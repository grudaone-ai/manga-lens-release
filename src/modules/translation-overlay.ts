/**
 * 翻译覆盖层模块
 *
 * Pixiv 等站点经常会因为瀑布流、懒加载、缩放和 SPA 路由导致图片父容器变化。
 * 这里统一使用挂在 body 下的全局 absolute 容器，并且所有覆盖层都用图片当前页面坐标计算，
 * 避免“文本框离原文字很远”和切换/滚动后错位。
 */

import type { BoundingBox } from './ocr-engine';
import type { TranslationResult } from './translator';
import type { MergedDialog } from './dialog-merger';

export interface TranslationOverlay {
  id: string;
  originalBox: BoundingBox;
  translatedText: string;
  element: HTMLElement;
  imageElement?: HTMLImageElement;
}

export interface RenderConfig {
  horizontalText: boolean;
  fontSize?: number;
  color?: string;
  background?: string;
  backgroundOpacity?: number;
  padding?: number;
  maxLines?: number;
}

export interface OverlayStyle {
  background?: string;
  color?: string;
  fontSize?: number;
  opacity?: number;
}

const DEFAULT_RENDER_CONFIG: Required<RenderConfig> = {
  horizontalText: true,
  fontSize: 14,
  color: '#000000',
  background: '#FFFFFF',
  backgroundOpacity: 0.86,
  padding: 3,
  maxLines: 10
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function getDocumentRect(element: HTMLElement): DOMRect {
  const rect = element.getBoundingClientRect();
  return new DOMRect(
    rect.left + window.scrollX,
    rect.top + window.scrollY,
    rect.width,
    rect.height
  );
}

function getImageNaturalSize(imageElement: HTMLImageElement): { width: number; height: number } {
  return {
    width: imageElement.naturalWidth || imageElement.width || imageElement.clientWidth || 1,
    height: imageElement.naturalHeight || imageElement.height || imageElement.clientHeight || 1
  };
}

function getDialogBounds(dialog: MergedDialog): { x: number; y: number; width: number; height: number } {
  return dialog.bubbleBounds?.clipped || dialog.bubbleBounds?.padded || dialog.bubbleBounds?.raw || dialog.boundingBox;
}

export class TranslationOverlayManager {
  private container: HTMLElement | null = null;
  private overlays: Map<string, TranslationOverlay> = new Map();
  private containerId = 'manga-lens-overlay-container';
  private overlayClass = 'manga-lens-text-overlay';

  createContainer(_parent?: HTMLElement): HTMLElement {
    let existing = document.getElementById(this.containerId) as HTMLElement | null;

    if (!existing) {
      existing = document.createElement('div');
      existing.id = this.containerId;
      existing.style.cssText = [
        'position:absolute',
        'top:0',
        'left:0',
        'width:0',
        'height:0',
        'pointer-events:none',
        'z-index:2147483646',
        'overflow:visible',
        'contain:layout style'
      ].join(';');
      document.body.appendChild(existing);
    }

    this.container = existing;
    return existing;
  }

  renderTranslation(imageElement: HTMLImageElement, box: BoundingBox, translatedText: string): string {
    const dialog: MergedDialog = {
      id: Date.now(),
      text: box.text,
      items: [],
      boundingBox: { x: box.x, y: box.y, width: box.width, height: box.height },
      charCount: box.text.length,
      charWidth: Math.max(8, box.width / Math.max(1, box.text.length)),
      itemCharWidths: [],
      translatedText,
      translationSuccess: true,
      isVertical: box.isVertical
    };
    return this.renderMergedDialog(imageElement, dialog, { horizontalText: !box.isVertical });
  }

  renderBatch(
    imageElement: HTMLImageElement,
    boxes: BoundingBox[],
    translations: TranslationResult[]
  ): string[] {
    const ids: string[] = [];
    translations.forEach((translation, index) => {
      const box = boxes[index];
      if (box && translation) {
        ids.push(this.renderTranslation(imageElement, box, translation.translatedText));
      }
    });
    return ids;
  }

  removeOverlay(id: string): void {
    const overlay = this.overlays.get(id);
    if (!overlay) return;
    overlay.element.remove();
    this.overlays.delete(id);
  }

  removeAllOverlays(): void {
    this.overlays.forEach((overlay) => overlay.element.remove());
    this.overlays.clear();
    this.removeContainer();
  }

  private removeContainer(): void {
    const existing = document.getElementById(this.containerId);
    existing?.remove();
    this.container = null;
  }

  getOverlayCount(): number {
    return this.overlays.size;
  }

  hasOverlays(): boolean {
    return this.overlays.size > 0;
  }

  removeOverlaysForImage(imageElement: HTMLImageElement): void {
    for (const [id, overlay] of this.overlays.entries()) {
      if (overlay.imageElement === imageElement) {
        overlay.element.remove();
        this.overlays.delete(id);
      }
    }
  }

  renderMergedDialog(
    imageElement: HTMLImageElement,
    dialog: MergedDialog,
    config?: Partial<RenderConfig>
  ): string {
    const cfg: Required<RenderConfig> = { ...DEFAULT_RENDER_CONFIG, ...config };
    const container = this.container || this.createContainer();
    const id = `ml-overlay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const natural = getImageNaturalSize(imageElement);
    const imageRect = getDocumentRect(imageElement);
    const bounds = getDialogBounds(dialog);

    const safeX = clamp(bounds.x, 0, natural.width);
    const safeY = clamp(bounds.y, 0, natural.height);
    const safeWidth = clamp(bounds.width, 1, natural.width - safeX || natural.width);
    const safeHeight = clamp(bounds.height, 1, natural.height - safeY || natural.height);

    const scaleX = imageRect.width / natural.width;
    const scaleY = imageRect.height / natural.height;

    let leftPx = imageRect.left + safeX * scaleX;
    let topPx = imageRect.top + safeY * scaleY;
    let widthPx = Math.max(18, safeWidth * scaleX);
    let heightPx = Math.max(18, safeHeight * scaleY);

    const text = dialog.translatedText || dialog.text;
    const isVertical = cfg.horizontalText ? false : !!dialog.isVertical;

    // 译文通常比原文长。直接用原 OCR 小框会导致译文离泡框中心很远或挤成一条线。
    // 在原文字框中心附近扩展，但不越出图片。
    if (cfg.horizontalText) {
      const estimatedWidth = clamp(text.length * (cfg.fontSize * 0.86), widthPx, imageRect.width * 0.55);
      const estimatedHeight = clamp(Math.ceil(text.length / Math.max(4, Math.floor(estimatedWidth / (cfg.fontSize * 0.9)))) * cfg.fontSize * 1.45, heightPx, imageRect.height * 0.22);
      leftPx -= (estimatedWidth - widthPx) / 2;
      topPx -= (estimatedHeight - heightPx) / 2;
      widthPx = estimatedWidth;
      heightPx = estimatedHeight;
    } else if (isVertical) {
      const estimatedWidth = clamp(Math.ceil(text.length / 8) * cfg.fontSize * 1.3, widthPx, imageRect.width * 0.35);
      leftPx -= (estimatedWidth - widthPx) / 2;
      widthPx = estimatedWidth;
    }

    leftPx = clamp(leftPx, imageRect.left, Math.max(imageRect.left, imageRect.right - widthPx));
    topPx = clamp(topPx, imageRect.top, Math.max(imageRect.top, imageRect.bottom - heightPx));

    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = this.overlayClass;
    overlay.textContent = text;

    const fontSize = this.calculateFontSizeForDialog(dialog, text, widthPx, cfg);
    const bgWithOpacity = this.hexToRgba(cfg.background, cfg.backgroundOpacity);

    overlay.style.cssText = [
      'position:absolute',
      `left:${leftPx}px`,
      `top:${topPx}px`,
      `width:${widthPx}px`,
      `min-height:${heightPx}px`,
      `font-family:"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif`,
      `font-size:${fontSize}px`,
      'line-height:1.35',
      `color:${cfg.color}`,
      `background:${bgWithOpacity}`,
      `padding:${cfg.padding}px`,
      'margin:0',
      'border-radius:3px',
      'box-shadow:0 1px 3px rgba(0,0,0,0.12)',
      'text-shadow:0 0 2px rgba(255,255,255,0.85)',
      'word-break:break-word',
      'overflow-wrap:anywhere',
      'white-space:pre-wrap',
      'text-align:center',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'box-sizing:border-box',
      'pointer-events:none',
      `writing-mode:${cfg.horizontalText ? 'horizontal-tb' : 'vertical-rl'}`
    ].join(';');

    if (dialog.translationSuccess === false) {
      overlay.style.border = '1px dashed #ef4444';
      overlay.title = '翻译失败，使用原文';
    }

    container.appendChild(overlay);
    this.overlays.set(id, {
      id,
      originalBox: {
        ...dialog.boundingBox,
        text: dialog.text,
        confidence: 1,
        isVertical: dialog.isVertical || false
      },
      translatedText: text,
      element: overlay,
      imageElement
    });

    return id;
  }

  renderMergedDialogs(
    imageElement: HTMLImageElement,
    dialogs: MergedDialog[],
    config?: Partial<RenderConfig>
  ): string[] {
    this.removeOverlaysForImage(imageElement);
    const ids: string[] = [];

    for (const dialog of dialogs) {
      if (dialog.translatedText || dialog.text) {
        ids.push(this.renderMergedDialog(imageElement, dialog, config));
      }
    }

    console.log(`[Overlay] 渲染完成: ${ids.length} 个覆盖层`);
    return ids;
  }

  rerenderOverlays(_imageElement: HTMLImageElement): void {
    // 当前渲染策略基于文档坐标；刷新翻译时会移除并重新渲染。
  }

  private calculateFontSize(boxWidth: number, config: Required<RenderConfig>): number {
    return clamp(Math.floor(boxWidth / 5), 10, config.fontSize);
  }

  private calculateFontSizeForDialog(
    dialog: MergedDialog,
    translatedText: string,
    boxWidth: number,
    config: Required<RenderConfig>
  ): number {
    if (!dialog.charWidth || dialog.charWidth <= 0 || !dialog.charCount) {
      return this.calculateFontSize(boxWidth, config);
    }

    const translatedCharCount = Math.max(1, translatedText.length);
    const scaleFactor = Math.min(1, Math.sqrt(dialog.charCount / translatedCharCount));
    return clamp(Math.round(dialog.charWidth * 0.95 * scaleFactor), 10, config.fontSize);
  }

  private hexToRgba(hex: string, alpha: number): string {
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;

    const value = hex.replace('#', '');
    if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
      return `rgba(255,255,255,${alpha})`;
    }

    const normalized = value.length === 3
      ? value.split('').map((char) => char + char).join('')
      : value;

    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  updateStyle(style: Partial<OverlayStyle>): void {
    const styleElement = document.getElementById('manga-lens-styles') || this.createStyleElement();
    styleElement.textContent = `
      .manga-lens-text-overlay {
        ${style.background ? `background: ${style.background};` : ''}
        ${style.color ? `color: ${style.color};` : ''}
        ${style.fontSize ? `font-size: ${style.fontSize}px;` : ''}
        ${style.opacity !== undefined ? `opacity: ${style.opacity};` : ''}
      }
    `;
  }

  private createStyleElement(): HTMLElement {
    const style = document.createElement('style');
    style.id = 'manga-lens-styles';
    document.head.appendChild(style);
    return style;
  }
}

export const overlayManager = new TranslationOverlayManager();
