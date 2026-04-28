import { overlayManager } from './modules/translation-overlay';
import { progressReporter } from './modules/progress-reporter';
import {
  detectPixivMode,
  getPixivArtworkId,
  getPixivPages,
  type PixivMangaPage
} from './modules/pixiv-detector';
import type { PixivVisionTranslationItem } from './modules/zhipu-vision-client';

interface MangaLensState {
  isEnabled: boolean;
  zhipuApiKey: string;
  zhipuVisionModel: string;
  processedPages: Set<string>;
  processingPages: Set<string>;
  queuedPages: Set<string>;
  failedPages: Map<string, number>;
  cache: Map<string, PixivVisionTranslationItem[]>;
  pageGeneration: number;
}

interface ActiveTaskInfo {
  label: string;
  pageIndex: number;
  startedAt: number;
  status: string;
}

const FAILED_PAGE_COOLDOWN_MS = 2000;
const SCROLL_IDLE_MS = 650;
const MAX_CONCURRENT_TRANSLATIONS = 4;
const WORKER_STAGGER_MS = 450;

const state: MangaLensState = {
  isEnabled: true,
  zhipuApiKey: '',
  zhipuVisionModel: 'glm-4.6v',
  processedPages: new Set(),
  processingPages: new Set(),
  queuedPages: new Set(),
  failedPages: new Map(),
  cache: new Map(),
  pageGeneration: 0
};

let scrollTimer: number | undefined;
let routeTimer: number | undefined;
let timerPanelInterval: number | undefined;
let lastUrl = location.href;
let activeWorkers = 0;
let workerLaunchCount = 0;
const pageQueue: PixivMangaPage[] = [];
const activeTasks = new Map<string, ActiveTaskInfo>();

function isPixivArtworkPage(): boolean {
  return /(?:^|\.)pixiv\.net$/i.test(location.hostname) && !!getPixivArtworkId();
}

function pageLabel(page: PixivMangaPage): string {
  return `${page.artworkId} p${page.pageIndex + 1}`;
}

function formatSeconds(ms: number): string {
  return `${Math.max(0, ms / 1000).toFixed(1)}s`;
}

function currentPageTotal(): number {
  return getPixivPages().length || 1;
}

function completedCount(): number {
  return state.processedPages.size;
}

function getImageUrlsForModel(page: PixivMangaPage): string[] {
  return [page.previewUrl, page.originalUrl].filter((url): url is string => !!url);
}

