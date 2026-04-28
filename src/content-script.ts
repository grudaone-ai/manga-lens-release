import { imageDetector, type DetectedImage } from './modules/image-detector';
import { mangaOCR } from './modules/ocr-engine';
import { overlayManager } from './modules/translation-overlay';
import { DialogMerger, type OCRTextItem } from './modules/dialog-merger';
import { BatchTranslator } from './modules/batch-translator';
import { progressReporter } from './modules/progress-reporter';

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
let totalEnqueuedInGeneration = 0;
const processQueue: DetectedImage[] = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asImageElement(element: HTMLElement): HTMLImageElement | null {
  if (element instanceof HTMLImageElement) return element;
  const nested = element.querySelector('img');
  return nested instanceof HTMLImageElement ? nested : null;
}

function getImageSrc(image: DetectedImage, imageElement: HTMLImageElement): string {
  return image.src || imageElement.currentSrc || imageElement.src || imageElement.dataset.src || imageElement.dataset.lazySrc || '';
}

function shortImageName(src: string): string {
  try {
    const url = new URL(src);
    const name = url.pathname.split('/').pop() || url.hostname;
    return `${url.hostname}/${name}`;
  } catch {
    return src.slice(0, 80);
  }
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

  const imageSrc = getImageSrc(image, imageElement);
  const imageIndex = Math.min(totalEnqueuedInGeneration, state.processedImages.size + state.processingImages.size + 1);
  const startedAt = Date.now();

  if (!isProbablyVisible(imageElement)) {
    progressReporter.update({
      stage: 'skip',
      title: '跳过不可见图片',
      detail: imageSrc ? shortImageName(imageSrc) : '图片不在当前页面附近',
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length
    });
    return;
  }

  progressReporter.update({
    stage: 'image-ready',
    title: '等待图片加载完成',
    detail: imageSrc ? shortImageName(imageSrc) : '读取页面图片元素',
    imageIndex,
    imageTotal: totalEnqueuedInGeneration,
    queueLength: processQueue.length
  });

  if (!(await waitForImageReady(imageElement))) {
    progressReporter.update({
      stage: 'skip',
      title: '图片尚未加载完成，已跳过',
      detail: imageSrc ? shortImageName(imageSrc) : undefined,
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length,
      warning: 'naturalWidth/naturalHeight 为空'
    });
    return;
  }

  const resolvedSrc = getImageSrc(image, imageElement);
  if (!resolvedSrc) return;
  if (state.processedImages.has(resolvedSrc) || state.processingImages.has(resolvedSrc)) return;

  const lastFailedAt = state.failedImages.get(resolvedSrc);
  if (lastFailedAt && Date.now() - lastFailedAt < FAILED_IMAGE_COOLDOWN_MS) {
    progressReporter.update({
      stage: 'skip',
      title: '图片处于失败冷却中',
      detail: shortImageName(resolvedSrc),
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length,
      warning: '15 秒内不重复请求失败图片'
    });
    return;
  }

  if (!state.zhipuApiKey) {
    progressReporter.update({
      stage: 'error',
      title: '缺少智谱 API Key',
      detail: '请先在扩展设置中填写 API Key',
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length
    });
    console.error('[MangaLens] 未配置智谱 API Key，请先在扩展设置中填写。');
    return;
  }

  state.processingImages.add(resolvedSrc);

  try {
    progressReporter.update({
      stage: 'image-source',
      title: '获取图片数据并提交 OCR',
      detail: shortImageName(resolvedSrc),
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length,
      elapsedMs: Date.now() - startedAt
    });

    const ocrResult = await mangaOCR.recognize(imageElement);
    if (generation !== state.pageGeneration || !state.isEnabled) return;

    progressReporter.update({
      stage: 'ocr',
      title: 'OCR 识别完成',
      detail: ocrResult.sourceMessage || shortImageName(resolvedSrc),
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length,
      source: ocrResult.source || 'unknown',
      ocrBoxes: ocrResult.boxes.length,
      warning: ocrResult.warnings?.join('；'),
      elapsedMs: Date.now() - startedAt
    });

    if (ocrResult.boxes.length === 0) {
      state.processedImages.add(resolvedSrc);
      progressReporter.update({
        stage: 'done',
        title: 'OCR 未识别到文字',
        detail: shortImageName(resolvedSrc),
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        source: ocrResult.source || 'unknown',
        ocrBoxes: 0,
        elapsedMs: Date.now() - startedAt
      });
      return;
    }

    progressReporter.update({
      stage: 'merge',
      title: '正在合并 OCR 文本框',
      detail: `${ocrResult.boxes.length} 个文本框`,
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length,
      source: ocrResult.source || 'unknown',
      ocrBoxes: ocrResult.boxes.length,
      elapsedMs: Date.now() - startedAt
    });

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

    progressReporter.update({
      stage: 'merge',
      title: '文本框合并完成',
      detail: `${ocrResult.boxes.length} 个文本框 → ${mergedDialogs.length} 段对话`,
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length,
      source: ocrResult.source || 'unknown',
      ocrBoxes: ocrResult.boxes.length,
      dialogs: mergedDialogs.length,
      elapsedMs: Date.now() - startedAt
    });

    if (mergedDialogs.length === 0) {
      state.processedImages.add(resolvedSrc);
      return;
    }

    const translator = new BatchTranslator({
      apiKey: state.zhipuApiKey,
      model: state.zhipuTranslationModel,
      maxBatchSize: 40,
      temperature: 0.35
    });

    progressReporter.update({
      stage: 'translate',
      title: `正在翻译 ${mergedDialogs.length} 段对话`,
      detail: mergedDialogs[0]?.text?.slice(0, 40),
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length,
      source: ocrResult.source || 'unknown',
      ocrBoxes: ocrResult.boxes.length,
      dialogs: mergedDialogs.length,
      translated: 0,
      totalToTranslate: mergedDialogs.length,
      elapsedMs: Date.now() - startedAt
    });

    const translationResult = await translator.translateInBatches(
      mergedDialogs.map((dialog, index) => ({
        id: index,
        text: dialog.text
      })),
      (completed, total) => progressReporter.update({
        stage: 'translate',
        title: `正在翻译 ${total} 段对话`,
        detail: `已完成 ${completed}/${total}`,
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        source: ocrResult.source || 'unknown',
        ocrBoxes: ocrResult.boxes.length,
        dialogs: mergedDialogs.length,
        translated: completed,
        totalToTranslate: total,
        elapsedMs: Date.now() - startedAt
      })
    );

    if (generation !== state.pageGeneration || !state.isEnabled) return;

    for (const item of translationResult.items) {
      const dialog = mergedDialogs[item.id];
      if (!dialog) continue;

      dialog.translatedText = item.translatedText || item.originalText;
      dialog.translationSuccess = item.success;
    }

    progressReporter.update({
      stage: 'render',
      title: '正在渲染译文覆盖层',
      detail: `翻译成功 ${translationResult.successCount} 段，失败 ${translationResult.failureCount} 段`,
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length,
      source: ocrResult.source || 'unknown',
      ocrBoxes: ocrResult.boxes.length,
      dialogs: mergedDialogs.length,
      translated: translationResult.successCount,
      totalToTranslate: mergedDialogs.length,
      elapsedMs: Date.now() - startedAt
    });

    const overlayIds = overlayManager.renderMergedDialogs(imageElement, mergedDialogs, {
      horizontalText: true,
      fontSize: 14,
      background: '#FFFFFF',
      backgroundOpacity: 0.86,
      padding: 3
    });

    state.processedImages.add(resolvedSrc);
    state.failedImages.delete(resolvedSrc);
    await updatePopupStatus();

    progressReporter.update({
      stage: 'done',
      title: '当前图片翻译完成',
      detail: shortImageName(resolvedSrc),
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length,
      source: ocrResult.source || 'unknown',
      ocrBoxes: ocrResult.boxes.length,
      dialogs: mergedDialogs.length,
      translated: translationResult.successCount,
      totalToTranslate: mergedDialogs.length,
      rendered: overlayIds.length,
      warning: ocrResult.source === 'visible-tab-capture' ? '当前使用截图 OCR，滚动或切换阅读模式时可能错位' : undefined,
      elapsedMs: Date.now() - startedAt
    });
  } catch (error) {
    state.failedImages.set(resolvedSrc, Date.now());
    const message = error instanceof Error ? error.message : String(error);
    progressReporter.update({
      stage: 'error',
      title: '图片处理失败',
      detail: shortImageName(resolvedSrc),
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length,
      error: message,
      elapsedMs: Date.now() - startedAt
    });
    console.error('[MangaLens] 图片处理失败:', error);
  } finally {
    state.processingImages.delete(resolvedSrc);
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

  if (candidates.length === 0) return;

  processQueue.push(...candidates);
  totalEnqueuedInGeneration = Math.max(totalEnqueuedInGeneration, state.processedImages.size + state.processingImages.size + processQueue.length);

  progressReporter.update({
    stage: 'queued',
    title: '已加入图片翻译队列',
    detail: `新增 ${candidates.length} 张候选图片`,
    imageTotal: totalEnqueuedInGeneration,
    queueLength: processQueue.length
  });

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
    progressReporter.update({
      stage: 'scan',
      title: '正在扫描页面图片',
      detail: location.hostname,
      queueLength: processQueue.length
    });
    enqueueImages(imageDetector.detectMangaImages());
  }, delay);
}

async function processAllImages(): Promise<void> {
  if (state.isProcessing) return;

  state.isProcessing = true;
  progressReporter.update({
    stage: 'scan',
    title: '正在扫描页面图片',
    detail: location.href,
    queueLength: processQueue.length
  });

  try {
    enqueueImages(imageDetector.detectMangaImages());
  } finally {
    state.isProcessing = false;
  }
}

async function selectImageManually(): Promise<void> {
  const image = await imageDetector.selectImage();
  if (image) {
    totalEnqueuedInGeneration = Math.max(totalEnqueuedInGeneration, state.processedImages.size + 1);
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
  totalEnqueuedInGeneration = 0;
  state.processingImages.clear();
  state.processedImages.clear();
  state.failedImages.clear();
  overlayManager.removeAllOverlays();
  progressReporter.update({
    stage: 'scan',
    title: '页面状态已重置，准备重新扫描',
    detail: location.href,
    queueLength: 0
  });
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
      totalEnqueuedInGeneration = processQueue.length;
      scheduleScan(350);
    });
    window.addEventListener('beforeunload', cleanup);

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
    progressReporter.update({
      stage: 'error',
      title: 'MangaLens 初始化失败',
      error: error instanceof Error ? error.message : String(error)
    });
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
