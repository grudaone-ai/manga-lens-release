import { recognizeWithZhipuOCR } from './modules/zhipu-client';

interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

let lastCaptureAt = 0;
let captureQueue: Promise<void> = Promise.resolve();

function buildFetchOptions(imageUrl: string, pageUrl?: string): RequestInit {
  const options: RequestInit = {
    mode: 'cors',
    credentials: 'omit',
    cache: 'default'
  };

  if (!pageUrl) return options;

  try {
    const page = new URL(pageUrl);
    const image = new URL(imageUrl);

    if (image.hostname.endsWith('pximg.net') && page.hostname.endsWith('pixiv.net')) {
      return {
        ...options,
        referrer: `${page.origin}/`,
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

async function fetchImageAsBase64(imageUrl: string, pageUrl?: string): Promise<string> {
  const response = await fetch(imageUrl, buildFetchOptions(imageUrl, pageUrl));
  if (!response.ok) {
    throw new Error(`图片获取失败: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return `data:${contentType};base64,${btoa(binary)}`;
}

function captureVisibleTab(): Promise<string> {
  return new Promise((resolve, reject) => {
    captureQueue = captureQueue
      .then(async () => {
        const waitMs = Math.max(0, 700 - (Date.now() - lastCaptureAt));
        if (waitMs > 0) {
          await new Promise((done) => setTimeout(done, waitMs));
        }

        return new Promise<void>((done, fail) => {
          chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, { format: 'png' }, (dataUrl) => {
            lastCaptureAt = Date.now();

            if (chrome.runtime.lastError) {
              fail(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (!dataUrl) {
              fail(new Error('标签页截图失败'));
              return;
            }

            resolve(dataUrl);
            done();
          });
        });
      })
      .catch(reject);
  });
}

async function cropCapturedImage(dataUrl: string, cropRect: CropRect, devicePixelRatio = 1): Promise<string> {
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
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('截图裁剪失败');
  }

  ctx.drawImage(bitmap, sx, sy, clippedWidth, clippedHeight, 0, 0, clippedWidth, clippedHeight);
  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await croppedBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return `data:image/png;base64,${btoa(binary)}`;
}

async function captureAndRecognizeVisibleImage(
  cropRect: CropRect,
  devicePixelRatio: number,
  apiKey: string,
  model: string
) {
  const screenshot = await captureVisibleTab();
  const croppedImage = await cropCapturedImage(screenshot, cropRect, devicePixelRatio);
  return recognizeWithZhipuOCR(croppedImage, apiKey, model);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['isEnabled', 'zhipuTranslationModel', 'zhipuOcrModel'], (result) => {
    chrome.storage.local.set({
      isEnabled: result.isEnabled !== undefined ? result.isEnabled : true,
      zhipuTranslationModel: result.zhipuTranslationModel || 'glm-4.7',
      zhipuOcrModel: result.zhipuOcrModel || 'glm-ocr'
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'background') {
    return true;
  }

  switch (message.type) {
    case 'GET_STORAGE':
      chrome.storage.local.get(message.keys, (result) => {
        sendResponse(result);
      });
      return true;

    case 'SET_STORAGE':
      chrome.storage.local.set(message.data, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'FETCH_IMAGE_AS_BASE64':
      (async () => {
        try {
          const base64 = await fetchImageAsBase64(message.imageUrl, message.pageUrl);
          sendResponse({ success: true, base64 });
        } catch (error) {
          sendResponse({
            success: false,
            message: error instanceof Error ? error.message : '图片获取失败'
          });
        }
      })();
      return true;

    case 'TEST_ZHIPU_OCR':
      (async () => {
        try {
          const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';
          const result = await recognizeWithZhipuOCR(
            testImageBase64,
            message.apiKey,
            message.model || 'glm-ocr'
          );

          sendResponse({
            success: true,
            message: `智谱 OCR 连接成功，识别到 ${result.items.length} 个文本区域`,
            requestId: result.requestId
          });
        } catch (error) {
          sendResponse({
            success: false,
            message: error instanceof Error ? error.message : '智谱 OCR 测试失败'
          });
        }
      })();
      return true;

    case 'FETCH_IMAGE_AND_ZHIPU_OCR':
      (async () => {
        try {
          let imageBase64: string;

          try {
            imageBase64 = await fetchImageAsBase64(message.imageUrl, message.pageUrl);
          } catch (error) {
            const messageText = error instanceof Error ? error.message : String(error);
            const isForbidden = messageText.includes('HTTP 403');
            if (!isForbidden || !message.cropRect) {
              throw error;
            }

            const fallbackResult = await captureAndRecognizeVisibleImage(
              message.cropRect,
              message.devicePixelRatio || 1,
              message.apiKey,
              message.model || 'glm-ocr'
            );

            sendResponse({
              success: true,
              text: fallbackResult.text,
              items: fallbackResult.items,
              requestId: fallbackResult.requestId,
              fallback: 'visible-tab-capture'
            });
            return;
          }

          const result = await recognizeWithZhipuOCR(
            imageBase64,
            message.apiKey,
            message.model || 'glm-ocr'
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
            message: error instanceof Error ? error.message : '智谱 OCR 识别失败'
          });
        }
      })();
      return true;

    default:
      sendResponse({ success: false, message: `未知消息类型: ${message.type}` });
      return true;
  }
});

console.log('[MangaLens] Background script loaded with Zhipu API');