function isCoolingDown(page: PixivMangaPage): boolean {
  const lastFailedAt = state.failedPages.get(page.cacheKey);
  return !!lastFailedAt && Date.now() - lastFailedAt < FAILED_PAGE_COOLDOWN_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getTimerSummary(): string {
  const now = Date.now();
  const active = [...activeTasks.values()]
    .sort((a, b) => a.pageIndex - b.pageIndex)
    .map((task) => `${task.label} ${task.status} ${formatSeconds(now - task.startedAt)}`);

  const queued = pageQueue.slice(0, 8).map((page) => `p${page.pageIndex + 1}`);
  const activePart = active.length > 0 ? `处理中：${active.join(' ｜ ')}` : '处理中：无';
  const queuedPart = queued.length > 0 ? `等待：${queued.join('，')}${pageQueue.length > queued.length ? ` 等${pageQueue.length}页` : ''}` : '等待：无';
  return `${activePart}\n${queuedPart}`;
}

function getActivePageSummaries(): string[] {
  const now = Date.now();
  return [...activeTasks.values()]
    .sort((a, b) => a.pageIndex - b.pageIndex)
    .map((task) => `${task.label} ${task.status} ${formatSeconds(now - task.startedAt)}`);
}

function getQueuedPageSummaries(): string[] {
  return pageQueue.slice(0, 10).map((page) => `p${page.pageIndex + 1}`);
}

function emitProgress(update: Parameters<typeof progressReporter.update>[0]): void {
  progressReporter.update({
    ...update,
    concurrency: `${activeWorkers}/${MAX_CONCURRENT_TRANSLATIONS}`,
    timerSummary: getTimerSummary(),
    activePages: getActivePageSummaries(),
    queuedPages: getQueuedPageSummaries()
  });
}

function startTimerPanel(): void {
  if (timerPanelInterval) return;
  timerPanelInterval = window.setInterval(() => {
    if (activeTasks.size === 0 && pageQueue.length === 0) return;
    emitProgress({
      stage: 'translate',
      title: 'Pixiv 漫画页翻译进行中',
      detail: `并发 ${activeWorkers}/${MAX_CONCURRENT_TRANSLATIONS} · 完成 ${completedCount()}/${currentPageTotal()} 页`,
      imageTotal: currentPageTotal(),
      queueLength: pageQueue.length,
      translated: completedCount(),
      totalToTranslate: currentPageTotal(),
      source: 'pixiv-html-url',
      silentLog: true
    });
  }, 1000);
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
  if (!state.isEnabled) return;
  if (state.processedPages.has(page.cacheKey) || state.processingPages.has(page.cacheKey)) return;
  if (isCoolingDown(page)) return;

  if (!state.zhipuApiKey) {
    emitProgress({
      stage: 'error',
      title: '缺少智谱 API Key',
      detail: '请先在扩展设置中填写 API Key',
      error: 'zhipuApiKey is empty'
    });
    return;
  }

  if (!(await waitForImageReady(page.img))) {
    emitProgress({
      stage: 'skip',
      title: 'Pixiv 漫画图尚未加载完成',
      detail: pageLabel(page),
      imageIndex: page.pageIndex + 1,
      imageTotal: currentPageTotal(),
      queueLength: pageQueue.length,
      warning: 'naturalWidth/naturalHeight 为空'
    });
    return;
  }

  const cached = state.cache.get(page.cacheKey);
  if (cached) {
    const overlayIds = overlayManager.renderPixivVisionItems(page.img, cached);
    state.processedPages.add(page.cacheKey);
    emitProgress({
      stage: 'done',
      title: '已使用缓存渲染 Pixiv 漫画页',
      detail: pageLabel(page),
      imageIndex: page.pageIndex + 1,
      imageTotal: currentPageTotal(),
      queueLength: pageQueue.length,
      source: 'cache',
      dialogs: cached.length,
      rendered: overlayIds.length,
      translated: completedCount(),
      totalToTranslate: currentPageTotal()
    });
    await updatePopupStatus();
    return;
  }

  const startedAt = Date.now();
  state.processingPages.add(page.cacheKey);
  activeTasks.set(page.cacheKey, {
    label: `p${page.pageIndex + 1}`,
    pageIndex: page.pageIndex,
    startedAt,
    status: '准备'
  });

  try {
    emitProgress({
      stage: 'image-source',
      title: '从 Pixiv HTML 容器读取漫画图',
      detail: `${pageLabel(page)} · 并发 ${activeWorkers}/${MAX_CONCURRENT_TRANSLATIONS}`,
      imageIndex: page.pageIndex + 1,
      imageTotal: currentPageTotal(),
      queueLength: pageQueue.length,
      source: 'pixiv-html-url',
      translated: completedCount(),
      totalToTranslate: currentPageTotal()
    });

    const imageUrls = getImageUrlsForModel(page);
    if (imageUrls.length === 0) throw new Error('没有找到 Pixiv 漫画图片 URL');

    activeTasks.set(page.cacheKey, {
      label: `p${page.pageIndex + 1}`,
      pageIndex: page.pageIndex,
      startedAt,
      status: '生成中'
    });

    emitProgress({
      stage: 'translate',
      title: `等待 ${state.zhipuVisionModel} 返回结果`,
      detail: `${pageLabel(page)} · 已提交视觉翻译请求，模型生成中`,
      imageIndex: page.pageIndex + 1,
      imageTotal: currentPageTotal(),
      queueLength: pageQueue.length,
      source: 'pixiv-html-url',
      translated: completedCount(),
      totalToTranslate: currentPageTotal(),
      elapsedMs: Date.now() - startedAt
    });

    const response = await sendMessageToBackground<any>({
      target: 'background',
      type: 'TRANSLATE_PIXIV_IMAGE',
      imageUrl: imageUrls[0],
      imageUrls,
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
    activeTasks.set(page.cacheKey, {
      label: `p${page.pageIndex + 1}`,
      pageIndex: page.pageIndex,
      startedAt,
      status: '渲染中'
    });

    emitProgress({
      stage: 'render',
      title: '正在渲染 GLM-4.6V 译文',
      detail: `${response.sourceMessage || pageLabel(page)} · 识别 ${items.length} 段`,
      imageIndex: page.pageIndex + 1,
      imageTotal: currentPageTotal(),
      queueLength: pageQueue.length,
      source: response.source || 'pixiv-html-url',
      dialogs: items.length,
      translated: completedCount(),
      totalToTranslate: currentPageTotal(),
      elapsedMs: Date.now() - startedAt
    });

    const overlayIds = overlayManager.renderPixivVisionItems(page.img, items);
    state.cache.set(page.cacheKey, items);
    state.processedPages.add(page.cacheKey);
    state.failedPages.delete(page.cacheKey);

    activeTasks.delete(page.cacheKey);
    emitProgress({
      stage: 'done',
      title: 'Pixiv 漫画页翻译完成',
      detail: `${pageLabel(page)} · 已完成 ${completedCount()}/${currentPageTotal()} 页 · 本页 ${formatSeconds(Date.now() - startedAt)}`,
      imageIndex: page.pageIndex + 1,
      imageTotal: currentPageTotal(),
      queueLength: pageQueue.length,
      source: response.source || 'pixiv-html-url',
      dialogs: items.length,
      rendered: overlayIds.length,
      translated: completedCount(),
      totalToTranslate: currentPageTotal(),
      elapsedMs: Date.now() - startedAt
    });

    await updatePopupStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.failedPages.set(page.cacheKey, Date.now());
    activeTasks.delete(page.cacheKey);
    emitProgress({
      stage: 'error',
      title: 'Pixiv 漫画页翻译失败',
      detail: `${pageLabel(page)} · 2 秒后可重试`,
      imageIndex: page.pageIndex + 1,
      imageTotal: currentPageTotal(),
      queueLength: pageQueue.length,
      source: 'pixiv-html-url',
      error: message,
      elapsedMs: Date.now() - startedAt
    });
    console.error('[MangaLens] Pixiv 漫画页翻译失败:', error);
  } finally {
    state.processingPages.delete(page.cacheKey);
    activeTasks.delete(page.cacheKey);
  }
}

function enqueuePages(pages: PixivMangaPage[], reason: string): void {
  let added = 0;
  for (const page of pages) {
    if (state.processedPages.has(page.cacheKey)) continue;
    if (state.processingPages.has(page.cacheKey)) continue;
    if (state.queuedPages.has(page.cacheKey)) continue;
    if (isCoolingDown(page)) continue;

    pageQueue.push(page);
    state.queuedPages.add(page.cacheKey);
    added += 1;
  }

  if (added > 0) {
    emitProgress({
      stage: 'queued',
      title: 'Pixiv 漫画页已加入翻译队列',
      detail: `${reason} · 新增 ${added} 页 · 当前队列 ${pageQueue.length} 页 · 并发 ${MAX_CONCURRENT_TRANSLATIONS}`,
      imageTotal: currentPageTotal(),
      queueLength: pageQueue.length,
      translated: completedCount(),
      totalToTranslate: currentPageTotal(),
      source: 'pixiv-html-dom'
    });
  }

  void drainQueue();
}

async function drainQueue(): Promise<void> {
  while (state.isEnabled && activeWorkers < MAX_CONCURRENT_TRANSLATIONS && pageQueue.length > 0) {
    const page = pageQueue.shift();
    if (!page) continue;
    state.queuedPages.delete(page.cacheKey);

    const launchIndex = workerLaunchCount;
    workerLaunchCount += 1;
    activeWorkers += 1;

    void (async () => {
      if (launchIndex >= 2) {
        await sleep((launchIndex - 1) * WORKER_STAGGER_MS);
      }
      await translatePixivPage(page);
    })()
      .finally(() => {
        activeWorkers -= 1;
        void drainQueue();
      });
  }
}

function findTargetPages(): PixivMangaPage[] {
  if (!isPixivArtworkPage()) return [];

  const mode = detectPixivMode();
  const pages = getPixivPages();

  if (mode === 'reader') {
    return pages;
  }

  return pages.slice(0, 1);
}

async function processCurrentPixivTarget(reason: string): Promise<void> {
  if (!state.isEnabled) return;

  if (!isPixivArtworkPage()) {
    emitProgress({
      stage: 'skip',
      title: '当前页面不是 Pixiv 作品页',
      detail: location.href
    });
    return;
  }

  const pages = findTargetPages();
  const mode = detectPixivMode();
  emitProgress({
    stage: 'scan',
    title: '正在定位 Pixiv 漫画页',
    detail: `${mode} 模式 · ${reason} · 当前 HTML 中找到 ${pages.length} 张目标图`,
    imageTotal: pages.length || currentPageTotal(),
    queueLength: pageQueue.length,
    translated: completedCount(),
    totalToTranslate: pages.length || currentPageTotal(),
    source: 'pixiv-html-dom'
  });

  enqueuePages(pages, reason);
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
  activeWorkers = 0;
  workerLaunchCount = 0;
  pageQueue.length = 0;
  activeTasks.clear();
  state.queuedPages.clear();
  state.processingPages.clear();
  state.processedPages.clear();
  state.failedPages.clear();
  overlayManager.removeAllOverlays();
  emitProgress({
    stage: 'scan',
    title: 'Pixiv 页面状态已重置',
    detail: location.href,
    queueLength: 0,
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

    startTimerPanel();
    scheduleProcess('初始化', 1000);

    window.addEventListener('scroll', () => {
      overlayManager.schedulePositionSync();
      scheduleProcess('滚动停止');
    }, { passive: true });

    window.addEventListener('resize', () => {
      overlayManager.schedulePositionSync();
      scheduleProcess('窗口尺寸变化', 500);
    });

    const observer = new MutationObserver(() => {
      overlayManager.schedulePositionSync();
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
    emitProgress({
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
  if (timerPanelInterval) window.clearInterval(timerPanelInterval);
});
