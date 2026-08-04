import {
  ChangeDetectionStrategy, Component, computed, inject, input,
} from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions, ChartType } from 'chart.js';
import { ChartThemeService } from '../../../core/services/chart-theme.service';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

/**
 * One wrapper for every Chart.js chart in the app.
 *
 * Why a single generic component rather than four specific ones: the loading
 * skeleton, empty state, theme reactivity and height handling are identical
 * for all of them. Only the data and a handful of options differ, and those
 * are cleaner as inputs than as four near-duplicate files.
 *
 * NOTE: uses `ChartOptions` (plain, non-generic) rather than
 * `ChartConfiguration['options']`. The latter is an indexed access into a
 * triple-generic type (`ChartConfiguration<TType, TData, TLabel>`), and
 * leaving all three generics to their defaults produced a type TypeScript
 * couldn't fully resolve here - which cascaded into "unknown reference"
 * errors on this component everywhere it was imported. `ChartOptions` is
 * the same type `chart-theme.service.ts` already uses successfully.
 */
@Component({
  selector: 'acms-chart',
  standalone: true,
  imports: [BaseChartDirective, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" [style.height.px]="height()">
      @if (loading()) {
        <div class="state" role="status" aria-live="polite">
          <div class="skeleton bar"></div>
          <span class="sr-only">Loading chart data</span>
        </div>
      } @else if (isEmpty()) {
        <div class="state empty">
          <span class="ic"><acms-icon [name]="emptyIcon()" [size]="22" /></span>
          <div class="t">{{ emptyTitle() }}</div>
          @if (emptyMessage()) { <div class="m">{{ emptyMessage() }}</div> }
        </div>
      } @else {
        <canvas baseChart
                [type]="type()"
                [data]="data()"
                [options]="merged()"
                [attr.aria-label]="ariaLabel()"
                role="img"></canvas>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .wrap { position: relative; width: 100%; }
    canvas { display: block; }

    .state {
      position: absolute; inset: 0;
      display: grid; place-items: center; align-content: center; gap: 8px;
      text-align: center;
    }
    .bar { width: 100%; height: 100%; border-radius: var(--r-md); }

    .empty .ic {
      display: grid; place-items: center; width: 46px; height: 46px;
      border-radius: var(--r-md); margin-bottom: 2px;
      background: var(--violet-bg); color: var(--violet-fg);
    }
    .empty .t {
      font-family: var(--font-display); font-weight: 600;
      font-size: var(--fs-base); color: var(--ink-muted);
    }
    .empty .m { font-size: var(--fs-xs); color: var(--ink-dim); max-width: 34ch; }
  `],
})
export class ChartComponent {
  private readonly ct = inject(ChartThemeService);

  readonly type = input.required<ChartType>();
  readonly data = input.required<ChartData>();
  readonly height = input(260);
  readonly loading = input(false);
  readonly ariaLabel = input('Chart');
  readonly emptyIcon = input<IconName>('bars');
  readonly emptyTitle = input('No data for this period');
  readonly emptyMessage = input<string>();
  /** Chart-specific overrides merged over the shared base options. */
  readonly options = input<ChartOptions>({});

  protected readonly isEmpty = computed(() => {
    const sets = this.data()?.datasets ?? [];
    if (!sets.length) return true;
    return sets.every(d => !(d.data as unknown[])?.length);
  });

  /** Deep-ish merge: base options, then per-chart overrides on top.
   *  Recomputes when the theme flips, because `ct.base()` is a signal. */
  protected readonly merged = computed<ChartOptions>(() => {
    const base = this.ct.base();
    const over = this.options() ?? {};
    return {
      ...base,
      ...over,
      plugins: { ...base.plugins, ...(over.plugins ?? {}) },
      scales: over.scales === null
        ? undefined
        : { ...(base.scales ?? {}), ...(over.scales ?? {}) },
    } as ChartOptions;
  });
}