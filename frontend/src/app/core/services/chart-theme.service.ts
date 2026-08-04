import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject } from '@angular/core';
import { ChartOptions } from 'chart.js';
import { ThemeService } from './theme.service';

/**
 * Chart.js has no knowledge of CSS custom properties - it needs literal
 * colour strings at configuration time. This service reads the resolved
 * token values off the document and rebuilds Chart.js options whenever the
 * theme flips, so charts re-theme with the rest of the app.
 */
@Injectable({ providedIn: 'root' })
export class ChartThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly theme = inject(ThemeService);

  /** Categorical series palette. Fixed hex, not tokens: these must stay
   *  visually distinct from each other in BOTH themes. */
  readonly series = {
    violet: '#8B5CF6',
    cyan:   '#22D3EE',
    blue:   '#3B82F6',
    amber:  '#F59E0B',
    rose:   '#F43F5E',
    teal:   '#14B8A6',
  } as const;

  /** Recomputed automatically when ThemeService.resolved() changes. */
  readonly palette = computed(() => {
    const dark = this.theme.resolved() === 'dark';
    return {
      dark,
      ink:      this.token('--ink',       dark ? '#EEF1FA' : '#1A1B2E'),
      muted:    this.token('--ink-muted', dark ? '#8E96B4' : '#71738D'),
      grid:     dark ? 'rgba(255,255,255,.07)' : 'rgba(26,27,46,.07)',
      tooltipBg: dark ? 'rgba(20,26,52,.96)'   : 'rgba(255,255,255,.98)',
      tooltipBorder: dark ? 'rgba(255,255,255,.14)' : 'rgba(26,27,46,.10)',
    };
  });

  private token(name: string, fallback: string): string {
    const v = getComputedStyle(this.doc.documentElement)
      .getPropertyValue(name).trim();
    return v || fallback;
  }

  /** Shared base options every chart in the app starts from. */
  readonly base = computed<ChartOptions>(() => {
    const p = this.palette();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 850, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: p.tooltipBg,
          borderColor: p.tooltipBorder,
          borderWidth: 1,
          titleColor: p.ink,
          bodyColor: p.muted,
          titleFont: { family: 'Poppins, sans-serif', size: 13, weight: 600 },
          bodyFont: { family: 'Inter, sans-serif', size: 12 },
          padding: 12,
          cornerRadius: 12,
          displayColors: true,
          boxWidth: 9,
          boxHeight: 9,
          boxPadding: 5,
          usePointStyle: true,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: p.muted,
            font: { family: 'Inter, sans-serif', size: 11 },
            maxRotation: 0,
            autoSkipPadding: 16,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: p.grid },
          border: { display: false },
          ticks: {
            color: p.muted,
            font: { family: 'Inter, sans-serif', size: 11 },
            precision: 0,
            maxTicksLimit: 5,
          },
        },
      },
    };
  });

  /** Vertical gradient fill for area charts. Needs the live canvas context,
   *  so it can't live in a computed - call it from the chart component. */
  gradient(ctx: CanvasRenderingContext2D, area: { top: number; bottom: number },
           hex: string, topAlpha = 0.38): CanvasGradient {
    const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, this.withAlpha(hex, topAlpha));
    g.addColorStop(1, this.withAlpha(hex, 0));
    return g;
  }

  withAlpha(hex: string, alpha: number): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}