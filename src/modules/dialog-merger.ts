/**
 * 对话合并器 v2
 * 
 * 功能：将 OCR 识别出的分散文字片段按阅读顺序合并成完整句子
 * 
 * 算法思路（漫画气泡特点）：
 * 1. 竖排文字：同一气泡内片段X坐标相近（竖排从上到下）
 * 2. 横排文字：同一气泡内片段Y坐标相近（横排从右到左）
 * 3. 使用 DBSCAN 思想，基于X轴和Y轴的联合判断
 * 4. 优先按X轴分组（漫画气泡列），组内再按Y轴排序合并
 */

export interface OCRTextItem {
  /** 文字内容 */
  text: string;
  /** 包围盒 X 坐标 */
  x: number;
  /** 包围盒 Y 坐标 */
  y: number;
  /** 包围盒宽度 */
  width: number;
  /** 包围盒高度 */
  height: number;
  /** 右边界 */
  right: number;
  /** 下边界 */
  bottom: number;
  /** 置信度 */
  confidence: number;
  /** 是否竖排文字 */
  isVertical: boolean;
  /** 原始多边形顶点 (可选) */
  polygon?: Array<{ x: number; y: number }>;
}

export interface MergedDialog {
  /** 对话唯一标识符（用于调试和映射） */
  id: number;
  /** 合并后的完整句子 */
  text: string;
  /** 所有原始片段 */
  items: OCRTextItem[];
  /** 合并后的统一边界框 */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** 合并后总字数 */
  charCount: number;
  /** 平均字符宽度（像素）- 用于字体大小计算 */
  charWidth: number;
  /** 每个片段的字符数和宽度信息 */
  itemCharWidths: Array<{ charCount: number; width: number; avgWidth: number }>;
  /** 气泡边界（带内边距和裁剪） */
  bubbleBounds?: BubbleBounds;
  /** 翻译后的文本 */
  translatedText?: string;
  /** 翻译是否成功 */
  translationSuccess?: boolean;
  /** 是否竖排文字（通过 OCR 片段的宽高比判断） */
  isVertical?: boolean;
}

/** 翻译后的对话（带完整翻译信息） */
export interface TranslatedDialog extends MergedDialog {
  /** 翻译后的文本 */
  translatedText: string;
  /** 翻译是否成功 */
  translationSuccess: boolean;
  /** 对话 ID（用于与翻译结果映射） */
  id: number;
}

/** 估算译文横排显示所需尺寸 */
export interface EstimatedSize {
  /** 估算宽度 */
  width: number;
  /** 估算高度 */
  height: number;
  /** 是否超出原始气泡范围 */
  isOverflow: boolean;
}

export interface DialogMergerConfig {
  /** X轴容差阈值（像素）- 同一列判定 */
  xThreshold: number;
  /** Y轴容差阈值（像素）- 同一行判定 */
  yThreshold: number;
  /** 是否从右往左阅读（日漫模式） */
  rtlMode: boolean;
  /** 是否竖排模式 */
  verticalMode: boolean;
  /** 气泡内边距（像素）- 为译文留出空间 */
  bubblePadding: number;
  /** 最大合并距离（像素）- 超出则不合并 */
  maxMergeDistance: number;
}

export interface BubbleBounds {
  /** 原始边界框 */
  raw: { x: number; y: number; width: number; height: number };
  /** 带内边距的边界框 */
  padded: { x: number; y: number; width: number; height: number };
  /** 裁剪后的边界框（不超出图片边界） */
  clipped: { x: number; y: number; width: number; height: number };
  /** 图片尺寸（用于边界裁剪） */
  imageBounds: { width: number; height: number };
}

const DEFAULT_CONFIG: DialogMergerConfig = {
  xThreshold: 150,       // 【调大】X轴容差：同一列的气泡X坐标差异（增大以合并更多）
  yThreshold: 50,        // 【调大】Y轴容差：同一行的气泡Y坐标差异（增大以合并更多）
  rtlMode: true,         // 日漫默认从右往左
  verticalMode: true,    // 日漫默认竖排
  bubblePadding: 8,
  maxMergeDistance: 300  // 【调大】最大合并距离：增大以合并更远的片段
};

