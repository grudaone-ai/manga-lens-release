/**
 * 翻译覆盖层模块
 * 将翻译后的文字渲染到漫画图片上
 * 
 * 支持：
 * 1. 原文竖排 → 译文横排渲染
 * 2. 基于 BubbleBounds 的精确定位
 * 3. 智能换行适配气泡尺寸
 */

import type { BoundingBox } from './ocr-engine';
import type { TranslationResult } from './translator';
import type { MergedDialog } from './dialog-merger';

export interface TranslationOverlay {
  id: string;
  originalBox: BoundingBox;
  translatedText: string;
  element: HTMLElement;
}

export interface RenderConfig {
  /** 译文是否横排（原文通常是竖排） */
  horizontalText: boolean;
  /** 字体大小 */
  fontSize?: number;
  /** 文字颜色 */
  color?: string;
  /** 背景色 */
  background?: string;
  /** 背景透明度 */
  backgroundOpacity?: number;
  /** 内边距 */
  padding?: number;
  /** 最大行数（超过则截断） */
  maxLines?: number;
}

const DEFAULT_RENDER_CONFIG: Required<RenderConfig> = {
  horizontalText: false,  // 改为竖排（与日语原文一致）
  fontSize: 14,
  color: '#000000',
  background: '#FFFFFF',
  backgroundOpacity: 0.88,
  padding: 4,
  maxLines: 10
};

export class TranslationOverlayManager {
  private container: HTMLElement | null = null;
  private overlays: Map<string, TranslationOverlay> = new Map();
  private containerId = 'manga-lens-overlay-container';
  private overlayClass = 'manga-lens-text-overlay';
  
  // 图片边界追踪（以图片元素为单位）
  private imageBoundsMap: Map<HTMLImageElement, { width: number; height: number }> = new Map();

  /**
   * 创建或获取覆盖层容器
   */
  createContainer(parent: HTMLElement): HTMLElement {
    // 如果已存在，先移除
    this.removeContainer();

    // 创建新容器
    this.container = document.createElement('div');
    this.container.id = this.containerId;
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999;
      overflow: hidden;
    `;

    // 确保父元素有相对定位
    const computedStyle = window.getComputedStyle(parent);
    if (computedStyle.position === 'static') {
      parent.style.position = 'relative';
    }

    parent.appendChild(this.container);
    return this.container;
  }

  /**
   * 渲染翻译文字
   */
  renderTranslation(
    imageElement: HTMLImageElement,
    box: BoundingBox,
    translatedText: string
  ): string {
    if (!this.container) {
      this.createContainer(imageElement.parentElement!);
    }

    const id = `ml-overlay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 计算相对于图片的百分比位置
    const boxRect = {
      x: (box.x / imageElement.naturalWidth) * 100,
      y: (box.y / imageElement.naturalHeight) * 100,
      width: (box.width / imageElement.naturalWidth) * 100,
      height: (box.height / imageElement.naturalHeight) * 100
    };

    // 创建覆盖元素
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = this.overlayClass;
    overlay.textContent = translatedText;

    // 设置样式
    const fontSize = Math.max(10, Math.min(box.height * 0.7, 18));
    
    overlay.style.cssText = `
      position: absolute;
      left: ${boxRect.x}%;
      top: ${boxRect.y}%;
      width: ${boxRect.width}%;
      min-height: ${boxRect.height}%;
      ${box.isVertical ? 'writing-mode: vertical-rl;' : 'writing-mode: horizontal-tb;'}
      font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.3;
      color: #000000;
      background: rgba(255, 255, 255, 0.88);
      padding: 2px 4px;
      margin: 0;
      text-shadow: 0 0 2px rgba(255, 255, 255, 0.9);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      border-radius: 2px;
      word-break: break-all;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translateZ(0);
      will-change: contents;
    `;

    this.container!.appendChild(overlay);

    // 记录覆盖层
    this.overlays.set(id, {
      id,
      originalBox: box,
      translatedText,
      element: overlay
    });

    return id;
  }

  /**
   * 批量渲染翻译
   */
  renderBatch(
    imageElement: HTMLImageElement,
    boxes: BoundingBox[],
    translations: TranslationResult[]
  ): string[] {
    const ids: string[] = [];

    translations.forEach((translation, index) => {
      const box = boxes[index];
      if (box && translation) {
        const id = this.renderTranslation(
          imageElement,
          box,
          translation.translatedText
        );
        ids.push(id);
      }
    });

    return ids;
  }

  /**
   * 移除指定覆盖层
   */
  removeOverlay(id: string): void {
    const overlay = this.overlays.get(id);
    if (overlay) {
      overlay.element.remove();
      this.overlays.delete(id);
    }
  }

