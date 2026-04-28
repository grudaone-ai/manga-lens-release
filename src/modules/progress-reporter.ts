export type ProgressStage =
  | 'idle'
  | 'scan'
  | 'queued'
  | 'image-ready'
  | 'image-source'
  | 'ocr'
  | 'merge'
  | 'translate'
  | 'render'
  | 'done'
  | 'skip'
  | 'error';

export interface ProgressUpdate {
  stage: ProgressStage;
  title: string;
  detail?: string;
  imageIndex?: number;
  imageTotal?: number;
  queueLength?: number;
  source?: string;
  ocrBoxes?: number;
  dialogs?: number;
  translated?: number;
  totalToTranslate?: number;
  rendered?: number;
  warning?: string;
  error?: string;
  elapsedMs?: number;
}

const PANEL_ID = 'manga-lens-progress-panel';
const BODY_ID = 'manga-lens-progress-body';
const TITLE_ID = 'manga-lens-progress-title';
const SUBTITLE_ID = 'manga-lens-progress-subtitle';
const BAR_ID = 'manga-lens-progress-bar';
const LOG_ID = 'manga-lens-progress-log';
const TOGGLE_ID = 'manga-lens-progress-toggle';

const STAGE_LABEL: Record<ProgressStage, string> = {
  idle: '待命',
  scan: '扫描',
  queued: '排队',
  'image-ready': '图片加载',
  'image-source': '图片获取',
  ocr: 'OCR',
  merge: '合并',
  translate: '翻译',
  render: '渲染',
  done: '完成',
  skip: '跳过',
  error: '错误'
};

const STAGE_WEIGHT: Record<ProgressStage, number> = {
  idle: 0,
  scan: 5,
  queued: 10,
  'image-ready': 18,
  'image-source': 30,
  ocr: 50,
  merge: 64,
  translate: 78,
  render: 92,
  done: 100,
  skip: 100,
  error: 100
};

function formatElapsed(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class ProgressReporter {
  private expanded = false;
  private lastUpdate: ProgressUpdate | null = null;
  private logs: string[] = [];

  update(update: ProgressUpdate): void {
    this.lastUpdate = update;
    this.ensurePanel();

    const stage = STAGE_LABEL[update.stage] || update.stage;
    const elapsed = formatElapsed(update.elapsedMs);
    const parts = [stage];
    if (update.imageIndex && update.imageTotal) parts.push(`图片 ${update.imageIndex}/${update.imageTotal}`);
    if (update.queueLength !== undefined) parts.push(`队列 ${update.queueLength}`);
    if (elapsed) parts.push(`耗时 ${elapsed}`);

    const detailParts: string[] = [];
    if (update.source) detailParts.push(`来源: ${update.source}`);
    if (update.ocrBoxes !== undefined) detailParts.push(`OCR框: ${update.ocrBoxes}`);
    if (update.dialogs !== undefined) detailParts.push(`对话: ${update.dialogs}`);
    if (update.totalToTranslate !== undefined) detailParts.push(`翻译: ${update.translated || 0}/${update.totalToTranslate}`);
    if (update.rendered !== undefined) detailParts.push(`渲染: ${update.rendered}`);

    const panel = document.getElementById(PANEL_ID);
    const title = document.getElementById(TITLE_ID);
    const subtitle = document.getElementById(SUBTITLE_ID);
    const body = document.getElementById(BODY_ID);
    const bar = document.getElementById(BAR_ID) as HTMLElement | null;

    if (panel) {
      panel.dataset.stage = update.stage;
      panel.classList.toggle('is-expanded', this.expanded);
    }
    if (title) title.textContent = update.title;
    if (subtitle) subtitle.textContent = [parts.join(' · '), update.detail, detailParts.join(' · ')].filter(Boolean).join('\n');
    if (bar) bar.style.width = `${this.calculatePercent(update)}%`;

    if (body) {
      body.innerHTML = this.renderBody(update);
    }

    this.pushLog(update);
    this.renderLog();
  }

  clear(delayMs = 1200): void {
    window.setTimeout(() => {
      const panel = document.getElementById(PANEL_ID);
      panel?.remove();
      this.lastUpdate = null;
      this.logs = [];
    }, delayMs);
  }

  private calculatePercent(update: ProgressUpdate): number {
    if (update.stage === 'translate' && update.totalToTranslate) {
      const local = Math.min(1, Math.max(0, (update.translated || 0) / update.totalToTranslate));
      return Math.round(68 + local * 20);
    }

    return STAGE_WEIGHT[update.stage] ?? 0;
  }

  private ensurePanel(): void {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="manga-lens-progress-header">
        <div>
          <div id="${TITLE_ID}" class="manga-lens-progress-title">MangaLens</div>
          <div id="${SUBTITLE_ID}" class="manga-lens-progress-subtitle"></div>
        </div>
        <button id="${TOGGLE_ID}" class="manga-lens-progress-toggle" type="button">详情</button>
      </div>
      <div class="manga-lens-progress-track"><div id="${BAR_ID}" class="manga-lens-progress-bar"></div></div>
      <div id="${BODY_ID}" class="manga-lens-progress-body"></div>
      <div id="${LOG_ID}" class="manga-lens-progress-log"></div>
    `;
    document.body.appendChild(panel);

    document.getElementById(TOGGLE_ID)?.addEventListener('click', () => {
      this.expanded = !this.expanded;
      panel.classList.toggle('is-expanded', this.expanded);
      const toggle = document.getElementById(TOGGLE_ID);
      if (toggle) toggle.textContent = this.expanded ? '收起' : '详情';
      if (this.lastUpdate) {
        this.update(this.lastUpdate);
      }
    });
  }

  private renderBody(update: ProgressUpdate): string {
    const rows: Array<[string, string | number | undefined]> = [
      ['阶段', STAGE_LABEL[update.stage]],
      ['图片', update.imageIndex && update.imageTotal ? `${update.imageIndex}/${update.imageTotal}` : undefined],
      ['队列', update.queueLength],
      ['来源', update.source],
      ['OCR 文本框', update.ocrBoxes],
      ['合并对话', update.dialogs],
      ['翻译进度', update.totalToTranslate !== undefined ? `${update.translated || 0}/${update.totalToTranslate}` : undefined],
      ['渲染数量', update.rendered],
      ['耗时', formatElapsed(update.elapsedMs)],
      ['警告', update.warning],
      ['错误', update.error]
    ];

    return rows
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `<div class="manga-lens-progress-row"><span>${escapeText(key)}</span><b>${escapeText(String(value))}</b></div>`)
      .join('');
  }

  private pushLog(update: ProgressUpdate): void {
    const message = [
      `[${STAGE_LABEL[update.stage]}]`,
      update.title,
      update.detail,
      update.source ? `source=${update.source}` : '',
      update.warning ? `warning=${update.warning}` : '',
      update.error ? `error=${update.error}` : ''
    ].filter(Boolean).join(' ');

    this.logs.push(message);
    this.logs = this.logs.slice(-8);
    console.log(`[MangaLens][Progress] ${message}`);
  }

  private renderLog(): void {
    const log = document.getElementById(LOG_ID);
    if (!log) return;
    log.innerHTML = this.logs.map((line) => `<div>${escapeText(line)}</div>`).join('');
  }
}

export const progressReporter = new ProgressReporter();
