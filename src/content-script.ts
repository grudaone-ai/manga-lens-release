import { overlayManager } from './modules/translation-overlay';
import { progressReporter } from './modules/progress-reporter';
import {
  detectPixivMode,
  getCurrentVisiblePixivPage,
  getPixivArtworkId,
  getPixivPages,
  type PixivMangaPage
} from './modules/pixiv-detector';
import type { PixivVisionTranslationItem } from './modules/zhipu-vision-client';

interface MangaLensState {
  isEnabled: boolean;
  isProcessing: boolean;
  zhipuApiKey: string;
  zhipuVisionModel: string;
  processedPages: Set<string>;
  processingPages: Set<string>;
  failedPages: Map<string, number>;
  cache: Map<string, PixivVisionTranslationItem[]>;
  pageGeneration: number;
}

const FAILED_PAGE_COOLDOWN_MS = 30000;
const SCROLL_IDLE_MS = 650;
const AUTO_PREFETCH_NEXT_PAGE = false;

const state: MangaLensState = {
  isEnabled: true,
  isProcessing: false,
  zhipuApiKey: '',
  zhipuVisionModel: 'glm-4.6v',
  processedPages: new Set(),
  processingPages: new Set(),
  failedPages: new Map(),
  cache: new Map(),
  pageGeneration: 0
};

let scrollTimer: number | undefined;
let routeTimer: number | undefined;
let lastUrl = location.href;

function isPixivArtworkPage(): boolean {
  return /(?:^|\.)pixiv\.net$/i.test(location.hostname) && !!getPixivArtworkId();
}

function pageLabel(page: PixivMangaPage): string {
  return `${page.artworkId} p${page.pageIndex + 1}`;
}

function getImageUrlForModel(page: PixivMangaPage): string {
  // Pixiv reader anchors expose img-original in href. Use original first because it is clearer
  // than the display-size master image, but fall back to preview when original is absent.
  return page.originalUrl || page.previewUrl;
}

function sendMessageToBackground<T = any>(message: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response as T);
    });
  });
}

async function updatePopupStatus(): Promise<void> {
  try {
    chrome.runtime.sendMessage({
      type: 'UPDATE_STATUS',
      processedCount: state.processedPages.size,
      cacheSize: state.cache.size
    });
  } catch {
    // Popup may be closed.
  }
}

async function waitForImageReady(img: HTMLImageElement): Promise<boolean> {
  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) return true;

  await Promise.race([
    img.decode?.().catch(() => undefined),
    new Promise((resolve) => window.setTimeout(resolve, 3000))
  ]);

  return img.naturalWidth > 0 && img.naturalHeight > 0;
}

