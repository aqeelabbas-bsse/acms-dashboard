import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api.models';
import {
  DrilldownDimension, DrilldownKind, DrilldownRow, DrilldownSummary,
} from '../models/drilldown.models';

export interface DrilldownRowsQuery {
  category?: string;
  dimension?: DrilldownDimension;
  /** Free text. Searches every searchable column unless `field` narrows it. */
  q?: string;
  /** A column key from summary.columns, or 'all'. */
  field?: string;
  /** ISO yyyy-MM-dd. Inclusive. */
  from?: string;
  /** ISO yyyy-MM-dd. Inclusive - the server pushes it to end of day. */
  to?: string;
  status?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class DrilldownService {
  private readonly api = inject(ApiService);

  summary(
    kind: DrilldownKind,
    dimension: DrilldownDimension = 'cardCategory',
  ): Observable<DrilldownSummary> {
    return this.api.get<DrilldownSummary>(`/analytics/drilldown/${kind}/summary`, { dimension });
  }

  rows(kind: DrilldownKind, q: DrilldownRowsQuery = {}): Observable<ApiResponse<DrilldownRow[]>> {
    // Undefined keys are dropped by ApiService rather than sent as the literal
    // string "undefined", so an empty filter genuinely means "no filter".
    return this.api.getEnvelope<DrilldownRow[]>(`/analytics/drilldown/${kind}/rows`, {
      category: q.category,
      dimension: q.dimension,
      q: q.q,
      field: q.field,
      from: q.from,
      to: q.to,
      status: q.status,
      sort: q.sort,
      dir: q.dir,
      page: q.page ?? 1,
      limit: q.limit ?? 25,
    });
  }
}