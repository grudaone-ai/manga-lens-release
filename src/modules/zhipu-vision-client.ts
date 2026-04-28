export interface PixivVisionTranslationItem {
  id: number;
  sourceText: string;
  translatedText: string;
  bbox: [number, number, number, number];
  orientation: 'vertical' | 'horizontal';
  kind?: 'speech' | 'sfx' | 'narration' | 'other';
}

export interface PixivVisionTranslationResult {
  items: PixivVisionTranslationItem[];
  requestId?: string;
  rawText: string;
}

const ZHIPU_CHAT_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const DEFAULT_VISION_MODEL = 'glm-4.6v';

const SYSTEM_PROMPT = `你是 Pixiv 漫画实时翻译引擎。
你的输入是一张 Pixiv 漫画页图片。你的任务是识别漫画画面内的日文台词、旁白、拟声词，并翻译为自然、简洁的简体中文。

规则：
1. 只处理漫画图片内部文字，不处理 Pixiv 网页 UI、作者名、标签、评论、按钮、页码、水印或浏览器界面。
2. 同一个气泡、同一段连续竖排文字、同一条旁白要合并成一条，不要逐字逐列拆开。
3. 译文要短、自然、口语化，适合覆盖回漫画气泡位置。
4. 保留角色语气、吐槽、害羞、命令、疑问等漫画表达。
5. 坐标 bbox 必须对应原文所在区域，使用相对输入图片的 0-1000 归一化坐标：[x1, y1, x2, y2]。
6. 严格输出 JSON，不要输出 Markdown、解释、分析或多余文本。`;

const USER_PROMPT = `请翻译这张 Pixiv 漫画页，并严格返回如下 JSON：
{
  "items": [
    {
      "id": 1,
      "sourceText": "原文",
      "translatedText": "简体中文译文",
      "bbox": [x1, y1, x2, y2],
      "orientation": "vertical",
      "kind": "speech"
    }
  ]
}

字段要求：
- id 从 1 开始递增。
- bbox 坐标范围为 0 到 1000，表示输入图片的相对位置。
- orientation 只能是 "vertical" 或 "horizontal"。
- kind 只能是 "speech"、"sfx"、"narration" 或 "other"。
- 没有可翻译文字时返回 {"items":[]}。`;

function stripDataUrlPrefix(imageBase64: string): string {
  if (imageBase64.startsWith('data:')) return imageBase64;
  return `data:image/jpeg;base64,${imageBase64.replace(/^data:[^;]+;base64,/, '')}`;
}

async function parseJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  let data: any;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`智谱视觉模型返回非 JSON 响应: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.msg || data?.message || text;
    throw new Error(`智谱视觉模型 API error ${response.status}: ${message}`);
  }

  if (data?.error) {
    throw new Error(`智谱视觉模型 API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data;
}

function extractJsonText(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);

  return trimmed;
}

function normalizeBBox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const nums = value.slice(0, 4).map((item) => Number(item));
  if (nums.some((num) => !Number.isFinite(num))) return null;

  let [x1, y1, x2, y2] = nums;
  x1 = Math.max(0, Math.min(1000, x1));
  y1 = Math.max(0, Math.min(1000, y1));
  x2 = Math.max(0, Math.min(1000, x2));
  y2 = Math.max(0, Math.min(1000, y2));

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const right = Math.max(x1, x2);
  const bottom = Math.max(y1, y2);

  if (right - left < 2 || bottom - top < 2) return null;
  return [left, top, right, bottom];
}

function parseVisionItems(content: string): PixivVisionTranslationItem[] {
  const jsonText = extractJsonText(content);
  let parsed: any;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`无法解析 GLM-4.6V 返回 JSON: ${error instanceof Error ? error.message : String(error)}；原始内容: ${content.slice(0, 300)}`);
  }

  const rawItems = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item, index): PixivVisionTranslationItem | null => {
      if (!item || typeof item !== 'object') return null;
      const sourceText = String(item.sourceText || item.originalText || item.text || '').trim();
      const translatedText = String(item.translatedText || item.translation || item.zh || '').trim();
      const bbox = normalizeBBox(item.bbox || item.box || item.boundingBox);
      if (!translatedText || !bbox) return null;

      const orientation = item.orientation === 'horizontal' ? 'horizontal' : 'vertical';
      const kind = ['speech', 'sfx', 'narration', 'other'].includes(item.kind) ? item.kind : 'speech';

      return {
        id: Number.isFinite(Number(item.id)) ? Number(item.id) : index + 1,
        sourceText,
        translatedText,
        bbox,
        orientation,
        kind
      };
    })
    .filter((item): item is PixivVisionTranslationItem => !!item);
}

export async function translatePixivMangaImageWithVision(
  imageBase64: string,
  apiKey: string,
  model = DEFAULT_VISION_MODEL
): Promise<PixivVisionTranslationResult> {
  if (!apiKey) {
    throw new Error('智谱 API Key 不能为空');
  }

  const imageUrl = stripDataUrlPrefix(imageBase64);
  const response = await fetch(ZHIPU_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || DEFAULT_VISION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: USER_PROMPT },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 4000,
      stream: false,
      thinking: { type: 'disabled' }
    })
  });

  const data = await parseJsonResponse(response);
  const content = String(data.choices?.[0]?.message?.content || '').trim();
  if (!content) {
    throw new Error('GLM-4.6V 返回内容为空');
  }

  return {
    items: parseVisionItems(content),
    requestId: data.id || data.request_id || '',
    rawText: content
  };
}
