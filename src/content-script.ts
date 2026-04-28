import { imageDetector, type DetectedImage } from './modules/image-detector';
import { mangaOCR } from './modules/ocr-engine';
import { overlayManager } from './modules/translation-overlay';
import { DialogMerger, type OCRTextItem } from './modules/dialog-merger';
import { BatchTranslator } from './modules/batch-translator';

interface MangaLensState {
  isEnabled: boolean;
  isProcessing: boolean;
  processedImages: Set<string>;
  failedImages: Map<string, number>;
  zhipuApiKey: string;
  zhipuTranslationModel: string;
  zhipuOcrModel: string;
}

const FAILED_IMAGE_COOLDOWN_MS = 15000;

const state: MangaLensState = {
  isEnabled: true,
  isProcessing: false,
  processedImages: new Set(),
  failedImages: new Map(),
  zhipuApiKey: '',
  zhipuTranslationModel: 'glm-4.7',
  zhipuOcrModel: 'glm-ocr'
};

function showLoading(message: string): void {
  const existing = document.getElementById('manga-lens-loading');
  if (existing) existing.remove();

  const loader = document.createElement('div');
  loader.id = 'manga-lens-loading';
  loader.className = 'manga-lens-loading';
  loader.textContent = `MangaLens: ${message}`;
  document.body.appendChild(loader);
}

function hideLoading(): void {
  document.getElementById('manga-lens-loading')?.remove();
}

function asImageElement(element: HTMLElement): HTMLImageElement | null {
  if (element instanceof HTMLImageElement) return element;
  const nested = element.querySelector('img');
  return nested instanceof HTMLImageElement ? nested : null;
}

function buildFallbackDetectedImage(img: HTMLImageElement): DetectedImage {
  const rect = img.getBoundingClientRect();
  return {
    element: img,
    src: img.src,
    position: {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    },
    aspectRatio: rect.width > 0 ? rect.height / rect.width : 1,
    isManga: true
  };
}

async function updatePopupStatus(): Promise<void> {
  try {
    chrome.runtime.sendMessage({
      type: 'UPDATE_STATUS',
      processedCount: state.processedImages.size,
      cacheSize: 0
    });
  } catch {
    // Popup may be closed.
  }
}

async function processImage(image: DetectedImage): Promise<void> {
  const imageElement = asImageElement(image.element);
  if (!imageElement) return;

  const imageSrc = image.src || imageElement.src;
  if (state.processedImages.has(imageSrc)) return;

  const lastFailedAt = state.failedImages.get(imageSrc);
  if (lastFailedAt && Date.now() - lastFailedAt < FAILED_IMAGE_COOLDOWN_MS) return;

  if (!state.zhipuApiKey) {
    console.error('[MangaLens] 未配置智谱 API Key，请先在扩展设置中填写。');
    return;
  }

  try {
    showLoading('正在识别文字...');
    const ocrResult = await mangaOCR.recognize(imageElement);
    if (ocrResult.boxes.length === 0) return;

    showLoading('正在合并对话...');
    const ocrItems: OCRTextItem[] = ocrResult.boxes.map((box) => ({
      text: box.text,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      right: box.x + box.width,
      bottom: box.y + box.height,
      confidence: box.confidence || 1,
      isVertical: box.isVertical
    }));

    const merger = new DialogMerger({ yThreshold: 50, xThreshold: 150, rtlMode: true });
    let mergedDialogs = merger.merge(ocrItems);
    mergedDialogs = merger.calculateAllBubbleBounds(
      mergedDialogs,
      imageElement.naturalWidth || imageElement.width,
      imageElement.naturalHeight || imageElement.height
    );

    showLoading(`正在翻译 ${mergedDialogs.length} 段对话...`);
    const translator = new BatchTranslator({
      apiKey: state.zhipuApiKey,
      model: state.zhipuTranslationModel
    });

    const translationResult = await translator.translateInBatches(
      mergedDialogs.map((dialog, index) => ({
        id: index,
        text: dialog.text
      })),
      (completed, total) => showLoading(`翻译进度: ${completed}/${total}`)
    );

    for (const item of translationResult.items) {
      const dialog = mergedDialogs[item.id];
      if (!dialog) continue;

      dialog.translatedText = item.translatedText || item.originalText;
      dialog.translationSuccess = item.success;
    }

    showLoading('正在渲染译文...');
    overlayManager.renderMergedDialogs(imageElement, mergedDialogs, {
      horizontalText: false,
      fontSize: 14,
      background: '#FFFFFF',
      backgroundOpacity: 0.88,
      padding: 4
    });

    state.processedImages.add(imageSrc);
    state.failedImages.delete(imageSrc);
    await updatePopupStatus();
  } catch (error) {
    state.failedImages.set(imageSrc, Date.now());
    console.error('[MangaLens] 图片处理失败:', error);
  } finally {
    hideLoading();
  }
}

