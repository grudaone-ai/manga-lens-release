export interface ZhipuOCRLayoutItem {
  content?: string;
  text?: string;
  bbox_2d?: number[];
  bbox?: number[];
  width?: number;
  height?: number;
  label?: string;
  confidence?: number;
}

export interface ZhipuOCRResult {
  text: string;
  items: ZhipuOCRLayoutItem[];
  requestId?: string;
  raw: unknown;
}

export interface ZhipuBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
  isVertical: boolean;
}

export interface ZhipuConvertedOCRResult {
  text: string;
  boxes: ZhipuBoundingBox[];
  confidence: number;
}

export interface DialogTranslationItem {
  id: number;
  originalText: string;
  translatedText?: string;
  success: boolean;
  error?: string;
}

export interface ZhipuTranslationResult {
  content: string;
  requestId: string;
}

const ZHIPU_CHAT_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_OCR_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/layout_parsing';

async function parseJsonResponse(response: Response, serviceName: string): Promise<any> {
  const text = await response.text();
  let data: any;

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

function flattenLayoutDetails(value: unknown): ZhipuOCRLayoutItem[] {
  if (!Array.isArray(value)) return [];

  const result: ZhipuOCRLayoutItem[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (node && typeof node === 'object') {
      const item = node as ZhipuOCRLayoutItem;
      if ((item.content || item.text) && (item.bbox_2d || item.bbox)) {
        result.push(item);
      }
    }
  };

  visit(value);
  return result;
}

function extractMarkdownText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return String(record.md || record.text || record.content || '');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'string') return value;
  return '';
}

export async function recognizeWithZhipuOCR(
  imageBase64: string,
  apiKey: string,
  model = 'glm-ocr'
): Promise<ZhipuOCRResult> {
  if (!apiKey) {
    throw new Error('Zhipu API Key is required for OCR');
  }

  const normalizedFile = imageBase64.replace(/^data:[^;]+;base64,/, '');
  const fileCandidates = imageBase64.startsWith('data:')
    ? [normalizedFile, imageBase64]
    : [normalizedFile];

  let data: any;
  let lastError: unknown;

  for (const file of fileCandidates) {
    try {
      const response = await fetch(ZHIPU_OCR_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          file,
          return_crop_images: false,
          need_layout_visualization: false
        })
      });

      data = await parseJsonResponse(response, 'Zhipu OCR');
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!data) {
    throw lastError instanceof Error ? lastError : new Error('Zhipu OCR request failed');
  }

  const items = flattenLayoutDetails(data.layout_details);
  const text = extractMarkdownText(data.md_results) ||
    items.map((item) => item.content || item.text || '').filter(Boolean).join('\n');

  return {
    text,
    items,
    requestId: data.request_id || data.id || '',
    raw: data
  };
}

export function convertZhipuOCRResultToOCRResult(
  result: ZhipuOCRResult,
  imageWidth: number,
  imageHeight: number
): ZhipuConvertedOCRResult {
  const boxes = result.items
    .map((item) => {
      const text = String(item.content || item.text || '').trim();
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
    })
    .filter((box): box is ZhipuBoundingBox => !!box);

  return {
    text: boxes.map((box) => box.text).join('\n') || result.text,
    boxes,
    confidence: boxes.length > 0
      ? boxes.reduce((sum, box) => sum + box.confidence, 0) / boxes.length
      : 0
  };
}

export async function translateWithZhipu(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  apiKey: string,
  model = 'glm-4.7',
  temperature = 0.6,
  maxTokens = 4000
): Promise<ZhipuTranslationResult> {
  if (!apiKey) {
    throw new Error('Zhipu API Key is required for translation');
  }

  const response = await fetch(ZHIPU_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
      thinking: {
        type: 'disabled'
      }
    })
  });

  const data = await parseJsonResponse(response, 'Zhipu translation');
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('Zhipu translation returned an empty response');
  }

  return {
    content,
    requestId: data.id || data.request_id || ''
  };
}
