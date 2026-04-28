# MangaLens

MangaLens is a Chrome extension for translating manga pages in place.

## What It Uses

- OCR: Zhipu GLM-OCR through `https://open.bigmodel.cn/api/paas/v4/layout_parsing`
- Translation: Zhipu GLM-4.7 through `https://open.bigmodel.cn/api/paas/v4/chat/completions`
- Authentication: one Zhipu API Key saved locally in `chrome.storage.local`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the extension:

```bash
npm run build
```

3. Open Chrome and go to `chrome://extensions/`.
4. Enable Developer mode.
5. Load the `dist/` folder as an unpacked extension.
6. Open the MangaLens popup and enter your Zhipu API Key.

## Main Files

- `src/content-script.ts`: scans manga images, runs OCR, translates text, and renders overlays.
- `src/background.ts`: fetches cross-origin images and calls Zhipu GLM-OCR.
- `src/modules/zhipu-client.ts`: shared Zhipu OCR and chat API client.
- `src/modules/batch-translator.ts`: batch manga dialogue translation through GLM-4.7.
- `src/modules/ocr-engine.ts`: OCR configuration and conversion into MangaLens bounding boxes.
- `src/popup/index.html` and `src/popup/popup.js`: extension configuration UI.

## Notes

- MiniMax, Tencent Cloud OCR, and MyMemory are no longer used in the runtime path.
- Do not hard-code your API Key into source files.
- The key is stored only in your local Chrome profile for this extension.
