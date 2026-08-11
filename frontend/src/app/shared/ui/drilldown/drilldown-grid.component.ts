import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  DrilldownColumn, DrilldownFilter, DrilldownRow,
} from '../../../core/models/drilldown.models';
import { StatusBadgeComponent, BadgeTone } from '../status-badge/status-badge.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SearchInputComponent } from '../search-input/search-input.component';
import { PaginatorComponent } from '../paginator/paginator.component';
import { IconComponent } from '../icon/icon.component';

const VALID_TONES: readonly BadgeTone[] = ['success', 'danger', 'warn', 'info', 'violet', 'neutral'];

/** Everything the grid can be narrowed by. Held by the parent so a filter
 *  change can reset pagination in one place. */
export interface GridQuery {
  q: string;
  field: string;
  status: string;
  from: string;
  to: string;
  sort: string;
  dir: 'asc' | 'desc';
}

export const EMPTY_QUERY: GridQuery = {
  q: '', field: 'all', status: 'all', from: '', to: '', sort: '', dir: 'desc',
};

/**
 * The searchable grid behind every drill-down.
 *
 * The review note was that searching only matched name or CNIC, with no way to
 * filter by date. Rather than hard-code more fields, the whole table is now
 * driven by the column schema the API sends with each summary: the head, the
 * "search in" list, the sort targets and the filter controls are all generated.
 * Adding a searchable field to a drill-down is a backend-only change.
 *
 * Filters compose - text, column scope, status and date range all narrow the
 * same set, and the footer states "showing X of Y" so a filtered count is never
 * mistaken for the KPI having changed.
 */