/**
 * 对话合并器类 v2
 */
export class DialogMerger {
  private config: DialogMergerConfig;

  constructor(config: Partial<DialogMergerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 合并 OCR 结果中的分散文字
   */
  merge(items: OCRTextItem[]): MergedDialog[] {
    if (items.length === 0) return [];

    // 预处理：计算边界
    const processedItems = items.map(item => ({
      ...item,
      right: item.x + item.width,
      bottom: item.y + item.height
    }));

    // 步骤1：按X轴分组（漫画气泡列）
    const xGroups = this.groupByXAxis(processedItems);

    // 步骤2：组内按Y轴排序
    const sortedGroups = xGroups.map(group => 
      [...group].sort((a, b) => a.y - b.y)
    );

    // 步骤3：组内相邻片段检查是否应合并
    const mergedDialogs: MergedDialog[] = [];
    let dialogId = 0;

    for (const group of sortedGroups) {
      if (group.length === 0) continue;

      let currentDialog: MergedDialog | null = null;

      for (const item of group) {
        if (!currentDialog) {
          // 第一个片段，创建新对话
          currentDialog = this.createMergedDialog(item, dialogId++);
        } else {
          // 检查是否应与当前对话合并
          const lastItem = currentDialog.items[currentDialog.items.length - 1];
          const shouldMerge = this.shouldMerge(lastItem, item);

          if (shouldMerge) {
            // 合并到当前对话
            currentDialog = this.mergeItemToDialog(currentDialog, item);
          } else {
            // 保存当前对话，创建新对话
            mergedDialogs.push(currentDialog);
            currentDialog = this.createMergedDialog(item, dialogId++);
          }
        }
      }

      // 保存最后一个对话
      if (currentDialog) {
        mergedDialogs.push(currentDialog);
      }
    }

    console.log(`[DialogMerger] 合并完成: ${items.length} 个片段 → ${mergedDialogs.length} 个对话`);
    console.log(`[DialogMerger] X轴分组: ${xGroups.length} 列`);
    for (let i = 0; i < mergedDialogs.length; i++) {
      const d = mergedDialogs[i];
      const orientation = d.isVertical ? '竖排' : '横排';
      const right = d.boundingBox.x + d.boundingBox.width;
      const bottom = d.boundingBox.y + d.boundingBox.height;
      console.log(`  [Dialog#${i}] "${d.text.slice(0, 30)}${d.text.length > 30 ? '...' : ''}" [${orientation}]`);
      console.log(`    边界框: x=${d.boundingBox.x}-${right}, y=${d.boundingBox.y}-${bottom}, 尺寸: ${d.boundingBox.width}x${d.boundingBox.height}`);
      console.log(`    片段数: ${d.items.length}, 总字数: ${d.charCount}`);
      if (d.items.length > 1) {
        console.log(`    原始片段X范围: [${d.items.map(it => it.x).join(', ')}]`);
      }
    }

    return mergedDialogs;
  }

  /**
   * 按X轴分组（同一列的气泡）
   * 使用基于密度的聚类：如果片段的X轴中心点在阈值范围内，归为同一组
   */
  private groupByXAxis(items: Array<OCRTextItem & { right: number; bottom: number }>): 
    Array<Array<OCRTextItem & { right: number; bottom: number }>> {
    
    const groups: Array<Array<OCRTextItem & { right: number; bottom: number }>> = [];
    const processed = new Set<number>();

    for (let i = 0; i < items.length; i++) {
      if (processed.has(i)) continue;

      const item = items[i];
      const itemXCenter = item.x + item.width / 2;
      
      // 尝试加入现有组或创建新组
      let addedToGroup = false;
      
      for (const group of groups) {
        if (group.length > 0) {
          const groupXCenter = group[0].x + group[0].width / 2;
          const xDiff = Math.abs(itemXCenter - groupXCenter);
          
          // 检查X轴是否在阈值范围内
          if (xDiff <= this.config.xThreshold) {
            group.push(item);
            processed.add(i);
            addedToGroup = true;
            break;
          }
        }
      }

      // 无法加入现有组，创建新组
      if (!addedToGroup) {
        groups.push([item]);
        processed.add(i);
      }
    }

    console.log(`[DialogMerger] X轴分组结果: ${groups.length} 组`);
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const xRange = group.map(item => item.x);
      console.log(`  组${i}: ${group.length}个片段, X范围=[${Math.min(...xRange)}, ${Math.max(...xRange)}]`);
    }

    return groups;
  }

