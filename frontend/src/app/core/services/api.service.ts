import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';

type ParamMap = Record<string, string | number | boolean | undefined | null>;

/**
 * Thin wrapper over HttpClient. Unwraps the { success, data, meta } envelope
 * so feature services deal in domain types, not transport shapes.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  private toParams(params?: ParamMap): HttpParams {
    let p = new HttpParams();
    if (!params) return p;
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    }
    return p;
  }

  get<T>(path: string, params?: ParamMap): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(`${environment.apiUrl}${path}`, { params: this.toParams(params) })
      .pipe(map(r => r.data));
  }

  /** Use when you need `meta` (pagination totals) alongside `data`. */
  getEnvelope<T>(path: string, params?: ParamMap): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(`${environment.apiUrl}${path}`, {
      params: this.toParams(params),
    });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(`${environment.apiUrl}${path}`, body)
      .pipe(map(r => r.data));
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .patch<ApiResponse<T>>(`${environment.apiUrl}${path}`, body)
      .pipe(map(r => r.data));
  }
}