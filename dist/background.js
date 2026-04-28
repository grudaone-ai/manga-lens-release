"use strict";
var MangaLensBackground = (() => {
  // src/modules/zhipu-client.ts
  var ZHIPU_OCR_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/layout_parsing";
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
  function flattenLayoutDetails(value) {
    if (!Array.isArray(value)) return [];
    const result = [];
    const visit = (node) => {
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (node && typeof node === "object") {
        const item = node;
        if ((item.content || item.text) && (item.bbox_2d || item.bbox)) {
          result.push(item);
        }
      }
    };
    visit(value);
    return result;
  }
  function extractMarkdownText(value) {
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item;
          return String(record.md || record.text || record.content || "");
        }
        return "";
      }).filter(Boolean).join("\n");
    }
    if (typeof value === "string") return value;
    return "";
  }
  async function recognizeWithZhipuOCR(imageBase64, apiKey, model = "glm-ocr") {
    if (!apiKey) {
      throw new Error("Zhipu API Key is required for OCR");
    }
    const normalizedFile = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const fileCandidates = imageBase64.startsWith("data:") ? [normalizedFile, imageBase64] : [normalizedFile];
    let data;
    let lastError;
    for (const file of fileCandidates) {
      try {
        const response = await fetch(ZHIPU_OCR_ENDPOINT, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            file,
            return_crop_images: false,
            need_layout_visualization: false
          })
        });
        data = await parseJsonResponse(response, "Zhipu OCR");
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!data) {
      throw lastError instanceof Error ? lastError : new Error("Zhipu OCR request failed");
    }
    const items = flattenLayoutDetails(data.layout_details);
    const text = extractMarkdownText(data.md_results) || items.map((item) => item.content || item.text || "").filter(Boolean).join("\n");
    return {
      text,
      items,
      requestId: data.request_id || data.id || "",
      raw: data
    };
  }

  // src/background.ts
  var lastCaptureAt = 0;
  var captureQueue = Promise.resolve();
  function buildFetchOptions(imageUrl, pageUrl) {
    const options = {
      mode: "cors",
      credentials: "omit",
      cache: "force-cache"
    };
    if (!pageUrl) return options;
    try {
      const page = new URL(pageUrl);
      const image = new URL(imageUrl);
      if (image.hostname.endsWith("pximg.net") && page.hostname.endsWith("pixiv.net")) {
        return {
          ...options,
          referrer: `${page.origin}/`,
          referrerPolicy: "strict-origin-when-cross-origin"
        };
      }
      return {
        ...options,
        referrer: pageUrl,
        referrerPolicy: "strict-origin-when-cross-origin"
      };
    } catch {
      return options;
    }
  }
  async function fetchWithTimeout(url, options, timeoutMs = 15e3) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
  async function fetchImageAsBase64(imageUrl, pageUrl) {
    const response = await fetchWithTimeout(imageUrl, buildFetchOptions(imageUrl, pageUrl));
    if (!response.ok) {
      throw new Error(`\u56FE\u7247\u83B7\u53D6\u5931\u8D25: HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let index = 0; index < bytes.byteLength; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return { base64: `data:${contentType};base64,${btoa(binary)}`, contentType };
  }
  function queryActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab || null));
    });
  }
  function isCropVisible(cropRect, viewport) {
    if (cropRect.width <= 0 || cropRect.height <= 0) return false;
    const viewportWidth = Number(viewport?.width) || 0;
    const viewportHeight = Number(viewport?.height) || 0;
    if (!viewportWidth || !viewportHeight) return true;
    return cropRect.left < viewportWidth && cropRect.top < viewportHeight && cropRect.left + cropRect.width > 0 && cropRect.top + cropRect.height > 0;
  }
  async function captureVisibleTab(expectedTabId, cropRect, viewport) {
    const activeTab = await queryActiveTab();
    if (expectedTabId && activeTab?.id !== expectedTabId) {
      throw new Error("\u5F53\u524D\u6807\u7B7E\u9875\u5DF2\u5207\u6362\uFF0C\u5DF2\u53D6\u6D88\u622A\u56FE OCR\uFF0C\u907F\u514D\u8BC6\u522B\u5230\u9519\u8BEF\u6807\u7B7E\u9875");
    }
    if (cropRect && !isCropVisible(cropRect, viewport)) {
      throw new Error("\u56FE\u7247\u4E0D\u5728\u5F53\u524D\u53EF\u89C1\u533A\u57DF\uFF0C\u5DF2\u8DF3\u8FC7\u622A\u56FE OCR");
    }
    return new Promise((resolve, reject) => {
      captureQueue = captureQueue.then(async () => {
        const waitMs = Math.max(0, 900 - (Date.now() - lastCaptureAt));
        if (waitMs > 0) {
          await new Promise((done) => setTimeout(done, waitMs));
        }
        return new Promise((done, fail) => {
          chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, { format: "png" }, (dataUrl) => {
            lastCaptureAt = Date.now();
            if (chrome.runtime.lastError) {
              fail(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (!dataUrl) {
              fail(new Error("\u6807\u7B7E\u9875\u622A\u56FE\u5931\u8D25"));
              return;
            }
            resolve(dataUrl);
            done();
          });
        });
      }).catch(reject);
    });
  }
  async function cropCapturedImage(dataUrl, cropRect, devicePixelRatio = 1) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.max(1, devicePixelRatio || 1);
    const sx = Math.max(0, Math.floor(cropRect.left * scale));
    const sy = Math.max(0, Math.floor(cropRect.top * scale));
    const sw = Math.max(1, Math.floor(cropRect.width * scale));
    const sh = Math.max(1, Math.floor(cropRect.height * scale));
    const clippedWidth = Math.min(sw, Math.max(1, bitmap.width - sx));
    const clippedHeight = Math.min(sh, Math.max(1, bitmap.height - sy));
    const canvas = new OffscreenCanvas(clippedWidth, clippedHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("\u622A\u56FE\u88C1\u526A\u5931\u8D25");
    }
    ctx.drawImage(bitmap, sx, sy, clippedWidth, clippedHeight, 0, 0, clippedWidth, clippedHeight);
    const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
    const buffer = await croppedBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.byteLength; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return `data:image/png;base64,${btoa(binary)}`;
  }
  async function captureAndRecognizeVisibleImage(cropRect, devicePixelRatio, apiKey, model, tabId, viewport) {
    const screenshot = await captureVisibleTab(tabId, cropRect, viewport);
    const croppedImage = await cropCapturedImage(screenshot, cropRect, devicePixelRatio);
    return recognizeWithZhipuOCR(croppedImage, apiKey, model);
  }
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(["isEnabled", "zhipuTranslationModel", "zhipuOcrModel"], (result) => {
      chrome.storage.local.set({
        isEnabled: result.isEnabled !== void 0 ? result.isEnabled : true,
        zhipuTranslationModel: result.zhipuTranslationModel || "glm-4.7",
        zhipuOcrModel: result.zhipuOcrModel || "glm-ocr"
      });
    });
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== "background") {
      return true;
    }
    switch (message.type) {
      case "GET_STORAGE":
        chrome.storage.local.get(message.keys, (result) => {
          sendResponse(result);
        });
        return true;
      case "SET_STORAGE":
        chrome.storage.local.set(message.data, () => {
          sendResponse({ success: true });
        });
        return true;
      case "FETCH_IMAGE_AS_BASE64":
        (async () => {
          try {
            const result = await fetchImageAsBase64(message.imageUrl, message.pageUrl);
            sendResponse({ success: true, base64: result.base64, contentType: result.contentType });
          } catch (error) {
            sendResponse({
              success: false,
              message: error instanceof Error ? error.message : "\u56FE\u7247\u83B7\u53D6\u5931\u8D25"
            });
          }
        })();
        return true;
      case "RECOGNIZE_ZHIPU_OCR_BASE64":
        (async () => {
          try {
            const result = await recognizeWithZhipuOCR(
              message.imageBase64,
              message.apiKey,
              message.model || "glm-ocr"
            );
            sendResponse({
              success: true,
              text: result.text,
              items: result.items,
              requestId: result.requestId,
              source: message.source || "element-canvas",
              sourceWidth: message.sourceWidth,
              sourceHeight: message.sourceHeight,
              sourceMessage: message.sourceMessage
            });
          } catch (error) {
            sendResponse({
              success: false,
              source: message.source || "element-canvas",
              message: error instanceof Error ? error.message : "\u667A\u8C31 OCR \u8BC6\u522B\u5931\u8D25"
            });
          }
        })();
        return true;
      case "TEST_ZHIPU_OCR":
        (async () => {
          try {
            const testImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAABQCAIAAACoK28rAAAEdklEQVR4nO3dPUh6XxzH8dsDhRIIgmUJtQQG0QPdIexBr1l3aS1bKiNoiZqiWoKWQCRoKBoqUNsighwqTCMosqKhwaWhNqPggj1QWFp5/sOFi/Sz/v3+/uD/88vnNZ17POd4L7x7wIZyGGMcABW5//cNAPxJCBpIQdBACoIGUhA0kIKggRQEDaQgaCAFQQMpCBpIQdBACoIGUhA0kIKggRQEDaQgaCAFQQMpCBpIQdBACoIGUhA0kIKggRQEDaQgaCAFQQMpCBpIyTRoj8fD87zJZOJ5fnV1VZ5cWVlpaGiwWCydnZ2RSESeVKvVgiBYLJaGhoaDgwN5cnNzUxAEQRDy8/PlwcbGhrxSNjc3x3Hc+fm5KIpWq7WjoyMSiaTdJR/48PAwMDCg0WiUO3S73a2trfX19YFAgOO4WCzW09MjCALP89vb2xk+Pvx1WAb8fn9zc/P9/T1j7P7+vrm5ORgMBgIBq9Uai8UYYzs7O21tbfJijUYjD8LhcE1NzaejlFc/jWV1dXWRSIQxtrGxYbfbv1nZ0tIyPz+vzEuSZDabPz4+Li4uqqqqGGMul2t2dpYxdnNzU1FR8Z+eG/5eGQVts9mOj4+Vy1Ao1N7eLoriycmJMjk0NJRIJFhKfMlkUqvVfjrq+6BLS0svLy8ZY4lE4vDw8JuVt7e3qfMXFxfr6+uMsefnZ51Oxxi7u7uLx+OMsWAwWFlZ+TuPC1kgo6DLyspeXl6Uy5eXl7KyMoPB8Pr6+utiJTK/39/V1fXVqyxdph6PR6/XDw4O7u/vf7Xr+3mv1zs4OKhc9vb2qtXqvb29tNshe/3JoGOxmMFg0Ov1aYNWqVQWi6WpqUmr1crfR1OlJiivlCk/Ae7u7txud21t7fT0dNpdX53GGLu6uqqurpYkKXXS5/P19fX96zNCdsko6Pb29lAopFweHR2Jomg2m09PT+WZZDLZ398vj5XIXC6X0+n8dNQ336ElSVLeRZKkkpKSr1amnX96euJ5XrmlkZGRt7c3xtj7+/uvv/lAtsvoU47x8fGJiYnHx0eO4x4eHiYnJycmJoaHh6empuLxOMdxa2tr8iBVR0fH2dnZz98lJyfHbrfLn5ZEo9Hy8vKf72WMORyOsbGxxsZGeebx8dHn83Ecd3x8bDQaf34UZIX8TDaLonh9fW21WgsLCxOJxOjoqM1m4zju8vKS53mdTldcXLy4uPhpl9FoDIfDyWQyNzf9l1MikRAEQR6bTCan07m8vNzd3a1SqfLy8txu98/v0Ov17u7uRqPRpaWloqKira2tmZkZh8OxsLBQUFDwW0dBVshh+JcUQAj+UgikIGggBUEDKQgaSEHQQAqCBlIQNJCCoIEUBA2kIGggBUEDKQgaSEHQQAqCBlIQNJCCoIEUBA2kIGggBUEDKQgaSEHQQAqCBlIQNJCCoIEUBA2kIGggBUEDKQgaSEHQQAqCBlIQNJCCoIEUBA2kIGggBUEDKQgaSEHQQAqCBlIQNJCCoIEUBA2kIGggBUEDKQgaSPkHsXrIuAOLC/QAAAAASUVORK5CYII=";
            const result = await recognizeWithZhipuOCR(testImageBase64, message.apiKey, message.model || "glm-ocr");
            sendResponse({
              success: true,
              message: `\u667A\u8C31 OCR \u8FDE\u63A5\u6210\u529F\uFF0C\u8BC6\u522B\u5230 ${result.items.length} \u4E2A\u6587\u672C\u533A\u57DF${result.text ? `\uFF1A${result.text.slice(0, 30)}` : ""}`,
              requestId: result.requestId
            });
          } catch (error) {
            sendResponse({
              success: false,
              message: error instanceof Error ? error.message : "\u667A\u8C31 OCR \u6D4B\u8BD5\u5931\u8D25"
            });
          }
        })();
        return true;
      case "FETCH_IMAGE_AND_ZHIPU_OCR":
        (async () => {
          try {
            let imageBase64;
            try {
              const fetched = await fetchImageAsBase64(message.imageUrl, message.pageUrl);
              imageBase64 = fetched.base64;
            } catch (error) {
              const messageText = error instanceof Error ? error.message : String(error);
              const isForbidden = messageText.includes("HTTP 403") || messageText.includes("Failed to fetch");
              if (!isForbidden || !message.cropRect) {
                throw error;
              }
              const fallbackResult = await captureAndRecognizeVisibleImage(
                message.cropRect,
                message.devicePixelRatio || 1,
                message.apiKey,
                message.model || "glm-ocr",
                sender.tab?.id,
                {
                  width: Number(message.viewportWidth) || void 0,
                  height: Number(message.viewportHeight) || void 0
                }
              );
              sendResponse({
                success: true,
                text: fallbackResult.text,
                items: fallbackResult.items,
                requestId: fallbackResult.requestId,
                source: "visible-tab-capture",
                sourceWidth: Math.round(message.cropRect.width * (message.devicePixelRatio || 1)),
                sourceHeight: Math.round(message.cropRect.height * (message.devicePixelRatio || 1)),
                sourceMessage: `background fetch \u5931\u8D25: ${messageText}\uFF1B\u5DF2\u56DE\u9000\u622A\u56FE OCR`,
                fallback: "visible-tab-capture"
              });
              return;
            }
            const result = await recognizeWithZhipuOCR(
              imageBase64,
              message.apiKey,
              message.model || "glm-ocr"
            );
            sendResponse({
              success: true,
              text: result.text,
              items: result.items,
              requestId: result.requestId,
              source: "background-fetch",
              sourceMessage: "\u5DF2\u901A\u8FC7 background fetch \u83B7\u53D6\u56FE\u7247 URL"
            });
          } catch (error) {
            sendResponse({
              success: false,
              source: "background-fetch",
              message: error instanceof Error ? error.message : "\u667A\u8C31 OCR \u8BC6\u522B\u5931\u8D25"
            });
          }
        })();
        return true;
      default:
        sendResponse({ success: false, message: `\u672A\u77E5\u6D88\u606F\u7C7B\u578B: ${message.type}` });
        return true;
    }
  });
  console.log("[MangaLens] Background script loaded with Zhipu API");
})();
