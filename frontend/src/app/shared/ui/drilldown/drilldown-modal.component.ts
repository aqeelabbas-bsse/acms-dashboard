import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { ModalComponent } from '../modal/modal.component';
import { SegmentedComponent, SegmentOption } from '../segmented/segmented.component';
import { IconComponent } from '../icon/icon.component';
import { BreakdownHistogramComponent } from './breakdown-histogram.component';
import {
  DrilldownGridComponent, GridQuery, EMPTY_QUERY,
} from './drilldown-grid.component';
import { DrilldownService } from '../../../core/services/drilldown.service';
import {
  DRILLDOWN_META, DrilldownDimension, DrilldownKind, DrilldownRow, DrilldownSummary,
} from '../../../core/models/drilldown.models';

/**
 * KPI -> category breakdown -> searchable grid. One component implements this
 * for all nine drillable metrics rather than nine near-identical screens.
 *
 * The "How this number is calculated" panel is deliberate. A review finding was
 * that the dashboard and SSMS reported different counts for the same concept
 * with nothing on screen to explain why, so every drill-down now publishes the
 * exact predicate behind its total. It can be copied straight into SSMS and
 * re-run, which turns "is the dashboard wrong?" into a ten-second check.
 *
 * Usage: `<acms-drilldown-modal [kind]="openKind()" (closed)="openKind.set(null)" />`
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
                  [width]="880" (close)="closed.emit()">

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
          <h4 class="stage__t">
            {{ summary()?.breakdownLabel || 'By category' }}
            &mdash; tap a bar to filter the list below
          </h4>
          <acms-breakdown-histogram
            [items]="summary()?.breakdown ?? []"
            [selected]="category()"
            (select)="pick($event)" />
        </section>

        <section class="stage">
          <h4 class="stage__t">Records</h4>
          <acms-drilldown-grid
            [rows]="rows()" [loading]="rowsLoading()"
            [columns]="summary()?.columns ?? []"
            [filterDefs]="summary()?.filters ?? []"
            [query]="query()" (queryChange)="patchQuery($event)"
            (resetAll)="resetFilters()"
            [activeCategory]="activeCategoryLabel()" (clearCategory)="pick(null)"
            [page]="page()" (pageChange)="setPage($event)"
            [limit]="limit" [total]="total()" [unfiltered]="unfiltered()" />
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
      gap: var(--s-4); margin-bottom: var(--s-4); flex-wrap: wrap;
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

  /** Which metric to show. `null` (the default) keeps the modal closed. */
  readonly kind = input<DrilldownKind | null>(null);
  readonly closed = output<void>();

  protected readonly dimensionOptions: SegmentOption[] = [
    { label: 'By card category', value: 'cardCategory' },
    { label: 'By OPI code', value: 'opicode' },
  ];

  protected readonly dimension = signal<DrilldownDimension>('cardCategory');
  protected readonly category = signal<string | null>(null);
  protected readonly query = signal<GridQuery>({ ...EMPTY_QUERY });
  protected readonly page = signal(1);
  protected readonly limit = 25;

  protected readonly summary = signal<DrilldownSummary | null>(null);
  protected readonly rows = signal<DrilldownRow[]>([]);
  protected readonly total = signal(0);
  protected readonly unfiltered = signal(0);
  protected readonly rowsLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly activeCategoryLabel = computed(() => {
    const code = this.category();
    if (!code) return null;
    return this.summary()?.breakdown.find(b => b.code === code)?.label ?? code;
  });

  /** Tracks the last kind+filter combo that already triggered a page reset, so
   *  a page-change-driven re-run of the row effect cannot loop back and reset
   *  the page a second time for the same filter state. */
  private lastFilterKey: string | null = null;

  constructor() {
    // Fresh state every time a different metric (or none) is opened.
    effect(() => {
      const k = this.kind();
      this.category.set(null);
      this.query.set({ ...EMPTY_QUERY });
      this.page.set(1);
      this.dimension.set('cardCategory');
      this.summary.set(null);
      this.error.set(null);
      this.lastFilterKey = null;
      if (k) this.loadSummary(k);
    });

    // Single source of truth for row fetches: reads kind + every filter + page.
    // When a FILTER (not the page) changes it resets the page itself, rather
    // than fetching twice - once for the filter and once when that reset
    // ripples back into this same effect.
    effect(() => {
      const k = this.kind();
      const category = this.category();
      const q = this.query();
      const dimension = this.dimension();
      const page = this.page();
      if (!k) return;

      const filterKey = [
        k, category, dimension, q.q, q.field, q.status, q.from, q.to, q.sort, q.dir,
      ].join('|');

      if (filterKey !== this.lastFilterKey) {
        this.lastFilterKey = filterKey;
        if (page !== 1) { this.page.set(1); return; }
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
    // The histogram buckets change with the dimension, so any bar selected
    // under the old one is meaningless now.
    this.category.set(null);
    const k = this.kind();
    if (k) this.loadSummary(k);
  }

  protected patchQuery(p: Partial<GridQuery>): void {
    this.query.update(q => ({ ...q, ...p }));
  }

  protected resetFilters(): void {
    this.query.update(q => ({ ...EMPTY_QUERY, sort: q.sort, dir: q.dir }));
  }

  protected setPage(p: number): void {
    this.page.set(p);
  }

  private loadSummary(k: DrilldownKind): void {
    this.svc.summary(k, this.dimension()).subscribe({
      next: s => this.summary.set(s),
      error: err => this.error.set(
        err?.error?.error?.message ?? 'Could not load this breakdown.'),
    });
  }

  private loadRows(k: DrilldownKind, page: number): void {
    this.rowsLoading.set(true);
    const q = this.query();

    this.svc.rows(k, {
      category: this.category() ?? undefined,
      dimension: this.dimension(),
      q: q.q || undefined,
      field: q.field && q.field !== 'all' ? q.field : undefined,
      from: q.from || undefined,
      to: q.to || undefined,
      status: q.status && q.status !== 'all' ? q.status : undefined,
      sort: q.sort || undefined,
      dir: q.dir,
      page,
      limit: this.limit,
    }).subscribe({
      next: env => {
        this.rows.set(env.data ?? []);
        this.total.set(readNum(env.meta, 'total') ?? env.data?.length ?? 0);
        this.unfiltered.set(readNum(env.meta, 'unfiltered') ?? 0);
        this.rowsLoading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.error?.message ?? 'Could not load these records.');
        this.rows.set([]);
        this.total.set(0);
        this.unfiltered.set(0);
        this.rowsLoading.set(false);
      },
    });
  }
}

function readNum(meta: Record<string, unknown> | undefined, key: string): number | null {
  const v = meta?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}