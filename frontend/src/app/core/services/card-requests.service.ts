import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { CardRequest, CardRequestStatus, CreateCardRequest, Paged } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class CardRequestsService {
  private readonly api = inject(ApiService);

  list(opts: { status?: CardRequestStatus | ''; page?: number; limit?: number } = {})
    : Observable<Paged<CardRequest>> {
    return this.api
      .getEnvelope<CardRequest[]>('/card-requests', {
        status: opts.status,
        page: opts.page ?? 1,
        limit: opts.limit ?? 25,
      })
      .pipe(map(r => ({
        items: r.data ?? [],
        page: Number(r.meta?.['page'] ?? 1),
        total: Number(r.meta?.['total'] ?? 0),
      })));
  }

  submit(body: CreateCardRequest): Observable<CardRequest> {
    return this.api.post<CardRequest>('/card-requests', body);
  }

  verify(id: number): Observable<CardRequest> {
    return this.api.patch<CardRequest>(`/card-requests/${id}/verify`);
  }

  print(id: number): Observable<CardRequest> {
    return this.api.patch<CardRequest>(`/card-requests/${id}/print`);
  }
}