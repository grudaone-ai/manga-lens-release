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
    cache: 'force-cache'
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

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
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
    throw new Error(`图片获取失败: HTTP ${response.status}`);
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

function queryActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab || null));
  });
}

function isCropVisible(cropRect: CropRect): boolean {
  return (
    cropRect.width > 0 &&
    cropRect.height > 0 &&
    cropRect.left < screen.width &&
    cropRect.top < screen.height &&
    cropRect.left + cropRect.width > 0 &&
    cropRect.top + cropRect.height > 0
  );
}

async function captureVisibleTab(expectedTabId?: number, cropRect?: CropRect): Promise<string> {
  const activeTab = await queryActiveTab();
  if (expectedTabId && activeTab?.id !== expectedTabId) {
    throw new Error('当前标签页已切换，已取消截图 OCR，避免识别到错误标签页');
  }

  if (cropRect && !isCropVisible(cropRect)) {
    throw new Error('图片不在当前可见区域，已跳过截图 OCR');
  }

  return new Promise((resolve, reject) => {
    captureQueue = captureQueue
      .then(async () => {
        const waitMs = Math.max(0, 900 - (Date.now() - lastCaptureAt));
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
  model: string,
  tabId?: number
) {
  const screenshot = await captureVisibleTab(tabId, cropRect);
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
          const result = await fetchImageAsBase64(message.imageUrl, message.pageUrl);
          sendResponse({ success: true, base64: result.base64, contentType: result.contentType });
        } catch (error) {
          sendResponse({
            success: false,
            message: error instanceof Error ? error.message : '图片获取失败'
          });
        }
      })();
      return true;

    case 'RECOGNIZE_ZHIPU_OCR_BASE64':
      (async () => {
        try {
          const result = await recognizeWithZhipuOCR(
            message.imageBase64,
            message.apiKey,
            message.model || 'glm-ocr'
          );

          sendResponse({
            success: true,
            text: result.text,
            items: result.items,
            requestId: result.requestId,
            source: message.source || 'element-canvas',
            sourceWidth: message.sourceWidth,
            sourceHeight: message.sourceHeight,
            sourceMessage: message.sourceMessage
          });
        } catch (error) {
          sendResponse({
            success: false,
            source: message.source || 'element-canvas',
            message: error instanceof Error ? error.message : '智谱 OCR 识别失败'
          });
        }
      })();
      return true;

    case 'TEST_ZHIPU_OCR':
      (async () => {
        try {
          const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAABQCAIAAACoK28rAAAEdklEQVR4nO3dPUh6XxzH8dsDhRIIgmUJtQQG0QPdIexBr1l3aS1bKiNoiZqiWoKWQCRoKBoqUNsighwqTCMosqKhwaWhNqPggj1QWFp5/sOFi/Sz/v3+/uD/88vnNZ17POd4L7x7wIZyGGMcABW5//cNAPxJCBpIQdBACoIGUhA0kIKggRQEDaQgaCAFQQMpCBpIQdBACoIGUhA0kIKggRQEDaQgaCAFQQMpCBpIQdBACoIGUhA0kIKggRQEDaQgaCAFQQMpCBpIyTRoj8fD87zJZOJ5fnV1VZ5cWVlpaGiwWCydnZ2RSESeVKvVgiBYLJaGhoaDgwN5cnNzUxAEQRDy8/PlwcbGhrxSNjc3x3Hc+fm5KIpWq7WjoyMSiaTdJR/48PAwMDCg0WiUO3S73a2trfX19YFAgOO4WCzW09MjCALP89vb2xk+Pvx1WAb8fn9zc/P9/T1j7P7+vrm5ORgMBgIBq9Uai8UYYzs7O21tbfJijUYjD8LhcE1NzaejlFc/jWV1dXWRSIQxtrGxYbfbv1nZ0tIyPz+vzEuSZDabPz4+Li4uqqqqGGMul2t2dpYxdnNzU1FR8Z+eG/5eGQVts9mOj4+Vy1Ao1N7eLoriycmJMjk0NJRIJFhKfMlkUqvVfjrq+6BLS0svLy8ZY4lE4vDw8JuVt7e3qfMXFxfr6+uMsefnZ51Oxxi7u7uLx+OMsWAwWFlZ+TuPC1kgo6DLyspeXl6Uy5eXl7KyMoPB8Pr6+utiJTK/39/V1fXVqyxdph6PR6/XDw4O7u/vf7Xr+3mv1zs4OKhc9vb2qtXqvb29tNshe/3JoGOxmMFg0Ov1aYNWqVQWi6WpqUmr1crfR1OlJiivlCk/Ae7u7txud21t7fT0dNpdX53GGLu6uqqurpYkKXXS5/P19fX96zNCdsko6Pb29lAopFweHR2Jomg2m09PT+WZZDLZ398vj5XIXC6X0+n8dNQ336ElSVLeRZKkkpKSr1amnX96euJ5XrmlkZGRt7c3xtj7+/uvv/lAtsvoU47x8fGJiYnHx0eO4x4eHiYnJycmJoaHh6empuLxOMdxa2tr8iBVR0fH2dnZz98lJyfHbrfLn5ZEo9Hy8vKf72WMORyOsbGxxsZGeebx8dHn83Ecd3x8bDQaf34UZIX8TDaLonh9fW21WgsLCxOJxOjoqM1m4zju8vKS53mdTldcXLy4uPhpl9FoDIfDyWQyNzf9l1MikRAEQR6bTCan07m8vNzd3a1SqfLy8txu98/v0Ov17u7uRqPRpaWloqKira2tmZkZh8OxsLBQUFDwW0dBVshh+JcUQAj+UgikIGggBUEDKQgaSEHQQAqCBlIQNJCCoIEUBA2kIGggBUEDKQgaSEHQQAqCBlIQNJCCoIEUBA2kIGggBUEDKQgaSEHQQAqCBlIQNJCCoIEUBA2kIGggBUEDKQgaSEHQQAqCBlIQNJCCoIEUBA2kIGggBUEDKQgaSEHQQAqCBlIQNJCCoIEUBA2kIGggBUEDKQgaSPkHsXrIuAOLC/QAAAAASUVORK5CYII=';
          const result = await recognizeWithZhipuOCR(testImageBase64, message.apiKey, message.model || 'glm-ocr');

          sendResponse({
            success: true,
            message: `智谱 OCR 连接成功，识别到 ${result.items.length} 个文本区域${result.text ? `：${result.text.slice(0, 30)}` : ''}`,
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
            const fetched = await fetchImageAsBase64(message.imageUrl, message.pageUrl);
            imageBase64 = fetched.base64;
          } catch (error) {
            const messageText = error instanceof Error ? error.message : String(error);
            const isForbidden = messageText.includes('HTTP 403') || messageText.includes('Failed to fetch');
            if (!isForbidden || !message.cropRect) {
              throw error;
            }

            const fallbackResult = await captureAndRecognizeVisibleImage(
              message.cropRect,
              message.devicePixelRatio || 1,
              message.apiKey,
              message.model || 'glm-ocr',
              sender.tab?.id
            );

            sendResponse({
              success: true,
              text: fallbackResult.text,
              items: fallbackResult.items,
              requestId: fallbackResult.requestId,
              source: 'visible-tab-capture',
              sourceWidth: Math.round(message.cropRect.width * (message.devicePixelRatio || 1)),
              sourceHeight: Math.round(message.cropRect.height * (message.devicePixelRatio || 1)),
              sourceMessage: `background fetch 失败: ${messageText}；已回退截图 OCR`,
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
            requestId: result.requestId,
            source: 'background-fetch',
            sourceMessage: '已通过 background fetch 获取图片 URL'
          });
        } catch (error) {
          sendResponse({
            success: false,
            source: 'background-fetch',
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
