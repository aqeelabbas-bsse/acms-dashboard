import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import {
  CreateEmployeeRequest, EmployeeDetail, EmployeeListItem, Paged,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private readonly api = inject(ApiService);

  list(opts: { search?: string; isActive?: boolean; page?: number; limit?: number } = {})
    : Observable<Paged<EmployeeListItem>> {
    return this.api
      .getEnvelope<EmployeeListItem[]>('/employees', {
        search: opts.search,
        isActive: opts.isActive,
        page: opts.page ?? 1,
        limit: opts.limit ?? 25,
      })
      .pipe(map(r => ({
        items: r.data ?? [],
        page: Number(r.meta?.['page'] ?? 1),
        total: Number(r.meta?.['total'] ?? 0),
      })));
  }

  getOne(cnic: string): Observable<EmployeeDetail> {
    return this.api.get<EmployeeDetail>(`/employees/${encodeURIComponent(cnic)}`);
  }

  create(body: CreateEmployeeRequest): Observable<EmployeeDetail> {
    return this.api.post<EmployeeDetail>('/employees', body);
  }

  update(cnic: string, body: Partial<CreateEmployeeRequest>): Observable<EmployeeDetail> {
    return this.api.patch<EmployeeDetail>(`/employees/${encodeURIComponent(cnic)}`, body);
  }
}