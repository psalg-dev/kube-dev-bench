import { toPng, toSvg } from 'html-to-image';

type ExportFormat = 'png' | 'svg';

const DEFAULT_BACKGROUND_COLOR = '#0d1117';

function sanitizeFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function triggerDownload(dataUrl: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export async function exportGraphCanvas(
  element: HTMLElement,
  format: ExportFormat,
  baseFileName: string
): Promise<void> {
  const fileName = sanitizeFileName(baseFileName || 'graph-export');

  if (format === 'svg') {
    const dataUrl = await toSvg(element, {
      backgroundColor: DEFAULT_BACKGROUND_COLOR,
      cacheBust: true,
    });
    triggerDownload(dataUrl, `${fileName}.svg`);
    return;
  }

  const dataUrl = await toPng(element, {
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    cacheBust: true,
    pixelRatio: 2,
  });
  triggerDownload(dataUrl, `${fileName}.png`);
}
