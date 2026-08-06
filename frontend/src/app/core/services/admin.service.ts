// =============================================================================
// src/app/core/services/admin.service.ts
// Phase 14 - Admin Console.
//
// One method per /v1/admin endpoint. Follows the same shape as
// visitor-rfid.service.ts and employees.service.ts from Phase 10: inject
// ApiService, return Observables, no state held here.
//
// NOTE ON PAGINATION: getUsers() needs the `meta.total` value, which
// ApiService.get<T>() unwraps away (it returns `data` only). If your ApiService
// has a raw/envelope method already, use it. If not, `getUsersPage()` below
// uses HttpClient directly for that one call - see the comment there.
// =============================================================================

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import {
  AcmsRole,
  AdminStats,
  AdminUser,
  AdminUserDetail,
  CreateUserPayload,
  UpdateUserPayload,
} from '../models/admin.models';

export interface UserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: 'active' | 'inactive' | '';
}

export interface UserPage {
  rows: AdminUser[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  // --- Reads ---------------------------------------------------------------

  /**
   * Paginated user list. Uses HttpClient directly (not ApiService) because the
   * paginator needs `meta.total`, and ApiService deliberately unwraps the
   * envelope down to `data`. Same reason the employees list handles its own
   * meta in Phase 10.
   */
  getUsersPage(q: UserQuery = {}): Observable<UserPage> {
    let params = new HttpParams()
      .set('page', String(q.page ?? 1))
      .set('limit', String(q.limit ?? 25));

    if (q.search?.trim()) params = params.set('search', q.search.trim());
    if (q.role) params = params.set('role', q.role);
    if (q.status) params = params.set('status', q.status);

    return this.http
      .get<{ data: AdminUser[]; meta?: { total?: number } }>(
        `${environment.apiUrl}/admin/users`,
        { params },
      )
      .pipe(
        map((res) => ({
          rows: res.data ?? [],
          total: res.meta?.total ?? res.data?.length ?? 0,
        })),
      );
  }

  getUser(id: string): Observable<AdminUserDetail> {
    return this.api.get<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`);
  }

  getStats(): Observable<AdminStats> {
    return this.api.get<AdminStats>('/admin/stats');
  }

  getRoles(): Observable<string[]> {
    return this.api.get<string[]>('/admin/roles');
  }

  // --- Writes --------------------------------------------------------------

  createUser(payload: CreateUserPayload): Observable<AdminUserDetail> {
    return this.api.post<AdminUserDetail>('/admin/users', payload);
  }

  updateUser(id: string, payload: UpdateUserPayload): Observable<AdminUserDetail> {
    return this.api.patch<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`, payload);
  }

  setRole(id: string, role: AcmsRole): Observable<AdminUserDetail> {
    return this.api.patch<AdminUserDetail>(
      `/admin/users/${encodeURIComponent(id)}/role`,
      { role },
    );
  }

  setStatus(id: string, isActive: boolean): Observable<AdminUserDetail> {
    return this.api.patch<AdminUserDetail>(
      `/admin/users/${encodeURIComponent(id)}/status`,
      { isActive },
    );
  }

  resetPassword(id: string, newPassword: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(
      `/admin/users/${encodeURIComponent(id)}/reset-password`,
      { newPassword },
    );
  }

  // --- Error translation ----------------------------------------------------

  /**
   * The controller returns real, actionable messages for the self-protection
   * rules (last admin, self-deactivation). Surface those verbatim rather than
   * flattening everything to "Something went wrong" - same approach
   * agent.service.ts takes with UNSAFE_QUERY.
   */
  describeError(err: unknown): string {
    const e = err as { status?: number; error?: { error?: { code?: string; message?: string } } };
    const api = e?.error?.error;

    if (api?.message) return api.message;

    switch (e?.status) {
      case 401: return 'Your session expired. Sign in again.';
      case 403: return 'Only an Admin can manage user accounts.';
      case 409: return 'That change conflicts with an existing account.';
      case 0:   return 'Cannot reach the API. Is the backend running?';
      default:  return 'Something went wrong. Try again.';
    }
  }
}