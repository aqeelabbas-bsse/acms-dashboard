import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BreakdownItem } from '../../../core/models/drilldown.models';

/**
 * A single-series, clickable histogram. Distinct from the existing
 * BarChartComponent, which renders two series side-by-side (submitted vs
 * printed) and has no click handler — this needed genuinely different
 * behaviour (one bar per category, tap a bar to filter the grid), not a
 * variant of the same component.
 */
@Component({
  selector: 'acms-breakdown-histogram',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      @if (items().length) {
        <div class="cols" role="list">
          @for (b of scaled(); track b.code) {
            <button type="button" class="col" role="listitem"
                    [class.active]="selected() === b.code"
                    [attr.aria-pressed]="selected() === b.code"
                    [attr.title]="b.label + ': ' + b.count"
                    (click)="pick(b.code)">
              <span class="count">{{ b.count }}</span>
              <span class="bar" [style.height.%]="b.pct"></span>
              <span class="tick">{{ b.label }}</span>
            </button>
          }
        </div>
      } @else {
        <div class="empty">No records in this view.</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .wrap { min-height: 200px; }
    .cols {
      display: flex; align-items: flex-end; gap: 10px;
      height: 200px; padding: var(--s-4) 4px 0;
    }
    .col {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; align-items: center;
      justify-content: flex-end; gap: 6px; height: 100%;
      background: none; border: none; cursor: pointer; padding: 0;
      font: inherit; color: inherit;
      border-radius: var(--r-sm);
      transition: background var(--t-fast) var(--ease);
    }
    .col:hover, .col.active { background: var(--hover-wash); }
    .count { font-size: var(--fs-xs); font-weight: 700; color: var(--ink-muted); }
    .bar {
      width: 100%; max-width: 34px; min-height: 4px;
      border-radius: 6px 6px 2px 2px;
      background: linear-gradient(180deg, var(--violet), var(--blue));
      transition: opacity var(--t-fast) var(--ease);
      animation: grow 600ms var(--ease) both;
    }
    .col.active .bar { background: linear-gradient(180deg, var(--rose), var(--violet)); }
    @keyframes grow { from { transform: scaleY(0); } }
    .tick {
      font-size: var(--fs-xs); color: var(--ink-muted);
      max-width: 100%; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; text-align: center;
    }
    .empty {
      display: grid; place-items: center; height: 200px;
      color: var(--ink-dim); font-size: var(--fs-sm);
    }
  `],
})
export class BreakdownHistogramComponent {
  readonly items = input.required<BreakdownItem[]>();
  /** Code of the currently-selected bar, or null when none is picked (= "all"). */
  readonly selected = input<string | null>(null);
  readonly select = output<string | null>();

  protected readonly scaled = computed(() => {
    const list = this.items();
    const max = Math.max(1, ...list.map((b) => b.count));
    return list.map((b) => ({ ...b, pct: Math.max(4, Math.round((b.count / max) * 100)) }));
  });

  protected pick(code: string): void {
    // Clicking the already-selected bar clears the filter back to "all" -
    // a toggle, not a one-way drill, so it's easy to back out without a
    // separate "clear filter" control.
    this.select.emit(this.selected() === code ? null : code);
  }
}