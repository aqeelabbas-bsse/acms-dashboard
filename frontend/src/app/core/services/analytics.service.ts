import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EtlRow, FunnelStats, KpiSummary } from '../models/api.models';
import { ApiService } from './api.service';

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
}