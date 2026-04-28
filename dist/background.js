"use strict";
var MangaLensBackground = (() => {
  // src/modules/zhipu-vision-client.ts
  var ZHIPU_CHAT_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  var DEFAULT_VISION_MODEL = "glm-4.6v";
  var SYSTEM_PROMPT = "\u4F60\u662F Pixiv \u6F2B\u753B\u5B9E\u65F6\u7FFB\u8BD1\u5F15\u64CE\u3002\u8BC6\u522B\u56FE\u7247\u5185\u65E5\u6587\u6F2B\u753B\u6587\u5B57\u5E76\u7FFB\u8BD1\u6210\u81EA\u7136\u7B80\u4F53\u4E2D\u6587\u3002\u53EA\u5904\u7406\u6F2B\u753B\u753B\u9762\u5185\u6587\u5B57\uFF0C\u4E0D\u5904\u7406\u7F51\u9875 UI\u3001\u4F5C\u8005\u540D\u3001\u6807\u7B7E\u3001\u8BC4\u8BBA\u3001\u6C34\u5370\u3002\u5408\u5E76\u540C\u4E00\u6C14\u6CE1\u6216\u540C\u4E00\u6BB5\u8FDE\u7EED\u6587\u5B57\u3002\u8BD1\u6587\u7B80\u77ED\uFF0C\u9002\u5408\u8986\u76D6\u56DE\u6C14\u6CE1\u3002\u4E25\u683C\u8F93\u51FA JSON\uFF0C\u4E0D\u8981\u89E3\u91CA\u3002bbox \u4F7F\u7528 0-1000 \u76F8\u5BF9\u5750\u6807\u3002";
  var USER_PROMPT = '\u8FD4\u56DE JSON\uFF1A{"items":[{"id":1,"sourceText":"\u539F\u6587","translatedText":"\u7B80\u4F53\u4E2D\u6587","bbox":[x1,y1,x2,y2],"orientation":"vertical|horizontal","kind":"speech|sfx|narration|other"}]}\u3002\u65E0\u6587\u5B57\u8FD4\u56DE {"items":[]}\u3002';
  function stripDataUrlPrefix(imageBase64) {
    if (imageBase64.startsWith("data:")) return imageBase64;
    return `data:image/jpeg;base64,${imageBase64.replace(/^data:[^;]+;base64,/, "")}`;
  }
  async function parseJsonResponse(response) {
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`\u667A\u8C31\u89C6\u89C9\u6A21\u578B\u8FD4\u56DE\u975E JSON \u54CD\u5E94: ${text.slice(0, 200)}`);
    }
    if (!response.ok) {
      const message = data?.error?.message || data?.msg || data?.message || text;
      throw new Error(`\u667A\u8C31\u89C6\u89C9\u6A21\u578B API error ${response.status}: ${message}`);
    }
    if (data?.error) {
      throw new Error(`\u667A\u8C31\u89C6\u89C9\u6A21\u578B API error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    return data;
  }
  function extractJsonText(content) {
    const trimmed = content.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) return fenced[1].trim();
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
    return trimmed;
  }
  function normalizeBBox(value) {
    if (!Array.isArray(value) || value.length < 4) return null;
    const nums = value.slice(0, 4).map((item) => Number(item));
    if (nums.some((num) => !Number.isFinite(num))) return null;
    let [x1, y1, x2, y2] = nums;
    x1 = Math.max(0, Math.min(1e3, x1));
    y1 = Math.max(0, Math.min(1e3, y1));
    x2 = Math.max(0, Math.min(1e3, x2));
    y2 = Math.max(0, Math.min(1e3, y2));
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const right = Math.max(x1, x2);
    const bottom = Math.max(y1, y2);
    if (right - left < 2 || bottom - top < 2) return null;
    return [left, top, right, bottom];
  }
  function parseVisionItems(content) {
    const jsonText = extractJsonText(content);
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`\u65E0\u6CD5\u89E3\u6790 GLM-4.6V \u8FD4\u56DE JSON: ${error instanceof Error ? error.message : String(error)}\uFF1B\u539F\u59CB\u5185\u5BB9: ${content.slice(0, 300)}`);
    }
    const rawItems = Array.isArray(parsed) ? parsed : parsed?.items;
    if (!Array.isArray(rawItems)) return [];
    return rawItems.map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const sourceText = String(item.sourceText || item.originalText || item.text || "").trim();
      const translatedText = String(item.translatedText || item.translation || item.zh || "").trim();
      const bbox = normalizeBBox(item.bbox || item.box || item.boundingBox);
      if (!translatedText || !bbox) return null;
      const orientation = item.orientation === "horizontal" ? "horizontal" : "vertical";
      const kind = ["speech", "sfx", "narration", "other"].includes(item.kind) ? item.kind : "speech";
      return {
        id: Number.isFinite(Number(item.id)) ? Number(item.id) : index + 1,
        sourceText,
        translatedText,
        bbox,
        orientation,
        kind
      };
    }).filter((item) => !!item);
  }
  async function translatePixivMangaImageWithVision(imageBase64, apiKey, model = DEFAULT_VISION_MODEL) {
    if (!apiKey) {
      throw new Error("\u667A\u8C31 API Key \u4E0D\u80FD\u4E3A\u7A7A");
    }
    const imageUrl = stripDataUrlPrefix(imageBase64);
    const response = await fetch(ZHIPU_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model || DEFAULT_VISION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0,
        top_p: 0.7,
        max_tokens: 1800,
        stream: false,
        thinking: { type: "disabled" }
      })
    });
    const data = await parseJsonResponse(response);
    const content = String(data.choices?.[0]?.message?.content || "").trim();
    if (!content) {
      throw new Error("GLM-4.6V \u8FD4\u56DE\u5185\u5BB9\u4E3A\u7A7A");
    }
    return {
      items: parseVisionItems(content),
      requestId: data.id || data.request_id || "",
      rawText: content
    };
  }

  // src/background.ts
  function uniqueUrls(urls) {
    return [...new Set(urls.filter((url) => !!url && /^https?:\/\//i.test(url)))];
  }
  function buildFetchOptions(pageUrl) {
    let referrer = "https://www.pixiv.net/";
    try {
      if (pageUrl && new URL(pageUrl).hostname.endsWith("pixiv.net")) {
        referrer = pageUrl;
      }
    } catch {
    }
    return {
      mode: "cors",
      credentials: "include",
      cache: "reload",
      referrer,
      referrerPolicy: "no-referrer-when-downgrade",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": navigator.language || "zh-CN,zh;q=0.9,en;q=0.8"
      }
    };
  }
  async function fetchWithTimeout(url, options, timeoutMs = 2e4) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
  function arrayBufferToBase64(buffer, contentType = "image/jpeg") {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 32768;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return { base64: `data:${contentType};base64,${btoa(binary)}`, contentType };
  }
  async function fetchOneImageAsBase64(imageUrl, pageUrl) {
    const response = await fetchWithTimeout(imageUrl, buildFetchOptions(pageUrl));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();
    return arrayBufferToBase64(buffer, contentType);
  }
  async function fetchPixivImageAsBase64(imageUrls, pageUrl) {
    const attempts = [];
    for (const url of uniqueUrls(imageUrls)) {
      try {
        const result = await fetchOneImageAsBase64(url, pageUrl);
        return { ...result, usedUrl: url, attempts };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        attempts.push(`${url} => ${message}`);
      }
    }
    throw new Error(`Pixiv \u56FE\u7247\u83B7\u53D6\u5931\u8D25\u3002\u5DF2\u5C1D\u8BD5: ${attempts.join("\uFF1B")}`);
  }
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(["isEnabled", "zhipuVisionModel"], (result) => {
      chrome.storage.local.set({
        isEnabled: result.isEnabled !== void 0 ? result.isEnabled : true,
        zhipuVisionModel: result.zhipuVisionModel || "glm-4.6v"
      });
    });
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.target !== "background") {
      return true;
    }
    switch (message.type) {
      case "GET_STORAGE":
        chrome.storage.local.get(message.keys, (result) => sendResponse(result));
        return true;
      case "SET_STORAGE":
        chrome.storage.local.set(message.data, () => sendResponse({ success: true }));
        return true;
      case "TRANSLATE_PIXIV_IMAGE":
        (async () => {
          try {
            if (!message.apiKey) throw new Error("\u7F3A\u5C11\u667A\u8C31 API Key");
            const imageUrls = uniqueUrls([
              ...Array.isArray(message.imageUrls) ? message.imageUrls : [],
              message.imageUrl
            ]);
            if (imageUrls.length === 0) throw new Error("\u7F3A\u5C11 Pixiv \u56FE\u7247 URL");
            const fetched = await fetchPixivImageAsBase64(imageUrls, message.pageUrl);
            const result = await translatePixivMangaImageWithVision(
              fetched.base64,
              message.apiKey,
              message.model || "glm-4.6v"
            );
            sendResponse({
              success: true,
              items: result.items,
              requestId: result.requestId,
              rawText: result.rawText,
              source: "pixiv-html-url",
              sourceMessage: `\u5DF2\u4ECE Pixiv HTML \u56FE\u7247 URL \u83B7\u53D6\u56FE\u7247\u5E76\u4EA4\u7ED9 ${message.model || "glm-4.6v"} \u8BC6\u522B\u7FFB\u8BD1`,
              contentType: fetched.contentType,
              usedUrl: fetched.usedUrl,
              attempts: fetched.attempts
            });
          } catch (error) {
            sendResponse({
              success: false,
              source: "pixiv-html-url",
              message: error instanceof Error ? error.message : "Pixiv \u56FE\u7247\u7FFB\u8BD1\u5931\u8D25"
            });
          }
        })();
        return true;
      default:
        sendResponse({ success: false, message: `\u672A\u77E5\u6D88\u606F\u7C7B\u578B: ${message.type}` });
        return true;
    }
  });
  console.log("[MangaLens] Background script loaded for Pixiv GLM-4.6V translation");
})();