async function translatePixivPage(page: PixivMangaPage, generation = state.pageGeneration): Promise<void> {
  if (!state.isEnabled || state.isProcessing) return;
  if (state.processedPages.has(page.cacheKey) || state.processingPages.has(page.cacheKey)) return;

  const lastFailedAt = state.failedPages.get(page.cacheKey);
  if (lastFailedAt && Date.now() - lastFailedAt < FAILED_PAGE_COOLDOWN_MS) {
    progressReporter.update({
      stage: 'skip',
      title: '当前漫画页处于失败冷却中',
      detail: pageLabel(page),
      warning: '30 秒内不重复请求失败页'
    });
    return;
  }

  if (!state.zhipuApiKey) {
    progressReporter.update({
      stage: 'error',
      title: '缺少智谱 API Key',
      detail: '请先在扩展设置中填写 API Key',
      error: 'zhipuApiKey is empty'
    });
    return;
  }

  if (!(await waitForImageReady(page.img))) {
    progressReporter.update({
      stage: 'skip',
      title: 'Pixiv 漫画图尚未加载完成',
      detail: pageLabel(page),
      warning: 'naturalWidth/naturalHeight 为空'
    });
    return;
  }

  const cached = state.cache.get(page.cacheKey);
  if (cached) {
    const overlayIds = overlayManager.renderPixivVisionItems(page.img, cached);
    state.processedPages.add(page.cacheKey);
    progressReporter.update({
      stage: 'done',
      title: '已使用缓存渲染 Pixiv 漫画页',
      detail: pageLabel(page),
      source: 'cache',
      dialogs: cached.length,
      rendered: overlayIds.length
    });
    await updatePopupStatus();
    return;
  }

  const startedAt = Date.now();
  state.isProcessing = true;
  state.processingPages.add(page.cacheKey);

  try {
    progressReporter.update({
      stage: 'image-source',
      title: '从 Pixiv HTML 容器读取漫画图',
      detail: `${pageLabel(page)} · ${detectPixivMode()} 模式`,
      source: 'pixiv-html-url'
    });

    const imageUrl = getImageUrlForModel(page);
    if (!imageUrl) throw new Error('没有找到 Pixiv 漫画图片 URL');

    progressReporter.update({
      stage: 'translate',
      title: `正在调用 ${state.zhipuVisionModel} 识别并翻译`,
      detail: pageLabel(page),
      source: 'pixiv-html-url',
      elapsedMs: Date.now() - startedAt
    });

    const response = await sendMessageToBackground<any>({
      target: 'background',
      type: 'TRANSLATE_PIXIV_IMAGE',
      imageUrl,
      pageUrl: location.href,
      apiKey: state.zhipuApiKey,
      model: state.zhipuVisionModel,
      artworkId: page.artworkId,
      pageIndex: page.pageIndex
    });

    if (generation !== state.pageGeneration || !state.isEnabled) return;
    if (!response?.success) {
      throw new Error(response?.message || 'GLM-4.6V Pixiv 漫画翻译失败');
    }

    const items = (response.items || []) as PixivVisionTranslationItem[];
    progressReporter.update({
      stage: 'render',
      title: '正在渲染 GLM-4.6V 译文',
      detail: response.sourceMessage || pageLabel(page),
      source: response.source || 'pixiv-html-url',
      dialogs: items.length,
      elapsedMs: Date.now() - startedAt
    });

    const overlayIds = overlayManager.renderPixivVisionItems(page.img, items);
    state.cache.set(page.cacheKey, items);
    state.processedPages.add(page.cacheKey);
    state.failedPages.delete(page.cacheKey);

    progressReporter.update({
      stage: 'done',
      title: 'Pixiv 漫画页翻译完成',
      detail: pageLabel(page),
      source: response.source || 'pixiv-html-url',
      dialogs: items.length,
      rendered: overlayIds.length,
      elapsedMs: Date.now() - startedAt
    });

    await updatePopupStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.failedPages.set(page.cacheKey, Date.now());
    progressReporter.update({
      stage: 'error',
      title: 'Pixiv 漫画页翻译失败',
      detail: pageLabel(page),
      source: 'pixiv-html-url',
      error: message,
      elapsedMs: Date.now() - startedAt
    });
    console.error('[MangaLens] Pixiv 漫画页翻译失败:', error);
  } finally {
    state.isProcessing = false;
    state.processingPages.delete(page.cacheKey);
  }
}

function findTargetPages(): PixivMangaPage[] {
  if (!isPixivArtworkPage()) return [];

  const mode = detectPixivMode();
  const pages = getPixivPages();

  if (mode === 'reader') {
    const current = getCurrentVisiblePixivPage(pages);
    if (!current) return [];

    if (!AUTO_PREFETCH_NEXT_PAGE) return [current];
    const next = pages.find((page) => page.pageIndex === current.pageIndex + 1);
    return next ? [current, next] : [current];
  }

  // Detail page: intentionally translate only the visible p0 preview image. Recommended works,
  // author gallery, comments, avatars and ads are excluded by artworkId + page filtering.
  return pages.slice(0, 1);
}

