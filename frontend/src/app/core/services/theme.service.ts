import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'acms_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly systemDark = signal(false);

  /** What the user chose. 'system' means follow the OS. */
  readonly mode = signal<ThemeMode>(this.loadMode());

  /** What is actually rendered right now. */
  readonly resolved = computed<'light' | 'dark'>(() => {
    const m = this.mode();
    if (m === 'system') return this.systemDark() ? 'dark' : 'light';
    return m;
  });

  constructor() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemDark.set(mq.matches);
    mq.addEventListener('change', e => this.systemDark.set(e.matches));

    // One write re-themes everything, because every colour is a token.
    effect(() => {
      this.doc.documentElement.setAttribute('data-theme', this.resolved());
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  toggle(): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private loadMode(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system';
  }
}