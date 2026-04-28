"use strict";
var MangaLensContent = (() => {
  // src/modules/translation-overlay.ts
  var DEFAULT_RENDER_CONFIG = {
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
  function overlaps(a, b) {
    const gap = 3;
    return !(a.left + a.width + gap <= b.left || b.left + b.width + gap <= a.left || a.top + a.height + gap <= b.top || b.top + b.height + gap <= a.top);
  }
  var TranslationOverlayManager = class {
    container = null;
    overlays = /* @__PURE__ */ new Map();
    containerId = "manga-lens-overlay-container";
    overlayClass = "manga-lens-text-overlay";
    syncScheduled = false;
    autoSyncStarted = false;
    createContainer() {
      let existing = document.getElementById(this.containerId);
      if (!existing) {
        existing = document.createElement("div");
        existing.id = this.containerId;
        existing.style.cssText = [
          "position:fixed",
          "top:0",
          "left:0",
          "width:100vw",
          "height:100vh",
          "pointer-events:none",
          "z-index:2147483646",
          "overflow:visible",
          "contain:layout style"
        ].join(";");
        document.body.appendChild(existing);
      }
      this.container = existing;
      this.startAutoSync();
      return existing;
    }
    startAutoSync() {
      if (this.autoSyncStarted) return;
      this.autoSyncStarted = true;
      const schedule = () => this.schedulePositionSync();
      window.addEventListener("scroll", schedule, { passive: true, capture: true });
      window.addEventListener("resize", schedule, { passive: true });
      window.setInterval(schedule, 350);
    }
    schedulePositionSync() {
      if (this.syncScheduled) return;
      this.syncScheduled = true;
      window.requestAnimationFrame(() => {
        this.syncScheduled = false;
        this.updateOverlayPositions();
      });
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
      this.updateOverlayPositions();
      console.log(`[Overlay] Pixiv \u6E32\u67D3\u5B8C\u6210: ${ids.length} \u4E2A\u8986\u76D6\u5C42`);
      return ids;
    }
    renderPixivVisionItem(imageElement, item, config) {
      const cfg = { ...DEFAULT_RENDER_CONFIG, ...config };
      const container = this.container || this.createContainer();
      const id = `ml-overlay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const overlay = document.createElement("div");
      overlay.id = id;
      overlay.className = this.overlayClass;
      overlay.textContent = item.translatedText;
      overlay.dataset.original = item.sourceText || "";
      overlay.style.cssText = [
        "position:fixed",
        "left:0",
        "top:0",
        'font-family:"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif',
        "line-height:1.35",
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
        "writing-mode:horizontal-tb",
        "transform:translateZ(0)"
      ].join(";");
      container.appendChild(overlay);
      this.overlays.set(id, {
        id,
        translatedText: item.translatedText,
        element: overlay,
        imageElement,
        item,
        config: cfg
      });
      this.updateOverlayPositions();
      return id;
    }
    updateOverlayPositions() {
      const groups = /* @__PURE__ */ new Map();
      for (const overlay of this.overlays.values()) {
        const group = groups.get(overlay.imageElement) || [];
        group.push(overlay);
        groups.set(overlay.imageElement, group);
      }
      for (const [imageElement, overlays] of groups.entries()) {
        this.updateImageOverlayGroup(imageElement, overlays);
      }
    }
    updateImageOverlayGroup(imageElement, overlays) {
      const imageRect = imageElement.getBoundingClientRect();
      if (imageRect.width <= 0 || imageRect.height <= 0 || imageRect.bottom < 0 || imageRect.top > window.innerHeight) {
        overlays.forEach((overlay) => {
          overlay.element.style.display = "none";
        });
        return;
      }
      const positioned = overlays.map((overlay) => this.calculateOverlayPosition(overlay, imageRect)).sort((a, b) => a.top - b.top || a.left - b.left);
      const placed = [];
      for (const item of positioned) {
        let candidate = item;
        let attempts = 0;
        while (placed.some((other) => overlaps(candidate, other)) && attempts < 18) {
          const direction = attempts % 2 === 0 ? 1 : -1;
          const step = Math.ceil((attempts + 1) / 2) * 8;
          candidate = {
            ...candidate,
            top: clamp(item.originalTop + direction * step, imageRect.top, Math.max(imageRect.top, imageRect.bottom - item.height))
          };
          attempts += 1;
        }
        placed.push(candidate);
        this.applyPosition(candidate);
      }
    }
    calculateOverlayPosition(overlay, imageRect) {
      const { item, config: cfg } = overlay;
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
      return {
        overlay,
        left: leftPx,
        top: topPx,
        width: widthPx,
        height: heightPx,
        originalTop: topPx
      };
    }
    applyPosition(positioned) {
      const { overlay, left, top, width, height } = positioned;
      const { item, config: cfg, element } = overlay;
      element.style.display = "flex";
      const bgWithOpacity = hexToRgba(cfg.background, cfg.backgroundOpacity);
      const fontSize = clamp(Math.round(Math.min(cfg.fontSize, width / Math.max(4, Math.min(8, item.translatedText.length)))), 10, cfg.fontSize);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.style.width = `${width}px`;
      element.style.minHeight = `${height}px`;
      element.style.fontSize = `${fontSize}px`;
      element.style.color = cfg.color;
      element.style.background = bgWithOpacity;
      element.style.padding = `${cfg.padding}px`;
    }
    getOverlayCount() {
      return this.overlays.size;
    }
  };
  var overlayManager = new TranslationOverlayManager();

  // src/modules/progress-reporter.ts
  var PANEL_ID = "manga-lens-progress-panel";
  var BODY_ID = "manga-lens-progress-body";
  var TITLE_ID = "manga-lens-progress-title";
  var SUBTITLE_ID = "manga-lens-progress-subtitle";
  var BAR_ID = "manga-lens-progress-bar";
  var LOG_ID = "manga-lens-progress-log";
  var TOGGLE_ID = "manga-lens-progress-toggle";
  var STAGE_LABEL = {
    idle: "\u5F85\u547D",
    scan: "\u626B\u63CF",
    queued: "\u6392\u961F",
    "image-ready": "\u56FE\u7247\u52A0\u8F7D",
    "image-source": "\u56FE\u7247\u83B7\u53D6",
    ocr: "OCR",
    merge: "\u5408\u5E76",
    translate: "\u7FFB\u8BD1",
    render: "\u6E32\u67D3",
    done: "\u5B8C\u6210",
    skip: "\u8DF3\u8FC7",
    error: "\u9519\u8BEF"
  };
  var STAGE_WEIGHT = {
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
  var ProgressReporter = class {
    expanded = false;
    lastUpdate = null;
    logs = [];
    update(update) {
      this.lastUpdate = update;
      this.ensurePanel();
      const stage = STAGE_LABEL[update.stage] || update.stage;
      const elapsed = formatElapsed(update.elapsedMs);
      const parts = [stage];
      if (update.imageIndex && update.imageTotal) parts.push(`\u56FE\u7247 ${update.imageIndex}/${update.imageTotal}`);
      if (update.queueLength !== void 0) parts.push(`\u961F\u5217 ${update.queueLength}`);
      if (update.concurrency !== void 0) parts.push(`\u5E76\u53D1 ${update.concurrency}`);
      if (elapsed) parts.push(`\u8017\u65F6 ${elapsed}`);
      const detailParts = [];
      if (update.source) detailParts.push(`\u6765\u6E90: ${update.source}`);
      if (update.ocrBoxes !== void 0) detailParts.push(`OCR\u6846: ${update.ocrBoxes}`);
      if (update.dialogs !== void 0) detailParts.push(`\u5BF9\u8BDD: ${update.dialogs}`);
      if (update.totalToTranslate !== void 0) detailParts.push(`\u5B8C\u6210: ${update.translated || 0}/${update.totalToTranslate}`);
      if (update.rendered !== void 0) detailParts.push(`\u6E32\u67D3: ${update.rendered}`);
      if (update.timerSummary) detailParts.push(update.timerSummary);
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
      if (subtitle) subtitle.textContent = [parts.join(" \xB7 "), update.detail, detailParts.join("\n")].filter(Boolean).join("\n");
      if (bar) bar.style.width = `${this.calculatePercent(update)}%`;
      if (body) {
        body.innerHTML = this.renderBody(update);
      }
      if (!update.silentLog) {
        this.pushLog(update);
        this.renderLog();
      }
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
      if (update.totalToTranslate) {
        const local = Math.min(1, Math.max(0, (update.translated || 0) / update.totalToTranslate));
        if (update.stage === "done") return 100;
        return Math.round(10 + local * 85);
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
        <button id="${TOGGLE_ID}" class="manga-lens-progress-toggle" type="button">\u8BE6\u60C5</button>
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
        if (toggle) toggle.textContent = this.expanded ? "\u6536\u8D77" : "\u8BE6\u60C5";
        if (this.lastUpdate) {
          this.update({ ...this.lastUpdate, silentLog: true });
        }
      });
    }
    renderBody(update) {
      const rows = [
        ["\u9636\u6BB5", STAGE_LABEL[update.stage]],
        ["\u56FE\u7247", update.imageIndex && update.imageTotal ? `${update.imageIndex}/${update.imageTotal}` : void 0],
        ["\u961F\u5217", update.queueLength],
        ["\u5E76\u53D1", update.concurrency],
        ["\u6765\u6E90", update.source],
        ["OCR \u6587\u672C\u6846", update.ocrBoxes],
        ["\u5408\u5E76\u5BF9\u8BDD", update.dialogs],
        ["\u5B8C\u6210\u9875\u6570", update.totalToTranslate !== void 0 ? `${update.translated || 0}/${update.totalToTranslate}` : void 0],
        ["\u9875\u9762\u8BA1\u65F6", update.timerSummary],
        ["\u5904\u7406\u4E2D", update.activePages?.join(" \uFF5C ")],
        ["\u7B49\u5F85\u961F\u5217", update.queuedPages?.join("\uFF0C")],
        ["\u6E32\u67D3\u6570\u91CF", update.rendered],
        ["\u8017\u65F6", formatElapsed(update.elapsedMs)],
        ["\u8B66\u544A", update.warning],
        ["\u9519\u8BEF", update.error]
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
  };
  var progressReporter = new ProgressReporter();

  // src/modules/pixiv-detector.ts
  var PXIMG_HOST_RE = /(?:^|\.)pximg\.net$/i;
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

  // src/content-script.ts
  var FAILED_PAGE_COOLDOWN_MS = 2e3;
  var SCROLL_IDLE_MS = 650;
  var MAX_CONCURRENT_TRANSLATIONS = 4;
  var WORKER_STAGGER_MS = 450;
  var state = {
    isEnabled: true,
    zhipuApiKey: "",
    zhipuVisionModel: "glm-4.6v",
    processedPages: /* @__PURE__ */ new Set(),
    processingPages: /* @__PURE__ */ new Set(),
    queuedPages: /* @__PURE__ */ new Set(),
    failedPages: /* @__PURE__ */ new Map(),
    cache: /* @__PURE__ */ new Map(),
    pageGeneration: 0
  };
  var scrollTimer;
  var routeTimer;
  var timerPanelInterval;
  var lastUrl = location.href;
  var activeWorkers = 0;
  var workerLaunchCount = 0;
  var pageQueue = [];
  var activeTasks = /* @__PURE__ */ new Map();
  function isPixivArtworkPage() {
    return /(?:^|\.)pixiv\.net$/i.test(location.hostname) && !!getPixivArtworkId();
  }
  function pageLabel(page) {
    return `${page.artworkId} p${page.pageIndex + 1}`;
  }
  function formatSeconds(ms) {
    return `${Math.max(0, ms / 1e3).toFixed(1)}s`;
  }
  function currentPageTotal() {
    return getPixivPages().length || 1;
  }
  function completedCount() {
    return state.processedPages.size;
  }
  function getImageUrlsForModel(page) {
    return [page.previewUrl, page.originalUrl].filter((url) => !!url);
  }
  function isCoolingDown(page) {
    const lastFailedAt = state.failedPages.get(page.cacheKey);
    return !!lastFailedAt && Date.now() - lastFailedAt < FAILED_PAGE_COOLDOWN_MS;
  }
  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
  function getTimerSummary() {
    const now = Date.now();
    const active = [...activeTasks.values()].sort((a, b) => a.pageIndex - b.pageIndex).map((task) => `${task.label} ${task.status} ${formatSeconds(now - task.startedAt)}`);
    const queued = pageQueue.slice(0, 8).map((page) => `p${page.pageIndex + 1}`);
    const activePart = active.length > 0 ? `\u5904\u7406\u4E2D\uFF1A${active.join(" \uFF5C ")}` : "\u5904\u7406\u4E2D\uFF1A\u65E0";
    const queuedPart = queued.length > 0 ? `\u7B49\u5F85\uFF1A${queued.join("\uFF0C")}${pageQueue.length > queued.length ? ` \u7B49${pageQueue.length}\u9875` : ""}` : "\u7B49\u5F85\uFF1A\u65E0";
    return `${activePart}
${queuedPart}`;
  }
  function getActivePageSummaries() {
    const now = Date.now();
    return [...activeTasks.values()].sort((a, b) => a.pageIndex - b.pageIndex).map((task) => `${task.label} ${task.status} ${formatSeconds(now - task.startedAt)}`);
  }
  function getQueuedPageSummaries() {
    return pageQueue.slice(0, 10).map((page) => `p${page.pageIndex + 1}`);
  }
  function emitProgress(update) {
    progressReporter.update({
      ...update,
      concurrency: `${activeWorkers}/${MAX_CONCURRENT_TRANSLATIONS}`,
      timerSummary: getTimerSummary(),
      activePages: getActivePageSummaries(),
      queuedPages: getQueuedPageSummaries()
    });
  }
  function startTimerPanel() {
    if (timerPanelInterval) return;
    timerPanelInterval = window.setInterval(() => {
      if (activeTasks.size === 0 && pageQueue.length === 0) return;
      emitProgress({
        stage: "translate",
        title: "Pixiv \u6F2B\u753B\u9875\u7FFB\u8BD1\u8FDB\u884C\u4E2D",
        detail: `\u5E76\u53D1 ${activeWorkers}/${MAX_CONCURRENT_TRANSLATIONS} \xB7 \u5B8C\u6210 ${completedCount()}/${currentPageTotal()} \u9875`,
        imageTotal: currentPageTotal(),
        queueLength: pageQueue.length,
        translated: completedCount(),
        totalToTranslate: currentPageTotal(),
        source: "pixiv-html-url",
        silentLog: true
      });
    }, 1e3);
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
    if (!state.isEnabled) return;
    if (state.processedPages.has(page.cacheKey) || state.processingPages.has(page.cacheKey)) return;
    if (isCoolingDown(page)) return;
    if (!state.zhipuApiKey) {
      emitProgress({
        stage: "error",
        title: "\u7F3A\u5C11\u667A\u8C31 API Key",
        detail: "\u8BF7\u5148\u5728\u6269\u5C55\u8BBE\u7F6E\u4E2D\u586B\u5199 API Key",
        error: "zhipuApiKey is empty"
      });
      return;
    }
    if (!await waitForImageReady(page.img)) {
      emitProgress({
        stage: "skip",
        title: "Pixiv \u6F2B\u753B\u56FE\u5C1A\u672A\u52A0\u8F7D\u5B8C\u6210",
        detail: pageLabel(page),
        imageIndex: page.pageIndex + 1,
        imageTotal: currentPageTotal(),
        queueLength: pageQueue.length,
        warning: "naturalWidth/naturalHeight \u4E3A\u7A7A"
      });
      return;
    }
    const cached = state.cache.get(page.cacheKey);
    if (cached) {
      const overlayIds = overlayManager.renderPixivVisionItems(page.img, cached);
      state.processedPages.add(page.cacheKey);
      emitProgress({
        stage: "done",
        title: "\u5DF2\u4F7F\u7528\u7F13\u5B58\u6E32\u67D3 Pixiv \u6F2B\u753B\u9875",
        detail: pageLabel(page),
        imageIndex: page.pageIndex + 1,
        imageTotal: currentPageTotal(),
        queueLength: pageQueue.length,
        source: "cache",
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
      status: "\u51C6\u5907"
    });
    try {
      emitProgress({
        stage: "image-source",
        title: "\u4ECE Pixiv HTML \u5BB9\u5668\u8BFB\u53D6\u6F2B\u753B\u56FE",
        detail: `${pageLabel(page)} \xB7 \u5E76\u53D1 ${activeWorkers}/${MAX_CONCURRENT_TRANSLATIONS}`,
        imageIndex: page.pageIndex + 1,
        imageTotal: currentPageTotal(),
        queueLength: pageQueue.length,
        source: "pixiv-html-url",
        translated: completedCount(),
        totalToTranslate: currentPageTotal()
      });
      const imageUrls = getImageUrlsForModel(page);
      if (imageUrls.length === 0) throw new Error("\u6CA1\u6709\u627E\u5230 Pixiv \u6F2B\u753B\u56FE\u7247 URL");
      activeTasks.set(page.cacheKey, {
        label: `p${page.pageIndex + 1}`,
        pageIndex: page.pageIndex,
        startedAt,
        status: "\u751F\u6210\u4E2D"
      });
      emitProgress({
        stage: "translate",
        title: `\u7B49\u5F85 ${state.zhipuVisionModel} \u8FD4\u56DE\u7ED3\u679C`,
        detail: `${pageLabel(page)} \xB7 \u5DF2\u63D0\u4EA4\u89C6\u89C9\u7FFB\u8BD1\u8BF7\u6C42\uFF0C\u6A21\u578B\u751F\u6210\u4E2D`,
        imageIndex: page.pageIndex + 1,
        imageTotal: currentPageTotal(),
        queueLength: pageQueue.length,
        source: "pixiv-html-url",
        translated: completedCount(),
        totalToTranslate: currentPageTotal(),
        elapsedMs: Date.now() - startedAt
      });
      const response = await sendMessageToBackground({
        target: "background",
        type: "TRANSLATE_PIXIV_IMAGE",
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
        throw new Error(response?.message || "GLM-4.6V Pixiv \u6F2B\u753B\u7FFB\u8BD1\u5931\u8D25");
      }
      const items = response.items || [];
      activeTasks.set(page.cacheKey, {
        label: `p${page.pageIndex + 1}`,
        pageIndex: page.pageIndex,
        startedAt,
        status: "\u6E32\u67D3\u4E2D"
      });
      emitProgress({
        stage: "render",
        title: "\u6B63\u5728\u6E32\u67D3 GLM-4.6V \u8BD1\u6587",
        detail: `${response.sourceMessage || pageLabel(page)} \xB7 \u8BC6\u522B ${items.length} \u6BB5`,
        imageIndex: page.pageIndex + 1,
        imageTotal: currentPageTotal(),
        queueLength: pageQueue.length,
        source: response.source || "pixiv-html-url",
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
        stage: "done",
        title: "Pixiv \u6F2B\u753B\u9875\u7FFB\u8BD1\u5B8C\u6210",
        detail: `${pageLabel(page)} \xB7 \u5DF2\u5B8C\u6210 ${completedCount()}/${currentPageTotal()} \u9875 \xB7 \u672C\u9875 ${formatSeconds(Date.now() - startedAt)}`,
        imageIndex: page.pageIndex + 1,
        imageTotal: currentPageTotal(),
        queueLength: pageQueue.length,
        source: response.source || "pixiv-html-url",
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
        stage: "error",
        title: "Pixiv \u6F2B\u753B\u9875\u7FFB\u8BD1\u5931\u8D25",
        detail: `${pageLabel(page)} \xB7 2 \u79D2\u540E\u53EF\u91CD\u8BD5`,
        imageIndex: page.pageIndex + 1,
        imageTotal: currentPageTotal(),
        queueLength: pageQueue.length,
        source: "pixiv-html-url",
        error: message,
        elapsedMs: Date.now() - startedAt
      });
      console.error("[MangaLens] Pixiv \u6F2B\u753B\u9875\u7FFB\u8BD1\u5931\u8D25:", error);
    } finally {
      state.processingPages.delete(page.cacheKey);
      activeTasks.delete(page.cacheKey);
    }
  }
  function enqueuePages(pages, reason) {
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
        stage: "queued",
        title: "Pixiv \u6F2B\u753B\u9875\u5DF2\u52A0\u5165\u7FFB\u8BD1\u961F\u5217",
        detail: `${reason} \xB7 \u65B0\u589E ${added} \u9875 \xB7 \u5F53\u524D\u961F\u5217 ${pageQueue.length} \u9875 \xB7 \u5E76\u53D1 ${MAX_CONCURRENT_TRANSLATIONS}`,
        imageTotal: currentPageTotal(),
        queueLength: pageQueue.length,
        translated: completedCount(),
        totalToTranslate: currentPageTotal(),
        source: "pixiv-html-dom"
      });
    }
    void drainQueue();
  }
  async function drainQueue() {
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
      })().finally(() => {
        activeWorkers -= 1;
        void drainQueue();
      });
    }
  }
  function findTargetPages() {
    if (!isPixivArtworkPage()) return [];
    const mode = detectPixivMode();
    const pages = getPixivPages();
    if (mode === "reader") {
      return pages;
    }
    return pages.slice(0, 1);
  }
  async function processCurrentPixivTarget(reason) {
    if (!state.isEnabled) return;
    if (!isPixivArtworkPage()) {
      emitProgress({
        stage: "skip",
        title: "\u5F53\u524D\u9875\u9762\u4E0D\u662F Pixiv \u4F5C\u54C1\u9875",
        detail: location.href
      });
      return;
    }
    const pages = findTargetPages();
    const mode = detectPixivMode();
    emitProgress({
      stage: "scan",
      title: "\u6B63\u5728\u5B9A\u4F4D Pixiv \u6F2B\u753B\u9875",
      detail: `${mode} \u6A21\u5F0F \xB7 ${reason} \xB7 \u5F53\u524D HTML \u4E2D\u627E\u5230 ${pages.length} \u5F20\u76EE\u6807\u56FE`,
      imageTotal: pages.length || currentPageTotal(),
      queueLength: pageQueue.length,
      translated: completedCount(),
      totalToTranslate: pages.length || currentPageTotal(),
      source: "pixiv-html-dom"
    });
    enqueuePages(pages, reason);
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
      stage: "scan",
      title: "Pixiv \u9875\u9762\u72B6\u6001\u5DF2\u91CD\u7F6E",
      detail: location.href,
      queueLength: 0,
      source: "pixiv-html-dom"
    });
  }
  async function initialize() {
    try {
      await loadConfig();
      if (!isPixivArtworkPage()) {
        console.log("[MangaLens] \u975E Pixiv \u4F5C\u54C1\u9875\uFF0CPixiv \u4E13\u7528\u7FFB\u8BD1\u5668\u672A\u542F\u52A8");
        return;
      }
      startTimerPanel();
      scheduleProcess("\u521D\u59CB\u5316", 1e3);
      window.addEventListener("scroll", () => {
        overlayManager.schedulePositionSync();
        scheduleProcess("\u6EDA\u52A8\u505C\u6B62");
      }, { passive: true });
      window.addEventListener("resize", () => {
        overlayManager.schedulePositionSync();
        scheduleProcess("\u7A97\u53E3\u5C3A\u5BF8\u53D8\u5316", 500);
      });
      const observer = new MutationObserver(() => {
        overlayManager.schedulePositionSync();
        scheduleProcess("Pixiv DOM \u66F4\u65B0", 900);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener("beforeunload", () => observer.disconnect());
      routeTimer = window.setInterval(() => {
        if (location.href === lastUrl) return;
        lastUrl = location.href;
        resetPageState();
        scheduleProcess("Pixiv \u8DEF\u7531\u53D8\u5316", 1e3);
      }, 1e3);
      console.log("[MangaLens] Pixiv GLM-4.6V translator initialized");
    } catch (error) {
      emitProgress({
        stage: "error",
        title: "MangaLens Pixiv \u521D\u59CB\u5316\u5931\u8D25",
        error: error instanceof Error ? error.message : String(error)
      });
      console.error("[MangaLens] \u521D\u59CB\u5316\u5931\u8D25:", error);
    }
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case "TOGGLE_ENABLED":
        state.isEnabled = message.enabled;
        if (!state.isEnabled) {
          resetPageState();
        } else {
          scheduleProcess("\u91CD\u65B0\u5F00\u542F", 0);
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
        scheduleProcess("\u624B\u52A8\u5237\u65B0", 0);
        sendResponse({ success: true });
        break;
      case "SELECT_IMAGE":
        scheduleProcess("\u4ECE Pixiv HTML \u5F53\u524D\u5BB9\u5668\u91CD\u65B0\u9009\u62E9", 0);
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
    if (timerPanelInterval) window.clearInterval(timerPanelInterval);
  });
})();
