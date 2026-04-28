"use strict";
var MangaLensContent = (() => {
  // src/modules/image-detector.ts
  var EXCLUDED_PATTERNS = [
    /\.gif(?:\?|#|$)/i,
    /doubleclick\.net/i,
    /googlesyndication\.com/i,
    /googleadservices\.com/i,
    /analytics/i,
    /tracking/i,
    /banner/i,
    /advertisement/i,
    /placeholder/i,
    /spacer\.gif/i,
    /transparent\.png/i,
    /icon-/i,
    /social-/i,
    /avatar/i,
    /profile/i
  ];
  var PIXIV_IMAGE_HOST = /(?:^|\.)pximg\.net$/i;
  function isPixivPage() {
    return /(?:^|\.)pixiv\.net$/i.test(location.hostname);
  }
  function normalizeImageUrl(src) {
    if (!src) return "";
    try {
      return new URL(src, location.href).href;
    } catch {
      return src;
    }
  }
  function getLargestSrcFromSrcset(srcset) {
    if (!srcset) return "";
    const candidates = srcset.split(",").map((entry) => entry.trim()).map((entry) => {
      const [url, descriptor] = entry.split(/\s+/);
      const weight = descriptor?.endsWith("w") ? Number.parseInt(descriptor, 10) : descriptor?.endsWith("x") ? Number.parseFloat(descriptor) * 1e3 : 0;
      return { url, weight: Number.isFinite(weight) ? weight : 0 };
    }).filter((entry) => !!entry.url).sort((a, b) => b.weight - a.weight);
    return candidates[0]?.url || "";
  }
  function shouldExcludeImage(src, width, height) {
    if (!src) return true;
    const normalized = normalizeImageUrl(src);
    const isPixivImage = (() => {
      try {
        return PIXIV_IMAGE_HOST.test(new URL(normalized).hostname);
      } catch {
        return /pximg\.net/i.test(normalized);
      }
    })();
    if (isPixivPage() && isPixivImage) {
      return width < 180 || height < 180;
    }
    if (width < 100 || height < 100) return true;
    return EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized));
  }
  function getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    };
  }
  function getImageSrc(img) {
    const source = img.closest("picture")?.querySelector("source");
    return normalizeImageUrl(
      img.currentSrc || getLargestSrcFromSrcset(img.srcset) || img.src || img.dataset.src || img.dataset.lazySrc || img.dataset.original || getLargestSrcFromSrcset(source?.srcset) || ""
    );
  }
  var ImageDetector = class {
    detectMangaImages() {
      const detected = [];
      const seen = /* @__PURE__ */ new Set();
      const push = (info) => {
        if (!info || seen.has(info.src)) return;
        seen.add(info.src);
        detected.push(info);
      };
      document.querySelectorAll("img").forEach((img) => push(this.analyzeImage(img)));
      document.querySelectorAll('[style*="background"], [data-src], [data-lazy-src], [data-original], picture, figure').forEach((element) => push(this.analyzeElement(element)));
      console.log(`[MangaLens] \u68C0\u6D4B\u5230 ${detected.length} \u5F20\u5019\u9009\u56FE\u7247`);
      return detected;
    }
    analyzeImage(img) {
      const rect = img.getBoundingClientRect();
      const width = rect.width || img.naturalWidth || img.width;
      const height = rect.height || img.naturalHeight || img.height;
      const src = getImageSrc(img);
      if (width <= 0 || height <= 0) return null;
      if (shouldExcludeImage(src, width, height)) return null;
      return {
        element: img,
        src,
        position: getElementPosition(img),
        aspectRatio: height / width,
        isManga: true
      };
    }
    analyzeElement(element) {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      let src = "";
      if (element instanceof HTMLImageElement) {
        src = getImageSrc(element);
      } else if (element.dataset.src || element.dataset.lazySrc || element.dataset.original) {
        src = normalizeImageUrl(element.dataset.src || element.dataset.lazySrc || element.dataset.original || "");
      } else if (element.style.backgroundImage) {
        const match = element.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (match) src = normalizeImageUrl(match[1]);
      }
      if (!src) {
        const img = element.querySelector("img");
        if (img) src = getImageSrc(img);
      }
      if (!src) {
        const source = element.querySelector("source");
        src = normalizeImageUrl(getLargestSrcFromSrcset(source?.srcset));
      }
      if (shouldExcludeImage(src, rect.width, rect.height)) return null;
      return {
        element,
        src,
        position: getElementPosition(element),
        aspectRatio: rect.height / rect.width,
        isManga: true
      };
    }
    async selectImage() {
      return new Promise((resolve) => {
        const instruction = document.createElement("div");
        instruction.id = "manga-lens-selector-instruction";
        instruction.textContent = "\u70B9\u51FB\u8981\u7FFB\u8BD1\u7684\u6F2B\u753B\u56FE\u7247\uFF0C\u6309 ESC \u53D6\u6D88";
        instruction.style.cssText = [
          "position: fixed",
          "top: 20px",
          "left: 50%",
          "transform: translateX(-50%)",
          "background: #2563eb",
          "color: white",
          "padding: 12px 18px",
          "border-radius: 8px",
          "font-size: 14px",
          "font-family: Microsoft YaHei, sans-serif",
          "z-index: 2147483647",
          "box-shadow: 0 4px 16px rgba(37, 99, 235, 0.35)"
        ].join(";");
        const cleanup = () => {
          instruction.remove();
          document.removeEventListener("click", onClick, true);
          document.removeEventListener("keydown", onKeyDown, true);
        };
        const onClick = (event) => {
          const target = event.target;
          if (!target) return;
          const img = target instanceof HTMLImageElement ? target : target.closest("img");
          if (!img) return;
          event.preventDefault();
          event.stopPropagation();
          cleanup();
          resolve(this.analyzeImage(img));
        };
        const onKeyDown = (event) => {
          if (event.key !== "Escape") return;
          cleanup();
          resolve(null);
        };
        document.body.appendChild(instruction);
        document.addEventListener("click", onClick, true);
        document.addEventListener("keydown", onKeyDown, true);
      });
    }
    observeNewImages(callback) {
      let debounceTimer;
      const flush = () => {
        window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(() => {
          const images = this.detectMangaImages();
          if (images.length > 0) callback(images);
        }, 350);
      };
      const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const mutation of mutations) {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            shouldScan = true;
            break;
          }
          if (mutation.type === "attributes" && mutation.target instanceof HTMLElement && ["src", "srcset", "style", "data-src", "data-lazy-src", "data-original"].includes(mutation.attributeName || "")) {
            shouldScan = true;
            break;
          }
        }
        if (shouldScan) flush();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "srcset", "style", "data-src", "data-lazy-src", "data-original"]
      });
      return () => {
        window.clearTimeout(debounceTimer);
        observer.disconnect();
      };
    }
  };
  var imageDetector = new ImageDetector();

  // src/modules/zhipu-client.ts
  var ZHIPU_CHAT_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  async function parseJsonResponse(response, serviceName) {
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`${serviceName} returned non-JSON response: ${text.slice(0, 200)}`);
    }
    if (!response.ok) {
      const message = data?.error?.message || data?.msg || data?.message || text;
      throw new Error(`${serviceName} API error ${response.status}: ${message}`);
    }
    if (data?.error) {
      throw new Error(`${serviceName} API error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    return data;
  }
  function convertZhipuOCRResultToOCRResult(result, imageWidth, imageHeight) {
    const boxes = result.items.map((item) => {
      const text = String(item.content || item.text || "").trim();
      const bbox = item.bbox_2d || item.bbox;
      if (!text || !bbox || bbox.length < 4) return null;
      let [x1, y1, x2, y2] = bbox.map(Number);
      const isRatio = [x1, y1, x2, y2].every((value) => Number.isFinite(value) && value >= 0 && value <= 1);
      if (isRatio) {
        x1 *= imageWidth;
        x2 *= imageWidth;
        y1 *= imageHeight;
        y2 *= imageHeight;
      }
      const x = Math.max(0, Math.min(x1, x2));
      const y = Math.max(0, Math.min(y1, y2));
      const width = Math.max(1, Math.abs(x2 - x1));
      const height = Math.max(1, Math.abs(y2 - y1));
      return {
        x,
        y,
        width,
        height,
        text,
        confidence: item.confidence || 1,
        isVertical: height > width * 1.2
      };
    }).filter((box) => !!box);
    return {
      text: boxes.map((box) => box.text).join("\n") || result.text,
      boxes,
      confidence: boxes.length > 0 ? boxes.reduce((sum, box) => sum + box.confidence, 0) / boxes.length : 0
    };
  }
  async function translateWithZhipu(messages, apiKey, model = "glm-4.7", temperature = 0.6, maxTokens = 4e3) {
    if (!apiKey) {
      throw new Error("Zhipu API Key is required for translation");
    }
    const response = await fetch(ZHIPU_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
        thinking: {
          type: "disabled"
        }
      })
    });
    const data = await parseJsonResponse(response, "Zhipu translation");
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Zhipu translation returned an empty response");
    }
    return {
      content,
      requestId: data.id || data.request_id || ""
    };
  }

  // src/modules/dialog-merger.ts
  var DEFAULT_CONFIG = {
    xThreshold: 150,
    // 【调大】X轴容差：同一列的气泡X坐标差异（增大以合并更多）
    yThreshold: 50,
    // 【调大】Y轴容差：同一行的气泡Y坐标差异（增大以合并更多）
    rtlMode: true,
    // 日漫默认从右往左
    verticalMode: true,
    // 日漫默认竖排
    bubblePadding: 8,
    maxMergeDistance: 300
    // 【调大】最大合并距离：增大以合并更远的片段
  };
  var DialogMerger = class {
    config;
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * 合并 OCR 结果中的分散文字
     */
    merge(items) {
      if (items.length === 0) return [];
      const processedItems = items.map((item) => ({
        ...item,
        right: item.x + item.width,
        bottom: item.y + item.height
      }));
      const xGroups = this.groupByXAxis(processedItems);
      const sortedGroups = xGroups.map(
        (group) => [...group].sort((a, b) => a.y - b.y)
      );
      const mergedDialogs = [];
      let dialogId = 0;
      for (const group of sortedGroups) {
        if (group.length === 0) continue;
        let currentDialog = null;
        for (const item of group) {
          if (!currentDialog) {
            currentDialog = this.createMergedDialog(item, dialogId++);
          } else {
            const lastItem = currentDialog.items[currentDialog.items.length - 1];
            const shouldMerge = this.shouldMerge(lastItem, item);
            if (shouldMerge) {
              currentDialog = this.mergeItemToDialog(currentDialog, item);
            } else {
              mergedDialogs.push(currentDialog);
              currentDialog = this.createMergedDialog(item, dialogId++);
            }
          }
        }
        if (currentDialog) {
          mergedDialogs.push(currentDialog);
        }
      }
      console.log(`[DialogMerger] \u5408\u5E76\u5B8C\u6210: ${items.length} \u4E2A\u7247\u6BB5 \u2192 ${mergedDialogs.length} \u4E2A\u5BF9\u8BDD`);
      console.log(`[DialogMerger] X\u8F74\u5206\u7EC4: ${xGroups.length} \u5217`);
      for (let i = 0; i < mergedDialogs.length; i++) {
        const d = mergedDialogs[i];
        const orientation = d.isVertical ? "\u7AD6\u6392" : "\u6A2A\u6392";
        const right = d.boundingBox.x + d.boundingBox.width;
        const bottom = d.boundingBox.y + d.boundingBox.height;
        console.log(`  [Dialog#${i}] "${d.text.slice(0, 30)}${d.text.length > 30 ? "..." : ""}" [${orientation}]`);
        console.log(`    \u8FB9\u754C\u6846: x=${d.boundingBox.x}-${right}, y=${d.boundingBox.y}-${bottom}, \u5C3A\u5BF8: ${d.boundingBox.width}x${d.boundingBox.height}`);
        console.log(`    \u7247\u6BB5\u6570: ${d.items.length}, \u603B\u5B57\u6570: ${d.charCount}`);
        if (d.items.length > 1) {
          console.log(`    \u539F\u59CB\u7247\u6BB5X\u8303\u56F4: [${d.items.map((it) => it.x).join(", ")}]`);
        }
      }
      return mergedDialogs;
    }
    /**
     * 按X轴分组（同一列的气泡）
     * 使用基于密度的聚类：如果片段的X轴中心点在阈值范围内，归为同一组
     */
    groupByXAxis(items) {
      const groups = [];
      const processed = /* @__PURE__ */ new Set();
      for (let i = 0; i < items.length; i++) {
        if (processed.has(i)) continue;
        const item = items[i];
        const itemXCenter = item.x + item.width / 2;
        let addedToGroup = false;
        for (const group of groups) {
          if (group.length > 0) {
            const groupXCenter = group[0].x + group[0].width / 2;
            const xDiff = Math.abs(itemXCenter - groupXCenter);
            if (xDiff <= this.config.xThreshold) {
              group.push(item);
              processed.add(i);
              addedToGroup = true;
              break;
            }
          }
        }
        if (!addedToGroup) {
          groups.push([item]);
          processed.add(i);
        }
      }
      console.log(`[DialogMerger] X\u8F74\u5206\u7EC4\u7ED3\u679C: ${groups.length} \u7EC4`);
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const xRange = group.map((item) => item.x);
        console.log(`  \u7EC4${i}: ${group.length}\u4E2A\u7247\u6BB5, X\u8303\u56F4=[${Math.min(...xRange)}, ${Math.max(...xRange)}]`);
      }
      return groups;
    }
    /**
     * 检查两个片段是否应该合并
     */
    shouldMerge(item1, item2) {
      const bbox1 = { x: item1.x, y: item1.y, right: item1.right, bottom: item1.bottom };
      const yDistance = item2.y - bbox1.bottom;
      const xCenter1 = item1.x + item1.width / 2;
      const xCenter2 = item2.x + item2.width / 2;
      const xDistance = Math.abs(xCenter2 - xCenter1);
      const totalDistance = Math.sqrt(yDistance * yDistance + xDistance * xDistance);
      const shouldMerge = yDistance >= 0 && yDistance <= this.config.yThreshold && xDistance <= this.config.xThreshold && totalDistance <= this.config.maxMergeDistance;
      if (yDistance > 0) {
        console.log(`[DialogMerger] \u5408\u5E76\u68C0\u67E5: "${item1.text.slice(0, 10)}" \u2192 "${item2.text.slice(0, 10)}"`, {
          yDistance: yDistance.toFixed(1),
          xDistance: xDistance.toFixed(1),
          totalDistance: totalDistance.toFixed(1),
          shouldMerge
        });
      }
      return shouldMerge;
    }
    /**
     * 创建合并对话
     */
    createMergedDialog(item, id) {
      const charCount = item.text.length;
      const avgWidth = charCount > 0 ? item.width / charCount : item.width;
      const isVertical = item.height > item.width;
      return {
        id,
        text: item.text,
        items: [{
          text: item.text,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          right: item.right,
          // 添加 right 属性
          bottom: item.bottom,
          // 添加 bottom 属性
          confidence: item.confidence,
          isVertical: item.isVertical
        }],
        boundingBox: {
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height
        },
        charCount,
        charWidth: avgWidth,
        itemCharWidths: [{ charCount, width: item.width, avgWidth }],
        isVertical
      };
    }
    /**
     * 将片段合并到对话
     */
    mergeItemToDialog(dialog, item) {
      const mergedText = dialog.text + item.text;
      let newX, newY;
      if (this.config.verticalMode) {
        newX = Math.min(dialog.boundingBox.x, item.x);
        newY = Math.min(dialog.boundingBox.y, item.y);
      } else {
        newX = Math.min(dialog.boundingBox.x, item.x);
        newY = Math.min(dialog.boundingBox.y, item.y);
      }
      const maxRight = Math.max(dialog.boundingBox.x + dialog.boundingBox.width, item.right);
      const maxBottom = Math.max(dialog.boundingBox.y + dialog.boundingBox.height, item.bottom);
      const newBoundingBox = {
        x: newX,
        y: newY,
        width: maxRight - newX,
        height: maxBottom - newY
      };
      const itemCharCount = item.text.length;
      const itemAvgWidth = itemCharCount > 0 ? item.width / itemCharCount : item.width;
      const newItemCharWidths = [...dialog.itemCharWidths, {
        charCount: itemCharCount,
        width: item.width,
        avgWidth: itemAvgWidth
      }];
      const totalCharCount = dialog.charCount + itemCharCount;
      const totalWidth = dialog.boundingBox.width + item.width;
      const newCharWidth = totalCharCount > 0 ? totalWidth / totalCharCount : itemAvgWidth;
      const itemIsVertical = item.height > item.width;
      const allItemsVertical = [...dialog.items, { isVertical: itemIsVertical }];
      const verticalCount = allItemsVertical.filter((i) => i.isVertical).length;
      const newIsVertical = verticalCount >= allItemsVertical.length / 2;
      return {
        ...dialog,
        text: mergedText,
        items: [...dialog.items, {
          text: item.text,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          right: item.right,
          // 添加 right 属性
          bottom: item.bottom,
          // 添加 bottom 属性
          confidence: item.confidence,
          isVertical: item.isVertical
        }],
        boundingBox: newBoundingBox,
        charCount: mergedText.length,
        charWidth: newCharWidth,
        itemCharWidths: newItemCharWidths,
        isVertical: newIsVertical
      };
    }
    /**
     * 计算气泡边界
     */
    calculateBubbleBounds(dialog, imageWidth, imageHeight) {
      const padding = this.config.bubblePadding;
      const raw = { ...dialog.boundingBox };
      const padded = {
        x: raw.x - padding,
        y: raw.y - padding,
        width: raw.width + padding * 2,
        height: raw.height + padding * 2
      };
      const clipped = {
        x: Math.max(0, padded.x),
        y: Math.max(0, padded.y),
        width: Math.min(imageWidth - padded.x, padded.width),
        height: Math.min(imageHeight - padded.y, padded.height)
      };
      if (clipped.width < 0) clipped.width = 0;
      if (clipped.height < 0) clipped.height = 0;
      return {
        raw,
        padded,
        clipped,
        imageBounds: { width: imageWidth, height: imageHeight }
      };
    }
    /**
     * 批量计算气泡边界
     */
    calculateAllBubbleBounds(dialogs, imageWidth, imageHeight) {
      return dialogs.map((dialog) => ({
        ...dialog,
        bubbleBounds: this.calculateBubbleBounds(dialog, imageWidth, imageHeight)
      }));
    }
    /**
     * 更新配置
     */
    setConfig(config) {
      this.config = { ...this.config, ...config };
    }
  };
  function mergeDialogs(ocrItems, config) {
    const merger = new DialogMerger(config);
    return merger.merge(ocrItems);
  }

  // src/modules/batch-translator.ts
  var DEFAULT_CONFIG2 = {
    apiKey: "",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4.7",
    temperature: 0.6,
    maxTokens: 4e3,
    maxBatchSize: 999,
    targetLanguage: "\u7B80\u4F53\u4E2D\u6587"
  };
  var SYSTEM_PROMPT = `\u4F60\u662F\u4E13\u4E1A\u7684\u6F2B\u753B\u7FFB\u8BD1\u52A9\u624B\u3002

\u4EFB\u52A1\uFF1A\u5C06\u6F2B\u753B OCR \u8BC6\u522B\u51FA\u7684\u53F0\u8BCD\u7FFB\u8BD1\u6210\u81EA\u7136\u3001\u7B80\u6D01\u7684\u7B80\u4F53\u4E2D\u6587\u3002

\u5FC5\u987B\u9075\u5B88\uFF1A
1. \u8F93\u51FA\u683C\u5F0F\u56FA\u5B9A\u4E3A\uFF1A\u3010\u7F16\u53F7\u3011\u8BD1\u6587\u3002
2. \u6BCF\u4E2A\u7F16\u53F7\u53EA\u8F93\u51FA\u4E00\u884C\u3002
3. \u4E0D\u8F93\u51FA\u89E3\u91CA\u3001\u5206\u6790\u3001\u5907\u6CE8\u3001\u5F15\u53F7\u3001\u62EC\u53F7\u6216\u989D\u5916\u524D\u7F00\u3002
4. \u4FDD\u7559\u6F2B\u753B\u53F0\u8BCD\u7684\u8BED\u6C14\uFF0C\u8BD1\u6587\u8981\u53E3\u8BED\u5316\u3002
5. OCR \u6587\u5B57\u53EF\u80FD\u6709\u9519\uFF0C\u7FFB\u8BD1\u524D\u5148\u6309\u4E0A\u4E0B\u6587\u81EA\u884C\u4FEE\u6B63\uFF0C\u518D\u76F4\u63A5\u8F93\u51FA\u8BD1\u6587\u3002
6. \u5982\u679C\u539F\u6587\u4E0D\u662F\u65E5\u6587\uFF0C\u4E5F\u6309\u6700\u5408\u7406\u542B\u4E49\u7FFB\u8BD1\u6210\u7B80\u4F53\u4E2D\u6587\u3002`;
  function buildBatchPrompt(items) {
    return items.map((item) => `\u3010${String(item.id).padStart(3, "0")}\u3011${item.text}`).join("\n");
  }
  function parseTranslationResponse(response, expectedIds) {
    const result = /* @__PURE__ */ new Map();
    const expected = new Set(expectedIds);
    const lines = response.split("\n").map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^【?\s*(\d+)\s*】?\s*(.+)$/);
      if (!match) continue;
      const id = Number.parseInt(match[1], 10);
      const text = match[2].trim();
      if (expected.has(id) && text) {
        result.set(id, text);
      }
    }
    return result;
  }
  var BatchTranslator = class {
    config;
    constructor(config) {
      if (!config.apiKey) {
        throw new Error("\u667A\u8C31 API Key \u4E0D\u80FD\u4E3A\u7A7A");
      }
      this.config = { ...DEFAULT_CONFIG2, ...config };
    }
    async translate(items) {
      if (items.length === 0) {
        return { items: [], successCount: 0, failureCount: 0 };
      }
      try {
        const response = await this.callZhipuAPI(items);
        const translations = parseTranslationResponse(response.content, items.map((item) => item.id));
        const resultItems = items.map((item) => {
          const translated = translations.get(item.id);
          if (translated) {
            return {
              id: item.id,
              originalText: item.text,
              translatedText: translated,
              success: true
            };
          }
          return {
            id: item.id,
            originalText: item.text,
            success: false,
            error: "\u667A\u8C31\u54CD\u5E94\u4E2D\u6CA1\u6709\u627E\u5230\u5BF9\u5E94\u7F16\u53F7\u7684\u8BD1\u6587"
          };
        });
        const successCount = resultItems.filter((item) => item.success).length;
        return {
          items: resultItems,
          successCount,
          failureCount: resultItems.length - successCount,
          requestId: response.requestId
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "\u672A\u77E5\u7FFB\u8BD1\u9519\u8BEF";
        return {
          items: items.map((item) => ({
            id: item.id,
            originalText: item.text,
            success: false,
            error: message
          })),
          successCount: 0,
          failureCount: items.length
        };
      }
    }
    async callZhipuAPI(items) {
      const prompt = buildBatchPrompt(items);
      return translateWithZhipu(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        this.config.apiKey,
        this.config.model,
        this.config.temperature,
        this.config.maxTokens
      );
    }
    async translateInBatches(items, onProgress) {
      const allResults = [];
      let totalSuccess = 0;
      let totalFailure = 0;
      let lastRequestId = "";
      for (let index = 0; index < items.length; index += this.config.maxBatchSize) {
        const batch = items.slice(index, index + this.config.maxBatchSize);
        const result = await this.translate(batch);
        allResults.push(...result.items);
        totalSuccess += result.successCount;
        totalFailure += result.failureCount;
        if (result.requestId) lastRequestId = result.requestId;
        onProgress?.(Math.min(index + this.config.maxBatchSize, items.length), items.length);
        if (index + this.config.maxBatchSize < items.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      return {
        items: allResults,
        successCount: totalSuccess,
        failureCount: totalFailure,
        requestId: lastRequestId
      };
    }
  };

  // src/modules/image-source.ts
  var MAX_CANVAS_PIXELS = 5e6;
  function getCanvasTargetSize(width, height) {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    const pixels = safeWidth * safeHeight;
    if (pixels <= MAX_CANVAS_PIXELS) {
      return { width: safeWidth, height: safeHeight, scale: 1 };
    }
    const scale = Math.sqrt(MAX_CANVAS_PIXELS / pixels);
    return {
      width: Math.max(1, Math.round(safeWidth * scale)),
      height: Math.max(1, Math.round(safeHeight * scale)),
      scale
    };
  }
  async function waitForImageDecode(imageElement) {
    if (imageElement.complete && imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0) return;
    await Promise.race([
      imageElement.decode?.().catch(() => void 0),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
  }
  async function captureImageElementAsBase64(imageElement) {
    await waitForImageDecode(imageElement);
    const naturalWidth = imageElement.naturalWidth || imageElement.width || imageElement.clientWidth;
    const naturalHeight = imageElement.naturalHeight || imageElement.height || imageElement.clientHeight;
    if (!naturalWidth || !naturalHeight) {
      throw new Error("\u9875\u9762\u56FE\u7247\u5C1A\u672A\u5B8C\u6210\u52A0\u8F7D\uFF0C\u65E0\u6CD5\u4ECE HTMLImageElement \u8BFB\u53D6\u5C3A\u5BF8");
    }
    const target = getCanvasTargetSize(naturalWidth, naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d", { willReadFrequently: false });
    if (!context) {
      throw new Error("\u65E0\u6CD5\u521B\u5EFA Canvas \u4EE5\u8BFB\u53D6\u9875\u9762\u56FE\u7247");
    }
    context.drawImage(imageElement, 0, 0, target.width, target.height);
    let base64;
    try {
      base64 = canvas.toDataURL("image/png");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`\u9875\u9762\u56FE\u7247 Canvas \u8BFB\u53D6\u5931\u8D25\uFF0C\u53EF\u80FD\u88AB\u8DE8\u57DF\u5B89\u5168\u7B56\u7565\u62E6\u622A: ${message}`);
    }
    if (!base64 || base64 === "data:,") {
      throw new Error("\u9875\u9762\u56FE\u7247 Canvas \u5BFC\u51FA\u4E3A\u7A7A");
    }
    const scaleMessage = target.scale < 1 ? `\uFF0C\u4E3A\u63A7\u5236 OCR \u8D1F\u8F7D\u5DF2\u7F29\u653E\u5230 ${target.width}x${target.height}` : "";
    return {
      base64,
      sourceWidth: target.width,
      sourceHeight: target.height,
      method: "element-canvas",
      message: `\u5DF2\u76F4\u63A5\u8BFB\u53D6\u9875\u9762 HTML \u56FE\u7247 ${naturalWidth}x${naturalHeight}${scaleMessage}`
    };
  }

  // src/modules/ocr-engine.ts
  async function getExtensionConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["zhipuApiKey", "zhipuOcrModel", "zhipuTranslationModel"],
        (result) => {
          resolve({
            zhipuApiKey: result.zhipuApiKey || "",
            zhipuOcrModel: result.zhipuOcrModel || "glm-ocr",
            zhipuTranslationModel: result.zhipuTranslationModel || "glm-4.7"
          });
        }
      );
    });
  }
  function getImageUrl(imageElement) {
    return imageElement.currentSrc || imageElement.src || imageElement.dataset.src || imageElement.dataset.lazySrc || "";
  }
  function scaleResultToImageSize(result, fromWidth, fromHeight, toWidth, toHeight) {
    if (!fromWidth || !fromHeight || fromWidth === toWidth && fromHeight === toHeight) return result;
    const scaleX = toWidth / fromWidth;
    const scaleY = toHeight / fromHeight;
    return {
      ...result,
      boxes: result.boxes.map((box) => ({
        ...box,
        x: box.x * scaleX,
        y: box.y * scaleY,
        width: box.width * scaleX,
        height: box.height * scaleY
      }))
    };
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
  var MangaOCR = class {
    isInitialized = false;
    config = {
      zhipuApiKey: "",
      zhipuOcrModel: "glm-ocr",
      zhipuTranslationModel: "glm-4.7"
    };
    async initialize() {
      if (this.isInitialized) return;
      this.config = await getExtensionConfig();
      this.isInitialized = true;
      console.log("[MangaLens] OCR initialized with Zhipu API");
    }
    async configureZhipuAPI(apiKey, translationModel = "glm-4.7", ocrModel = "glm-ocr") {
      this.config = {
        zhipuApiKey: apiKey,
        zhipuTranslationModel: translationModel || "glm-4.7",
        zhipuOcrModel: ocrModel || "glm-ocr"
      };
      await chrome.storage.local.set(this.config);
      this.isInitialized = true;
    }
    async recognize(imageElement) {
      if (!this.isInitialized) {
        await this.initialize();
      }
      if (!this.config.zhipuApiKey) {
        throw new Error("\u672A\u914D\u7F6E\u667A\u8C31 API Key\uFF0C\u8BF7\u5148\u5728\u6269\u5C55\u8BBE\u7F6E\u4E2D\u586B\u5199");
      }
      const imageUrl = getImageUrl(imageElement);
      if (!imageUrl) {
        throw new Error("\u65E0\u6CD5\u83B7\u53D6\u56FE\u7247\u5730\u5740");
      }
      const warnings = [];
      try {
        return await this.recognizeViaElementCanvas(imageElement, warnings);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`element-canvas \u5931\u8D25: ${message}`);
        console.warn("[MangaLens] element-canvas OCR \u5931\u8D25\uFF0C\u5C1D\u8BD5 background fetch:", error);
      }
      return this.recognizeViaBackground(imageElement, imageUrl, warnings);
    }
    async recognizeViaElementCanvas(imageElement, warnings) {
      const captured = await captureImageElementAsBase64(imageElement);
      const response = await sendMessageToBackground({
        target: "background",
        type: "RECOGNIZE_ZHIPU_OCR_BASE64",
        imageBase64: captured.base64,
        source: captured.method,
        sourceWidth: captured.sourceWidth,
        sourceHeight: captured.sourceHeight,
        sourceMessage: captured.message,
        apiKey: this.config.zhipuApiKey,
        model: this.config.zhipuOcrModel
      });
      if (!response?.success) {
        throw new Error(response?.message || "\u9875\u9762\u56FE\u7247 OCR \u8BC6\u522B\u5931\u8D25");
      }
      const naturalWidth = imageElement.naturalWidth || imageElement.width || captured.sourceWidth;
      const naturalHeight = imageElement.naturalHeight || imageElement.height || captured.sourceHeight;
      const sourceWidth = Number(response.sourceWidth) || captured.sourceWidth;
      const sourceHeight = Number(response.sourceHeight) || captured.sourceHeight;
      const ocrResult = convertZhipuOCRResultToOCRResult(
        {
          text: response.text || "",
          items: response.items || [],
          requestId: response.requestId,
          raw: response
        },
        sourceWidth,
        sourceHeight
      );
      const scaled = scaleResultToImageSize(ocrResult, sourceWidth, sourceHeight, naturalWidth, naturalHeight);
      return {
        ...scaled,
        source: "element-canvas",
        sourceMessage: response.sourceMessage || captured.message,
        sourceWidth,
        sourceHeight,
        requestId: response.requestId,
        warnings
      };
    }
    async recognizeViaBackground(imageElement, imageUrl, warnings = []) {
      const rect = imageElement.getBoundingClientRect();
      const cropRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
      const response = await sendMessageToBackground({
        target: "background",
        type: "FETCH_IMAGE_AND_ZHIPU_OCR",
        imageUrl,
        pageUrl: window.location.href,
        cropRect,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        apiKey: this.config.zhipuApiKey,
        model: this.config.zhipuOcrModel
      });
      if (!response?.success) {
        rejectWithWarnings(response?.message || "\u667A\u8C31 OCR \u8BC6\u522B\u5931\u8D25", warnings);
      }
      const naturalWidth = imageElement.naturalWidth || imageElement.width || Math.round(cropRect.width);
      const naturalHeight = imageElement.naturalHeight || imageElement.height || Math.round(cropRect.height);
      const sourceWidth = Number(response.sourceWidth) || naturalWidth;
      const sourceHeight = Number(response.sourceHeight) || naturalHeight;
      const ocrResult = convertZhipuOCRResultToOCRResult(
        {
          text: response.text || "",
          items: response.items || [],
          requestId: response.requestId,
          raw: response
        },
        sourceWidth,
        sourceHeight
      );
      const scaled = scaleResultToImageSize(ocrResult, sourceWidth, sourceHeight, naturalWidth, naturalHeight);
      return {
        ...scaled,
        source: response.source || response.fallback || "background-fetch",
        sourceMessage: response.sourceMessage,
        sourceWidth,
        sourceHeight,
        requestId: response.requestId,
        warnings
      };
    }
    async recognizeAndMerge(imageElement, mergerConfig) {
      const rawResult = await this.recognize(imageElement);
      const imageWidth = imageElement.naturalWidth || imageElement.width;
      const imageHeight = imageElement.naturalHeight || imageElement.height;
      const ocrItems = rawResult.boxes.map((box) => ({
        text: box.text,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.x + box.width,
        bottom: box.y + box.height,
        confidence: box.confidence,
        isVertical: box.isVertical
      }));
      const dialogs = mergeDialogs(ocrItems, mergerConfig);
      const merger = new DialogMerger(mergerConfig);
      const dialogsWithBounds = merger.calculateAllBubbleBounds(dialogs, imageWidth, imageHeight);
      return {
        dialogs: dialogsWithBounds,
        rawResult,
        imageSize: { width: imageWidth, height: imageHeight }
      };
    }
    async recognizeAndTranslate(imageElement, mergerConfig, zhipuApiKey, onProgress) {
      const { dialogs, rawResult, imageSize } = await this.recognizeAndMerge(imageElement, mergerConfig);
      if (dialogs.length === 0) {
        return {
          dialogs,
          translation: { items: [], successCount: 0, failureCount: 0 },
          rawResult,
          imageSize
        };
      }
      const apiKey = zhipuApiKey || this.config.zhipuApiKey;
      if (!apiKey) {
        throw new Error("\u672A\u914D\u7F6E\u667A\u8C31 API Key\uFF0C\u65E0\u6CD5\u7FFB\u8BD1");
      }
      onProgress?.("translating", 0);
      const translator = new BatchTranslator({
        apiKey,
        model: this.config.zhipuTranslationModel
      });
      const translationItems = dialogs.map((dialog, index) => ({
        id: index,
        text: dialog.text
      }));
      const translation = await translator.translateInBatches(translationItems, (completed, total) => {
        onProgress?.("translating", Math.round(completed / total * 100));
      });
      const translatedDialogs = dialogs.map((dialog, index) => {
        const item = translation.items.find((entry) => entry.id === index);
        return {
          ...dialog,
          translatedText: item?.translatedText || dialog.text,
          translationSuccess: !!item?.success
        };
      });
      return {
        dialogs: translatedDialogs,
        translation,
        rawResult,
        imageSize
      };
    }
  };
  function rejectWithWarnings(message, warnings) {
    const detail = warnings.length > 0 ? `\uFF1B\u6B64\u524D\u5C1D\u8BD5: ${warnings.join("\uFF1B")}` : "";
    throw new Error(`${message}${detail}`);
  }
  var mangaOCR = new MangaOCR();

  // src/modules/translation-overlay.ts
  var DEFAULT_RENDER_CONFIG = {
    horizontalText: true,
    fontSize: 14,
    color: "#000000",
    background: "#FFFFFF",
    backgroundOpacity: 0.86,
    padding: 3,
    maxLines: 10
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
  function getImageNaturalSize(imageElement) {
    return {
      width: imageElement.naturalWidth || imageElement.width || imageElement.clientWidth || 1,
      height: imageElement.naturalHeight || imageElement.height || imageElement.clientHeight || 1
    };
  }
  function getDialogBounds(dialog) {
    return dialog.bubbleBounds?.clipped || dialog.bubbleBounds?.padded || dialog.bubbleBounds?.raw || dialog.boundingBox;
  }
  var TranslationOverlayManager = class {
    container = null;
    overlays = /* @__PURE__ */ new Map();
    containerId = "manga-lens-overlay-container";
    overlayClass = "manga-lens-text-overlay";
    createContainer(_parent) {
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
    renderTranslation(imageElement, box, translatedText) {
      const dialog = {
        id: Date.now(),
        text: box.text,
        items: [],
        boundingBox: { x: box.x, y: box.y, width: box.width, height: box.height },
        charCount: box.text.length,
        charWidth: Math.max(8, box.width / Math.max(1, box.text.length)),
        itemCharWidths: [],
        translatedText,
        translationSuccess: true,
        isVertical: box.isVertical
      };
      return this.renderMergedDialog(imageElement, dialog, { horizontalText: !box.isVertical });
    }
    renderBatch(imageElement, boxes, translations) {
      const ids = [];
      translations.forEach((translation, index) => {
        const box = boxes[index];
        if (box && translation) {
          ids.push(this.renderTranslation(imageElement, box, translation.translatedText));
        }
      });
      return ids;
    }
    removeOverlay(id) {
      const overlay = this.overlays.get(id);
      if (!overlay) return;
      overlay.element.remove();
      this.overlays.delete(id);
    }
    removeAllOverlays() {
      this.overlays.forEach((overlay) => overlay.element.remove());
      this.overlays.clear();
      this.removeContainer();
    }
    removeContainer() {
      const existing = document.getElementById(this.containerId);
      existing?.remove();
      this.container = null;
    }
    getOverlayCount() {
      return this.overlays.size;
    }
    hasOverlays() {
      return this.overlays.size > 0;
    }
    removeOverlaysForImage(imageElement) {
      for (const [id, overlay] of this.overlays.entries()) {
        if (overlay.imageElement === imageElement) {
          overlay.element.remove();
          this.overlays.delete(id);
        }
      }
    }
    renderMergedDialog(imageElement, dialog, config) {
      const cfg = { ...DEFAULT_RENDER_CONFIG, ...config };
      const container = this.container || this.createContainer();
      const id = `ml-overlay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const natural = getImageNaturalSize(imageElement);
      const imageRect = getDocumentRect(imageElement);
      const bounds = getDialogBounds(dialog);
      const safeX = clamp(bounds.x, 0, natural.width);
      const safeY = clamp(bounds.y, 0, natural.height);
      const safeWidth = clamp(bounds.width, 1, natural.width - safeX || natural.width);
      const safeHeight = clamp(bounds.height, 1, natural.height - safeY || natural.height);
      const scaleX = imageRect.width / natural.width;
      const scaleY = imageRect.height / natural.height;
      let leftPx = imageRect.left + safeX * scaleX;
      let topPx = imageRect.top + safeY * scaleY;
      let widthPx = Math.max(18, safeWidth * scaleX);
      let heightPx = Math.max(18, safeHeight * scaleY);
      const text = dialog.translatedText || dialog.text;
      const isVertical = cfg.horizontalText ? false : !!dialog.isVertical;
      if (cfg.horizontalText) {
        const estimatedWidth = clamp(text.length * (cfg.fontSize * 0.86), widthPx, imageRect.width * 0.55);
        const estimatedHeight = clamp(Math.ceil(text.length / Math.max(4, Math.floor(estimatedWidth / (cfg.fontSize * 0.9)))) * cfg.fontSize * 1.45, heightPx, imageRect.height * 0.22);
        leftPx -= (estimatedWidth - widthPx) / 2;
        topPx -= (estimatedHeight - heightPx) / 2;
        widthPx = estimatedWidth;
        heightPx = estimatedHeight;
      } else if (isVertical) {
        const estimatedWidth = clamp(Math.ceil(text.length / 8) * cfg.fontSize * 1.3, widthPx, imageRect.width * 0.35);
        leftPx -= (estimatedWidth - widthPx) / 2;
        widthPx = estimatedWidth;
      }
      leftPx = clamp(leftPx, imageRect.left, Math.max(imageRect.left, imageRect.right - widthPx));
      topPx = clamp(topPx, imageRect.top, Math.max(imageRect.top, imageRect.bottom - heightPx));
      const overlay = document.createElement("div");
      overlay.id = id;
      overlay.className = this.overlayClass;
      overlay.textContent = text;
      const fontSize = this.calculateFontSizeForDialog(dialog, text, widthPx, cfg);
      const bgWithOpacity = this.hexToRgba(cfg.background, cfg.backgroundOpacity);
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
        `writing-mode:${cfg.horizontalText ? "horizontal-tb" : "vertical-rl"}`
      ].join(";");
      if (dialog.translationSuccess === false) {
        overlay.style.border = "1px dashed #ef4444";
        overlay.title = "\u7FFB\u8BD1\u5931\u8D25\uFF0C\u4F7F\u7528\u539F\u6587";
      }
      container.appendChild(overlay);
      this.overlays.set(id, {
        id,
        originalBox: {
          ...dialog.boundingBox,
          text: dialog.text,
          confidence: 1,
          isVertical: dialog.isVertical || false
        },
        translatedText: text,
        element: overlay,
        imageElement
      });
      return id;
    }
    renderMergedDialogs(imageElement, dialogs, config) {
      this.removeOverlaysForImage(imageElement);
      const ids = [];
      for (const dialog of dialogs) {
        if (dialog.translatedText || dialog.text) {
          ids.push(this.renderMergedDialog(imageElement, dialog, config));
        }
      }
      console.log(`[Overlay] \u6E32\u67D3\u5B8C\u6210: ${ids.length} \u4E2A\u8986\u76D6\u5C42`);
      return ids;
    }
    rerenderOverlays(_imageElement) {
    }
    calculateFontSize(boxWidth, config) {
      return clamp(Math.floor(boxWidth / 5), 10, config.fontSize);
    }
    calculateFontSizeForDialog(dialog, translatedText, boxWidth, config) {
      if (!dialog.charWidth || dialog.charWidth <= 0 || !dialog.charCount) {
        return this.calculateFontSize(boxWidth, config);
      }
      const translatedCharCount = Math.max(1, translatedText.length);
      const scaleFactor = Math.min(1, Math.sqrt(dialog.charCount / translatedCharCount));
      return clamp(Math.round(dialog.charWidth * 0.95 * scaleFactor), 10, config.fontSize);
    }
    hexToRgba(hex, alpha) {
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
    updateStyle(style) {
      const styleElement = document.getElementById("manga-lens-styles") || this.createStyleElement();
      styleElement.textContent = `
      .manga-lens-text-overlay {
        ${style.background ? `background: ${style.background};` : ""}
        ${style.color ? `color: ${style.color};` : ""}
        ${style.fontSize ? `font-size: ${style.fontSize}px;` : ""}
        ${style.opacity !== void 0 ? `opacity: ${style.opacity};` : ""}
      }
    `;
    }
    createStyleElement() {
      const style = document.createElement("style");
      style.id = "manga-lens-styles";
      document.head.appendChild(style);
      return style;
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
      if (elapsed) parts.push(`\u8017\u65F6 ${elapsed}`);
      const detailParts = [];
      if (update.source) detailParts.push(`\u6765\u6E90: ${update.source}`);
      if (update.ocrBoxes !== void 0) detailParts.push(`OCR\u6846: ${update.ocrBoxes}`);
      if (update.dialogs !== void 0) detailParts.push(`\u5BF9\u8BDD: ${update.dialogs}`);
      if (update.totalToTranslate !== void 0) detailParts.push(`\u7FFB\u8BD1: ${update.translated || 0}/${update.totalToTranslate}`);
      if (update.rendered !== void 0) detailParts.push(`\u6E32\u67D3: ${update.rendered}`);
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
      if (subtitle) subtitle.textContent = [parts.join(" \xB7 "), update.detail, detailParts.join(" \xB7 ")].filter(Boolean).join("\n");
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
          this.update(this.lastUpdate);
        }
      });
    }
    renderBody(update) {
      const rows = [
        ["\u9636\u6BB5", STAGE_LABEL[update.stage]],
        ["\u56FE\u7247", update.imageIndex && update.imageTotal ? `${update.imageIndex}/${update.imageTotal}` : void 0],
        ["\u961F\u5217", update.queueLength],
        ["\u6765\u6E90", update.source],
        ["OCR \u6587\u672C\u6846", update.ocrBoxes],
        ["\u5408\u5E76\u5BF9\u8BDD", update.dialogs],
        ["\u7FFB\u8BD1\u8FDB\u5EA6", update.totalToTranslate !== void 0 ? `${update.translated || 0}/${update.totalToTranslate}` : void 0],
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

  // src/content-script.ts
  var FAILED_IMAGE_COOLDOWN_MS = 15e3;
  var IMAGE_PROCESS_DELAY_MS = 250;
  var MAX_IMAGES_PER_SCAN = 6;
  var PROCESS_QUEUE_CONCURRENCY = 1;
  var state = {
    isEnabled: true,
    isProcessing: false,
    processedImages: /* @__PURE__ */ new Set(),
    processingImages: /* @__PURE__ */ new Set(),
    failedImages: /* @__PURE__ */ new Map(),
    zhipuApiKey: "",
    zhipuTranslationModel: "glm-4.7",
    zhipuOcrModel: "glm-ocr",
    pageGeneration: 0
  };
  var scanTimer;
  var activeWorkers = 0;
  var totalEnqueuedInGeneration = 0;
  var processQueue = [];
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function asImageElement(element) {
    if (element instanceof HTMLImageElement) return element;
    const nested = element.querySelector("img");
    return nested instanceof HTMLImageElement ? nested : null;
  }
  function getImageSrc2(image, imageElement) {
    return image.src || imageElement.currentSrc || imageElement.src || imageElement.dataset.src || imageElement.dataset.lazySrc || "";
  }
  function shortImageName(src) {
    try {
      const url = new URL(src);
      const name = url.pathname.split("/").pop() || url.hostname;
      return `${url.hostname}/${name}`;
    } catch {
      return src.slice(0, 80);
    }
  }
  function isProbablyVisible(imageElement) {
    const rect = imageElement.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) return false;
    const margin = Math.max(window.innerHeight * 1.5, 900);
    return rect.bottom > -margin && rect.top < window.innerHeight + margin;
  }
  function buildFallbackDetectedImage(img) {
    const rect = img.getBoundingClientRect();
    return {
      element: img,
      src: img.currentSrc || img.src || img.dataset.src || img.dataset.lazySrc || "",
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
  async function updatePopupStatus() {
    try {
      chrome.runtime.sendMessage({
        type: "UPDATE_STATUS",
        processedCount: state.processedImages.size,
        cacheSize: 0
      });
    } catch {
    }
  }
  async function waitForImageReady(imageElement) {
    if (imageElement.complete && imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0) {
      return true;
    }
    await Promise.race([
      imageElement.decode?.().catch(() => void 0),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
    return imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0;
  }
  function createMergerForPage() {
    const isPixiv = /(?:^|\.)pixiv\.net$/i.test(location.hostname);
    return new DialogMerger({
      yThreshold: isPixiv ? 42 : 50,
      xThreshold: isPixiv ? 90 : 150,
      rtlMode: true,
      bubblePadding: isPixiv ? 3 : 8,
      maxMergeDistance: isPixiv ? 220 : 300
    });
  }
  async function processImage(image, generation = state.pageGeneration) {
    const imageElement = asImageElement(image.element);
    if (!imageElement) return;
    const imageSrc = getImageSrc2(image, imageElement);
    const imageIndex = Math.min(totalEnqueuedInGeneration, state.processedImages.size + state.processingImages.size + 1);
    const startedAt = Date.now();
    if (!isProbablyVisible(imageElement)) {
      progressReporter.update({
        stage: "skip",
        title: "\u8DF3\u8FC7\u4E0D\u53EF\u89C1\u56FE\u7247",
        detail: imageSrc ? shortImageName(imageSrc) : "\u56FE\u7247\u4E0D\u5728\u5F53\u524D\u9875\u9762\u9644\u8FD1",
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length
      });
      return;
    }
    progressReporter.update({
      stage: "image-ready",
      title: "\u7B49\u5F85\u56FE\u7247\u52A0\u8F7D\u5B8C\u6210",
      detail: imageSrc ? shortImageName(imageSrc) : "\u8BFB\u53D6\u9875\u9762\u56FE\u7247\u5143\u7D20",
      imageIndex,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length
    });
    if (!await waitForImageReady(imageElement)) {
      progressReporter.update({
        stage: "skip",
        title: "\u56FE\u7247\u5C1A\u672A\u52A0\u8F7D\u5B8C\u6210\uFF0C\u5DF2\u8DF3\u8FC7",
        detail: imageSrc ? shortImageName(imageSrc) : void 0,
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        warning: "naturalWidth/naturalHeight \u4E3A\u7A7A"
      });
      return;
    }
    const resolvedSrc = getImageSrc2(image, imageElement);
    if (!resolvedSrc) return;
    if (state.processedImages.has(resolvedSrc) || state.processingImages.has(resolvedSrc)) return;
    const lastFailedAt = state.failedImages.get(resolvedSrc);
    if (lastFailedAt && Date.now() - lastFailedAt < FAILED_IMAGE_COOLDOWN_MS) {
      progressReporter.update({
        stage: "skip",
        title: "\u56FE\u7247\u5904\u4E8E\u5931\u8D25\u51B7\u5374\u4E2D",
        detail: shortImageName(resolvedSrc),
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        warning: "15 \u79D2\u5185\u4E0D\u91CD\u590D\u8BF7\u6C42\u5931\u8D25\u56FE\u7247"
      });
      return;
    }
    if (!state.zhipuApiKey) {
      progressReporter.update({
        stage: "error",
        title: "\u7F3A\u5C11\u667A\u8C31 API Key",
        detail: "\u8BF7\u5148\u5728\u6269\u5C55\u8BBE\u7F6E\u4E2D\u586B\u5199 API Key",
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length
      });
      console.error("[MangaLens] \u672A\u914D\u7F6E\u667A\u8C31 API Key\uFF0C\u8BF7\u5148\u5728\u6269\u5C55\u8BBE\u7F6E\u4E2D\u586B\u5199\u3002");
      return;
    }
    state.processingImages.add(resolvedSrc);
    try {
      progressReporter.update({
        stage: "image-source",
        title: "\u83B7\u53D6\u56FE\u7247\u6570\u636E\u5E76\u63D0\u4EA4 OCR",
        detail: shortImageName(resolvedSrc),
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        elapsedMs: Date.now() - startedAt
      });
      const ocrResult = await mangaOCR.recognize(imageElement);
      if (generation !== state.pageGeneration || !state.isEnabled) return;
      progressReporter.update({
        stage: "ocr",
        title: "OCR \u8BC6\u522B\u5B8C\u6210",
        detail: ocrResult.sourceMessage || shortImageName(resolvedSrc),
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        source: ocrResult.source || "unknown",
        ocrBoxes: ocrResult.boxes.length,
        warning: ocrResult.warnings?.join("\uFF1B"),
        elapsedMs: Date.now() - startedAt
      });
      if (ocrResult.boxes.length === 0) {
        state.processedImages.add(resolvedSrc);
        progressReporter.update({
          stage: "done",
          title: "OCR \u672A\u8BC6\u522B\u5230\u6587\u5B57",
          detail: shortImageName(resolvedSrc),
          imageIndex,
          imageTotal: totalEnqueuedInGeneration,
          queueLength: processQueue.length,
          source: ocrResult.source || "unknown",
          ocrBoxes: 0,
          elapsedMs: Date.now() - startedAt
        });
        return;
      }
      progressReporter.update({
        stage: "merge",
        title: "\u6B63\u5728\u5408\u5E76 OCR \u6587\u672C\u6846",
        detail: `${ocrResult.boxes.length} \u4E2A\u6587\u672C\u6846`,
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        source: ocrResult.source || "unknown",
        ocrBoxes: ocrResult.boxes.length,
        elapsedMs: Date.now() - startedAt
      });
      const ocrItems = ocrResult.boxes.map((box) => ({
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
        stage: "merge",
        title: "\u6587\u672C\u6846\u5408\u5E76\u5B8C\u6210",
        detail: `${ocrResult.boxes.length} \u4E2A\u6587\u672C\u6846 \u2192 ${mergedDialogs.length} \u6BB5\u5BF9\u8BDD`,
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        source: ocrResult.source || "unknown",
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
        stage: "translate",
        title: `\u6B63\u5728\u7FFB\u8BD1 ${mergedDialogs.length} \u6BB5\u5BF9\u8BDD`,
        detail: mergedDialogs[0]?.text?.slice(0, 40),
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        source: ocrResult.source || "unknown",
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
          stage: "translate",
          title: `\u6B63\u5728\u7FFB\u8BD1 ${total} \u6BB5\u5BF9\u8BDD`,
          detail: `\u5DF2\u5B8C\u6210 ${completed}/${total}`,
          imageIndex,
          imageTotal: totalEnqueuedInGeneration,
          queueLength: processQueue.length,
          source: ocrResult.source || "unknown",
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
        stage: "render",
        title: "\u6B63\u5728\u6E32\u67D3\u8BD1\u6587\u8986\u76D6\u5C42",
        detail: `\u7FFB\u8BD1\u6210\u529F ${translationResult.successCount} \u6BB5\uFF0C\u5931\u8D25 ${translationResult.failureCount} \u6BB5`,
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        source: ocrResult.source || "unknown",
        ocrBoxes: ocrResult.boxes.length,
        dialogs: mergedDialogs.length,
        translated: translationResult.successCount,
        totalToTranslate: mergedDialogs.length,
        elapsedMs: Date.now() - startedAt
      });
      const overlayIds = overlayManager.renderMergedDialogs(imageElement, mergedDialogs, {
        horizontalText: true,
        fontSize: 14,
        background: "#FFFFFF",
        backgroundOpacity: 0.86,
        padding: 3
      });
      state.processedImages.add(resolvedSrc);
      state.failedImages.delete(resolvedSrc);
      await updatePopupStatus();
      progressReporter.update({
        stage: "done",
        title: "\u5F53\u524D\u56FE\u7247\u7FFB\u8BD1\u5B8C\u6210",
        detail: shortImageName(resolvedSrc),
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        source: ocrResult.source || "unknown",
        ocrBoxes: ocrResult.boxes.length,
        dialogs: mergedDialogs.length,
        translated: translationResult.successCount,
        totalToTranslate: mergedDialogs.length,
        rendered: overlayIds.length,
        warning: ocrResult.source === "visible-tab-capture" ? "\u5F53\u524D\u4F7F\u7528\u622A\u56FE OCR\uFF0C\u6EDA\u52A8\u6216\u5207\u6362\u9605\u8BFB\u6A21\u5F0F\u65F6\u53EF\u80FD\u9519\u4F4D" : void 0,
        elapsedMs: Date.now() - startedAt
      });
    } catch (error) {
      state.failedImages.set(resolvedSrc, Date.now());
      const message = error instanceof Error ? error.message : String(error);
      progressReporter.update({
        stage: "error",
        title: "\u56FE\u7247\u5904\u7406\u5931\u8D25",
        detail: shortImageName(resolvedSrc),
        imageIndex,
        imageTotal: totalEnqueuedInGeneration,
        queueLength: processQueue.length,
        error: message,
        elapsedMs: Date.now() - startedAt
      });
      console.error("[MangaLens] \u56FE\u7247\u5904\u7406\u5931\u8D25:", error);
    } finally {
      state.processingImages.delete(resolvedSrc);
    }
  }
  function enqueueImages(images) {
    const existing = new Set(processQueue.map((item) => item.src));
    const candidates = images.filter((image) => {
      const img = asImageElement(image.element);
      if (!img) return false;
      const src = getImageSrc2(image, img);
      return src && !existing.has(src) && !state.processedImages.has(src) && !state.processingImages.has(src);
    }).sort((a, b) => a.position.y - b.position.y).slice(0, MAX_IMAGES_PER_SCAN);
    if (candidates.length === 0) return;
    processQueue.push(...candidates);
    totalEnqueuedInGeneration = Math.max(totalEnqueuedInGeneration, state.processedImages.size + state.processingImages.size + processQueue.length);
    progressReporter.update({
      stage: "queued",
      title: "\u5DF2\u52A0\u5165\u56FE\u7247\u7FFB\u8BD1\u961F\u5217",
      detail: `\u65B0\u589E ${candidates.length} \u5F20\u5019\u9009\u56FE\u7247`,
      imageTotal: totalEnqueuedInGeneration,
      queueLength: processQueue.length
    });
    void drainQueue();
  }
  async function drainQueue() {
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
  function scheduleScan(delay = 400) {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      if (!state.isEnabled) return;
      progressReporter.update({
        stage: "scan",
        title: "\u6B63\u5728\u626B\u63CF\u9875\u9762\u56FE\u7247",
        detail: location.hostname,
        queueLength: processQueue.length
      });
      enqueueImages(imageDetector.detectMangaImages());
    }, delay);
  }
  async function selectImageManually() {
    const image = await imageDetector.selectImage();
    if (image) {
      totalEnqueuedInGeneration = Math.max(totalEnqueuedInGeneration, state.processedImages.size + 1);
      await processImage(image);
    }
  }
  async function loadConfig() {
    const stored = await chrome.storage.local.get([
      "zhipuApiKey",
      "zhipuTranslationModel",
      "zhipuOcrModel",
      "isEnabled"
    ]);
    state.zhipuApiKey = stored.zhipuApiKey || "";
    state.zhipuTranslationModel = stored.zhipuTranslationModel || "glm-4.7";
    state.zhipuOcrModel = stored.zhipuOcrModel || "glm-ocr";
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
  function resetPageState() {
    state.pageGeneration += 1;
    processQueue.length = 0;
    totalEnqueuedInGeneration = 0;
    state.processingImages.clear();
    state.processedImages.clear();
    state.failedImages.clear();
    overlayManager.removeAllOverlays();
    progressReporter.update({
      stage: "scan",
      title: "\u9875\u9762\u72B6\u6001\u5DF2\u91CD\u7F6E\uFF0C\u51C6\u5907\u91CD\u65B0\u626B\u63CF",
      detail: location.href,
      queueLength: 0
    });
  }
  async function initialize() {
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
      window.addEventListener("scroll", () => scheduleScan(350), { passive: true });
      window.addEventListener("resize", () => {
        if (!state.isEnabled) return;
        overlayManager.removeAllOverlays();
        state.processedImages.clear();
        totalEnqueuedInGeneration = processQueue.length;
        scheduleScan(350);
      });
      window.addEventListener("beforeunload", cleanup);
      let lastUrl = location.href;
      setInterval(() => {
        if (location.href === lastUrl) return;
        lastUrl = location.href;
        resetPageState();
        scheduleScan(900);
      }, 1e3);
      console.log("[MangaLens] Content script initialized with Zhipu API");
    } catch (error) {
      console.error("[MangaLens] \u521D\u59CB\u5316\u5931\u8D25:", error);
      progressReporter.update({
        stage: "error",
        title: "MangaLens \u521D\u59CB\u5316\u5931\u8D25",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  window.addEventListener("manga-lens-rerender", async (event) => {
    const customEvent = event;
    const imageSrc = customEvent.detail?.imageSrc;
    if (!imageSrc) return;
    const images = document.querySelectorAll("img");
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
      case "TOGGLE_ENABLED":
        state.isEnabled = message.enabled;
        if (!state.isEnabled) {
          resetPageState();
        } else {
          scheduleScan(0);
        }
        sendResponse({ success: true });
        break;
      case "CONFIGURE_ZHIPU_API":
        (async () => {
          state.zhipuApiKey = message.zhipuApiKey || "";
          state.zhipuTranslationModel = message.zhipuTranslationModel || "glm-4.7";
          state.zhipuOcrModel = message.zhipuOcrModel || "glm-ocr";
          await mangaOCR.configureZhipuAPI(
            state.zhipuApiKey,
            state.zhipuTranslationModel,
            state.zhipuOcrModel
          );
          sendResponse({ success: true });
        })();
        return true;
      case "REFRESH":
        resetPageState();
        scheduleScan(0);
        sendResponse({ success: true });
        break;
      case "SELECT_IMAGE":
        selectImageManually();
        sendResponse({ success: true });
        break;
      case "RERENDER_IMAGE":
        state.processedImages.delete(message.imageSrc);
        state.failedImages.delete(message.imageSrc);
        scheduleScan(0);
        sendResponse({ success: true });
        break;
      case "GET_STATUS":
        sendResponse({
          isEnabled: state.isEnabled,
          processedCount: state.processedImages.size,
          cacheSize: 0
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
})();
