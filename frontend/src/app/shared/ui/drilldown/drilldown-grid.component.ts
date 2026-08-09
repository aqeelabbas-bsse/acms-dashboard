import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DrilldownRow } from '../../../core/models/drilldown.models';
import { StatusBadgeComponent, BadgeTone } from '../status-badge/status-badge.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SearchInputComponent } from '../search-input/search-input.component';
import { PaginatorComponent } from '../paginator/paginator.component';

const VALID_TONES: readonly BadgeTone[] = ['success', 'danger', 'warn', 'info', 'violet', 'neutral'];

/** Requirement 7: "Grid show of all of them with proper searching." One reusable table for all five KPIs. */
@Component({
  selector: 'acms-drilldown-grid',
  standalone: true,
  imports: [StatusBadgeComponent, EmptyStateComponent, SearchInputComponent, PaginatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <acms-search-input [value]="search()" (valueChange)="searchChange.emit($event)"
                         placeholder="Search by name or CNIC..." />
      @if (activeCategory()) {
        <span class="filter-pill">
          {{ activeCategory() }}
          <button type="button" (click)="clearCategory.emit()" aria-label="Clear category filter">×</button>
        </span>
      }
    </div>

    @if (loading()) {
      <div class="pad" role="status" aria-live="polite">
        @for (i of [1,2,3,4,5]; track i) { <div class="skeleton row-sk"></div> }
      </div>
    } @else if (rows().length === 0) {
      <acms-empty-state icon="search" title="No matching records"
        message="Try a different search term or clear the category filter." />
    } @else {
      <div class="tbl-wrap">
        <table class="tbl">
          <caption class="sr-only">Drill-down records</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Identifier</th>
              <th scope="col">Category</th>
              <th scope="col">Status</th>
              <th scope="col">Date</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr>
                <td class="strong">{{ r.primary }}</td>
                <td class="mono">{{ r.secondary || '&mdash;' }}</td>
                <td>{{ r.categoryLabel || '&mdash;' }}</td>
                <td>
                  @if (r.statusLabel) {
                    <acms-status-badge [label]="r.statusLabel" [tone]="tone(r.statusTone)" />
                  }
                </td>
                <td>{{ date(r.date) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <acms-paginator [page]="page()" (pageChange)="pageChange.emit($event)"
                      [limit]="limit()" [total]="total()" />
    }
  `,
  styles: [`
    :host { display: block; }
    .toolbar { display: flex; align-items: center; gap: 10px; padding: 0 0 var(--s-4); flex-wrap: wrap; }
    .filter-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 6px 5px 12px; border-radius: 999px;
      background: var(--violet-bg); color: var(--violet-fg);
      font-size: var(--fs-xs); font-weight: 600;
    }
    .filter-pill button {
      display: grid; place-items: center; width: 18px; height: 18px;
      border-radius: 50%; border: none; background: rgba(0,0,0,.08);
      color: inherit; cursor: pointer; font-size: 13px; line-height: 1;
    }
    .pad { padding: var(--s-4) 0; display: grid; gap: 10px; }
    .row-sk { height: 38px; }
  `],
})
export class DrilldownGridComponent {
  readonly rows = input.required<DrilldownRow[]>();
  readonly loading = input(false);
  readonly search = input('');
  readonly activeCategory = input<string | null>(null);
  readonly page = input(1);
  readonly limit = input(25);
  readonly total = input(0);

  readonly searchChange = output<string>();
  readonly pageChange = output<number>();
  readonly clearCategory = output<void>();

  protected tone(raw: string | null): BadgeTone {
    return (VALID_TONES as readonly string[]).includes(raw ?? '') ? (raw as BadgeTone) : 'neutral';
  }

  protected date(v: string | null): string {
    if (!v) return '\u2014';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '\u2014' : d.toLocaleDateString(undefined,
      { day: 'numeric', month: 'short', year: 'numeric' });
  }
}