  /**
   * 移除所有覆盖层
   */
  removeAllOverlays(): void {
    this.overlays.forEach((overlay) => {
      overlay.element.remove();
    });
    this.overlays.clear();
    this.removeContainer();
  }

  /**
   * 移除容器
   */
  private removeContainer(): void {
    const existing = document.getElementById(this.containerId);
    if (existing) {
      existing.remove();
    }
    this.container = null;
  }

  /**
   * 获取当前覆盖层数量
   */
  getOverlayCount(): number {
    return this.overlays.size;
  }

  /**
   * 检查是否有覆盖层
   */
  hasOverlays(): boolean {
    return this.overlays.size > 0;
  }

  /**
   * 渲染翻译后的对话（新版）
   * 
   * 使用 MergedDialog 的 bubbleBounds 进行精确定位，
   * 将横排译文渲染到原文位置。
   */
  renderMergedDialog(
    imageElement: HTMLImageElement,
    dialog: MergedDialog,
    config?: Partial<RenderConfig>
  ): string {
    // 如果 dialog 指定了 isVertical，覆盖 config 中的 horizontalText
    // isVertical 为 true 表示竖排，horizontalText 应为 false
    // isVertical 为 false 表示横排，horizontalText 应为 true
    const isVertical = dialog.isVertical !== undefined ? dialog.isVertical : true;
    const cfg: Required<RenderConfig> = {
      ...DEFAULT_RENDER_CONFIG,
      ...config,
      horizontalText: !isVertical  // isVertical=true → horizontalText=false
    };
    
    // 确保容器存在
    if (!this.container) {
      this.createContainer(imageElement.parentElement!);
    }

    const id = `ml-overlay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 获取气泡边界
    // 优先使用 transformedBounds（旋转变换后的边界），否则使用 raw（原始边界）
    // @ts-ignore - transformedBounds 是我们动态添加的属性
    const transformedBounds = dialog.transformedBounds;
    const bounds = transformedBounds || (dialog.bubbleBounds?.raw || dialog.boundingBox);
    
    // 获取图片的自然尺寸（OCR 识别时的尺寸）
    const imageWidth = imageElement.naturalWidth;
    const imageHeight = imageElement.naturalHeight;
    
    // 【修复】限制边界不超过图片范围，防止 OCR 坐标超出图片边界
    // 关键：当右边界超出图片时，宽度应该是 (图片右边界 - x)
    const boundsRight = bounds.x + bounds.width;
    const boundsBottom = bounds.y + bounds.height;
    
    let safeX = bounds.x;
    let safeY = bounds.y;
    let safeWidth = bounds.width;
    let safeHeight = bounds.height;
    
    // 如果右边界超出图片，调整宽度（保持左边界不变）
    if (boundsRight > imageWidth) {
      safeWidth = Math.max(20, imageWidth - safeX);
    }
    // 如果下边界超出图片，调整高度
    if (boundsBottom > imageHeight) {
      safeHeight = Math.max(20, imageHeight - safeY);
    }
    // 确保不小于最小尺寸
    safeWidth = Math.max(20, safeWidth);
    safeHeight = Math.max(20, safeHeight);
    
    const safeBounds = {
      x: safeX,
      y: safeY,
      width: safeWidth,
      height: safeHeight
    };
    
    // 获取图片在页面中显示的尺寸（用于计算偏移）
    const displayedWidth = imageElement.clientWidth || imageElement.offsetWidth;
    const displayedHeight = imageElement.clientHeight || imageElement.offsetHeight;
    
    // 检查图片尺寸是否有效
    if (displayedWidth === 0 || displayedHeight === 0) {
      console.error(`[Overlay#${id.slice(-6)}] ❌ 图片显示尺寸为0，naturalWidth=${imageWidth}, naturalHeight=${imageHeight}, clientWidth=${displayedWidth}, offsetWidth=${imageElement.offsetWidth}`);
    }
    
    // 计算图片相对于容器的偏移量
    const imgRect = imageElement.getBoundingClientRect();
    const containerRect = this.container!.getBoundingClientRect();
    const offsetX = imgRect.left - containerRect.left;
    const offsetY = imgRect.top - containerRect.top;
    
    // 计算缩放比例
    const scaleX = displayedWidth / imageWidth;
    const scaleY = displayedHeight / imageHeight;
    
    // 获取译文（翻译失败时使用原文）
    const translatedText = dialog.translatedText || dialog.text;
    
    // 根据文字内容和方向动态计算覆盖层尺寸
    // 竖排：宽度基于字符数和平均字符宽度，高度基于原始气泡
    // 横排：高度基于行数和行高，宽度基于原始气泡
    const charCount = translatedText.length;
    const charWidth = dialog.charWidth || 14;
    let overlayWidth: number;
    let overlayHeight: number;
    
    if (isVertical) {
      // 竖排：覆盖层宽度根据译文长度计算
      // 估算每个字符竖排时的宽度（包含间距）
      const estimatedCharWidth = charWidth * 1.2;
      // 【修复】估算竖排需要的列数
      // 考虑中文竖排每列通常 1-2 个字符，根据字数动态计算
      // 10字以内1列，11-20字2列，21-30字3列，以此类推
      const estimatedCols = Math.max(1, Math.ceil(charCount / 8));
      overlayWidth = estimatedCols * estimatedCharWidth;
      overlayHeight = safeBounds.height; // 高度跟随原始气泡
      console.log(`[Overlay#${id.slice(-6)}] 竖排尺寸计算: ${charCount}字, charWidth=${charWidth.toFixed(1)}, cols=${estimatedCols}, 宽度=${overlayWidth.toFixed(1)}px`);
    } else {
      // 横排：覆盖层高度根据行数计算
      const lineHeight = charWidth * 1.4;
      const estimatedLines = Math.ceil(charCount / 8); // 每行约8个字
      overlayHeight = estimatedLines * lineHeight;
      overlayWidth = safeBounds.width; // 宽度跟随原始气泡
      console.log(`[Overlay#${id.slice(-6)}] 横排尺寸计算: ${charCount}字, charWidth=${charWidth.toFixed(1)}, lines=${estimatedLines}, 高度=${overlayHeight.toFixed(1)}px`);
    }
    
    // 限制最小/最大尺寸
    overlayWidth = Math.max(20, Math.min(overlayWidth, displayedWidth * 0.8));
    overlayHeight = Math.max(20, Math.min(overlayHeight, displayedHeight * 0.5));
    
    // 计算像素坐标（基于安全边界和显示尺寸的比例）
    const pixelLeft = safeBounds.x * scaleX;
    const pixelTop = safeBounds.y * scaleY;
    const pixelWidth = overlayWidth;  // 使用动态计算的宽度
    const pixelHeight = overlayHeight;  // 使用动态计算的高度
    
    // 计算相对于容器的百分比位置
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // 检查容器尺寸是否有效
    if (containerWidth === 0 || containerHeight === 0) {
      console.error(`[Overlay#${id.slice(-6)}] ❌ 容器尺寸为0，containerWidth=${containerWidth}, containerHeight=${containerHeight}`);
    }
    
    // 防止除以0
    const safeContainerWidth = containerWidth || 1;
    const safeContainerHeight = containerHeight || 1;
    
    let left = ((offsetX + pixelLeft) / safeContainerWidth) * 100;
    let top = ((offsetY + pixelTop) / safeContainerHeight) * 100;
    let width = (pixelWidth / safeContainerWidth) * 100;
    let height = (pixelHeight / safeContainerHeight) * 100;
    
    // 限制百分比在 0-100 范围内（防止溢出到可见区域外）
    // 但允许少量溢出（-5% 到 105%），因为某些情况下需要稍微超出边界
    left = Math.max(-10, Math.min(110, left));
    top = Math.max(-10, Math.min(110, top));
    width = Math.max(1, Math.min(100, width));
    height = Math.max(1, Math.min(100, height));
    
    // 确保位置不会完全超出图片范围
    if (left > 90 || top > 90 || left < -5 || top < -5) {
      console.warn(`[Overlay#${id.slice(-6)}] ⚠️ 覆盖层位置异常偏出: left=${left.toFixed(2)}%, top=${top.toFixed(2)}%`);
    }
    
    // 调试日志 - 使用分开的 console.log 输出完整信息，避免被截断
    console.log(`[Overlay#${id.slice(-6)}] 📍 渲染信息 [dialogId=${dialog.id}]:`);
    console.log(`  原文: "${dialog.text}", 译文: "${translatedText}"`);
    console.log(`  方向: ${isVertical ? '竖排' : '横排'}, horizontalText=${cfg.horizontalText}`);
    console.log(`  图片尺寸: natural=${imageWidth}x${imageHeight}, displayed=${displayedWidth}x${displayedHeight}`);
    console.log(`  缩放: scaleX=${scaleX.toFixed(4)}, scaleY=${scaleY.toFixed(4)}`);
    console.log(`  渲染边界: (${safeBounds.x}, ${safeBounds.y}) ${safeBounds.width}x${safeBounds.height}`);
    console.log(`  动态尺寸: ${overlayWidth.toFixed(1)}x${overlayHeight.toFixed(1)}px`);
    console.log(`  百分比位置: left=${left.toFixed(2)}%, top=${top.toFixed(2)}%, w=${width.toFixed(2)}%, h=${height.toFixed(2)}%`);
    console.log(`  图片偏移: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
    console.log(`  容器尺寸: ${containerRect.width.toFixed(1)}x${containerRect.height.toFixed(1)}`);
    console.log(`  字符: ${dialog.charCount}字, charWidth=${dialog.charWidth?.toFixed(1)}`);
    
    // 警告：横排的小片段可能渲染位置不明显
    if (!isVertical && overlayWidth < 50) {
      console.warn(`[Overlay#${id.slice(-6)}] ⚠️ 横排覆盖层宽度仅 ${overlayWidth.toFixed(1)}px，可能难以看到！`);
    }
    if (!isVertical && bounds.width < 30) {
      console.warn(`[Overlay#${id.slice(-6)}] ⚠️ 原始气泡宽度仅 ${bounds.width}px，横排覆盖层可能很窄！`);
    }

    // 创建覆盖元素
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = this.overlayClass;
    overlay.textContent = translatedText;

    // 计算字体大小（基于原文平均字符宽度和翻译后字符数）
    const fontSize = this.calculateFontSizeForDialog(dialog, translatedText, safeBounds.width, cfg);
    
    // 构建样式
    const bgWithOpacity = this.hexToRgba(cfg.background, cfg.backgroundOpacity);
    
    overlay.style.cssText = `
      position: absolute;
      left: ${left}%;
      top: ${top}%;
      width: ${width}%;
      min-height: ${height}%;
      font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.4;
      color: ${cfg.color};
      background: ${bgWithOpacity};
      padding: ${cfg.padding}px;
      margin: 0;
      text-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
      border-radius: 3px;
      word-break: break-all;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translateZ(0);
      will-change: contents;
      z-index: 1;
      writing-mode: ${cfg.horizontalText ? 'horizontal-tb' : 'vertical-rl'};
      ${cfg.horizontalText ? 'max-height: ' + height + '%;' : ''}
    `;

    // 标记翻译失败
    if (dialog.translationSuccess === false) {
      overlay.style.border = '1px dashed #ff6666';
      overlay.title = '翻译失败，使用原文';
    }

    this.container!.appendChild(overlay);

    // 记录覆盖层
    this.overlays.set(id, {
      id,
      originalBox: {
        ...dialog.boundingBox,
        text: dialog.text,
        confidence: 1,
        isVertical: dialog.isVertical || false
      },
      translatedText,
      element: overlay
    });

    return id;
  }

  /**
   * 批量渲染翻译后的对话
   */
  renderMergedDialogs(
    imageElement: HTMLImageElement,
    dialogs: MergedDialog[],
    config?: Partial<RenderConfig>
  ): string[] {
    // 记录图片尺寸
    this.imageBoundsMap.set(imageElement, {
      width: imageElement.naturalWidth,
      height: imageElement.naturalHeight
    });

    const ids: string[] = [];
    let skippedCount = 0;

    for (let i = 0; i < dialogs.length; i++) {
      const dialog = dialogs[i];
      if (dialog.translatedText || dialog.text) {
        const id = this.renderMergedDialog(imageElement, dialog, config);
        ids.push(id);
      } else {
        skippedCount++;
        console.warn(`[Overlay] 跳过渲染: [${dialog.id}] 无翻译文本, 原文: "${dialog.text.slice(0, 20)}"`);
      }
    }

    console.log(`[Overlay] ✅ 渲染完成: ${ids.length} 个覆盖层, 跳过 ${skippedCount} 个 (无翻译文本)`);
    
    // 输出所有覆盖层信息，方便定位
    if (ids.length > 0) {
      console.log(`[Overlay] 📍 所有覆盖层元素 ID:`, ids.map(id => `#${id}`));
    }

    return ids;
  }

  /**
   * 重新渲染所有覆盖层（已弃用旋转功能）
   */
  rerenderOverlays(_imageElement: HTMLImageElement): void {
    console.log('[Overlay] rerenderOverlays 已弃用，旋转功能已移除');
  }

  /**
   * 移除图片的所有覆盖层
   */
  removeOverlaysForImage(_imageElement: HTMLImageElement): void {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.remove();
    }
    this.container = null;
    this.overlays.clear();
  }