  /**
   * 检查两个片段是否应该合并
   */
  private shouldMerge(
    item1: OCRTextItem & { right: number; bottom: number },
    item2: OCRTextItem & { right: number; bottom: number }
  ): boolean {
    // 计算边界框
    const bbox1 = { x: item1.x, y: item1.y, right: item1.right, bottom: item1.bottom };
    // Y轴距离：当前片段顶部到上一个片段底部的距离
    const yDistance = item2.y - bbox1.bottom;
    
    // X轴距离：两个片段X轴中心的距离
    const xCenter1 = item1.x + item1.width / 2;
    const xCenter2 = item2.x + item2.width / 2;
    const xDistance = Math.abs(xCenter2 - xCenter1);

    // 合并条件：
    // 1. Y轴距离在阈值内（竖排文字从上到下）
    // 2. X轴中心点差异在阈值内（同一列）
    // 3. 总距离在最大合并距离内
    const totalDistance = Math.sqrt(yDistance * yDistance + xDistance * xDistance);
    
    const shouldMerge = (
      yDistance >= 0 && 
      yDistance <= this.config.yThreshold &&
      xDistance <= this.config.xThreshold &&
      totalDistance <= this.config.maxMergeDistance
    );

    if (yDistance > 0) {
      console.log(`[DialogMerger] 合并检查: "${item1.text.slice(0, 10)}" → "${item2.text.slice(0, 10)}"`, {
        yDistance: yDistance.toFixed(1),
        xDistance: xDistance.toFixed(1),
        totalDistance: totalDistance.toFixed(1),
        shouldMerge
      });
    }

    return shouldMerge;
  }

  /**
   * 创建合并对话
   */
  private createMergedDialog(
    item: OCRTextItem & { right: number; bottom: number },
    id: number
  ): MergedDialog {
    const charCount = item.text.length;
    const avgWidth = charCount > 0 ? item.width / charCount : item.width;
    // 通过宽高比判断竖排/横排：height > width 为竖排
    const isVertical = item.height > item.width;

    return {
      id,
      text: item.text,
      items: [{
        text: item.text,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        right: item.right,      // 添加 right 属性
        bottom: item.bottom,    // 添加 bottom 属性
        confidence: item.confidence,
        isVertical: item.isVertical
      }],
      boundingBox: {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height
      },
      charCount,
      charWidth: avgWidth,
      itemCharWidths: [{ charCount, width: item.width, avgWidth }],
      isVertical
    };
  }

