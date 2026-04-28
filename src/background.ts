import { translatePixivMangaImageWithVision } from './modules/zhipu-vision-client';

function uniqueUrls(urls: Array<string | undefined | null>): string[] {
  return [...new Set(urls.filter((url): url is string => !!url && /^https?:\/\//i.test(url)))];
}

function buildFetchOptions(pageUrl?: string): RequestInit {
  let referrer = 'https://www.pixiv.net/';
  try {
    if (pageUrl && new URL(pageUrl).hostname.endsWith('pixiv.net')) {
      referrer = pageUrl;
    }
  } catch {
    // keep default referrer
  }

  return {
    mode: 'cors',
    credentials: 'include',
    cache: 'reload',
    referrer,
    referrerPolicy: 'no-referrer-when-downgrade',
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': navigator.language || 'zh-CN,zh;q=0.9,en;q=0.8'
    }
  };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer, contentType = 'image/jpeg'): { base64: string; contentType: string } {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return { base64: `data:${contentType};base64,${btoa(binary)}`, contentType };
}

async function fetchOneImageAsBase64(imageUrl: string, pageUrl?: string): Promise<{ base64: string; contentType: string }> {
  const response = await fetchWithTimeout(imageUrl, buildFetchOptions(pageUrl));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = await response.arrayBuffer();
  return arrayBufferToBase64(buffer, contentType);
}

async function fetchPixivImageAsBase64(
  imageUrls: string[],
  pageUrl?: string
): Promise<{ base64: string; contentType: string; usedUrl: string; attempts: string[] }> {
  const attempts: string[] = [];

  for (const url of uniqueUrls(imageUrls)) {
    try {
      const result = await fetchOneImageAsBase64(url, pageUrl);
      return { ...result, usedUrl: url, attempts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push(`${url} => ${message}`);
    }
  }

  throw new Error(`Pixiv 图片获取失败。已尝试: ${attempts.join('；')}`);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['isEnabled', 'zhipuVisionModel'], (result) => {
    chrome.storage.local.set({
      isEnabled: result.isEnabled !== undefined ? result.isEnabled : true,
      zhipuVisionModel: result.zhipuVisionModel || 'glm-4.6v'
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'background') {
    return true;
  }

  switch (message.type) {
    case 'GET_STORAGE':
      chrome.storage.local.get(message.keys, (result) => sendResponse(result));
      return true;

    case 'SET_STORAGE':
      chrome.storage.local.set(message.data, () => sendResponse({ success: true }));
      return true;

    case 'TRANSLATE_PIXIV_IMAGE':
      (async () => {
        try {
          if (!message.apiKey) throw new Error('缺少智谱 API Key');
          const imageUrls = uniqueUrls([
            ...(Array.isArray(message.imageUrls) ? message.imageUrls : []),
            message.imageUrl
          ]);
          if (imageUrls.length === 0) throw new Error('缺少 Pixiv 图片 URL');

          const fetched = await fetchPixivImageAsBase64(imageUrls, message.pageUrl);
          const result = await translatePixivMangaImageWithVision(
            fetched.base64,
            message.apiKey,
            message.model || 'glm-4.6v'
          );

          sendResponse({
            success: true,
            items: result.items,
            requestId: result.requestId,
            rawText: result.rawText,
            source: 'pixiv-html-url',
            sourceMessage: `已从 Pixiv HTML 图片 URL 获取图片并交给 ${message.model || 'glm-4.6v'} 识别翻译`,
            contentType: fetched.contentType,
            usedUrl: fetched.usedUrl,
            attempts: fetched.attempts
          });
        } catch (error) {
          sendResponse({
            success: false,
            source: 'pixiv-html-url',
            message: error instanceof Error ? error.message : 'Pixiv 图片翻译失败'
          });
        }
      })();
      return true;

    default:
      sendResponse({ success: false, message: `未知消息类型: ${message.type}` });
      return true;
  }
});

console.log('[MangaLens] Background script loaded for Pixiv GLM-4.6V translation');