  /**
   * 计算字体大小
   */
  private calculateFontSize(
    boxWidth: number,
    config: Required<RenderConfig>
  ): number {
    // 基于宽度计算字体大小
    const estimatedCharWidth = config.fontSize;
    const charsPerLine = Math.floor(boxWidth / estimatedCharWidth);
    
    if (charsPerLine <= 0) {
      return config.fontSize;
    }
    
    // 确保字体不会太大
    return Math.min(config.fontSize, Math.max(10, boxWidth / charsPerLine * 0.8));
  }

  /**
   * 基于对话信息计算字体大小
   * 
   * 算法：
   * 1. 根据原文的平均字符宽度（charWidth）计算每个字符应占的像素
   * 2. 考虑翻译后字符数与原文的差异
   * 3. 使用 itemCharWidths 的加权平均作为基准
   * 4. 确保字体大小在合理范围内
   */
  private calculateFontSizeForDialog(
    dialog: MergedDialog,
    translatedText: string,
    boxWidth: number,
    config: Required<RenderConfig>
  ): number {
    // 如果没有 charWidth 信息，使用传统方法
    if (!dialog.charWidth || dialog.charWidth <= 0) {
      return this.calculateFontSize(boxWidth, config);
    }

    const translatedCharCount = translatedText.length;
    const ocrCharCount = dialog.charCount;

    // 使用 itemCharWidths 的加权平均计算基准字符宽度
    let weightedCharWidth = dialog.charWidth;
    if (dialog.itemCharWidths && dialog.itemCharWidths.length > 0) {
      const totalChars = dialog.itemCharWidths.reduce((sum, i) => sum + i.charCount, 0);
      const weightedSum = dialog.itemCharWidths.reduce((sum, i) => sum + i.avgWidth * i.charCount, 0);
      if (totalChars > 0) {
        weightedCharWidth = weightedSum / totalChars;
      }
    }

    // 计算目标字体大小
    // 字体大小约为字符宽度的 0.7-0.9 倍（考虑字间距）
    const baseFontSize = weightedCharWidth * 0.8;

    // 考虑翻译后字符数的影响
    // 如果翻译后字符更多，需要适当缩小
    if (translatedCharCount > ocrCharCount && ocrCharCount > 0) {
      const scaleFactor = Math.sqrt(ocrCharCount / translatedCharCount);
      const adjustedFontSize = baseFontSize * scaleFactor;
      
      // 限制范围：最小8px，最大原配置值
      const finalFontSize = Math.min(config.fontSize, Math.max(8, adjustedFontSize));
      
      console.log(`[Overlay] 字体计算: charWidth=${weightedCharWidth.toFixed(1)}, 原文${ocrCharCount}字→译文${translatedCharCount}字, scale=${scaleFactor.toFixed(2)}, 最终=${finalFontSize.toFixed(1)}px`);
      return finalFontSize;
    }

    // 翻译后字符数不变或减少，保持基准大小
    const finalFontSize = Math.min(config.fontSize, Math.max(10, baseFontSize));
    
    console.log(`[Overlay] 字体计算: charWidth=${weightedCharWidth.toFixed(1)}, 原文${ocrCharCount}字→译文${translatedCharCount}字, 最终=${finalFontSize.toFixed(1)}px`);
    return finalFontSize;
  }

