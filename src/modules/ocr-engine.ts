import {
  convertZhipuOCRResultToOCRResult,
  type ZhipuOCRLayoutItem
} from './zhipu-client';
import {
  mergeDialogs,
  DialogMerger,
  type OCRTextItem,
  type MergedDialog,
  type DialogMergerConfig
} from './dialog-merger';
import {
  BatchTranslator,
  type BatchTranslationResult
} from './batch-translator';

export interface OCRResult {
  text: string;
  boxes: BoundingBox[];
  confidence: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
  isVertical: boolean;
}

interface ExtensionConfig {
  zhipuApiKey: string;
  zhipuOcrModel: string;
  zhipuTranslationModel: string;
}

interface ViewportCropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RecognitionTranslationResult {
  dialogs: MergedDialog[];
  translation: BatchTranslationResult;
  rawResult: OCRResult;
  imageSize: { width: number; height: number };
}

async function getExtensionConfig(): Promise<ExtensionConfig> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['zhipuApiKey', 'zhipuOcrModel', 'zhipuTranslationModel'],
      (result) => {
        resolve({
          zhipuApiKey: result.zhipuApiKey || '',
          zhipuOcrModel: result.zhipuOcrModel || 'glm-ocr',
          zhipuTranslationModel: result.zhipuTranslationModel || 'glm-4.7'
        });
      }
    );
  });
}

function getImageUrl(imageElement: HTMLImageElement): string {
  return imageElement.currentSrc || imageElement.src || imageElement.dataset.src || imageElement.dataset.lazySrc || '';
}

function scaleResultToImageSize(
  result: OCRResult,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number
): OCRResult {
  if (!fromWidth || !fromHeight || fromWidth === toWidth && fromHeight === toHeight) return result;

  const scaleX = toWidth / fromWidth;
  const scaleY = toHeight / fromHeight;
  return {
    ...result,
    boxes: result.boxes.map((box) => ({
      ...box,
      x: box.x * scaleX,
      y: box.y * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY
    }))
  };
}