async function processCurrentPixivTarget(reason: string): Promise<void> {
  if (!state.isEnabled || state.isProcessing) return;

  if (!isPixivArtworkPage()) {
    progressReporter.update({
      stage: 'skip',
      title: '当前页面不是 Pixiv 作品页',
      detail: location.href
    });
    return;
  }

  const pages = findTargetPages();
  const mode = detectPixivMode();
  progressReporter.update({
    stage: 'scan',
    title: '正在定位 Pixiv 漫画页',
    detail: `${mode} 模式 · ${reason} · 找到 ${pages.length} 张目标图`,
    source: 'pixiv-html-dom'
  });

  const page = pages.find((candidate) => !state.processedPages.has(candidate.cacheKey)) || pages[0];
  if (!page) return;

  await translatePixivPage(page);
}

function scheduleProcess(reason: string, delay = SCROLL_IDLE_MS): void {
  window.clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(() => {
    void processCurrentPixivTarget(reason);
  }, delay);
}

async function loadConfig(): Promise<void> {
  const stored = await chrome.storage.local.get([
    'zhipuApiKey',
    'zhipuVisionModel',
    'zhipuTranslationModel',
    'isEnabled'
  ]);

  state.zhipuApiKey = stored.zhipuApiKey || '';
  state.zhipuVisionModel = stored.zhipuVisionModel || stored.zhipuTranslationModel || 'glm-4.6v';
  state.isEnabled = stored.isEnabled !== false;
}

function resetPageState(): void {
  state.pageGeneration += 1;
  state.isProcessing = false;
  state.processedPages.clear();
  state.processingPages.clear();
  state.failedPages.clear();
  overlayManager.removeAllOverlays();
  progressReporter.update({
    stage: 'scan',
    title: 'Pixiv 页面状态已重置',
    detail: location.href,
    source: 'pixiv-html-dom'
  });
}

async function initialize(): Promise<void> {
  try {
    await loadConfig();

    if (!isPixivArtworkPage()) {
      console.log('[MangaLens] 非 Pixiv 作品页，Pixiv 专用翻译器未启动');
      return;
    }

    scheduleProcess('初始化', 1000);

    window.addEventListener('scroll', () => scheduleProcess('滚动停止'), { passive: true });
    window.addEventListener('resize', () => {
      overlayManager.removeAllOverlays();
      state.processedPages.clear();
      scheduleProcess('窗口尺寸变化', 500);
    });

    const observer = new MutationObserver(() => {
      // Pixiv is a SPA. Do not process every mutation immediately; just run once after DOM settles.
      scheduleProcess('Pixiv DOM 更新', 900);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('beforeunload', () => observer.disconnect());

    routeTimer = window.setInterval(() => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      resetPageState();
      scheduleProcess('Pixiv 路由变化', 1000);
    }, 1000);

    console.log('[MangaLens] Pixiv GLM-4.6V translator initialized');
  } catch (error) {
    progressReporter.update({
      stage: 'error',
      title: 'MangaLens Pixiv 初始化失败',
      error: error instanceof Error ? error.message : String(error)
    });
    console.error('[MangaLens] 初始化失败:', error);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'TOGGLE_ENABLED':
      state.isEnabled = message.enabled;
      if (!state.isEnabled) {
        resetPageState();
      } else {
        scheduleProcess('重新开启', 0);
      }
      sendResponse({ success: true });
      break;

    case 'CONFIGURE_ZHIPU_API':
      state.zhipuApiKey = message.zhipuApiKey || '';
      state.zhipuVisionModel = message.zhipuVisionModel || message.zhipuTranslationModel || 'glm-4.6v';
      sendResponse({ success: true });
      break;

    case 'REFRESH':
      resetPageState();
      scheduleProcess('手动刷新', 0);
      sendResponse({ success: true });
      break;

    case 'SELECT_IMAGE':
      // Manual selection is intentionally removed. Pixiv pages are selected from HTML containers only.
      scheduleProcess('从 Pixiv HTML 当前容器重新选择', 0);
      sendResponse({ success: true });
      break;

    case 'GET_STATUS':
      sendResponse({
        isEnabled: state.isEnabled,
        processedCount: state.processedPages.size,
        cacheSize: state.cache.size
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

window.addEventListener('beforeunload', () => {
  if (routeTimer) window.clearInterval(routeTimer);
});
