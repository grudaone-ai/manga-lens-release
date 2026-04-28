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
      cache: "default"
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
  async function fetchImageAsBase64(imageUrl, pageUrl) {
    const response = await fetch(imageUrl, buildFetchOptions(imageUrl, pageUrl));
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
    return `data:${contentType};base64,${btoa(binary)}`;
  }
  function captureVisibleTab() {
    return new Promise((resolve, reject) => {
      captureQueue = captureQueue.then(async () => {
        const waitMs = Math.max(0, 700 - (Date.now() - lastCaptureAt));
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
  async function captureAndRecognizeVisibleImage(cropRect, devicePixelRatio, apiKey, model) {
    const screenshot = await captureVisibleTab();
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
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
            const base64 = await fetchImageAsBase64(message.imageUrl, message.pageUrl);
            sendResponse({ success: true, base64 });
          } catch (error) {
            sendResponse({
              success: false,
              message: error instanceof Error ? error.message : "\u56FE\u7247\u83B7\u53D6\u5931\u8D25"
            });
          }
        })();
        return true;
      case "TEST_ZHIPU_OCR":
        (async () => {
          try {
            const testImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";
            const result = await recognizeWithZhipuOCR(
              testImageBase64,
              message.apiKey,
              message.model || "glm-ocr"
            );
            sendResponse({
              success: true,
              message: `\u667A\u8C31 OCR \u8FDE\u63A5\u6210\u529F\uFF0C\u8BC6\u522B\u5230 ${result.items.length} \u4E2A\u6587\u672C\u533A\u57DF`,
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
              imageBase64 = await fetchImageAsBase64(message.imageUrl, message.pageUrl);
            } catch (error) {
              const messageText = error instanceof Error ? error.message : String(error);
              const isForbidden = messageText.includes("HTTP 403");
              if (!isForbidden || !message.cropRect) {
                throw error;
              }
              const fallbackResult = await captureAndRecognizeVisibleImage(
                message.cropRect,
                message.devicePixelRatio || 1,
                message.apiKey,
                message.model || "glm-ocr"
              );
              sendResponse({
                success: true,
                text: fallbackResult.text,
                items: fallbackResult.items,
                requestId: fallbackResult.requestId,
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
              requestId: result.requestId
            });
          } catch (error) {
            sendResponse({
              success: false,
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
