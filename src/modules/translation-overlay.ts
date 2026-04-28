import type { PixivVisionTranslationItem } from './zhipu-vision-client';

export interface TranslationOverlay {
  id: string;
  translatedText: string;
  element: HTMLElement;
  imageElement: HTMLImageElement;
}

export interface RenderConfig {
  fontSize?: number;
  color?: string;
  background?: string;
  backgroundOpacity?: number;
  padding?: number;
}

const DEFAULT_RENDER_CONFIG: Required<RenderConfig> = {
  fontSize: 14,
  color: '#000000',
  background: '#FFFFFF',
  backgroundOpacity: 0.86,
  padding: 3
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

function hexToRgba(hex: string, alpha: number): string {
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

export class TranslationOverlayManager {
  private container: HTMLElement | null = null;
  private overlays: Map<string, TranslationOverlay> = new Map();
  private containerId = 'manga-lens-overlay-container';
  private overlayClass = 'manga-lens-text-overlay';

  createContainer(): HTMLElement {
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

  removeAllOverlays(): void {
    this.overlays.forEach((overlay) => overlay.element.remove());
    this.overlays.clear();
    document.getElementById(this.containerId)?.remove();
    this.container = null;
  }

  removeOverlaysForImage(imageElement: HTMLImageElement): void {
    for (const [id, overlay] of this.overlays.entries()) {
      if (overlay.imageElement === imageElement) {
        overlay.element.remove();
        this.overlays.delete(id);
      }
    }
  }

  renderPixivVisionItems(
    imageElement: HTMLImageElement,
    items: PixivVisionTranslationItem[],
    config?: Partial<RenderConfig>
  ): string[] {
    this.removeOverlaysForImage(imageElement);
    const ids: string[] = [];

    for (const item of items) {
      ids.push(this.renderPixivVisionItem(imageElement, item, config));
    }

    console.log(`[Overlay] Pixiv 渲染完成: ${ids.length} 个覆盖层`);
    return ids;
  }

  renderPixivVisionItem(
    imageElement: HTMLImageElement,
    item: PixivVisionTranslationItem,
    config?: Partial<RenderConfig>
  ): string {
    const cfg: Required<RenderConfig> = { ...DEFAULT_RENDER_CONFIG, ...config };
    const container = this.container || this.createContainer();
    const id = `ml-overlay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const imageRect = getDocumentRect(imageElement);
    const [x1, y1, x2, y2] = item.bbox;

    let leftPx = imageRect.left + (x1 / 1000) * imageRect.width;
    let topPx = imageRect.top + (y1 / 1000) * imageRect.height;
    let widthPx = Math.max(18, ((x2 - x1) / 1000) * imageRect.width);
    let heightPx = Math.max(18, ((y2 - y1) / 1000) * imageRect.height);

    const text = item.translatedText;
    const estimatedWidth = clamp(text.length * (cfg.fontSize * 0.86), widthPx, imageRect.width * 0.58);
    const estimatedHeight = clamp(
      Math.ceil(text.length / Math.max(4, Math.floor(estimatedWidth / (cfg.fontSize * 0.9)))) * cfg.fontSize * 1.45,
      heightPx,
      imageRect.height * 0.24
    );

    leftPx -= (estimatedWidth - widthPx) / 2;
    topPx -= (estimatedHeight - heightPx) / 2;
    widthPx = estimatedWidth;
    heightPx = estimatedHeight;

    leftPx = clamp(leftPx, imageRect.left, Math.max(imageRect.left, imageRect.right - widthPx));
    topPx = clamp(topPx, imageRect.top, Math.max(imageRect.top, imageRect.bottom - heightPx));

    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = this.overlayClass;
    overlay.textContent = text;
    overlay.dataset.original = item.sourceText || '';

    const bgWithOpacity = hexToRgba(cfg.background, cfg.backgroundOpacity);
    const fontSize = clamp(Math.round(Math.min(cfg.fontSize, widthPx / Math.max(4, Math.min(8, text.length)))), 10, cfg.fontSize);

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
      'writing-mode:horizontal-tb'
    ].join(';');

    container.appendChild(overlay);
    this.overlays.set(id, {
      id,
      translatedText: text,
      element: overlay,
      imageElement
    });

    return id;
  }

  getOverlayCount(): number {
    return this.overlays.size;
  }
}

export const overlayManager = new TranslationOverlayManager();
