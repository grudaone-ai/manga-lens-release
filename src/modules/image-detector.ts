export interface DetectedImage {
  element: HTMLElement;
  src: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  aspectRatio: number;
  isManga: boolean;
}

const EXCLUDED_PATTERNS = [
  /\.gif$/i,
  /doubleclick\.net/i,
  /googlesyndication\.com/i,
  /googleadservices\.com/i,
  /analytics/i,
  /tracking/i,
  /banner/i,
  /advertisement/i,
  /placeholder/i,
  /spacer\.gif/i,
  /transparent\.png/i,
  /icon-/i,
  /social-/i
];

function shouldExcludeImage(src: string, width: number, height: number): boolean {
  if (!src) return true;
  if (width < 100 || height < 100) return true;
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(src));
}

function getElementPosition(element: HTMLElement): DetectedImage['position'] {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height
  };
}

export class ImageDetector {
  detectMangaImages(): DetectedImage[] {
    const detected: DetectedImage[] = [];
    const seen = new Set<string>();

    document.querySelectorAll('img').forEach((img) => {
      const info = this.analyzeImage(img as HTMLImageElement);
      if (!info || seen.has(info.src)) return;

      seen.add(info.src);
      detected.push(info);
    });

    document.querySelectorAll('[style*="background"], [data-src], picture, figure').forEach((element) => {
      const info = this.analyzeElement(element as HTMLElement);
      if (!info || seen.has(info.src)) return;

      seen.add(info.src);
      detected.push(info);
    });

    console.log(`[MangaLens] 检测到 ${detected.length} 张候选图片`);
    return detected;
  }

  private analyzeImage(img: HTMLImageElement): DetectedImage | null {
    const rect = img.getBoundingClientRect();
    const src = img.currentSrc || img.src || img.dataset.src || img.dataset.lazySrc || '';

    if (rect.width <= 0 || rect.height <= 0) return null;
    if (shouldExcludeImage(src, rect.width, rect.height)) return null;

    return {
      element: img,
      src,
      position: getElementPosition(img),
      aspectRatio: rect.height / rect.width,
      isManga: true
    };
  }

  private analyzeElement(element: HTMLElement): DetectedImage | null {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    let src = '';
    if (element instanceof HTMLImageElement) {
      src = element.currentSrc || element.src;
    } else if (element.dataset.src) {
      src = element.dataset.src;
    } else if (element.style.backgroundImage) {
      const match = element.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (match) src = match[1];
    }

    if (!src) {
      const img = element.querySelector('img');
      src = img?.currentSrc || img?.src || img?.dataset.src || '';
    }

    if (!src) {
      const source = element.querySelector('source');
      src = source?.srcset?.split(' ')[0] || '';
    }

    if (shouldExcludeImage(src, rect.width, rect.height)) return null;

    return {
      element,
      src,
      position: getElementPosition(element),
      aspectRatio: rect.height / rect.width,
      isManga: true
    };
  }

  async selectImage(): Promise<DetectedImage | null> {
    return new Promise((resolve) => {
      const instruction = document.createElement('div');
      instruction.id = 'manga-lens-selector-instruction';
      instruction.textContent = '点击要翻译的漫画图片，按 ESC 取消';
      instruction.style.cssText = [
        'position: fixed',
        'top: 20px',
        'left: 50%',
        'transform: translateX(-50%)',
        'background: #2563eb',
        'color: white',
        'padding: 12px 18px',
        'border-radius: 8px',
        'font-size: 14px',
        'font-family: Microsoft YaHei, sans-serif',
        'z-index: 2147483647',
        'box-shadow: 0 4px 16px rgba(37, 99, 235, 0.35)'
      ].join(';');

      const cleanup = () => {
        instruction.remove();
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKeyDown, true);
      };

      const onClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;

        const img = target instanceof HTMLImageElement ? target : target.closest('img');
        if (!img) return;

        event.preventDefault();
        event.stopPropagation();
        cleanup();
        resolve(this.analyzeImage(img));
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        cleanup();
        resolve(null);
      };

      document.body.appendChild(instruction);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKeyDown, true);
    });
  }

  observeNewImages(callback: (images: DetectedImage[]) => void): () => void {
    const observer = new MutationObserver((mutations) => {
      const images: DetectedImage[] = [];

      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          if (node instanceof HTMLImageElement) {
            const info = this.analyzeImage(node);
            if (info) images.push(info);
            return;
          }

          node.querySelectorAll('img').forEach((img) => {
            const info = this.analyzeImage(img as HTMLImageElement);
            if (info) images.push(info);
          });
        });
      }

      if (images.length > 0) callback(images);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }
}

export const imageDetector = new ImageDetector();