  /**
   * 将片段合并到对话
   */
  private mergeItemToDialog(
    dialog: MergedDialog,
    item: OCRTextItem & { right: number; bottom: number }
  ): MergedDialog {
    // 合并文字
    // 竖排从右到左阅读：先读最右边的片段(y最小)，后读左边的片段(y更大)
    // 所以新片段(更大的y)应该 append 到末尾
    const mergedText = dialog.text + item.text;

    // 计算扩展边界框
    // 竖排模式：X取最小值（最左边的列），Y取最小值（顶部）
    // 横排模式：X取最小值（最上边的行），Y取最小值（顶部）
    // 注意：合并后的边界框应该包含所有片段，所以X应该是最左边的，Y是最上面的
    let newX: number, newY: number;
    if (this.config.verticalMode) {
      // 竖排：X取最小（最左边），Y取最小（最上边）
      newX = Math.min(dialog.boundingBox.x, item.x);
      newY = Math.min(dialog.boundingBox.y, item.y);
    } else {
      // 横排：X取最小（最左边），Y取最小（最上边）
      newX = Math.min(dialog.boundingBox.x, item.x);
      newY = Math.min(dialog.boundingBox.y, item.y);
    }

    const maxRight = Math.max(dialog.boundingBox.x + dialog.boundingBox.width, item.right);
    const maxBottom = Math.max(dialog.boundingBox.y + dialog.boundingBox.height, item.bottom);

    const newBoundingBox = {
      x: newX,
      y: newY,
      width: maxRight - newX,
      height: maxBottom - newY
    };

    // 计算合并后的平均字符宽度
    const itemCharCount = item.text.length;
    const itemAvgWidth = itemCharCount > 0 ? item.width / itemCharCount : item.width;
    
    // 合并片段的字符宽度信息
    const newItemCharWidths = [...dialog.itemCharWidths, { 
      charCount: itemCharCount, 
      width: item.width, 
      avgWidth: itemAvgWidth 
    }];

    // 计算整体平均字符宽度（加权平均）
    const totalCharCount = dialog.charCount + itemCharCount;
    const totalWidth = dialog.boundingBox.width + item.width;
    const newCharWidth = totalCharCount > 0 ? totalWidth / totalCharCount : itemAvgWidth;

    // 通过投票决定 isVertical：统计所有片段中竖排的数量
    // 规则：如果 height > width，判定为竖排
    const itemIsVertical = item.height > item.width;
    const allItemsVertical = [...dialog.items, { isVertical: itemIsVertical }];
    const verticalCount = allItemsVertical.filter(i => i.isVertical).length;
    const newIsVertical = verticalCount >= allItemsVertical.length / 2;

    return {
      ...dialog,
      text: mergedText,
      items: [...dialog.items, {
        text: item.text,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        right: item.right,      // 添加 right 属性
        bottom: item.bottom,    // 添加 bottom 属性
        confidence: item.confidence,
        isVertical: item.isVertical
      }],
      boundingBox: newBoundingBox,
      charCount: mergedText.length,
      charWidth: newCharWidth,
      itemCharWidths: newItemCharWidths,
      isVertical: newIsVertical
    };
  }

  /**
   * 计算气泡边界
   */
  calculateBubbleBounds(
    dialog: MergedDialog,
    imageWidth: number,
    imageHeight: number
  ): BubbleBounds {
    const padding = this.config.bubblePadding;
    
    const raw = { ...dialog.boundingBox };
    
    const padded: BubbleBounds['padded'] = {
      x: raw.x - padding,
      y: raw.y - padding,
      width: raw.width + padding * 2,
      height: raw.height + padding * 2
    };
    
    const clipped: BubbleBounds['clipped'] = {
      x: Math.max(0, padded.x),
      y: Math.max(0, padded.y),
      width: Math.min(imageWidth - padded.x, padded.width),
      height: Math.min(imageHeight - padded.y, padded.height)
    };
    
    if (clipped.width < 0) clipped.width = 0;
    if (clipped.height < 0) clipped.height = 0;
    
    return {
      raw,
      padded,
      clipped,
      imageBounds: { width: imageWidth, height: imageHeight }
    };
  }

  /**
   * 批量计算气泡边界
   */
  calculateAllBubbleBounds(
    dialogs: MergedDialog[],
    imageWidth: number,
    imageHeight: number
  ): MergedDialog[] {
    return dialogs.map(dialog => ({
      ...dialog,
      bubbleBounds: this.calculateBubbleBounds(dialog, imageWidth, imageHeight)
    }));
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<DialogMergerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * 便捷函数：从 OCR 结果直接合并
 */
export function mergeDialogs(
  ocrItems: OCRTextItem[],
  config?: Partial<DialogMergerConfig>
): MergedDialog[] {
  const merger = new DialogMerger(config);
  return merger.merge(ocrItems);
}
