import { translateWithZhipu } from './zhipu-client';

export interface DialogTranslationItem {
  id: number;
  originalText: string;
  translatedText?: string;
  success: boolean;
  error?: string;
}

export interface BatchTranslationResult {
  items: DialogTranslationItem[];
  successCount: number;
  failureCount: number;
  requestId?: string;
}

export interface BatchTranslationConfig {
  apiKey: string;
  endpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxBatchSize?: number;
  targetLanguage?: string;
}

const DEFAULT_CONFIG: Required<BatchTranslationConfig> = {
  apiKey: '',
  endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  model: 'glm-4.7',
  temperature: 0.6,
  maxTokens: 4000,
  maxBatchSize: 999,
  targetLanguage: '简体中文'
};

const SYSTEM_PROMPT = `你是专业的漫画翻译助手。

任务：将漫画 OCR 识别出的台词翻译成自然、简洁的简体中文。

必须遵守：
1. 输出格式固定为：【编号】译文。
2. 每个编号只输出一行。
3. 不输出解释、分析、备注、引号、括号或额外前缀。
4. 保留漫画台词的语气，译文要口语化。
5. OCR 文字可能有错，翻译前先按上下文自行修正，再直接输出译文。
6. 如果原文不是日文，也按最合理含义翻译成简体中文。`;

function buildBatchPrompt(items: Array<{ id: number; text: string }>): string {
  return items.map((item) => `【${String(item.id).padStart(3, '0')}】${item.text}`).join('\n');
}

function parseTranslationResponse(response: string, expectedIds: number[]): Map<number, string> {
  const result = new Map<number, string>();
  const expected = new Set(expectedIds);
  const lines = response.split('\n').map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^【?\s*(\d+)\s*】?\s*(.+)$/);
    if (!match) continue;

    const id = Number.parseInt(match[1], 10);
    const text = match[2].trim();
    if (expected.has(id) && text) {
      result.set(id, text);
    }
  }

  return result;
}

export class BatchTranslator {
  private config: Required<BatchTranslationConfig>;

  constructor(config: BatchTranslationConfig) {
    if (!config.apiKey) {
      throw new Error('智谱 API Key 不能为空');
    }
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async translate(items: Array<{ id: number; text: string }>): Promise<BatchTranslationResult> {
    if (items.length === 0) {
      return { items: [], successCount: 0, failureCount: 0 };
    }

    try {
      const response = await this.callZhipuAPI(items);
      const translations = parseTranslationResponse(response.content, items.map((item) => item.id));

      const resultItems = items.map((item): DialogTranslationItem => {
        const translated = translations.get(item.id);
        if (translated) {
          return {
            id: item.id,
            originalText: item.text,
            translatedText: translated,
            success: true
          };
        }

        return {
          id: item.id,
          originalText: item.text,
          success: false,
          error: '智谱响应中没有找到对应编号的译文'
        };
      });

      const successCount = resultItems.filter((item) => item.success).length;
      return {
        items: resultItems,
        successCount,
        failureCount: resultItems.length - successCount,
        requestId: response.requestId
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知翻译错误';
      return {
        items: items.map((item) => ({
          id: item.id,
          originalText: item.text,
          success: false,
          error: message
        })),
        successCount: 0,
        failureCount: items.length
      };
    }
  }

  private async callZhipuAPI(items: Array<{ id: number; text: string }>): Promise<{ content: string; requestId: string }> {
    const prompt = buildBatchPrompt(items);
    return translateWithZhipu(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      this.config.apiKey,
      this.config.model,
      this.config.temperature,
      this.config.maxTokens
    );
  }

  async translateInBatches(
    items: Array<{ id: number; text: string }>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<BatchTranslationResult> {
    const allResults: DialogTranslationItem[] = [];
    let totalSuccess = 0;
    let totalFailure = 0;
    let lastRequestId = '';

    for (let index = 0; index < items.length; index += this.config.maxBatchSize) {
      const batch = items.slice(index, index + this.config.maxBatchSize);
      const result = await this.translate(batch);

      allResults.push(...result.items);
      totalSuccess += result.successCount;
      totalFailure += result.failureCount;
      if (result.requestId) lastRequestId = result.requestId;

      onProgress?.(Math.min(index + this.config.maxBatchSize, items.length), items.length);

      if (index + this.config.maxBatchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return {
      items: allResults,
      successCount: totalSuccess,
      failureCount: totalFailure,
      requestId: lastRequestId
    };
  }
}

export async function batchTranslate(
  dialogs: Array<{ id: number; text: string }>,
  apiKey: string
): Promise<BatchTranslationResult> {
  const translator = new BatchTranslator({ apiKey });
  return translator.translate(dialogs);
}