@Component({
  selector: 'acms-drilldown-grid',
  standalone: true,
  imports: [
    StatusBadgeComponent, EmptyStateComponent, SearchInputComponent,
    PaginatorComponent, IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <div class="toolbar__main">
        <acms-search-input [value]="query().q" (valueChange)="patch({ q: $event })"
                           [placeholder]="searchPlaceholder()" />

        @if (searchableColumns().length > 1) {
          <label class="fld">
            <span class="fld__l">in</span>
            <select [value]="query().field" (change)="patch({ field: val($event) })"
                    aria-label="Search in column">
              <option value="all">All fields</option>
              @for (c of searchableColumns(); track c.key) {
                <option [value]="c.key">{{ c.label }}</option>
              }
            </select>
          </label>
        }

        <button type="button" class="advbtn" [class.on]="showAdvanced()"
                (click)="showAdvanced.set(!showAdvanced())"
                [attr.aria-expanded]="showAdvanced()">
          <acms-icon name="filter" [size]="14" [weight]="2" />
          Filters
          @if (activeCount() > 0) { <span class="badge">{{ activeCount() }}</span> }
        </button>
      </div>

      @if (showAdvanced()) {
        <div class="adv">
          @for (f of filterDefs(); track f.key) {
            @if (f.type === 'select' && f.options?.length) {
              <label class="fld fld--stack">
                <span class="fld__l">{{ f.label }}</span>
                <select [value]="query().status" (change)="patch({ status: val($event) })">
                  @for (o of f.options ?? []; track o.value) {
                    <option [value]="o.value">{{ o.label }}</option>
                  }
                </select>
              </label>
            }
            @if (f.type === 'dateRange') {
              <label class="fld fld--stack">
                <span class="fld__l">{{ f.label }} &mdash; from</span>
                <input type="date" [value]="query().from" [attr.max]="query().to || null"
                       (change)="patch({ from: val($event) })" />
              </label>
              <label class="fld fld--stack">
                <span class="fld__l">to</span>
                <input type="date" [value]="query().to" [attr.min]="query().from || null"
                       (change)="patch({ to: val($event) })" />
              </label>
            }
          }

          @if (activeCount() > 0) {
            <button type="button" class="reset" (click)="resetAll.emit()">
              <acms-icon name="refresh" [size]="13" [weight]="2" /> Reset
            </button>
          }
        </div>
      }

      @if (activeCategory() || activeCount() > 0) {
        <div class="chips">
          @if (activeCategory()) {
            <span class="chip chip--cat">
              {{ activeCategory() }}
              <button type="button" (click)="clearCategory.emit()"
                      aria-label="Clear category filter">&times;</button>
            </span>
          }
          @for (c of activeChips(); track c.key) {
            <span class="chip">
              {{ c.label }}
              <button type="button" (click)="clearOne(c.key)"
                      [attr.aria-label]="'Clear ' + c.label">&times;</button>
            </span>
          }
        </div>
      }
    </div>

    @if (loading()) {
      <div class="pad" role="status" aria-live="polite">
        @for (i of [1,2,3,4,5]; track i) { <div class="skeleton row-sk"></div> }
      </div>
    } @else if (rows().length === 0) {
      <acms-empty-state icon="search" title="No matching records"
        message="Nothing matches these filters. Try widening the date range or clearing the category." />
    } @else {
      <div class="tbl-wrap">
        <table class="tbl">
          <caption class="sr-only">Drill-down records</caption>
          <thead>
            <tr>
              @for (c of columns(); track c.key) {
                <th scope="col" [attr.aria-sort]="ariaSort(c)">
                  @if (c.sortable) {
                    <button type="button" class="sortbtn" (click)="toggleSort(c.key)">
                      {{ c.label }}
                      <acms-icon name="chevron" [size]="11" [weight]="2.6"
                                 class="caret"
                                 [class.caret--on]="query().sort === c.key"
                                 [class.caret--up]="query().sort === c.key && query().dir === 'asc'" />
                    </button>
                  } @else {
                    {{ c.label }}
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr>
                @for (c of columns(); track c.key) {
                  <td [class.strong]="c === columns()[0]" [class.mono]="c.type === 'mono'">
                    @if (c.type === 'status') {
                      @if (cell(r, c.key)) {
                        <acms-status-badge [label]="cell(r, c.key)!" [tone]="tone(r.statusTone)" />
                      }
                    } @else if (c.type === 'date') {
                      {{ date(cell(r, c.key)) }}
                    } @else {
                      {{ cell(r, c.key) || '\u2014' }}
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="foot">
        <span class="count">
          Showing {{ rows().length }} of {{ total() }}
          @if (unfiltered() > total()) { <em>&nbsp;(filtered from {{ unfiltered() }})</em> }
        </span>
        <acms-paginator [page]="page()" (pageChange)="pageChange.emit($event)"
                        [limit]="limit()" [total]="total()" />
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .toolbar { display: flex; flex-direction: column; gap: 10px; padding: 0 0 var(--s-4); }
    .toolbar__main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

    .fld { display: inline-flex; align-items: center; gap: 7px; }
    .fld--stack { flex-direction: column; align-items: flex-start; gap: 4px; }
    .fld__l { font-size: var(--fs-xs); color: var(--ink-dim); font-weight: 600; white-space: nowrap; }

    select, input[type='date'] {
      height: 34px; padding: 0 10px;
      border: 1px solid var(--glass-border); border-radius: var(--r-sm);
      background: var(--hover-wash); color: var(--ink);
      font-family: var(--font-body); font-size: var(--fs-sm);
      cursor: pointer;
    }
    select:focus-visible, input[type='date']:focus-visible {
      outline: none; border-color: rgba(124,108,240,.55);
      box-shadow: 0 0 0 3px rgba(124,108,240,.14);
    }

    .advbtn {
      display: inline-flex; align-items: center; gap: 6px;
      height: 38px; padding: 0 14px;
      border: 1px solid var(--glass-border); border-radius: var(--r-pill);
      background: var(--hover-wash); color: var(--ink-muted);
      font-family: var(--font-body); font-size: var(--fs-sm); font-weight: 600;
      cursor: pointer; transition: all var(--t-fast) var(--ease);
    }
    .advbtn:hover { background: var(--hover-wash-2); color: var(--ink); }
    .advbtn.on { color: var(--violet-fg); border-color: rgba(124,108,240,.45); }
    .advbtn .badge {
      display: grid; place-items: center; min-width: 17px; height: 17px;
      padding: 0 5px; border-radius: 999px;
      background: var(--violet-fg); color: #fff; font-size: 10px; font-weight: 700;
    }

    .adv {
      display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap;
      padding: var(--s-4); border-radius: var(--r-md);
      background: var(--hover-wash);
      animation: slide var(--t-base) var(--ease);
    }
    @keyframes slide { from { opacity: 0; transform: translateY(-4px); } }

    .reset {
      display: inline-flex; align-items: center; gap: 5px;
      height: 34px; padding: 0 12px; border-radius: var(--r-sm);
      border: 1px solid var(--glass-border); background: transparent;
      color: var(--ink-muted); font-family: var(--font-body);
      font-size: var(--fs-sm); font-weight: 600; cursor: pointer;
    }
    .reset:hover { color: var(--ink); }

    .chips { display: flex; gap: 7px; flex-wrap: wrap; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 6px 4px 11px; border-radius: 999px;
      background: var(--hover-wash-2); color: var(--ink-soft);
      font-size: var(--fs-xs); font-weight: 600;
    }
    .chip--cat { background: var(--violet-bg); color: var(--violet-fg); }
    .chip button {
      display: grid; place-items: center; width: 17px; height: 17px;
      border-radius: 50%; border: none; background: rgba(0,0,0,.08);
      color: inherit; cursor: pointer; font-size: 12px; line-height: 1;
    }

    .sortbtn {
      display: inline-flex; align-items: center; gap: 4px;
      border: none; background: none; padding: 0;
      font: inherit; color: inherit; cursor: pointer;
    }
    .caret { opacity: 0; transition: opacity var(--t-fast) var(--ease),
                                     transform var(--t-fast) var(--ease); }
    .sortbtn:hover .caret { opacity: .4; }
    .caret--on { opacity: 1; }
    .caret--up { transform: rotate(180deg); }

    .foot {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--s-4); flex-wrap: wrap; margin-top: var(--s-2);
    }
    .count { font-size: var(--fs-xs); color: var(--ink-dim); }
    .count em { font-style: normal; opacity: .75; }

    .pad { padding: var(--s-4) 0; display: grid; gap: 10px; }
    .row-sk { height: 38px; }
    .tbl-wrap { overflow-x: auto; }
  `],
})
export class DrilldownGridComponent {
  readonly rows = input.required<DrilldownRow[]>();
  readonly columns = input<DrilldownColumn[]>([]);
  readonly filterDefs = input<DrilldownFilter[]>([]);
  readonly query = input<GridQuery>(EMPTY_QUERY);
  readonly loading = input(false);
  readonly activeCategory = input<string | null>(null);
  readonly page = input(1);
  readonly limit = input(25);
  readonly total = input(0);
  /** Row count under this KPI before any grid filter - drives "filtered from N". */
  readonly unfiltered = input(0);

  readonly queryChange = output<Partial<GridQuery>>();
  readonly pageChange = output<number>();
  readonly clearCategory = output<void>();
  readonly resetAll = output<void>();

  protected readonly showAdvanced = signal(false);

  protected readonly searchableColumns = computed(() =>
    this.columns().filter(c => c.searchable));

  protected readonly searchPlaceholder = computed(() => {
    const field = this.query().field;
    if (field && field !== 'all') {
      const col = this.columns().find(c => c.key === field);
      if (col) return `Search ${col.label.toLowerCase()}...`;
    }
    const names = this.searchableColumns().slice(0, 3).map(c => c.label.toLowerCase());
    return names.length ? `Search ${names.join(', ')} and more...` : 'Search...';
  });

  /** Chips for everything currently narrowing the grid, so no filter can be
   *  left on invisibly and quietly hide rows. */
  protected readonly activeChips = computed(() => {
    const q = this.query();
    const chips: { key: keyof GridQuery; label: string }[] = [];

    if (q.q) {
      const scope = q.field && q.field !== 'all'
        ? this.columns().find(c => c.key === q.field)?.label ?? q.field
        : 'all fields';
      chips.push({ key: 'q', label: `"${q.q}" in ${scope}` });
    }
    if (q.status && q.status !== 'all') {
      const def = this.filterDefs().find(f => f.type === 'select');
      const opt = def?.options?.find(o => o.value === q.status);
      chips.push({ key: 'status', label: opt?.label ?? q.status });
    }
    if (q.from) chips.push({ key: 'from', label: `From ${q.from}` });
    if (q.to) chips.push({ key: 'to', label: `To ${q.to}` });

    return chips;
  });

  protected readonly activeCount = computed(() => this.activeChips().length);

  protected patch(p: Partial<GridQuery>): void {
    this.queryChange.emit(p);
  }

  protected clearOne(key: keyof GridQuery): void {
    this.queryChange.emit(key === 'status' ? { status: 'all' } : ({ [key]: '' } as Partial<GridQuery>));
  }

  protected toggleSort(key: string): void {
    const q = this.query();
    this.queryChange.emit(
      q.sort === key
        ? { sort: key, dir: q.dir === 'asc' ? 'desc' : 'asc' }
        : { sort: key, dir: 'asc' },
    );
  }

  protected ariaSort(c: DrilldownColumn): string | null {
    if (!c.sortable) return null;
    if (this.query().sort !== c.key) return 'none';
    return this.query().dir === 'asc' ? 'ascending' : 'descending';
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected cell(r: DrilldownRow, key: string): string | null {
    return r.cells?.[key] ?? null;
  }

  protected tone(raw: string | null): BadgeTone {
    return (VALID_TONES as readonly string[]).includes(raw ?? '') ? (raw as BadgeTone) : 'neutral';
  }

  /**
   * The API sends these with an explicit Z, so `new Date()` converts to the
   * viewer's zone instead of showing the raw UTC hour. Do not strip it.
   */
  protected date(v: string | null): string {
    if (!v) return '\u2014';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '\u2014';

    const midnight = d.getHours() === 0 && d.getMinutes() === 0;
    return d.toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
      ...(midnight ? {} : { hour: '2-digit', minute: '2-digit' }),
    });
  }
}