  /**
   * 将 hex 颜色转换为 rgba
   */
  private hexToRgba(hex: string, alpha: number): string {
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
      return hex;
    }
    
    // 移除 # 号
    hex = hex.replace('#', '');
    
    // 解析 RGB
    let r: number, g: number, b: number;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    } else {
      return `rgba(255, 255, 255, ${alpha})`;
    }
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * 更新覆盖层样式
   */
  updateStyle(style: Partial<OverlayStyle>): void {
    const styleElement = document.getElementById('manga-lens-styles') || this.createStyleElement();
    
    const css = `
      .manga-lens-text-overlay {
        ${style.background ? `background: ${style.background};` : ''}
        ${style.color ? `color: ${style.color};` : ''}
        ${style.fontSize ? `font-size: ${style.fontSize}px;` : ''}
        ${style.opacity !== undefined ? `opacity: ${style.opacity};` : ''}
      }
    `;
    
    styleElement.textContent = css;
  }

  /**
   * 创建样式元素
   */
  private createStyleElement(): HTMLElement {
    const style = document.createElement('style');
    style.id = 'manga-lens-styles';
    style.textContent = '';
    document.head.appendChild(style);
    return style;
  }
}

export interface OverlayStyle {
  background?: string;
  color?: string;
  fontSize?: number;
  opacity?: number;
}

// 导出单例
export const overlayManager = new TranslationOverlayManager();
