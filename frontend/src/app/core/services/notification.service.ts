// =============================================================================
// src/app/core/services/notification.service.ts
// =============================================================================

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SignalrService } from './signalr.service';
import { AuthService } from './auth.service';
import {
  AcmsNotification, EVENT_RULES, FALLBACK_RULE, MAX_NOTIFICATIONS, isInterested,
} from '../models/notification.models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly signalr = inject(SignalrService);
  private readonly auth = inject(AuthService);

  private readonly _items = signal<AcmsNotification[]>([]);

  /** Newest first. */
  readonly items = this._items.asReadonly();

  readonly unreadCount = computed(() => this._items().filter((n) => !n.read).length);
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  /** Dedupe guard. SignalR can redeliver on reconnect. */
  private readonly seen = new Set<string>();

  /** Identity the in-memory list currently belongs to. `undefined` until first run. */
  private activeUser: string | null | undefined = undefined;

  constructor() {
    // NotificationService is a root singleton, so without this it survives
    // sign-out. Storage was already keyed per user (correct), but the
    // in-memory `_items` signal was only ever loaded once at app boot -
    // switching accounts in the same tab kept showing the PREVIOUS user's
    // already-rendered notifications until a full page reload. Watching
    // username and reloading from that user's own key on change closes that
    // gap the same way AgentService's per-role chat reset does.
    effect(() => {
      const user = this.currentUsername();
      if (user !== this.activeUser) {
        this.activeUser = user;
        this.switchIdentity();
      }
    });

    effect(() => {
      const raw = this.signalr.events();
      if (!Array.isArray(raw) || raw.length === 0) return;
      this.ingestFrom(raw);
    });
  }

  /** Swaps the in-memory list to whatever is stored under the new user's key. */
  private switchIdentity(): void {
    this._items.set([]);
    this.seen.clear();
    this.restore();
  }

  // --- Ingestion ------------------------------------------------------------

  private ingestFrom(raw: unknown[]): void {
    const role = this.currentRole();
    const fresh: AcmsNotification[] = [];

    for (const e of raw) {
      const n = this.toNotification(e, role);
      if (!n) continue;
      if (this.seen.has(n.id)) continue;
      this.seen.add(n.id);
      fresh.push(n);
    }

    if (fresh.length === 0) return;

    // Sort newest-first within the batch, then prepend.
    fresh.sort((a, b) => b.at.localeCompare(a.at));

    this._items.update((prev) => [...fresh, ...prev].slice(0, MAX_NOTIFICATIONS));
    this.persist();
  }

  /**
   * Tolerant mapper. Field names vary slightly between the Phase 5 controllers
   * and the Phase 14 AdminController, so every field has fallbacks rather than
   * assuming one exact shape.
   */
  private toNotification(e: unknown, role: string | null): AcmsNotification | null {
    const ev = e as Record<string, unknown>;
    const type = String(ev?.['type'] ?? ev?.['Type'] ?? '').trim();
    if (!type) return null;

    // Role scoping happens at ingestion, not at render, so an irrelevant event
    // never contributes to the unread badge in the first place.
    if (!isInterested(role, type)) return null;

    const subject = String(
      ev?.['subject'] ?? ev?.['Subject'] ??
      ev?.['username'] ?? ev?.['name'] ??
      ev?.['cardRequestId'] ?? ev?.['card'] ?? '',
    ).trim();

    const detailRaw = ev?.['detail'] ?? ev?.['Detail'] ?? ev?.['remarks'] ?? null;
    const detail = detailRaw == null || detailRaw === '' ? null : String(detailRaw);

    const atRaw = ev?.['at'] ?? ev?.['At'] ?? ev?.['timestamp'] ?? null;
    const at = this.toIso(atRaw);

    const rule = EVENT_RULES[type] ?? FALLBACK_RULE;

    // The backend composes a complete, correct sentence server-side
    // (e.g. "Bilal Ahmed checked out") and sends it as `description` - use it
    // directly rather than reassembling one from a subject the payload may
    // not even carry. rule.label() stays as a fallback for the rare case a
    // description is genuinely missing, so nothing ever silently blanks out.
    const description = String(ev?.['description'] ?? ev?.['Description'] ?? '').trim();
    const title = description || rule.label(subject || 'a record');

    return {
      id: `${type}|${subject}|${at}`,
      type,
      title,
      detail,
      at,
      tone: rule.tone,
      icon: rule.icon,
      route: rule.route,
      read: false,
    };
  }

  private toIso(v: unknown): string {
    if (typeof v === 'string') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    // A missing timestamp must not collapse every event into one dedupe key,
    // so fall back to "now" rather than a constant.
    return new Date().toISOString();
  }

  // --- Commands -------------------------------------------------------------

  markRead(id: string): void {
    this._items.update((list) =>
      list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    this.persist();
  }

  markAllRead(): void {
    if (!this.hasUnread()) return;
    this._items.update((list) => list.map((n) => ({ ...n, read: true })));
    this.persist();
  }

  clearAll(): void {
    this._items.set([]);
    this.seen.clear();
    this.persist();
  }

  // --- Persistence ----------------------------------------------------------
  //
  // Keyed per user so signing in as a different role doesn't inherit someone
  // else's read state. Cap of 50 keeps this well under any localStorage
  // pressure while covering more history than anyone scrolls in one sitting.
  //
  // Same XSS trade-off already accepted for the JWT (doc-gap #27). Nothing
  // sensitive is stored here beyond names already visible in the UI.

  private storageKey(): string {
    return `acms_notifications_v1:${this.currentUsername() ?? 'anon'}`;
  }

  private persist(): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(this._items()));
    } catch {
      // Quota or private-mode failure must never break the UI. Notifications
      // simply become session-only.
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) return;

      const parsed = JSON.parse(raw) as AcmsNotification[];
      if (!Array.isArray(parsed)) return;

      const clean = parsed.filter((n) => n && typeof n.id === 'string').slice(0, MAX_NOTIFICATIONS);
      clean.forEach((n) => this.seen.add(n.id));
      this._items.set(clean);
    } catch {
      localStorage.removeItem(this.storageKey());
    }
  }

  // --- Auth adapters --------------------------------------------------------
  // AuthService exposes role/username as signals (Phase 9 Step 2 rewrite). If
  // yours are plain properties, drop the ?.() here - these two methods are the
  // only place this file touches AuthService.

  private currentRole(): string | null {
    return (this.auth.role?.() as string | null) ?? null;
  }

  private currentUsername(): string | null {
    return (this.auth.username?.() as string | null) ?? null;
  }
}