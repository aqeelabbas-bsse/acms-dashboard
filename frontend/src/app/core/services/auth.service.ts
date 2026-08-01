import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, LoginResponse, Role } from '../models/api.models';

const TOKEN_KEY = 'acms_token';
const ROLE_KEY = 'acms_role';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _role = signal<Role | null>(localStorage.getItem(ROLE_KEY) as Role | null);

  readonly token = this._token.asReadonly();
  readonly role = this._role.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  readonly username = signal<string>('Aqeel Abbas');  // real value arrives in Phase 9
  readonly initials = computed(() =>
    this.username().split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase());

  login(username: string, password: string): Observable<ApiResponse<LoginResponse>> {
    return this.http
      .post<ApiResponse<LoginResponse>>(`${environment.apiUrl}/auth/login`, { username, password })
      .pipe(tap(res => {
        if (res.success) {
          localStorage.setItem(TOKEN_KEY, res.data.token);
          localStorage.setItem(ROLE_KEY, res.data.role ?? '');
          this._token.set(res.data.token);
          this._role.set(res.data.role);
        }
      }));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    this._token.set(null);
    this._role.set(null);
  }

  hasRole(...roles: Role[]): boolean {
    const r = this._role();
    return !!r && roles.includes(r);
  }
}