import { imageDetector, type DetectedImage } from './modules/image-detector';
import { mangaOCR } from './modules/ocr-engine';
import { overlayManager } from './modules/translation-overlay';
import { DialogMerger, type OCRTextItem } from './modules/dialog-merger';
import { BatchTranslator } from './modules/batch-translator';

interface MangaLensState {
  isEnabled: boolean;
  isProcessing: boolean;
  processedImages: Set<string>;
  processingImages: Set<string>;
  failedImages: Map<string, number>;
  zhipuApiKey: string;
  zhipuTranslationModel: string;
  zhipuOcrModel: string;
  pageGeneration: number;
}

const FAILED_IMAGE_COOLDOWN_MS = 15000;
const IMAGE_PROCESS_DELAY_MS = 250;
const MAX_IMAGES_PER_SCAN = 6;
const PROCESS_QUEUE_CONCURRENCY = 1;

const state: MangaLensState = {
  isEnabled: true,
  isProcessing: false,
  processedImages: new Set(),
  processingImages: new Set(),
  failedImages: new Map(),
  zhipuApiKey: '',
  zhipuTranslationModel: 'glm-4.7',
  zhipuOcrModel: 'glm-ocr',
  pageGeneration: 0
};

let scanTimer: number | undefined;
let activeWorkers = 0;
const processQueue: DetectedImage[] = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function getImageSrc(image: DetectedImage, imageElement: HTMLImageElement): string {
  return image.src || imageElement.currentSrc || imageElement.src || imageElement.dataset.src || imageElement.dataset.lazySrc || '';
}

function isProbablyVisible(imageElement: HTMLImageElement): boolean {
  const rect = imageElement.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 80) return false;

  const margin = Math.max(window.innerHeight * 1.5, 900);
  return rect.bottom > -margin && rect.top < window.innerHeight + margin;
}

function buildFallbackDetectedImage(img: HTMLImageElement): DetectedImage {
  const rect = img.getBoundingClientRect();
  return {
    element: img,
    src: img.currentSrc || img.src || img.dataset.src || img.dataset.lazySrc || '',
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

async function waitForImageReady(imageElement: HTMLImageElement): Promise<boolean> {
  if (imageElement.complete && imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0) {
    return true;
  }

  await Promise.race([
    imageElement.decode?.().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 2500))
  ]);

  return imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0;
}

function createMergerForPage(): DialogMerger {
  const isPixiv = /(?:^|\.)pixiv\.net$/i.test(location.hostname);
  return new DialogMerger({
    yThreshold: isPixiv ? 42 : 50,
    xThreshold: isPixiv ? 90 : 150,
    rtlMode: true,
    bubblePadding: isPixiv ? 3 : 8,
    maxMergeDistance: isPixiv ? 220 : 300
  });
}

async function processImage(image: DetectedImage, generation = state.pageGeneration): Promise<void> {
  const imageElement = asImageElement(image.element);
  if (!imageElement) return;

  if (!isProbablyVisible(imageElement)) return;
  if (!(await waitForImageReady(imageElement))) return;

  const imageSrc = getImageSrc(image, imageElement);
  if (!imageSrc) return;
  if (state.processedImages.has(imageSrc) || state.processingImages.has(imageSrc)) return;

  const lastFailedAt = state.failedImages.get(imageSrc);
  if (lastFailedAt && Date.now() - lastFailedAt < FAILED_IMAGE_COOLDOWN_MS) return;

  if (!state.zhipuApiKey) {
    console.error('[MangaLens] 未配置智谱 API Key，请先在扩展设置中填写。');
    return;
  }

  state.processingImages.add(imageSrc);

  try {
    showLoading('正在识别文字...');
    const ocrResult = await mangaOCR.recognize(imageElement);
    if (generation !== state.pageGeneration || !state.isEnabled) return;
    if (ocrResult.boxes.length === 0) {
      state.processedImages.add(imageSrc);
      return;
    }

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

    const merger = createMergerForPage();
    let mergedDialogs = merger.merge(ocrItems);
    mergedDialogs = merger.calculateAllBubbleBounds(
      mergedDialogs,
      imageElement.naturalWidth || imageElement.width,
      imageElement.naturalHeight || imageElement.height
    );

    if (mergedDialogs.length === 0) {
      state.processedImages.add(imageSrc);
      return;
    }

    showLoading(`正在翻译 ${mergedDialogs.length} 段对话...`);
    const translator = new BatchTranslator({
      apiKey: state.zhipuApiKey,
      model: state.zhipuTranslationModel,
      maxBatchSize: 40,
      temperature: 0.35
    });

    const translationResult = await translator.translateInBatches(
      mergedDialogs.map((dialog, index) => ({
        id: index,
        text: dialog.text
      })),
      (completed, total) => showLoading(`翻译进度: ${completed}/${total}`)
    );

    if (generation !== state.pageGeneration || !state.isEnabled) return;

    for (const item of translationResult.items) {
      const dialog = mergedDialogs[item.id];
      if (!dialog) continue;

      dialog.translatedText = item.translatedText || item.originalText;
      dialog.translationSuccess = item.success;
    }

    showLoading('正在渲染译文...');
    overlayManager.renderMergedDialogs(imageElement, mergedDialogs, {
      horizontalText: true,
      fontSize: 14,
      background: '#FFFFFF',
      backgroundOpacity: 0.86,
      padding: 3
    });

    state.processedImages.add(imageSrc);
    state.failedImages.delete(imageSrc);
    await updatePopupStatus();
  } catch (error) {
    state.failedImages.set(imageSrc, Date.now());
    console.error('[MangaLens] 图片处理失败:', error);
  } finally {
    state.processingImages.delete(imageSrc);
    hideLoading();
  }
}

