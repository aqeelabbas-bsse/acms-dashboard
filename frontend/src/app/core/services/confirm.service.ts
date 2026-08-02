import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface Pending extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<Pending | null>(null);

  /** Returns a promise that settles true/false when the user chooses. */
  ask(req: ConfirmRequest): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this.pending.set({ ...req, resolve });
    });
  }

  settle(ok: boolean): void {
    const p = this.pending();
    this.pending.set(null);
    p?.resolve(ok);
  }
}