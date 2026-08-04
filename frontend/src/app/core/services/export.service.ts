import { Injectable } from '@angular/core';

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/**
 * Client-side export. Deliberately dependency-free.
 *
 * FR-ANL-05 asks for "PDF or Excel". The plan assumed a backend
 * /analytics/export endpoint that was never built (gap list item 10).
 * Rather than block Phase 12 on backend work, this exports:
 *   - CSV, which Excel opens natively (satisfies the Excel half)
 *   - Print-to-PDF via the browser's own print pipeline (satisfies the PDF half)
 *
 * If real .xlsx with formatting is required later, `npm install xlsx` and
 * swap toCsv() for SheetJS. Flagged for the supervisor either way.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {

  exportCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string): void {
    const head = columns.map(c => this.escape(c.header)).join(',');
    const body = rows
      .map(r => columns.map(c => this.escape(c.value(r))).join(','))
      .join('\r\n');

    // BOM so Excel reads UTF-8 correctly - without it, non-ASCII names break.
    const blob = new Blob(['\uFEFF' + head + '\r\n' + body],
                          { type: 'text/csv;charset=utf-8;' });
    this.download(blob, `${filename}-${this.stamp()}.csv`);
  }

  /**
   * Opens the browser print dialog scoped to one element. The user picks
   * "Save as PDF" - no client-side PDF library needed.
   *
   * Canvas elements (Chart.js charts) don't survive an outerHTML clone -
   * a cloned <canvas> is always blank, since only the DOM node copies,
   * never the drawn pixels. Each canvas is snapshotted to a PNG image
   * first, and the image replaces the canvas in the printed copy.
   */
  printElement(el: HTMLElement, title: string): void {
    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) return;                                    // popup blocked

    const clone = el.cloneNode(true) as HTMLElement;
    const originalCanvases = el.querySelectorAll('canvas');
    const cloneCanvases = clone.querySelectorAll('canvas');

    originalCanvases.forEach((canvas, i) => {
      const target = cloneCanvases[i];
      if (!target) return;
      let dataUrl = '';
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch {
        return;                                          // tainted canvas - skip, leave blank
      }
      // getBoundingClientRect reflects the canvas's actual rendered CSS
      // size, unlike clientWidth/Height which can be 0 or misleading for
      // elements sized via component-scoped styles.
      const rect = canvas.getBoundingClientRect();
      const img = document.createElement('img');
      img.src = dataUrl;
      img.className = 'print-chart-snapshot';
      img.style.display = 'block';
      img.style.width = `${Math.round(rect.width) || canvas.width}px`;
      img.style.height = `${Math.round(rect.height) || canvas.height}px`;
      target.replaceWith(img);
    });

    win.document.write(`<!doctype html><html><head>
      <title>${title}</title>
      <style>${this.collectAllStyles()}
        body { padding: 28px; background: #fff !important; }
        @page { margin: 16mm; }
        .print-chart-snapshot { display: block; max-width: 100%; }
      </style></head>
      <body data-theme="light">${clone.outerHTML}</body></html>`);
    win.document.close();

    // Give the cloned styles a beat to apply before the dialog opens.
    setTimeout(() => { win.focus(); win.print(); }, 350);
  }

  /**
   * document.styleSheets alone misses styles Angular injects via
   * document.adoptedStyleSheets (constructable stylesheets) - a separate
   * browser API used by newer Angular builds (@angular/build:application,
   * esbuild-based) for some component-scoped styles. Both sources are
   * collected here so cloned components keep their own layout rules,
   * not just the global styles.scss ones.
   */
  private collectAllStyles(): string {
    const sheets: CSSStyleSheet[] = [...Array.from(document.styleSheets)];

    const adopted = (document as unknown as { adoptedStyleSheets?: CSSStyleSheet[] })
      .adoptedStyleSheets;
    if (adopted?.length) sheets.push(...adopted);

    return sheets
      .map(s => {
        try {
          return Array.from(s.cssRules).map(r => r.cssText).join('\n');
        } catch {
          return '';                                     // cross-origin sheet
        }
      })
      .join('\n');
  }

  private escape(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  private stamp(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}