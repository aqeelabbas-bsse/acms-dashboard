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
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class DrilldownService {
  private readonly api = inject(ApiService);

  summary(kind: DrilldownKind, dimension: DrilldownDimension = 'cardCategory'): Observable<DrilldownSummary> {
    return this.api.get<DrilldownSummary>(`/analytics/drilldown/${kind}/summary`, { dimension });
  }

  rows(kind: DrilldownKind, q: DrilldownRowsQuery = {}): Observable<ApiResponse<DrilldownRow[]>> {
    return this.api.getEnvelope<DrilldownRow[]>(`/analytics/drilldown/${kind}/rows`, {
      category: q.category,
      dimension: q.dimension,
      search: q.search,
      page: q.page ?? 1,
      limit: q.limit ?? 25,
    });
  }
}