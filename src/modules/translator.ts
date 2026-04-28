import { translateWithZhipu } from './zhipu-client';

export interface TranslationResult {
  translatedText: string;
  sourceText: string;
  detectedLanguage?: string;
}

export interface TranslatorConfig {
  zhipuApiKey?: string;
  zhipuTranslationModel?: string;
}

export class Translator {
  private config: TranslatorConfig = {};
  private cache = new Map<string, TranslationResult>();
  private useCount = {
    zhipu: 0
  };

  configure(config: TranslatorConfig): void {
    this.config = config;
  }

  async translateJapaneseToChinese(text: string): Promise<TranslationResult> {
    const cleanText = text.trim();
    if (!cleanText) {
      return { translatedText: '', sourceText: text };
    }

    const cached = this.cache.get(cleanText);
    if (cached) return cached;

    if (!this.config.zhipuApiKey) {
      return {
        translatedText: `[未配置智谱 API] ${cleanText}`,
        sourceText: cleanText
      };
    }

    const response = await translateWithZhipu(
      [
        {
          role: 'system',
          content: '你是专业漫画翻译助手。请把输入台词翻译成自然简洁的简体中文，只输出译文。'
        },
        {
          role: 'user',
          content: cleanText
        }
      ],
      this.config.zhipuApiKey,
      this.config.zhipuTranslationModel || 'glm-4.7',
      0.6,
      500
    );

    const result = {
      translatedText: response.content,
      sourceText: cleanText,
      detectedLanguage: 'auto'
    };

    this.cache.set(cleanText, result);
    this.useCount.zhipu += 1;
    return result;
  }

  async translateBatch(texts: string[]): Promise<TranslationResult[]> {
    return Promise.all(texts.map((text) => this.translateJapaneseToChinese(text)));
  }

  getUsageStats(): { zhipu: number } {
    return { ...this.useCount };
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const translator = new Translator();
