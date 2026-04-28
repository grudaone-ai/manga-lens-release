export type ImageSourceMethod = 'element-canvas' | 'background-fetch' | 'visible-tab-capture' | 'unknown';

export interface ImageElementCaptureResult {
  base64: string;
  sourceWidth: number;
  sourceHeight: number;
  method: ImageSourceMethod;
  message: string;
}

const MAX_CANVAS_PIXELS = 5_000_000;

function getCanvasTargetSize(width: number, height: number): { width: number; height: number; scale: number } {
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

async function waitForImageDecode(imageElement: HTMLImageElement): Promise<void> {
  if (imageElement.complete && imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0) return;

  await Promise.race([
    imageElement.decode?.().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 2500))
  ]);
}

export async function captureImageElementAsBase64(
  imageElement: HTMLImageElement
): Promise<ImageElementCaptureResult> {
  await waitForImageDecode(imageElement);

  const naturalWidth = imageElement.naturalWidth || imageElement.width || imageElement.clientWidth;
  const naturalHeight = imageElement.naturalHeight || imageElement.height || imageElement.clientHeight;

  if (!naturalWidth || !naturalHeight) {
    throw new Error('页面图片尚未完成加载，无法从 HTMLImageElement 读取尺寸');
  }

  const target = getCanvasTargetSize(naturalWidth, naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext('2d', { willReadFrequently: false });
  if (!context) {
    throw new Error('无法创建 Canvas 以读取页面图片');
  }

  context.drawImage(imageElement, 0, 0, target.width, target.height);

  let base64: string;
  try {
    base64 = canvas.toDataURL('image/png');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`页面图片 Canvas 读取失败，可能被跨域安全策略拦截: ${message}`);
  }

  if (!base64 || base64 === 'data:,') {
    throw new Error('页面图片 Canvas 导出为空');
  }

  const scaleMessage = target.scale < 1
    ? `，为控制 OCR 负载已缩放到 ${target.width}x${target.height}`
    : '';

  return {
    base64,
    sourceWidth: target.width,
    sourceHeight: target.height,
    method: 'element-canvas',
    message: `已直接读取页面 HTML 图片 ${naturalWidth}x${naturalHeight}${scaleMessage}`
  };
}
