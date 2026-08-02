import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'danger' | 'info' | 'warn';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  private push(tone: ToastTone, title: string, message?: string, ms = 4500): void {
    const id = ++this.seq;
    this.toasts.update(list => [...list, { id, tone, title, message }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  success(title: string, message?: string): void { this.push('success', title, message); }
  info(title: string, message?: string): void { this.push('info', title, message); }
  warn(title: string, message?: string): void { this.push('warn', title, message, 6000); }
  /** Errors linger - the user needs time to read what went wrong. */
  error(title: string, message?: string): void { this.push('danger', title, message, 8000); }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}