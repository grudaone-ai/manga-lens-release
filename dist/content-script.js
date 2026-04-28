"use strict";
var MangaLensContent = (() => {
  // src/modules/image-detector.ts
  var EXCLUDED_PATTERNS = [
    /\.gif$/i,
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
    /social-/i
  ];
  function shouldExcludeImage(src, width, height) {
    if (!src) return true;
    if (width < 100 || height < 100) return true;
    return EXCLUDED_PATTERNS.some((pattern) => pattern.test(src));
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
  var ImageDetector = class {
    detectMangaImages() {
      const detected = [];
      const seen = /* @__PURE__ */ new Set();
      document.querySelectorAll("img").forEach((img) => {
        const info = this.analyzeImage(img);
        if (!info || seen.has(info.src)) return;
        seen.add(info.src);
        detected.push(info);
      });
      document.querySelectorAll('[style*="background"], [data-src], picture, figure').forEach((element) => {
        const info = this.analyzeElement(element);
        if (!info || seen.has(info.src)) return;
        seen.add(info.src);
        detected.push(info);
      });
      console.log(`[MangaLens] \u68C0\u6D4B\u5230 ${detected.length} \u5F20\u5019\u9009\u56FE\u7247`);
      return detected;
    }
    analyzeImage(img) {
      const rect = img.getBoundingClientRect();
      const src = img.currentSrc || img.src || img.dataset.src || img.dataset.lazySrc || "";
      if (rect.width <= 0 || rect.height <= 0) return null;
      if (shouldExcludeImage(src, rect.width, rect.height)) return null;
      return {
        element: img,
        src,
        position: getElementPosition(img),
        aspectRatio: rect.height / rect.width,
        isManga: true
      };
    }
    analyzeElement(element) {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      let src = "";
      if (element instanceof HTMLImageElement) {
        src = element.currentSrc || element.src;
      } else if (element.dataset.src) {
        src = element.dataset.src;
      } else if (element.style.backgroundImage) {
        const match = element.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (match) src = match[1];
      }
      if (!src) {
        const img = element.querySelector("img");
        src = img?.currentSrc || img?.src || img?.dataset.src || "";
      }
      if (!src) {
        const source = element.querySelector("source");
        src = source?.srcset?.split(" ")[0] || "";
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
      const observer = new MutationObserver((mutations) => {
        const images = [];
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node instanceof HTMLImageElement) {
              const info = this.analyzeImage(node);
              if (info) images.push(info);
              return;
            }
            node.querySelectorAll("img").forEach((img) => {
              const info = this.analyzeImage(img);
              if (info) images.push(info);
            });
          });
        }
        if (images.length > 0) callback(images);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      return () => observer.disconnect();
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
      const imageUrl = imageElement.src || imageElement.currentSrc;
      if (!imageUrl) {
        throw new Error("\u65E0\u6CD5\u83B7\u53D6\u56FE\u7247\u5730\u5740");
      }
      return this.recognizeViaBackground(imageElement, imageUrl);
    }
    async recognizeViaBackground(imageElement, imageUrl) {
      const rect = imageElement.getBoundingClientRect();
      const cropRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            target: "background",
            type: "FETCH_IMAGE_AND_ZHIPU_OCR",
            imageUrl,
            pageUrl: window.location.href,
            cropRect,
            devicePixelRatio: window.devicePixelRatio || 1,
            apiKey: this.config.zhipuApiKey,
            model: this.config.zhipuOcrModel
          },
          (response) => {
            if (!response?.success) {
              reject(new Error(response?.message || "\u667A\u8C31 OCR \u8BC6\u522B\u5931\u8D25"));
              return;
            }
            const ocrResult = convertZhipuOCRResultToOCRResult(
              {
                text: response.text || "",
                items: response.items || [],
                requestId: response.requestId,
                raw: response
              },
              imageElement.naturalWidth || imageElement.width,
              imageElement.naturalHeight || imageElement.height
            );
            resolve(ocrResult);
          }
        );
      });
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
  var mangaOCR = new MangaOCR();

  // src/modules/translation-overlay.ts
  var DEFAULT_RENDER_CONFIG = {
    horizontalText: false,
    // 改为竖排（与日语原文一致）
    fontSize: 14,
    color: "#000000",
    background: "#FFFFFF",
    backgroundOpacity: 0.88,
    padding: 4,
    maxLines: 10
  };
  var TranslationOverlayManager = class {
    container = null;
    overlays = /* @__PURE__ */ new Map();
    containerId = "manga-lens-overlay-container";
    overlayClass = "manga-lens-text-overlay";
    // 图片边界追踪（以图片元素为单位）
    imageBoundsMap = /* @__PURE__ */ new Map();
    /**
     * 创建或获取覆盖层容器
     */
    createContainer(parent) {
      this.removeContainer();
      this.container = document.createElement("div");
      this.container.id = this.containerId;
      this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999;
      overflow: hidden;
    `;
      const computedStyle = window.getComputedStyle(parent);
      if (computedStyle.position === "static") {
        parent.style.position = "relative";
      }
      parent.appendChild(this.container);
      return this.container;
    }
    /**
     * 渲染翻译文字
     */
    renderTranslation(imageElement, box, translatedText) {
      if (!this.container) {
        this.createContainer(imageElement.parentElement);
      }
      const id = `ml-overlay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const boxRect = {
        x: box.x / imageElement.naturalWidth * 100,
        y: box.y / imageElement.naturalHeight * 100,
        width: box.width / imageElement.naturalWidth * 100,
        height: box.height / imageElement.naturalHeight * 100
      };
      const overlay = document.createElement("div");
      overlay.id = id;
      overlay.className = this.overlayClass;
      overlay.textContent = translatedText;
      const fontSize = Math.max(10, Math.min(box.height * 0.7, 18));
      overlay.style.cssText = `
      position: absolute;
      left: ${boxRect.x}%;
      top: ${boxRect.y}%;
      width: ${boxRect.width}%;
      min-height: ${boxRect.height}%;
      ${box.isVertical ? "writing-mode: vertical-rl;" : "writing-mode: horizontal-tb;"}
      font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.3;
      color: #000000;
      background: rgba(255, 255, 255, 0.88);
      padding: 2px 4px;
      margin: 0;
      text-shadow: 0 0 2px rgba(255, 255, 255, 0.9);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      border-radius: 2px;
      word-break: break-all;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translateZ(0);
      will-change: contents;
    `;
      this.container.appendChild(overlay);
      this.overlays.set(id, {
        id,
        originalBox: box,
        translatedText,
        element: overlay
      });
      return id;
    }
    /**
     * 批量渲染翻译
     */
    renderBatch(imageElement, boxes, translations) {
      const ids = [];
      translations.forEach((translation, index) => {
        const box = boxes[index];
        if (box && translation) {
          const id = this.renderTranslation(
            imageElement,
            box,
            translation.translatedText
          );
          ids.push(id);
        }
      });
      return ids;
    }
    /**
     * 移除指定覆盖层
     */
    removeOverlay(id) {
      const overlay = this.overlays.get(id);
      if (overlay) {
        overlay.element.remove();
        this.overlays.delete(id);
      }
    }
    /**
     * 移除所有覆盖层
     */
    removeAllOverlays() {
      this.overlays.forEach((overlay) => {
        overlay.element.remove();
      });
      this.overlays.clear();
      this.removeContainer();
    }
    /**
     * 移除容器
     */
    removeContainer() {
      const existing = document.getElementById(this.containerId);
      if (existing) {
        existing.remove();
      }
      this.container = null;
    }
    /**
     * 获取当前覆盖层数量
     */
    getOverlayCount() {
      return this.overlays.size;
    }
    /**
     * 检查是否有覆盖层
     */
    hasOverlays() {
      return this.overlays.size > 0;
    }
    /**
     * 渲染翻译后的对话（新版）
     * 
     * 使用 MergedDialog 的 bubbleBounds 进行精确定位，
     * 将横排译文渲染到原文位置。
     */
    renderMergedDialog(imageElement, dialog, config) {
      const isVertical = dialog.isVertical !== void 0 ? dialog.isVertical : true;
      const cfg = {
        ...DEFAULT_RENDER_CONFIG,
        ...config,
        horizontalText: !isVertical
        // isVertical=true → horizontalText=false
      };
      if (!this.container) {
        this.createContainer(imageElement.parentElement);
      }
      const id = `ml-overlay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const transformedBounds = dialog.transformedBounds;
      const bounds = transformedBounds || (dialog.bubbleBounds?.raw || dialog.boundingBox);
      const imageWidth = imageElement.naturalWidth;
      const imageHeight = imageElement.naturalHeight;
      const boundsRight = bounds.x + bounds.width;
      const boundsBottom = bounds.y + bounds.height;
      let safeX = bounds.x;
      let safeY = bounds.y;
      let safeWidth = bounds.width;
      let safeHeight = bounds.height;
      if (boundsRight > imageWidth) {
        safeWidth = Math.max(20, imageWidth - safeX);
      }
      if (boundsBottom > imageHeight) {
        safeHeight = Math.max(20, imageHeight - safeY);
      }
      safeWidth = Math.max(20, safeWidth);
      safeHeight = Math.max(20, safeHeight);
      const safeBounds = {
        x: safeX,
        y: safeY,
        width: safeWidth,
        height: safeHeight
      };
      const displayedWidth = imageElement.clientWidth || imageElement.offsetWidth;
      const displayedHeight = imageElement.clientHeight || imageElement.offsetHeight;
      if (displayedWidth === 0 || displayedHeight === 0) {
        console.error(`[Overlay#${id.slice(-6)}] \u274C \u56FE\u7247\u663E\u793A\u5C3A\u5BF8\u4E3A0\uFF0CnaturalWidth=${imageWidth}, naturalHeight=${imageHeight}, clientWidth=${displayedWidth}, offsetWidth=${imageElement.offsetWidth}`);
      }
      const imgRect = imageElement.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();
      const offsetX = imgRect.left - containerRect.left;
      const offsetY = imgRect.top - containerRect.top;
      const scaleX = displayedWidth / imageWidth;
      const scaleY = displayedHeight / imageHeight;
      const translatedText = dialog.translatedText || dialog.text;
      const charCount = translatedText.length;
      const charWidth = dialog.charWidth || 14;
      let overlayWidth;
      let overlayHeight;
      if (isVertical) {
        const estimatedCharWidth = charWidth * 1.2;
        const estimatedCols = Math.max(1, Math.ceil(charCount / 8));
        overlayWidth = estimatedCols * estimatedCharWidth;
        overlayHeight = safeBounds.height;
        console.log(`[Overlay#${id.slice(-6)}] \u7AD6\u6392\u5C3A\u5BF8\u8BA1\u7B97: ${charCount}\u5B57, charWidth=${charWidth.toFixed(1)}, cols=${estimatedCols}, \u5BBD\u5EA6=${overlayWidth.toFixed(1)}px`);
      } else {
        const lineHeight = charWidth * 1.4;
        const estimatedLines = Math.ceil(charCount / 8);
        overlayHeight = estimatedLines * lineHeight;
        overlayWidth = safeBounds.width;
        console.log(`[Overlay#${id.slice(-6)}] \u6A2A\u6392\u5C3A\u5BF8\u8BA1\u7B97: ${charCount}\u5B57, charWidth=${charWidth.toFixed(1)}, lines=${estimatedLines}, \u9AD8\u5EA6=${overlayHeight.toFixed(1)}px`);
      }
      overlayWidth = Math.max(20, Math.min(overlayWidth, displayedWidth * 0.8));
      overlayHeight = Math.max(20, Math.min(overlayHeight, displayedHeight * 0.5));
      const pixelLeft = safeBounds.x * scaleX;
      const pixelTop = safeBounds.y * scaleY;
      const pixelWidth = overlayWidth;
      const pixelHeight = overlayHeight;
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      if (containerWidth === 0 || containerHeight === 0) {
        console.error(`[Overlay#${id.slice(-6)}] \u274C \u5BB9\u5668\u5C3A\u5BF8\u4E3A0\uFF0CcontainerWidth=${containerWidth}, containerHeight=${containerHeight}`);
      }
      const safeContainerWidth = containerWidth || 1;
      const safeContainerHeight = containerHeight || 1;
      let left = (offsetX + pixelLeft) / safeContainerWidth * 100;
      let top = (offsetY + pixelTop) / safeContainerHeight * 100;
      let width = pixelWidth / safeContainerWidth * 100;
      let height = pixelHeight / safeContainerHeight * 100;
      left = Math.max(-10, Math.min(110, left));
      top = Math.max(-10, Math.min(110, top));
      width = Math.max(1, Math.min(100, width));
      height = Math.max(1, Math.min(100, height));
      if (left > 90 || top > 90 || left < -5 || top < -5) {
        console.warn(`[Overlay#${id.slice(-6)}] \u26A0\uFE0F \u8986\u76D6\u5C42\u4F4D\u7F6E\u5F02\u5E38\u504F\u51FA: left=${left.toFixed(2)}%, top=${top.toFixed(2)}%`);
      }
      console.log(`[Overlay#${id.slice(-6)}] \u{1F4CD} \u6E32\u67D3\u4FE1\u606F [dialogId=${dialog.id}]:`);
      console.log(`  \u539F\u6587: "${dialog.text}", \u8BD1\u6587: "${translatedText}"`);
      console.log(`  \u65B9\u5411: ${isVertical ? "\u7AD6\u6392" : "\u6A2A\u6392"}, horizontalText=${cfg.horizontalText}`);
      console.log(`  \u56FE\u7247\u5C3A\u5BF8: natural=${imageWidth}x${imageHeight}, displayed=${displayedWidth}x${displayedHeight}`);
      console.log(`  \u7F29\u653E: scaleX=${scaleX.toFixed(4)}, scaleY=${scaleY.toFixed(4)}`);
      console.log(`  \u6E32\u67D3\u8FB9\u754C: (${safeBounds.x}, ${safeBounds.y}) ${safeBounds.width}x${safeBounds.height}`);
      console.log(`  \u52A8\u6001\u5C3A\u5BF8: ${overlayWidth.toFixed(1)}x${overlayHeight.toFixed(1)}px`);
      console.log(`  \u767E\u5206\u6BD4\u4F4D\u7F6E: left=${left.toFixed(2)}%, top=${top.toFixed(2)}%, w=${width.toFixed(2)}%, h=${height.toFixed(2)}%`);
      console.log(`  \u56FE\u7247\u504F\u79FB: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
      console.log(`  \u5BB9\u5668\u5C3A\u5BF8: ${containerRect.width.toFixed(1)}x${containerRect.height.toFixed(1)}`);
      console.log(`  \u5B57\u7B26: ${dialog.charCount}\u5B57, charWidth=${dialog.charWidth?.toFixed(1)}`);
      if (!isVertical && overlayWidth < 50) {
        console.warn(`[Overlay#${id.slice(-6)}] \u26A0\uFE0F \u6A2A\u6392\u8986\u76D6\u5C42\u5BBD\u5EA6\u4EC5 ${overlayWidth.toFixed(1)}px\uFF0C\u53EF\u80FD\u96BE\u4EE5\u770B\u5230\uFF01`);
      }
      if (!isVertical && bounds.width < 30) {
        console.warn(`[Overlay#${id.slice(-6)}] \u26A0\uFE0F \u539F\u59CB\u6C14\u6CE1\u5BBD\u5EA6\u4EC5 ${bounds.width}px\uFF0C\u6A2A\u6392\u8986\u76D6\u5C42\u53EF\u80FD\u5F88\u7A84\uFF01`);
      }
      const overlay = document.createElement("div");
      overlay.id = id;
      overlay.className = this.overlayClass;
      overlay.textContent = translatedText;
      const fontSize = this.calculateFontSizeForDialog(dialog, translatedText, safeBounds.width, cfg);
      const bgWithOpacity = this.hexToRgba(cfg.background, cfg.backgroundOpacity);
      overlay.style.cssText = `
      position: absolute;
      left: ${left}%;
      top: ${top}%;
      width: ${width}%;
      min-height: ${height}%;
      font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.4;
      color: ${cfg.color};
      background: ${bgWithOpacity};
      padding: ${cfg.padding}px;
      margin: 0;
      text-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
      border-radius: 3px;
      word-break: break-all;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translateZ(0);
      will-change: contents;
      z-index: 1;
      writing-mode: ${cfg.horizontalText ? "horizontal-tb" : "vertical-rl"};
      ${cfg.horizontalText ? "max-height: " + height + "%;" : ""}
    `;
      if (dialog.translationSuccess === false) {
        overlay.style.border = "1px dashed #ff6666";
        overlay.title = "\u7FFB\u8BD1\u5931\u8D25\uFF0C\u4F7F\u7528\u539F\u6587";
      }
      this.container.appendChild(overlay);
      this.overlays.set(id, {
        id,
        originalBox: {
          ...dialog.boundingBox,
          text: dialog.text,
          confidence: 1,
          isVertical: dialog.isVertical || false
        },
        translatedText,
        element: overlay
      });
      return id;
    }
    /**
     * 批量渲染翻译后的对话
     */
    renderMergedDialogs(imageElement, dialogs, config) {
      this.imageBoundsMap.set(imageElement, {
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight
      });
      const ids = [];
      let skippedCount = 0;
      for (let i = 0; i < dialogs.length; i++) {
        const dialog = dialogs[i];
        if (dialog.translatedText || dialog.text) {
          const id = this.renderMergedDialog(imageElement, dialog, config);
          ids.push(id);
        } else {
          skippedCount++;
          console.warn(`[Overlay] \u8DF3\u8FC7\u6E32\u67D3: [${dialog.id}] \u65E0\u7FFB\u8BD1\u6587\u672C, \u539F\u6587: "${dialog.text.slice(0, 20)}"`);
        }
      }
      console.log(`[Overlay] \u2705 \u6E32\u67D3\u5B8C\u6210: ${ids.length} \u4E2A\u8986\u76D6\u5C42, \u8DF3\u8FC7 ${skippedCount} \u4E2A (\u65E0\u7FFB\u8BD1\u6587\u672C)`);
      if (ids.length > 0) {
        console.log(`[Overlay] \u{1F4CD} \u6240\u6709\u8986\u76D6\u5C42\u5143\u7D20 ID:`, ids.map((id) => `#${id}`));
      }
      return ids;
    }
    /**
     * 重新渲染所有覆盖层（已弃用旋转功能）
     */
    rerenderOverlays(_imageElement) {
      console.log("[Overlay] rerenderOverlays \u5DF2\u5F03\u7528\uFF0C\u65CB\u8F6C\u529F\u80FD\u5DF2\u79FB\u9664");
    }
    /**
     * 移除图片的所有覆盖层
     */
    removeOverlaysForImage(_imageElement) {
      const container = document.getElementById(this.containerId);
      if (container) {
        container.remove();
      }
      this.container = null;
      this.overlays.clear();
    }
    /**
     * 计算字体大小
     */
    calculateFontSize(boxWidth, config) {
      const estimatedCharWidth = config.fontSize;
      const charsPerLine = Math.floor(boxWidth / estimatedCharWidth);
      if (charsPerLine <= 0) {
        return config.fontSize;
      }
      return Math.min(config.fontSize, Math.max(10, boxWidth / charsPerLine * 0.8));
    }
    /**
     * 基于对话信息计算字体大小
     * 
     * 算法：
     * 1. 根据原文的平均字符宽度（charWidth）计算每个字符应占的像素
     * 2. 考虑翻译后字符数与原文的差异
     * 3. 使用 itemCharWidths 的加权平均作为基准
     * 4. 确保字体大小在合理范围内
     */
    calculateFontSizeForDialog(dialog, translatedText, boxWidth, config) {
      if (!dialog.charWidth || dialog.charWidth <= 0) {
        return this.calculateFontSize(boxWidth, config);
      }
      const translatedCharCount = translatedText.length;
      const ocrCharCount = dialog.charCount;
      let weightedCharWidth = dialog.charWidth;
      if (dialog.itemCharWidths && dialog.itemCharWidths.length > 0) {
        const totalChars = dialog.itemCharWidths.reduce((sum, i) => sum + i.charCount, 0);
        const weightedSum = dialog.itemCharWidths.reduce((sum, i) => sum + i.avgWidth * i.charCount, 0);
        if (totalChars > 0) {
          weightedCharWidth = weightedSum / totalChars;
        }
      }
      const baseFontSize = weightedCharWidth * 0.8;
      if (translatedCharCount > ocrCharCount && ocrCharCount > 0) {
        const scaleFactor = Math.sqrt(ocrCharCount / translatedCharCount);
        const adjustedFontSize = baseFontSize * scaleFactor;
        const finalFontSize2 = Math.min(config.fontSize, Math.max(8, adjustedFontSize));
        console.log(`[Overlay] \u5B57\u4F53\u8BA1\u7B97: charWidth=${weightedCharWidth.toFixed(1)}, \u539F\u6587${ocrCharCount}\u5B57\u2192\u8BD1\u6587${translatedCharCount}\u5B57, scale=${scaleFactor.toFixed(2)}, \u6700\u7EC8=${finalFontSize2.toFixed(1)}px`);
        return finalFontSize2;
      }
      const finalFontSize = Math.min(config.fontSize, Math.max(10, baseFontSize));
      console.log(`[Overlay] \u5B57\u4F53\u8BA1\u7B97: charWidth=${weightedCharWidth.toFixed(1)}, \u539F\u6587${ocrCharCount}\u5B57\u2192\u8BD1\u6587${translatedCharCount}\u5B57, \u6700\u7EC8=${finalFontSize.toFixed(1)}px`);
      return finalFontSize;
    }
    /**
     * 将 hex 颜色转换为 rgba
     */
    hexToRgba(hex, alpha) {
      if (hex.startsWith("rgba") || hex.startsWith("rgb")) {
        return hex;
      }
      hex = hex.replace("#", "");
      let r, g, b;
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
      } else {
        return `rgba(255, 255, 255, ${alpha})`;
      }
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    /**
     * 更新覆盖层样式
     */
    updateStyle(style) {
      const styleElement = document.getElementById("manga-lens-styles") || this.createStyleElement();
      const css = `
      .manga-lens-text-overlay {
        ${style.background ? `background: ${style.background};` : ""}
        ${style.color ? `color: ${style.color};` : ""}
        ${style.fontSize ? `font-size: ${style.fontSize}px;` : ""}
        ${style.opacity !== void 0 ? `opacity: ${style.opacity};` : ""}
      }
    `;
      styleElement.textContent = css;
    }
    /**
     * 创建样式元素
     */
    createStyleElement() {
      const style = document.createElement("style");
      style.id = "manga-lens-styles";
      style.textContent = "";
      document.head.appendChild(style);
      return style;
    }
  };
  var overlayManager = new TranslationOverlayManager();

  // src/content-script.ts
  var FAILED_IMAGE_COOLDOWN_MS = 15e3;
  var state = {
    isEnabled: true,
    isProcessing: false,
    processedImages: /* @__PURE__ */ new Set(),
    failedImages: /* @__PURE__ */ new Map(),
    zhipuApiKey: "",
    zhipuTranslationModel: "glm-4.7",
    zhipuOcrModel: "glm-ocr"
  };
  function showLoading(message) {
    const existing = document.getElementById("manga-lens-loading");
    if (existing) existing.remove();
    const loader = document.createElement("div");
    loader.id = "manga-lens-loading";
    loader.className = "manga-lens-loading";
    loader.textContent = `MangaLens: ${message}`;
    document.body.appendChild(loader);
  }
  function hideLoading() {
    document.getElementById("manga-lens-loading")?.remove();
  }
  function asImageElement(element) {
    if (element instanceof HTMLImageElement) return element;
    const nested = element.querySelector("img");
    return nested instanceof HTMLImageElement ? nested : null;
  }
  function buildFallbackDetectedImage(img) {
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
  async function processImage(image) {
    const imageElement = asImageElement(image.element);
    if (!imageElement) return;
    const imageSrc = image.src || imageElement.src;
    if (state.processedImages.has(imageSrc)) return;
    const lastFailedAt = state.failedImages.get(imageSrc);
    if (lastFailedAt && Date.now() - lastFailedAt < FAILED_IMAGE_COOLDOWN_MS) return;
    if (!state.zhipuApiKey) {
      console.error("[MangaLens] \u672A\u914D\u7F6E\u667A\u8C31 API Key\uFF0C\u8BF7\u5148\u5728\u6269\u5C55\u8BBE\u7F6E\u4E2D\u586B\u5199\u3002");
      return;
    }
    try {
      showLoading("\u6B63\u5728\u8BC6\u522B\u6587\u5B57...");
      const ocrResult = await mangaOCR.recognize(imageElement);
      if (ocrResult.boxes.length === 0) return;
      showLoading("\u6B63\u5728\u5408\u5E76\u5BF9\u8BDD...");
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
      const merger = new DialogMerger({ yThreshold: 50, xThreshold: 150, rtlMode: true });
      let mergedDialogs = merger.merge(ocrItems);
      mergedDialogs = merger.calculateAllBubbleBounds(
        mergedDialogs,
        imageElement.naturalWidth || imageElement.width,
        imageElement.naturalHeight || imageElement.height
      );
      showLoading(`\u6B63\u5728\u7FFB\u8BD1 ${mergedDialogs.length} \u6BB5\u5BF9\u8BDD...`);
      const translator = new BatchTranslator({
        apiKey: state.zhipuApiKey,
        model: state.zhipuTranslationModel
      });
      const translationResult = await translator.translateInBatches(
        mergedDialogs.map((dialog, index) => ({
          id: index,
          text: dialog.text
        })),
        (completed, total) => showLoading(`\u7FFB\u8BD1\u8FDB\u5EA6: ${completed}/${total}`)
      );
      for (const item of translationResult.items) {
        const dialog = mergedDialogs[item.id];
        if (!dialog) continue;
        dialog.translatedText = item.translatedText || item.originalText;
        dialog.translationSuccess = item.success;
      }
      showLoading("\u6B63\u5728\u6E32\u67D3\u8BD1\u6587...");
      overlayManager.renderMergedDialogs(imageElement, mergedDialogs, {
        horizontalText: false,
        fontSize: 14,
        background: "#FFFFFF",
        backgroundOpacity: 0.88,
        padding: 4
      });
      state.processedImages.add(imageSrc);
      state.failedImages.delete(imageSrc);
      await updatePopupStatus();
    } catch (error) {
      state.failedImages.set(imageSrc, Date.now());
      console.error("[MangaLens] \u56FE\u7247\u5904\u7406\u5931\u8D25:", error);
    } finally {
      hideLoading();
    }
  }
  async function processAllImages() {
    if (state.isProcessing) return;
    state.isProcessing = true;
    showLoading("\u6B63\u5728\u626B\u63CF\u9875\u9762\u56FE\u7247...");
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
  async function selectImageManually() {
    const image = await imageDetector.selectImage();
    if (image) {
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
  async function initialize() {
    try {
      await loadConfig();
      setTimeout(async () => {
        if (state.isEnabled) {
          await processAllImages();
        }
      }, 1e3);
      const cleanup = imageDetector.observeNewImages(async (images) => {
        if (!state.isEnabled) return;
        for (const image of images) {
          await processImage(image);
        }
      });
      window.addEventListener("beforeunload", cleanup);
      console.log("[MangaLens] Content script initialized with Zhipu API");
    } catch (error) {
      console.error("[MangaLens] \u521D\u59CB\u5316\u5931\u8D25:", error);
      hideLoading();
    }
  }
  window.addEventListener("manga-lens-rerender", async (event) => {
    const customEvent = event;
    const imageSrc = customEvent.detail?.imageSrc;
    if (!imageSrc) return;
    const images = document.querySelectorAll("img");
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
      case "TOGGLE_ENABLED":
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
        state.processedImages.clear();
        state.failedImages.clear();
        overlayManager.removeAllOverlays();
        processAllImages();
        sendResponse({ success: true });
        break;
      case "SELECT_IMAGE":
        selectImageManually();
        sendResponse({ success: true });
        break;
      case "RERENDER_IMAGE":
        state.processedImages.delete(message.imageSrc);
        state.failedImages.delete(message.imageSrc);
        processAllImages();
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
