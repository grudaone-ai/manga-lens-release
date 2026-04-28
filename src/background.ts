import { translatePixivMangaImageWithVision } from './modules/zhipu-vision-client';

function buildFetchOptions(imageUrl: string, pageUrl?: string): RequestInit {
  const options: RequestInit = {
    mode: 'cors',
    credentials: 'omit',
    cache: 'force-cache'
  };

  if (!pageUrl) return options;

  try {
    const page = new URL(pageUrl);
    const image = new URL(imageUrl);

    if (image.hostname.endsWith('pximg.net') && page.hostname.endsWith('pixiv.net')) {
      return {
        ...options,
        referrer: page.origin + '/',
        referrerPolicy: 'strict-origin-when-cross-origin'
      };
    }

    return {
      ...options,
      referrer: pageUrl,
      referrerPolicy: 'strict-origin-when-cross-origin'
    };
  } catch {
    return options;
  }
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

async function fetchImageAsBase64(imageUrl: string, pageUrl?: string): Promise<{ base64: string; contentType: string }> {
  const response = await fetchWithTimeout(imageUrl, buildFetchOptions(imageUrl, pageUrl));
  if (!response.ok) {
    throw new Error(`Pixiv 图片获取失败: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return { base64: `data:${contentType};base64,${btoa(binary)}`, contentType };
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
          if (!message.imageUrl) throw new Error('缺少 Pixiv 图片 URL');
          if (!message.apiKey) throw new Error('缺少智谱 API Key');

          const fetched = await fetchImageAsBase64(message.imageUrl, message.pageUrl);
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
            contentType: fetched.contentType
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
