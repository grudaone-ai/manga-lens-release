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
  /\.gif(?:\?|#|$)/i,
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
  /social-/i,
  /avatar/i,
  /profile/i
];

const PIXIV_IMAGE_HOST = /(?:^|\.)pximg\.net$/i;

function isPixivPage(): boolean {
  return /(?:^|\.)pixiv\.net$/i.test(location.hostname);
}

function normalizeImageUrl(src: string): string {
  if (!src) return '';
  try {
    return new URL(src, location.href).href;
  } catch {
    return src;
  }
}

function getLargestSrcFromSrcset(srcset?: string): string {
  if (!srcset) return '';

  const candidates = srcset
    .split(',')
    .map((entry) => entry.trim())
    .map((entry) => {
      const [url, descriptor] = entry.split(/\s+/);
      const weight = descriptor?.endsWith('w')
        ? Number.parseInt(descriptor, 10)
        : descriptor?.endsWith('x')
          ? Number.parseFloat(descriptor) * 1000
          : 0;
      return { url, weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((entry) => !!entry.url)
    .sort((a, b) => b.weight - a.weight);

  return candidates[0]?.url || '';
}

function shouldExcludeImage(src: string, width: number, height: number): boolean {
  if (!src) return true;

  const normalized = normalizeImageUrl(src);
  const isPixivImage = (() => {
    try {
      return PIXIV_IMAGE_HOST.test(new URL(normalized).hostname);
    } catch {
      return /pximg\.net/i.test(normalized);
    }
  })();

  if (isPixivPage() && isPixivImage) {
    return width < 180 || height < 180;
  }

  if (width < 100 || height < 100) return true;
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized));
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

function getImageSrc(img: HTMLImageElement): string {
  const source = img.closest('picture')?.querySelector('source');
  return normalizeImageUrl(
    img.currentSrc ||
    getLargestSrcFromSrcset(img.srcset) ||
    img.src ||
    img.dataset.src ||
    img.dataset.lazySrc ||
    img.dataset.original ||
    getLargestSrcFromSrcset(source?.srcset) ||
    ''
  );
}

export class ImageDetector {
  detectMangaImages(): DetectedImage[] {
    const detected: DetectedImage[] = [];
    const seen = new Set<string>();

    const push = (info: DetectedImage | null) => {
      if (!info || seen.has(info.src)) return;
      seen.add(info.src);
      detected.push(info);
    };

    document.querySelectorAll('img').forEach((img) => push(this.analyzeImage(img as HTMLImageElement)));
    document
      .querySelectorAll('[style*="background"], [data-src], [data-lazy-src], [data-original], picture, figure')
      .forEach((element) => push(this.analyzeElement(element as HTMLElement)));

    console.log(`[MangaLens] 检测到 ${detected.length} 张候选图片`);
    return detected;
  }

  private analyzeImage(img: HTMLImageElement): DetectedImage | null {
    const rect = img.getBoundingClientRect();
    const width = rect.width || img.naturalWidth || img.width;
    const height = rect.height || img.naturalHeight || img.height;
    const src = getImageSrc(img);

    if (width <= 0 || height <= 0) return null;
    if (shouldExcludeImage(src, width, height)) return null;

    return {
      element: img,
      src,
      position: getElementPosition(img),
      aspectRatio: height / width,
      isManga: true
    };
  }

  private analyzeElement(element: HTMLElement): DetectedImage | null {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    let src = '';
    if (element instanceof HTMLImageElement) {
      src = getImageSrc(element);
    } else if (element.dataset.src || element.dataset.lazySrc || element.dataset.original) {
      src = normalizeImageUrl(element.dataset.src || element.dataset.lazySrc || element.dataset.original || '');
    } else if (element.style.backgroundImage) {
      const match = element.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (match) src = normalizeImageUrl(match[1]);
    }

    if (!src) {
      const img = element.querySelector('img');
      if (img) src = getImageSrc(img as HTMLImageElement);
    }

    if (!src) {
      const source = element.querySelector('source');
      src = normalizeImageUrl(getLargestSrcFromSrcset(source?.srcset));
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
    let debounceTimer: number | undefined;

    const flush = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        const images = this.detectMangaImages();
        if (images.length > 0) callback(images);
      }, 350);
    };

    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }

        if (
          mutation.type === 'attributes' &&
          mutation.target instanceof HTMLElement &&
          ['src', 'srcset', 'style', 'data-src', 'data-lazy-src', 'data-original'].includes(mutation.attributeName || '')
        ) {
          shouldScan = true;
          break;
        }
      }

      if (shouldScan) flush();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'style', 'data-src', 'data-lazy-src', 'data-original']
    });

    return () => {
      window.clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }
}

export const imageDetector = new ImageDetector();