function enqueueImages(images: DetectedImage[]): void {
  const existing = new Set(processQueue.map((item) => item.src));
  const candidates = images
    .filter((image) => {
      const img = asImageElement(image.element);
      if (!img) return false;
      const src = getImageSrc(image, img);
      return src && !existing.has(src) && !state.processedImages.has(src) && !state.processingImages.has(src);
    })
    .sort((a, b) => a.position.y - b.position.y)
    .slice(0, MAX_IMAGES_PER_SCAN);

  processQueue.push(...candidates);
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (activeWorkers >= PROCESS_QUEUE_CONCURRENCY) return;
  if (!state.isEnabled) return;

  activeWorkers += 1;
  const generation = state.pageGeneration;

  try {
    while (processQueue.length > 0 && state.isEnabled && generation === state.pageGeneration) {
      const image = processQueue.shift();
      if (!image) continue;
      await processImage(image, generation);
      await sleep(IMAGE_PROCESS_DELAY_MS);
    }
  } finally {
    activeWorkers -= 1;
  }
}

function scheduleScan(delay = 400): void {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    if (!state.isEnabled) return;
    enqueueImages(imageDetector.detectMangaImages());
  }, delay);
}

async function processAllImages(): Promise<void> {
  if (state.isProcessing) return;

  state.isProcessing = true;
  showLoading('正在扫描页面图片...');

  try {
    enqueueImages(imageDetector.detectMangaImages());
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

function resetPageState(): void {
  state.pageGeneration += 1;
  processQueue.length = 0;
  state.processingImages.clear();
  state.processedImages.clear();
  state.failedImages.clear();
  overlayManager.removeAllOverlays();
}

async function initialize(): Promise<void> {
  try {
    await loadConfig();

    setTimeout(() => {
      if (state.isEnabled) {
        scheduleScan(0);
      }
    }, 1200);

    const cleanup = imageDetector.observeNewImages((images) => {
      if (!state.isEnabled) return;
      enqueueImages(images);
    });

    window.addEventListener('scroll', () => scheduleScan(350), { passive: true });
    window.addEventListener('resize', () => {
      if (!state.isEnabled) return;
      overlayManager.removeAllOverlays();
      state.processedImages.clear();
      scheduleScan(350);
    });
    window.addEventListener('beforeunload', cleanup);

    // Pixiv 是 SPA，作品页切换 #p 或路由时不会完整刷新，需要主动重扫。
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      resetPageState();
      scheduleScan(900);
    }, 1000);

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
    if (img.src === imageSrc || img.currentSrc === imageSrc) {
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
        resetPageState();
      } else {
        scheduleScan(0);
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
      resetPageState();
      scheduleScan(0);
      sendResponse({ success: true });
      break;

    case 'SELECT_IMAGE':
      selectImageManually();
      sendResponse({ success: true });
      break;

    case 'RERENDER_IMAGE':
      state.processedImages.delete(message.imageSrc);
      state.failedImages.delete(message.imageSrc);
      scheduleScan(0);
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
