import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { ModalComponent } from '../modal/modal.component';
import { SegmentedComponent, SegmentOption } from '../segmented/segmented.component';
import { IconComponent } from '../icon/icon.component';
import { BreakdownHistogramComponent } from './breakdown-histogram.component';
import { DrilldownGridComponent } from './drilldown-grid.component';
import { DrilldownService } from '../../../core/services/drilldown.service';
import {
  DRILLDOWN_META, DrilldownDimension, DrilldownKind, DrilldownRow, DrilldownSummary,
} from '../../../core/models/drilldown.models';

/**
 * The generic flow described in the supervisor's notes: click a KPI ->
 * category breakdown as a histogram -> click a bar (or skip straight there)
 * -> searchable, paginated grid of the underlying records. One component
 * implements this for all five KPIs (Reqs 1, 2, 4, 5, 6, 7) rather than five
 * near-identical screens.
 *
 * Usage: `<acms-drilldown-modal [kind]="openKind()" (closed)="openKind.set(null)" />`
 * — presence of `kind` controls visibility, same pattern as the other modals
 * in this app (`@if (blocking(); as card)`).
 */
@Component({
  selector: 'acms-drilldown-modal',
  standalone: true,
  imports: [
    ModalComponent, SegmentedComponent, IconComponent,
    BreakdownHistogramComponent, DrilldownGridComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (kind(); as k) {
      <acms-modal [title]="meta(k).title" [subtitle]="meta(k).subtitle"
                  [width]="720" (close)="closed.emit()">

        <div class="head">
          <div class="total">
            <span class="n">{{ summary()?.total ?? '\u2026' }}</span>
            <span class="l">total in this view</span>
          </div>

          @if (summary()?.supportsDimensionToggle) {
            <acms-segmented [options]="dimensionOptions" [value]="dimension()"
                            (valueChange)="setDimension($any($event))" />
          }
        </div>

        @if (error()) {
          <div class="alert" role="alert"><acms-icon name="alert" [size]="15" /> {{ error() }}</div>
        }

        <section class="stage">
          <h4 class="stage__t">By category &mdash; tap a bar to filter the list below</h4>
          <acms-breakdown-histogram
            [items]="summary()?.breakdown ?? []"
            [selected]="category()"
            (select)="pick($event)" />
        </section>

        <section class="stage">
          <h4 class="stage__t">Records</h4>
          <acms-drilldown-grid
            [rows]="rows()" [loading]="rowsLoading()"
            [search]="search()" (searchChange)="setSearch($event)"
            [activeCategory]="activeCategoryLabel()" (clearCategory)="pick(null)"
            [page]="page()" (pageChange)="setPage($event)"
            [limit]="limit" [total]="total()" />
        </section>

        <div modalFooter>
          <button class="btn btn--ghost" type="button" (click)="closed.emit()">Close</button>
        </div>
      </acms-modal>
    }
  `,
  styles: [`
    :host { display: block; }
    .head {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--s-4); margin-bottom: var(--s-5); flex-wrap: wrap;
    }
    .total { display: flex; align-items: baseline; gap: 8px; }
    .total .n {
      font-family: var(--font-display); font-size: var(--fs-xl); font-weight: 700;
      background: var(--num-grad); -webkit-background-clip: text;
      background-clip: text; -webkit-text-fill-color: transparent;
    }
    .total .l { font-size: var(--fs-sm); color: var(--ink-muted); }

    .alert {
      display: flex; align-items: center; gap: 9px;
      margin-bottom: var(--s-4); padding: 10px var(--s-4);
      border-radius: var(--r-md); background: var(--danger-bg); color: var(--danger-fg);
      font-size: var(--fs-sm);
    }

    .stage { margin-bottom: var(--s-6); }
    .stage__t {
      margin: 0 0 var(--s-3); font-size: var(--fs-sm); font-weight: 600;
      color: var(--ink-muted); text-transform: uppercase; letter-spacing: .02em;
    }
  `],
})
export class DrilldownModalComponent {
  private readonly svc = inject(DrilldownService);

  /** Which KPI to show. `null` (the default) keeps the modal closed. */
  readonly kind = input<DrilldownKind | null>(null);
  readonly closed = output<void>();

  protected readonly dimensionOptions: SegmentOption[] = [
    { label: 'By card category', value: 'cardCategory' },
  ];

  protected readonly dimension = signal<DrilldownDimension>('cardCategory');
  protected readonly category = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly limit = 25;

  protected readonly summary = signal<DrilldownSummary | null>(null);
  protected readonly rows = signal<DrilldownRow[]>([]);
  protected readonly total = signal(0);
  protected readonly rowsLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly activeCategoryLabel = computed(() => {
    const code = this.category();
    if (!code) return null;
    return this.summary()?.breakdown.find((b) => b.code === code)?.label ?? code;
  });

  /** Tracks the last kind+filter combo that already triggered a page reset,
   *  so a page-change-triggered re-run of the row effect below doesn't loop
   *  back and reset the page a second time for the same filter state. */
  private lastFilterKey: string | null = null;
  private summaryRequestId = 0;

  constructor() {
    // Fresh state every time a different KPI (or none) is opened.
    effect(() => {
      const k = this.kind();
      this.category.set(null);
      this.search.set('');
      this.page.set(1);
      this.dimension.set('cardCategory');
      this.summary.set(null);
      this.error.set(null);
      this.lastFilterKey = null;
      if (k) this.loadSummary(k);
    });

    // Single source of truth for row fetches: reads kind + every filter +
    // page. When a FILTER (not page) changes, it resets page to 1 itself
    // rather than fetching twice - once for the filter change and once more
    // when that reset ripples into this same effect via `page()`.
    effect(() => {
      const k = this.kind();
      const category = this.category();
      const search = this.search();
      const dimension = this.dimension();
      const page = this.page();
      if (!k) return;

      const filterKey = `${k}|${category}|${search}|${dimension}`;
      if (filterKey !== this.lastFilterKey) {
        this.lastFilterKey = filterKey;
        if (page !== 1) { this.page.set(1); return; } // triggers this effect again at page=1
      }

      this.loadRows(k, page);
    });
  }

  protected meta(k: DrilldownKind) {
    return DRILLDOWN_META[k];
  }

  protected pick(code: string | null): void {
    this.category.set(code);
  }

  protected setDimension(d: DrilldownDimension): void {
    this.dimension.set(d);
    const k = this.kind();
    if (k) this.loadSummary(k);
}

  protected setSearch(v: string): void {
    this.search.set(v);
  }

  protected setPage(p: number): void {
    this.page.set(p);
  }

  private loadSummary(k: DrilldownKind): void {
    this.svc.summary(k, this.dimension()).subscribe({
      next: (s) => this.summary.set(s),
      error: (err) => this.error.set(err?.error?.error?.message ?? 'Could not load this breakdown.'),
    });
  }

  private loadRows(k: DrilldownKind, page: number): void {
    this.rowsLoading.set(true);
    this.svc.rows(k, {
      category: this.category() ?? undefined,
      dimension: this.dimension(),
      search: this.search() || undefined,
      page,
      limit: this.limit,
    }).subscribe({
      next: (env) => {
        this.rows.set(env.data ?? []);
        this.total.set(readTotal(env.meta) ?? env.data?.length ?? 0);
        this.rowsLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error?.message ?? 'Could not load these records.');
        this.rows.set([]);
        this.total.set(0);
        this.rowsLoading.set(false);
      },
    });
  }
}

function readTotal(meta: Record<string, unknown> | undefined): number | null {
  const t = meta?.['total'];
  return typeof t === 'number' && Number.isFinite(t) ? t : null;
}