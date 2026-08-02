import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, LoginResponse, Role } from '../models/api.models';
import { decodeJwt, isExpired, readRole, readUsername } from '../utils/jwt';

const TOKEN_KEY = 'acms_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(this.loadToken());
  readonly token = this._token.asReadonly();

  /** Derived straight from the token - no separate storage to drift. */
  readonly role = computed<Role | null>(() => {
    const t = this._token();
    if (!t) return null;
    const payload = decodeJwt(t);
    return payload ? (readRole(payload) as Role | null) : null;
  });

  readonly username = computed<string | null>(() => {
    const t = this._token();
    if (!t) return null;
    const payload = decodeJwt(t);
    return payload ? readUsername(payload) : null;
  });

  readonly initials = computed(() => {
    const name = this.username();
    if (!name) return '?';
    return name.slice(0, 2).toUpperCase();
  });

  readonly isLoggedIn = computed(() => !isExpired(this._token()));

  login(username: string, password: string): Observable<ApiResponse<LoginResponse>> {
    return this.http
      .post<ApiResponse<LoginResponse>>(`${environment.apiUrl}/auth/login`, { username, password })
      .pipe(tap(res => {
        if (res.success) {
          localStorage.setItem(TOKEN_KEY, res.data.token);
          this._token.set(res.data.token);
        }
      }));
  }

  logout(redirect = true): void {
    localStorage.removeItem(TOKEN_KEY);
    this._token.set(null);
    if (redirect) this.router.navigate(['/login']);
  }

  hasRole(...roles: Role[]): boolean {
    const r = this.role();
    return !!r && roles.includes(r);
  }

  /** Discards an already-expired token so the app starts clean. */
  private loadToken(): string | null {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (isExpired(stored)) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return stored;
  }
}