import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { CreateVisitorRequest, Paged, Visitor } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class VisitorsService {
  private readonly api = inject(ApiService);

  list(opts: { search?: string; onSite?: boolean; page?: number; limit?: number } = {})
    : Observable<Paged<Visitor>> {
    return this.api
      .getEnvelope<Visitor[]>('/visitors', {
        search: opts.search,
        onSite: opts.onSite,
        page: opts.page ?? 1,
        limit: opts.limit ?? 25,
      })
      .pipe(map(r => ({
        items: r.data ?? [],
        page: Number(r.meta?.['page'] ?? 1),
        total: Number(r.meta?.['total'] ?? 0),
      })));
  }

  onSite(): Observable<Visitor[]> {
    return this.api.get<Visitor[]>('/onsite');
  }

  register(body: CreateVisitorRequest): Observable<Visitor> {
    return this.api.post<Visitor>('/visitors', body);
  }

  checkout(id: number): Observable<Visitor> {
    return this.api.patch<Visitor>(`/visitors/${id}/checkout`);
  }
}