export class MangaOCR {
  private isInitialized = false;
  private config: ExtensionConfig = {
    zhipuApiKey: '',
    zhipuOcrModel: 'glm-ocr',
    zhipuTranslationModel: 'glm-4.7'
  };

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.config = await getExtensionConfig();
    this.isInitialized = true;
    console.log('[MangaLens] OCR initialized with Zhipu API');
  }

  async configureZhipuAPI(apiKey: string, translationModel = 'glm-4.7', ocrModel = 'glm-ocr'): Promise<void> {
    this.config = {
      zhipuApiKey: apiKey,
      zhipuTranslationModel: translationModel || 'glm-4.7',
      zhipuOcrModel: ocrModel || 'glm-ocr'
    };

    await chrome.storage.local.set(this.config);
    this.isInitialized = true;
  }

  async recognize(imageElement: HTMLImageElement): Promise<OCRResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.config.zhipuApiKey) {
      throw new Error('未配置智谱 API Key，请先在扩展设置中填写');
    }

    const imageUrl = getImageUrl(imageElement);
    if (!imageUrl) {
      throw new Error('无法获取图片地址');
    }

    return this.recognizeViaBackground(imageElement, imageUrl);
  }

  private async recognizeViaBackground(
    imageElement: HTMLImageElement,
    imageUrl: string
  ): Promise<OCRResult> {
    const rect = imageElement.getBoundingClientRect();
    const cropRect: ViewportCropRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          target: 'background',
          type: 'FETCH_IMAGE_AND_ZHIPU_OCR',
          imageUrl,
          pageUrl: window.location.href,
          cropRect,
          devicePixelRatio: window.devicePixelRatio || 1,
          apiKey: this.config.zhipuApiKey,
          model: this.config.zhipuOcrModel
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response?.success) {
            reject(new Error(response?.message || '智谱 OCR 识别失败'));
            return;
          }

          const naturalWidth = imageElement.naturalWidth || imageElement.width || Math.round(cropRect.width);
          const naturalHeight = imageElement.naturalHeight || imageElement.height || Math.round(cropRect.height);
          const sourceWidth = Number(response.sourceWidth) || naturalWidth;
          const sourceHeight = Number(response.sourceHeight) || naturalHeight;

          const ocrResult = convertZhipuOCRResultToOCRResult(
            {
              text: response.text || '',
              items: (response.items || []) as ZhipuOCRLayoutItem[],
              requestId: response.requestId,
              raw: response
            },
            sourceWidth,
            sourceHeight
          );

          resolve(scaleResultToImageSize(ocrResult, sourceWidth, sourceHeight, naturalWidth, naturalHeight));
        }
      );
    });
  }

  async recognizeAndMerge(
    imageElement: HTMLImageElement,
    mergerConfig?: Partial<DialogMergerConfig>
  ): Promise<{
    dialogs: MergedDialog[];
    rawResult: OCRResult;
    imageSize: { width: number; height: number };
  }> {
    const rawResult = await this.recognize(imageElement);
    const imageWidth = imageElement.naturalWidth || imageElement.width;
    const imageHeight = imageElement.naturalHeight || imageElement.height;
    const ocrItems: OCRTextItem[] = rawResult.boxes.map((box) => ({
      text: box.text,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      right: box.x + box.width,
      bottom: box.y + box.height,
      confidence: box.confidence,
      isVertical: box.isVertical
    }));

    const dialogs = mergeDialogs(ocrItems, mergerConfig);
    const merger = new DialogMerger(mergerConfig);
    const dialogsWithBounds = merger.calculateAllBubbleBounds(dialogs, imageWidth, imageHeight);

    return {
      dialogs: dialogsWithBounds,
      rawResult,
      imageSize: { width: imageWidth, height: imageHeight }
    };
  }

  async recognizeAndTranslate(
    imageElement: HTMLImageElement,
    mergerConfig?: Partial<DialogMergerConfig>,
    zhipuApiKey?: string,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<RecognitionTranslationResult> {
    const { dialogs, rawResult, imageSize } = await this.recognizeAndMerge(imageElement, mergerConfig);

    if (dialogs.length === 0) {
      return {
        dialogs,
        translation: { items: [], successCount: 0, failureCount: 0 },
        rawResult,
        imageSize
      };
    }

    const apiKey = zhipuApiKey || this.config.zhipuApiKey;
    if (!apiKey) {
      throw new Error('未配置智谱 API Key，无法翻译');
    }

    onProgress?.('translating', 0);
    const translator = new BatchTranslator({
      apiKey,
      model: this.config.zhipuTranslationModel
    });
    const translationItems = dialogs.map((dialog, index) => ({
      id: index,
      text: dialog.text
    }));
    const translation = await translator.translateInBatches(translationItems, (completed, total) => {
      onProgress?.('translating', Math.round((completed / total) * 100));
    });

    const translatedDialogs = dialogs.map((dialog, index) => {
      const item = translation.items.find((entry) => entry.id === index);
      return {
        ...dialog,
        translatedText: item?.translatedText || dialog.text,
        translationSuccess: !!item?.success
      };
    });

    return {
      dialogs: translatedDialogs,
      translation,
      rawResult,
      imageSize
    };
  }
}

export async function testZhipuOCRConnection(
  apiKey: string,
  model = 'glm-ocr'
): Promise<{ success: boolean; message: string; requestId?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        target: 'background',
        type: 'TEST_ZHIPU_OCR',
        apiKey,
        model
      },
      (response) => {
        resolve(response || { success: false, message: '智谱 OCR 测试失败' });
      }
    );
  });
}

export const mangaOCR = new MangaOCR();

export type {
  MergedDialog,
  TranslatedDialog,
  DialogMergerConfig,
  OCRTextItem,
  BubbleBounds,
  EstimatedSize
} from './dialog-merger';
export { DialogMerger, mergeDialogs } from './dialog-merger';

export type {
  DialogTranslationItem,
  BatchTranslationResult
} from './batch-translator';
export { BatchTranslator, batchTranslate } from './batch-translator';
