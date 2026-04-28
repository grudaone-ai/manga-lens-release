const DEFAULT_RENDER_CONFIG = {
  fontSize: 14,
  color: "#000000",
  background: "#FFFFFF",
  backgroundOpacity: 0.86,
  padding: 3
};
function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
function getDocumentRect(element) {
  const rect = element.getBoundingClientRect();
  return new DOMRect(
    rect.left + window.scrollX,
    rect.top + window.scrollY,
    rect.width,
    rect.height
  );
}
function hexToRgba(hex, alpha) {
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  const value = hex.replace("#", "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return `rgba(255,255,255,${alpha})`;
  }
  const normalized = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
class TranslationOverlayManager {
  container = null;
  overlays = /* @__PURE__ */ new Map();
  containerId = "manga-lens-overlay-container";
  overlayClass = "manga-lens-text-overlay";
  createContainer() {
    let existing = document.getElementById(this.containerId);
    if (!existing) {
      existing = document.createElement("div");
      existing.id = this.containerId;
      existing.style.cssText = [
        "position:absolute",
        "top:0",
        "left:0",
        "width:0",
        "height:0",
        "pointer-events:none",
        "z-index:2147483646",
        "overflow:visible",
        "contain:layout style"
      ].join(";");
      document.body.appendChild(existing);
    }
    this.container = existing;
    return existing;
  }
  removeAllOverlays() {
    this.overlays.forEach((overlay) => overlay.element.remove());
    this.overlays.clear();
    document.getElementById(this.containerId)?.remove();
    this.container = null;
  }
  removeOverlaysForImage(imageElement) {
    for (const [id, overlay] of this.overlays.entries()) {
      if (overlay.imageElement === imageElement) {
        overlay.element.remove();
        this.overlays.delete(id);
      }
    }
  }
  renderPixivVisionItems(imageElement, items, config) {
    this.removeOverlaysForImage(imageElement);
    const ids = [];
    for (const item of items) {
      ids.push(this.renderPixivVisionItem(imageElement, item, config));
    }
    console.log(`[Overlay] Pixiv 渲染完成: ${ids.length} 个覆盖层`);
    return ids;
  }
  renderPixivVisionItem(imageElement, item, config) {
    const cfg = { ...DEFAULT_RENDER_CONFIG, ...config };
    const container = this.container || this.createContainer();
    const id = `ml-overlay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const imageRect = getDocumentRect(imageElement);
    const [x1, y1, x2, y2] = item.bbox;
    let leftPx = imageRect.left + x1 / 1e3 * imageRect.width;
    let topPx = imageRect.top + y1 / 1e3 * imageRect.height;
    let widthPx = Math.max(18, (x2 - x1) / 1e3 * imageRect.width);
    let heightPx = Math.max(18, (y2 - y1) / 1e3 * imageRect.height);
    const text = item.translatedText;
    const estimatedWidth = clamp(text.length * (cfg.fontSize * 0.86), widthPx, imageRect.width * 0.58);
    const estimatedHeight = clamp(
      Math.ceil(text.length / Math.max(4, Math.floor(estimatedWidth / (cfg.fontSize * 0.9)))) * cfg.fontSize * 1.45,
      heightPx,
      imageRect.height * 0.24
    );
    leftPx -= (estimatedWidth - widthPx) / 2;
    topPx -= (estimatedHeight - heightPx) / 2;
    widthPx = estimatedWidth;
    heightPx = estimatedHeight;
    leftPx = clamp(leftPx, imageRect.left, Math.max(imageRect.left, imageRect.right - widthPx));
    topPx = clamp(topPx, imageRect.top, Math.max(imageRect.top, imageRect.bottom - heightPx));
    const overlay = document.createElement("div");
    overlay.id = id;
    overlay.className = this.overlayClass;
    overlay.textContent = text;
    overlay.dataset.original = item.sourceText || "";
    const bgWithOpacity = hexToRgba(cfg.background, cfg.backgroundOpacity);
    const fontSize = clamp(Math.round(Math.min(cfg.fontSize, widthPx / Math.max(4, Math.min(8, text.length)))), 10, cfg.fontSize);
    overlay.style.cssText = [
      "position:absolute",
      `left:${leftPx}px`,
      `top:${topPx}px`,
      `width:${widthPx}px`,
      `min-height:${heightPx}px`,
      `font-family:"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif`,
      `font-size:${fontSize}px`,
      "line-height:1.35",
      `color:${cfg.color}`,
      `background:${bgWithOpacity}`,
      `padding:${cfg.padding}px`,
      "margin:0",
      "border-radius:3px",
      "box-shadow:0 1px 3px rgba(0,0,0,0.12)",
      "text-shadow:0 0 2px rgba(255,255,255,0.85)",
      "word-break:break-word",
      "overflow-wrap:anywhere",
      "white-space:pre-wrap",
      "text-align:center",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "box-sizing:border-box",
      "pointer-events:none",
      "writing-mode:horizontal-tb"
    ].join(";");
    container.appendChild(overlay);
    this.overlays.set(id, {
      id,
      translatedText: text,
      element: overlay,
      imageElement
    });
    return id;
  }
  getOverlayCount() {
    return this.overlays.size;
  }
}
const overlayManager = new TranslationOverlayManager();
const PANEL_ID = "manga-lens-progress-panel";
const BODY_ID = "manga-lens-progress-body";
const TITLE_ID = "manga-lens-progress-title";
const SUBTITLE_ID = "manga-lens-progress-subtitle";
const BAR_ID = "manga-lens-progress-bar";
const LOG_ID = "manga-lens-progress-log";
const TOGGLE_ID = "manga-lens-progress-toggle";
const STAGE_LABEL = {
  idle: "待命",
  scan: "扫描",
  queued: "排队",
  "image-ready": "图片加载",
  "image-source": "图片获取",
  ocr: "OCR",
  merge: "合并",
  translate: "翻译",
  render: "渲染",
  done: "完成",
  skip: "跳过",
  error: "错误"
};
const STAGE_WEIGHT = {
  idle: 0,
  scan: 5,
  queued: 10,
  "image-ready": 18,
  "image-source": 30,
  ocr: 50,
  merge: 64,
  translate: 78,
  render: 92,
  done: 100,
  skip: 100,
  error: 100
};
function formatElapsed(ms) {
  if (!ms) return "";
  if (ms < 1e3) return `${ms}ms`;
  return `${(ms / 1e3).toFixed(1)}s`;
}
function escapeText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
class ProgressReporter {
  expanded = false;
  lastUpdate = null;
  logs = [];
  update(update) {
    this.lastUpdate = update;
    this.ensurePanel();
    const stage = STAGE_LABEL[update.stage] || update.stage;
    const elapsed = formatElapsed(update.elapsedMs);
    const parts = [stage];
    if (update.imageIndex && update.imageTotal) parts.push(`图片 ${update.imageIndex}/${update.imageTotal}`);
    if (update.queueLength !== void 0) parts.push(`队列 ${update.queueLength}`);
    if (elapsed) parts.push(`耗时 ${elapsed}`);
    const detailParts = [];
    if (update.source) detailParts.push(`来源: ${update.source}`);
    if (update.ocrBoxes !== void 0) detailParts.push(`OCR框: ${update.ocrBoxes}`);
    if (update.dialogs !== void 0) detailParts.push(`对话: ${update.dialogs}`);
    if (update.totalToTranslate !== void 0) detailParts.push(`翻译: ${update.translated || 0}/${update.totalToTranslate}`);
    if (update.rendered !== void 0) detailParts.push(`渲染: ${update.rendered}`);
    const panel = document.getElementById(PANEL_ID);
    const title = document.getElementById(TITLE_ID);
    const subtitle = document.getElementById(SUBTITLE_ID);
    const body = document.getElementById(BODY_ID);
    const bar = document.getElementById(BAR_ID);
    if (panel) {
      panel.dataset.stage = update.stage;
      panel.classList.toggle("is-expanded", this.expanded);
    }
    if (title) title.textContent = update.title;
    if (subtitle) subtitle.textContent = [parts.join(" · "), update.detail, detailParts.join(" · ")].filter(Boolean).join("\n");
    if (bar) bar.style.width = `${this.calculatePercent(update)}%`;
    if (body) {
      body.innerHTML = this.renderBody(update);
    }
    this.pushLog(update);
    this.renderLog();
  }
  clear(delayMs = 1200) {
    window.setTimeout(() => {
      const panel = document.getElementById(PANEL_ID);
      panel?.remove();
      this.lastUpdate = null;
      this.logs = [];
    }, delayMs);
  }
  calculatePercent(update) {
    if (update.stage === "translate" && update.totalToTranslate) {
      const local = Math.min(1, Math.max(0, (update.translated || 0) / update.totalToTranslate));
      return Math.round(68 + local * 20);
    }
    return STAGE_WEIGHT[update.stage] ?? 0;
  }
  ensurePanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="manga-lens-progress-header">
        <div>
          <div id="${TITLE_ID}" class="manga-lens-progress-title">MangaLens</div>
          <div id="${SUBTITLE_ID}" class="manga-lens-progress-subtitle"></div>
        </div>
        <button id="${TOGGLE_ID}" class="manga-lens-progress-toggle" type="button">详情</button>
      </div>
      <div class="manga-lens-progress-track"><div id="${BAR_ID}" class="manga-lens-progress-bar"></div></div>
      <div id="${BODY_ID}" class="manga-lens-progress-body"></div>
      <div id="${LOG_ID}" class="manga-lens-progress-log"></div>
    `;
    document.body.appendChild(panel);
    document.getElementById(TOGGLE_ID)?.addEventListener("click", () => {
      this.expanded = !this.expanded;
      panel.classList.toggle("is-expanded", this.expanded);
      const toggle = document.getElementById(TOGGLE_ID);
      if (toggle) toggle.textContent = this.expanded ? "收起" : "详情";
      if (this.lastUpdate) {
        this.update(this.lastUpdate);
      }
    });
  }
  renderBody(update) {
    const rows = [
      ["阶段", STAGE_LABEL[update.stage]],
      ["图片", update.imageIndex && update.imageTotal ? `${update.imageIndex}/${update.imageTotal}` : void 0],
      ["队列", update.queueLength],
      ["来源", update.source],
      ["OCR 文本框", update.ocrBoxes],
      ["合并对话", update.dialogs],
      ["翻译进度", update.totalToTranslate !== void 0 ? `${update.translated || 0}/${update.totalToTranslate}` : void 0],
      ["渲染数量", update.rendered],
      ["耗时", formatElapsed(update.elapsedMs)],
      ["警告", update.warning],
      ["错误", update.error]
    ];
    return rows.filter(([, value]) => value !== void 0 && value !== "").map(([key, value]) => `<div class="manga-lens-progress-row"><span>${escapeText(key)}</span><b>${escapeText(String(value))}</b></div>`).join("");
  }
  pushLog(update) {
    const message = [
      `[${STAGE_LABEL[update.stage]}]`,
      update.title,
      update.detail,
      update.source ? `source=${update.source}` : "",
      update.warning ? `warning=${update.warning}` : "",
      update.error ? `error=${update.error}` : ""
    ].filter(Boolean).join(" ");
    this.logs.push(message);
    this.logs = this.logs.slice(-8);
    console.log(`[MangaLens][Progress] ${message}`);
  }
  renderLog() {
    const log = document.getElementById(LOG_ID);
    if (!log) return;
    log.innerHTML = this.logs.map((line) => `<div>${escapeText(line)}</div>`).join("");
  }
}
const progressReporter = new ProgressReporter();
const PXIMG_HOST_RE = /(?:^|\.)pximg\.net$/i;
function getPixivArtworkId() {
  const match = location.pathname.match(/\/artworks\/(\d+)/);
  return match?.[1] || null;
}
function normalizeUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, location.href).href;
  } catch {
    return value;
  }
}
function isPximgUrl(url) {
  try {
    return PXIMG_HOST_RE.test(new URL(url).hostname);
  } catch {
    return /pximg\.net/i.test(url);
  }
}
function parsePageIndex(url, artworkId) {
  const match = url.match(new RegExp(`${artworkId}_p(\\d+)`, "i"));
  if (!match) return null;
  const page = Number.parseInt(match[1], 10);
  return Number.isFinite(page) ? page : null;
}
function isCurrentArtworkUrl(url, artworkId) {
  if (!url || !isPximgUrl(url)) return false;
  if (!url.includes(`${artworkId}_p`)) return false;
  if (url.includes("/user-profile/")) return false;
  if (url.includes("_square1200")) return false;
  if (url.includes("/custom-thumb/")) return false;
  return true;
}
function getImageUrl(img) {
  return normalizeUrl(img.currentSrc || img.src || img.dataset.src || img.dataset.lazySrc || "");
}
function createPageFromAnchor(anchor, artworkId) {
  const img = anchor.querySelector("img");
  if (!(img instanceof HTMLImageElement)) return null;
  const originalUrl = normalizeUrl(anchor.href);
  const previewUrl = getImageUrl(img);
  const joined = `${originalUrl}
${previewUrl}`;
  const pageIndex = parsePageIndex(joined, artworkId);
  if (pageIndex === null) return null;
  if (!isCurrentArtworkUrl(originalUrl, artworkId) && !isCurrentArtworkUrl(previewUrl, artworkId)) return null;
  const dataPage = Number.parseInt(anchor.dataset.page || "", 10);
  return {
    artworkId,
    pageIndex,
    dataPage: Number.isFinite(dataPage) ? dataPage : void 0,
    originalUrl: isCurrentArtworkUrl(originalUrl, artworkId) ? originalUrl : void 0,
    previewUrl,
    img,
    anchor,
    cacheKey: `pixiv:${artworkId}:p${pageIndex}:${previewUrl || originalUrl}`
  };
}
function createPageFromImage(img, artworkId) {
  const previewUrl = getImageUrl(img);
  const anchor = img.closest("a");
  const originalUrl = normalizeUrl(anchor?.href || "");
  const joined = `${originalUrl}
${previewUrl}`;
  const pageIndex = parsePageIndex(joined, artworkId);
  if (pageIndex === null) return null;
  if (!isCurrentArtworkUrl(originalUrl, artworkId) && !isCurrentArtworkUrl(previewUrl, artworkId)) return null;
  const rect = img.getBoundingClientRect();
  if (rect.width < 180 || rect.height < 180) return null;
  return {
    artworkId,
    pageIndex,
    dataPage: anchor?.dataset.page ? Number.parseInt(anchor.dataset.page, 10) : void 0,
    originalUrl: isCurrentArtworkUrl(originalUrl, artworkId) ? originalUrl : void 0,
    previewUrl,
    img,
    anchor: anchor || void 0,
    cacheKey: `pixiv:${artworkId}:p${pageIndex}:${previewUrl || originalUrl}`
  };
}
function uniqueAndSort(pages) {
  const map = /* @__PURE__ */ new Map();
  for (const page of pages) {
    const current = map.get(page.pageIndex);
    if (!current) {
      map.set(page.pageIndex, page);
      continue;
    }
    const currentArea = current.img.getBoundingClientRect().width * current.img.getBoundingClientRect().height;
    const nextArea = page.img.getBoundingClientRect().width * page.img.getBoundingClientRect().height;
    if (nextArea > currentArea) map.set(page.pageIndex, page);
  }
  return [...map.values()].sort((a, b) => a.pageIndex - b.pageIndex);
}
function detectPixivMode() {
  const hasReaderAnchors = document.querySelectorAll('a[data-page][href*="i.pximg.net/img-original"]').length > 0;
  if (location.hash || hasReaderAnchors) return "reader";
  return "detail";
}
function getReaderPages(artworkId = getPixivArtworkId()) {
  if (!artworkId) return [];
  const pages = [];
  document.querySelectorAll('a[data-page][href*="i.pximg.net/img-original"], a.gtm-expand-full-size-illust[data-page]').forEach((node) => {
    const page = createPageFromAnchor(node, artworkId);
    if (page) pages.push(page);
  });
  return uniqueAndSort(pages);
}
function getDetailPages(artworkId = getPixivArtworkId()) {
  if (!artworkId) return [];
  const pages = [];
  document.querySelectorAll("img").forEach((node) => {
    const page = createPageFromImage(node, artworkId);
    if (page) pages.push(page);
  });
  const sorted = uniqueAndSort(pages);
  const first = sorted.find((page) => page.pageIndex === 0) || sorted[0];
  return first ? [first] : [];
}
function getPixivPages() {
  const artworkId = getPixivArtworkId();
  if (!artworkId) return [];
  const readerPages = getReaderPages(artworkId);
  if (readerPages.length > 0) return readerPages;
  return getDetailPages(artworkId);
}
function getCurrentVisiblePixivPage(pages = getPixivPages()) {
  if (pages.length === 0) return null;
  const viewportCenterY = window.innerHeight / 2;
  const ranked = pages.map((page) => {
    const rect = page.img.getBoundingClientRect();
    const visibleWidth = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    const visibleArea = Math.max(0, visibleWidth) * Math.max(0, visibleHeight);
    const totalArea = Math.max(1, rect.width * rect.height);
    const visibleRatio = visibleArea / totalArea;
    const centerDistance = Math.abs((rect.top + rect.bottom) / 2 - viewportCenterY);
    return { page, visibleRatio, centerDistance, area: totalArea };
  }).filter((entry) => entry.visibleRatio > 0.08 || entry.area > 3e5).sort((a, b) => b.visibleRatio - a.visibleRatio || a.centerDistance - b.centerDistance);
  return ranked[0]?.page || pages[0];
}
const FAILED_PAGE_COOLDOWN_MS = 3e4;
const SCROLL_IDLE_MS = 650;
const state = {
  isEnabled: true,
  isProcessing: false,
  zhipuApiKey: "",
  zhipuVisionModel: "glm-4.6v",
  processedPages: /* @__PURE__ */ new Set(),
  processingPages: /* @__PURE__ */ new Set(),
  failedPages: /* @__PURE__ */ new Map(),
  cache: /* @__PURE__ */ new Map(),
  pageGeneration: 0
};
let scrollTimer;
let routeTimer;
let lastUrl = location.href;
function isPixivArtworkPage() {
  return /(?:^|\.)pixiv\.net$/i.test(location.hostname) && !!getPixivArtworkId();
}
function pageLabel(page) {
  return `${page.artworkId} p${page.pageIndex + 1}`;
}
function getImageUrlForModel(page) {
  return page.originalUrl || page.previewUrl;
}
function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}
async function updatePopupStatus() {
  try {
    chrome.runtime.sendMessage({
      type: "UPDATE_STATUS",
      processedCount: state.processedPages.size,
      cacheSize: state.cache.size
    });
  } catch {
  }
}
async function waitForImageReady(img) {
  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) return true;
  await Promise.race([
    img.decode?.().catch(() => void 0),
    new Promise((resolve) => window.setTimeout(resolve, 3e3))
  ]);
  return img.naturalWidth > 0 && img.naturalHeight > 0;
}
async function translatePixivPage(page, generation = state.pageGeneration) {
  if (!state.isEnabled || state.isProcessing) return;
  if (state.processedPages.has(page.cacheKey) || state.processingPages.has(page.cacheKey)) return;
  const lastFailedAt = state.failedPages.get(page.cacheKey);
  if (lastFailedAt && Date.now() - lastFailedAt < FAILED_PAGE_COOLDOWN_MS) {
    progressReporter.update({
      stage: "skip",
      title: "当前漫画页处于失败冷却中",
      detail: pageLabel(page),
      warning: "30 秒内不重复请求失败页"
    });
    return;
  }
  if (!state.zhipuApiKey) {
    progressReporter.update({
      stage: "error",
      title: "缺少智谱 API Key",
      detail: "请先在扩展设置中填写 API Key",
      error: "zhipuApiKey is empty"
    });
    return;
  }
  if (!await waitForImageReady(page.img)) {
    progressReporter.update({
      stage: "skip",
      title: "Pixiv 漫画图尚未加载完成",
      detail: pageLabel(page),
      warning: "naturalWidth/naturalHeight 为空"
    });
    return;
  }
  const cached = state.cache.get(page.cacheKey);
  if (cached) {
    const overlayIds = overlayManager.renderPixivVisionItems(page.img, cached);
    state.processedPages.add(page.cacheKey);
    progressReporter.update({
      stage: "done",
      title: "已使用缓存渲染 Pixiv 漫画页",
      detail: pageLabel(page),
      source: "cache",
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
      stage: "image-source",
      title: "从 Pixiv HTML 容器读取漫画图",
      detail: `${pageLabel(page)} · ${detectPixivMode()} 模式`,
      source: "pixiv-html-url"
    });
    const imageUrl = getImageUrlForModel(page);
    if (!imageUrl) throw new Error("没有找到 Pixiv 漫画图片 URL");
    progressReporter.update({
      stage: "translate",
      title: `正在调用 ${state.zhipuVisionModel} 识别并翻译`,
      detail: pageLabel(page),
      source: "pixiv-html-url",
      elapsedMs: Date.now() - startedAt
    });
    const response = await sendMessageToBackground({
      target: "background",
      type: "TRANSLATE_PIXIV_IMAGE",
      imageUrl,
      pageUrl: location.href,
      apiKey: state.zhipuApiKey,
      model: state.zhipuVisionModel,
      artworkId: page.artworkId,
      pageIndex: page.pageIndex
    });
    if (generation !== state.pageGeneration || !state.isEnabled) return;
    if (!response?.success) {
      throw new Error(response?.message || "GLM-4.6V Pixiv 漫画翻译失败");
    }
    const items = response.items || [];
    progressReporter.update({
      stage: "render",
      title: "正在渲染 GLM-4.6V 译文",
      detail: response.sourceMessage || pageLabel(page),
      source: response.source || "pixiv-html-url",
      dialogs: items.length,
      elapsedMs: Date.now() - startedAt
    });
    const overlayIds = overlayManager.renderPixivVisionItems(page.img, items);
    state.cache.set(page.cacheKey, items);
    state.processedPages.add(page.cacheKey);
    state.failedPages.delete(page.cacheKey);
    progressReporter.update({
      stage: "done",
      title: "Pixiv 漫画页翻译完成",
      detail: pageLabel(page),
      source: response.source || "pixiv-html-url",
      dialogs: items.length,
      rendered: overlayIds.length,
      elapsedMs: Date.now() - startedAt
    });
    await updatePopupStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.failedPages.set(page.cacheKey, Date.now());
    progressReporter.update({
      stage: "error",
      title: "Pixiv 漫画页翻译失败",
      detail: pageLabel(page),
      source: "pixiv-html-url",
      error: message,
      elapsedMs: Date.now() - startedAt
    });
    console.error("[MangaLens] Pixiv 漫画页翻译失败:", error);
  } finally {
    state.isProcessing = false;
    state.processingPages.delete(page.cacheKey);
  }
}
function findTargetPages() {
  if (!isPixivArtworkPage()) return [];
  const mode = detectPixivMode();
  const pages = getPixivPages();
  if (mode === "reader") {
    const current = getCurrentVisiblePixivPage(pages);
    if (!current) return [];
    return [current];
  }
  return pages.slice(0, 1);
}
async function processCurrentPixivTarget(reason) {
  if (!state.isEnabled || state.isProcessing) return;
  if (!isPixivArtworkPage()) {
    progressReporter.update({
      stage: "skip",
      title: "当前页面不是 Pixiv 作品页",
      detail: location.href
    });
    return;
  }
  const pages = findTargetPages();
  const mode = detectPixivMode();
  progressReporter.update({
    stage: "scan",
    title: "正在定位 Pixiv 漫画页",
    detail: `${mode} 模式 · ${reason} · 找到 ${pages.length} 张目标图`,
    source: "pixiv-html-dom"
  });
  const page = pages.find((candidate) => !state.processedPages.has(candidate.cacheKey)) || pages[0];
  if (!page) return;
  await translatePixivPage(page);
}
function scheduleProcess(reason, delay = SCROLL_IDLE_MS) {
  window.clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(() => {
    void processCurrentPixivTarget(reason);
  }, delay);
}
async function loadConfig() {
  const stored = await chrome.storage.local.get([
    "zhipuApiKey",
    "zhipuVisionModel",
    "zhipuTranslationModel",
    "isEnabled"
  ]);
  state.zhipuApiKey = stored.zhipuApiKey || "";
  state.zhipuVisionModel = stored.zhipuVisionModel || stored.zhipuTranslationModel || "glm-4.6v";
  state.isEnabled = stored.isEnabled !== false;
}
function resetPageState() {
  state.pageGeneration += 1;
  state.isProcessing = false;
  state.processedPages.clear();
  state.processingPages.clear();
  state.failedPages.clear();
  overlayManager.removeAllOverlays();
  progressReporter.update({
    stage: "scan",
    title: "Pixiv 页面状态已重置",
    detail: location.href,
    source: "pixiv-html-dom"
  });
}
async function initialize() {
  try {
    await loadConfig();
    if (!isPixivArtworkPage()) {
      console.log("[MangaLens] 非 Pixiv 作品页，Pixiv 专用翻译器未启动");
      return;
    }
    scheduleProcess("初始化", 1e3);
    window.addEventListener("scroll", () => scheduleProcess("滚动停止"), { passive: true });
    window.addEventListener("resize", () => {
      overlayManager.removeAllOverlays();
      state.processedPages.clear();
      scheduleProcess("窗口尺寸变化", 500);
    });
    const observer = new MutationObserver(() => {
      scheduleProcess("Pixiv DOM 更新", 900);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("beforeunload", () => observer.disconnect());
    routeTimer = window.setInterval(() => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      resetPageState();
      scheduleProcess("Pixiv 路由变化", 1e3);
    }, 1e3);
    console.log("[MangaLens] Pixiv GLM-4.6V translator initialized");
  } catch (error) {
    progressReporter.update({
      stage: "error",
      title: "MangaLens Pixiv 初始化失败",
      error: error instanceof Error ? error.message : String(error)
    });
    console.error("[MangaLens] 初始化失败:", error);
  }
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "TOGGLE_ENABLED":
      state.isEnabled = message.enabled;
      if (!state.isEnabled) {
        resetPageState();
      } else {
        scheduleProcess("重新开启", 0);
      }
      sendResponse({ success: true });
      break;
    case "CONFIGURE_ZHIPU_API":
      state.zhipuApiKey = message.zhipuApiKey || "";
      state.zhipuVisionModel = message.zhipuVisionModel || message.zhipuTranslationModel || "glm-4.6v";
      sendResponse({ success: true });
      break;
    case "REFRESH":
      resetPageState();
      scheduleProcess("手动刷新", 0);
      sendResponse({ success: true });
      break;
    case "SELECT_IMAGE":
      scheduleProcess("从 Pixiv HTML 当前容器重新选择", 0);
      sendResponse({ success: true });
      break;
    case "GET_STATUS":
      sendResponse({
        isEnabled: state.isEnabled,
        processedCount: state.processedPages.size,
        cacheSize: state.cache.size
      });
      break;
  }
  return true;
});
if (document.readyState === "complete") {
  initialize();
} else {
  window.addEventListener("load", initialize);
}
window.addEventListener("beforeunload", () => {
  if (routeTimer) window.clearInterval(routeTimer);
});
