import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // The login call itself must never carry a stale token.
  const isLoginRequest = req.url.includes('/auth/login');

  const token = auth.token();
  const request = token && !isLoginRequest
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      // A 401 on login just means "wrong password" - let the form show it.
      // A 401 anywhere else means the session died: clear and redirect.
      if (err.status === 401 && !isLoginRequest) {
        auth.logout(false);
        router.navigate(['/login'], {
          queryParams: { returnUrl: router.url, reason: 'expired' },
        });
      }
      return throwError(() => err);
    }),
  );
};