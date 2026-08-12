import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EtlRow, FunnelStats, KpiSummary } from '../models/api.models';
import { ApiService } from './api.service';

/** Shape returned by POST /v1/analytics/etl/run. */
export interface EtlRunResult {
  from: string;
  to: string;
  daysProcessed: number;
  cardRequestsRead: number;
  visitsRead: number;
  durationMs: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly api = inject(ApiService);

  getSummary(): Observable<KpiSummary> {
    return this.api.get<KpiSummary>('/analytics/summary');
  }

  getFunnel(from?: string, to?: string): Observable<FunnelStats> {
    return this.api.get<FunnelStats>('/analytics/funnel', { from, to });
  }

  getTraffic(from?: string, to?: string): Observable<EtlRow[]> {
    return this.api.get<EtlRow[]>('/analytics/traffic', { from, to });
  }

  getDailyCards(from?: string, to?: string): Observable<EtlRow[]> {
    return this.api.get<EtlRow[]>('/analytics/daily-cards', { from, to });
  }

  /**
   * Admin-only. Rebuilds the three summary tables the trend charts read from.
   *
   * The endpoint takes lookbackDays as a query parameter rather than a body,
   * so the POST body is empty — passing `{}` here would send a JSON object the
   * controller does not bind and does not expect.
   */
  runEtl(lookbackDays = 90): Observable<EtlRunResult> {
    return this.api.post<EtlRunResult>(
      `/analytics/etl/run?lookbackDays=${lookbackDays}`, null);
  }
}