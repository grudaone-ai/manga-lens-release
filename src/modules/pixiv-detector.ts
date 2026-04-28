export type PixivPageMode = 'detail' | 'reader';

export interface PixivMangaPage {
  artworkId: string;
  pageIndex: number;
  dataPage?: number;
  originalUrl?: string;
  previewUrl: string;
  img: HTMLImageElement;
  anchor?: HTMLAnchorElement;
  cacheKey: string;
}

const PXIMG_HOST_RE = /(?:^|\.)pximg\.net$/i;

export function getPixivArtworkId(): string | null {
  const match = location.pathname.match(/\/artworks\/(\d+)/);
  return match?.[1] || null;
}

function normalizeUrl(value?: string | null): string {
  if (!value) return '';
  try {
    return new URL(value, location.href).href;
  } catch {
    return value;
  }
}

function isPximgUrl(url: string): boolean {
  try {
    return PXIMG_HOST_RE.test(new URL(url).hostname);
  } catch {
    return /pximg\.net/i.test(url);
  }
}

function parsePageIndex(url: string, artworkId: string): number | null {
  const match = url.match(new RegExp(`${artworkId}_p(\\d+)`, 'i'));
  if (!match) return null;
  const page = Number.parseInt(match[1], 10);
  return Number.isFinite(page) ? page : null;
}

function isCurrentArtworkUrl(url: string, artworkId: string): boolean {
  if (!url || !isPximgUrl(url)) return false;
  if (!url.includes(`${artworkId}_p`)) return false;
  if (url.includes('/user-profile/')) return false;
  if (url.includes('_square1200')) return false;
  if (url.includes('/custom-thumb/')) return false;
  return true;
}

function getImageUrl(img: HTMLImageElement): string {
  return normalizeUrl(img.currentSrc || img.src || img.dataset.src || img.dataset.lazySrc || '');
}

function createPageFromAnchor(anchor: HTMLAnchorElement, artworkId: string): PixivMangaPage | null {
  const img = anchor.querySelector('img');
  if (!(img instanceof HTMLImageElement)) return null;

  const originalUrl = normalizeUrl(anchor.href);
  const previewUrl = getImageUrl(img);
  const joined = `${originalUrl}\n${previewUrl}`;
  const pageIndex = parsePageIndex(joined, artworkId);

  if (pageIndex === null) return null;
  if (!isCurrentArtworkUrl(originalUrl, artworkId) && !isCurrentArtworkUrl(previewUrl, artworkId)) return null;

  const dataPage = Number.parseInt(anchor.dataset.page || '', 10);

  return {
    artworkId,
    pageIndex,
    dataPage: Number.isFinite(dataPage) ? dataPage : undefined,
    originalUrl: isCurrentArtworkUrl(originalUrl, artworkId) ? originalUrl : undefined,
    previewUrl,
    img,
    anchor,
    cacheKey: `pixiv:${artworkId}:p${pageIndex}:${previewUrl || originalUrl}`
  };
}

function createPageFromImage(img: HTMLImageElement, artworkId: string): PixivMangaPage | null {
  const previewUrl = getImageUrl(img);
  const anchor = img.closest('a') as HTMLAnchorElement | null;
  const originalUrl = normalizeUrl(anchor?.href || '');
  const joined = `${originalUrl}\n${previewUrl}`;
  const pageIndex = parsePageIndex(joined, artworkId);

  if (pageIndex === null) return null;
  if (!isCurrentArtworkUrl(originalUrl, artworkId) && !isCurrentArtworkUrl(previewUrl, artworkId)) return null;

  const rect = img.getBoundingClientRect();
  if (rect.width < 180 || rect.height < 180) return null;

  return {
    artworkId,
    pageIndex,
    dataPage: anchor?.dataset.page ? Number.parseInt(anchor.dataset.page, 10) : undefined,
    originalUrl: isCurrentArtworkUrl(originalUrl, artworkId) ? originalUrl : undefined,
    previewUrl,
    img,
    anchor: anchor || undefined,
    cacheKey: `pixiv:${artworkId}:p${pageIndex}:${previewUrl || originalUrl}`
  };
}

function uniqueAndSort(pages: PixivMangaPage[]): PixivMangaPage[] {
  const map = new Map<number, PixivMangaPage>();

  for (const page of pages) {
    const current = map.get(page.pageIndex);
    if (!current) {
      map.set(page.pageIndex, page);
      continue;
    }

    const currentArea = current.img.getBoundingClientRect().width * current.img.getBoundingClientRect().height;
    const nextArea = page.img.getBoundingClientRect().width * page.img.getBoundingClientRect().height;
    if (nextArea > currentArea) map.set(page.pageIndex, page);
  }

  return [...map.values()].sort((a, b) => a.pageIndex - b.pageIndex);
}

export function detectPixivMode(): PixivPageMode {
  const hasReaderAnchors = document.querySelectorAll('a[data-page][href*="i.pximg.net/img-original"]').length > 0;
  if (location.hash || hasReaderAnchors) return 'reader';
  return 'detail';
}

export function getReaderPages(artworkId = getPixivArtworkId()): PixivMangaPage[] {
  if (!artworkId) return [];

  const pages: PixivMangaPage[] = [];
  document
    .querySelectorAll('a[data-page][href*="i.pximg.net/img-original"], a.gtm-expand-full-size-illust[data-page]')
    .forEach((node) => {
      const page = createPageFromAnchor(node as HTMLAnchorElement, artworkId);
      if (page) pages.push(page);
    });

  return uniqueAndSort(pages);
}

export function getDetailPages(artworkId = getPixivArtworkId()): PixivMangaPage[] {
  if (!artworkId) return [];

  const pages: PixivMangaPage[] = [];
  document.querySelectorAll('img').forEach((node) => {
    const page = createPageFromImage(node as HTMLImageElement, artworkId);
    if (page) pages.push(page);
  });

  const sorted = uniqueAndSort(pages);
  const first = sorted.find((page) => page.pageIndex === 0) || sorted[0];
  return first ? [first] : [];
}

export function getPixivPages(): PixivMangaPage[] {
  const artworkId = getPixivArtworkId();
  if (!artworkId) return [];

  const readerPages = getReaderPages(artworkId);
  if (readerPages.length > 0) return readerPages;
  return getDetailPages(artworkId);
}

export function getCurrentVisiblePixivPage(pages = getPixivPages()): PixivMangaPage | null {
  if (pages.length === 0) return null;

  const viewportCenterY = window.innerHeight / 2;
  const ranked = pages
    .map((page) => {
      const rect = page.img.getBoundingClientRect();
      const visibleWidth = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
      const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      const visibleArea = Math.max(0, visibleWidth) * Math.max(0, visibleHeight);
      const totalArea = Math.max(1, rect.width * rect.height);
      const visibleRatio = visibleArea / totalArea;
      const centerDistance = Math.abs((rect.top + rect.bottom) / 2 - viewportCenterY);

      return { page, visibleRatio, centerDistance, area: totalArea };
    })
    .filter((entry) => entry.visibleRatio > 0.08 || entry.area > 300_000)
    .sort((a, b) => b.visibleRatio - a.visibleRatio || a.centerDistance - b.centerDistance);

  return ranked[0]?.page || pages[0];
}