async function processAllImages(): Promise<void> {
  if (state.isProcessing) return;

  state.isProcessing = true;
  showLoading('正在扫描页面图片...');

  try {
    const images = imageDetector.detectMangaImages();
    for (const image of images) {
      await processImage(image);
    }
  } finally {
    state.isProcessing = false;
    hideLoading();
  }
}

async function selectImageManually(): Promise<void> {
  const image = await imageDetector.selectImage();
  if (image) {
    await processImage(image);
  }
}

async function loadConfig(): Promise<void> {
  const stored = await chrome.storage.local.get([
    'zhipuApiKey',
    'zhipuTranslationModel',
    'zhipuOcrModel',
    'isEnabled'
  ]);

  state.zhipuApiKey = stored.zhipuApiKey || '';
  state.zhipuTranslationModel = stored.zhipuTranslationModel || 'glm-4.7';
  state.zhipuOcrModel = stored.zhipuOcrModel || 'glm-ocr';
  state.isEnabled = stored.isEnabled !== false;

  if (state.zhipuApiKey) {
    await mangaOCR.configureZhipuAPI(
      state.zhipuApiKey,
      state.zhipuTranslationModel,
      state.zhipuOcrModel
    );
  } else {
    await mangaOCR.initialize();
  }
}

async function initialize(): Promise<void> {
  try {
    await loadConfig();

    setTimeout(async () => {
      if (state.isEnabled) {
        await processAllImages();
      }
    }, 1000);

    const cleanup = imageDetector.observeNewImages(async (images) => {
      if (!state.isEnabled) return;
      for (const image of images) {
        await processImage(image);
      }
    });

    window.addEventListener('beforeunload', cleanup);
    console.log('[MangaLens] Content script initialized with Zhipu API');
  } catch (error) {
    console.error('[MangaLens] 初始化失败:', error);
    hideLoading();
  }
}

window.addEventListener('manga-lens-rerender', async (event: Event) => {
  const customEvent = event as CustomEvent;
  const imageSrc = customEvent.detail?.imageSrc;
  if (!imageSrc) return;

  const images = document.querySelectorAll('img');
  for (const img of images) {
    if (img.src === imageSrc) {
      state.processedImages.delete(imageSrc);
      state.failedImages.delete(imageSrc);
      await processImage(buildFallbackDetectedImage(img));
      break;
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'TOGGLE_ENABLED':
      state.isEnabled = message.enabled;
      if (!state.isEnabled) {
        overlayManager.removeAllOverlays();
        state.processedImages.clear();
        state.failedImages.clear();
      } else {
        processAllImages();
      }
      sendResponse({ success: true });
      break;

    case 'CONFIGURE_ZHIPU_API':
      (async () => {
        state.zhipuApiKey = message.zhipuApiKey || '';
        state.zhipuTranslationModel = message.zhipuTranslationModel || 'glm-4.7';
        state.zhipuOcrModel = message.zhipuOcrModel || 'glm-ocr';
        await mangaOCR.configureZhipuAPI(
          state.zhipuApiKey,
          state.zhipuTranslationModel,
          state.zhipuOcrModel
        );
        sendResponse({ success: true });
      })();
      return true;

    case 'REFRESH':
      state.processedImages.clear();
      state.failedImages.clear();
      overlayManager.removeAllOverlays();
      processAllImages();
      sendResponse({ success: true });
      break;

    case 'SELECT_IMAGE':
      selectImageManually();
      sendResponse({ success: true });
      break;

    case 'RERENDER_IMAGE':
      state.processedImages.delete(message.imageSrc);
      state.failedImages.delete(message.imageSrc);
      processAllImages();
      sendResponse({ success: true });
      break;

    case 'GET_STATUS':
      sendResponse({
        isEnabled: state.isEnabled,
        processedCount: state.processedImages.size,
        cacheSize: 0
      });
      break;
  }

  return true;
});

if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}
