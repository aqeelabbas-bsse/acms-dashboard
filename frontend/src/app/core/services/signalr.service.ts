import { Injectable, computed, inject, signal } from '@angular/core';
import {
  HubConnection, HubConnectionBuilder, HubConnectionState, IRetryPolicy,
  LogLevel, RetryContext,
} from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export type ConnState = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'down';

/**
 * Normalised shape used everywhere in the app.
 *
 * The wire shape from AuditBroadcaster is actually
 *   { type, description, actor, at, payload }
 * with type-specific extras (id, cnic, crid, card...) nested under `payload`,
 * NOT flat on the event. `description` is a complete, already-professional
 * sentence composed server-side per event (e.g. "Bilal Ahmed checked out") -
 * it is the thing to display, not something to reconstruct from field guesses.
 *
 * `normaliseEvent()` below does the flattening once, here, so every consumer
 * (notification bell, live feed, anything added later) works off the same
 * correct data instead of each guessing at field names independently.
 */
export interface AuditEvent {
  type: string;
  description: string;
  actor?: string;
  at: string;
  cardRequestId?: number;
  visitorId?: number;
  cnic?: string;
  name?: string;
  card?: string;
  [key: string]: unknown;
}

interface RawAuditEvent {
  type?: unknown;
  description?: unknown;
  actor?: unknown;
  at?: unknown;
  payload?: unknown;
}

function normaliseEvent(raw: unknown): AuditEvent {
  const r = (raw ?? {}) as RawAuditEvent;
  const payload = r.payload && typeof r.payload === 'object'
    ? (r.payload as Record<string, unknown>)
    : {};

  return {
    ...payload,
    type: typeof r.type === 'string' ? r.type : 'Unknown',
    description: typeof r.description === 'string' ? r.description : '',
    actor: typeof r.actor === 'string' ? r.actor : undefined,
    at: typeof r.at === 'string' ? r.at : new Date().toISOString(),
  };
}

/**
 * SignalR's built-in withAutomaticReconnect([...]) gives up permanently once
 * the array of delays is exhausted (~37s across 5 attempts here). During dev,
 * a backend restart that takes longer than that leaves the client dead until
 * a manual page reload - which is exactly what happened this session while
 * restarting the API for the Ollama migration.
 *
 * This policy never gives up: it backs off exponentially, capped at 30s, and
 * keeps trying indefinitely. In production this is the right default too -
 * a brief backend redeploy shouldn't require every open tab to be refreshed.
 */
class UnlimitedBackoffRetryPolicy implements IRetryPolicy {
  nextRetryDelayInMilliseconds(retryContext: RetryContext): number {
    return Math.min(30_000, 1000 * 2 ** retryContext.previousRetryCount);
  }
}

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private readonly auth = inject(AuthService);
  private hub: HubConnection | null = null;
  private visibilityBound = false;

  private readonly _state = signal<ConnState>('idle');
  private readonly _events = signal<AuditEvent[]>([]);
  private readonly _occupancy = signal<number | null>(null);

  readonly state = this._state.asReadonly();
  readonly events = this._events.asReadonly();
  readonly occupancy = this._occupancy.asReadonly();
  readonly isLive = computed(() => this._state() === 'live');

  /** Idempotent - safe to call from several components. */
  connect(): void {
    if (this.hub) return;

    const token = this.auth.token();
    if (!token) { this._state.set('down'); return; }

    this._state.set('connecting');

    this.hub = new HubConnectionBuilder()
      .withUrl(`${environment.hubUrl}/audit`, {
        accessTokenFactory: () => this.auth.token() ?? '',
      })
      .withAutomaticReconnect(new UnlimitedBackoffRetryPolicy())
      .configureLogging(LogLevel.Warning)
      .build();

    this.hub.on('AuditEvent', (raw: unknown) => this.push(normaliseEvent(raw)));
    this.hub.on('OccupancyChanged', (payload: unknown) =>
      this._occupancy.set(readCount(payload)));

    this.hub.onreconnecting(() => this._state.set('reconnecting'));
    this.hub.onreconnected(() => this._state.set('live'));

    // onclose fires both when withAutomaticReconnect gives up (shouldn't
    // happen now, but defensive) and when .stop() was called deliberately
    // via disconnect(). Only auto-recover in the former case.
    this.hub.onclose(() => {
      this._state.set('down');
      if (this.hub) this.scheduleManualRecovery();
    });

    this.startWithRetry();
    this.bindVisibilityRecovery();
  }

  disconnect(): void {
    const wasHub = this.hub;
    this.hub = null; // clear first so onclose's recovery check sees null and no-ops
    if (wasHub?.state === HubConnectionState.Connected) void wasHub.stop();
    this._state.set('idle');
  }

  /** Newest first, capped so a long session can't grow unbounded. */
  private push(evt: AuditEvent): void {
    this._events.update(list => [evt, ...list].slice(0, 60));
  }

  seedOccupancy(count: number): void {
    if (this._occupancy() !== null) return;
    const n = readCount(count);
    if (n !== null) this._occupancy.set(n);
  }

  /** Covers the case where the very first .start() fails (e.g. backend not
   *  up yet on page load) - withAutomaticReconnect only kicks in AFTER a
   *  connection has been successfully established once. */
  private startWithRetry(attempt = 0): void {
    if (!this.hub) return;

    this.hub.start()
      .then(() => this._state.set('live'))
      .catch(() => {
        this._state.set('down');
        const delay = Math.min(30_000, 1000 * 2 ** attempt);
        setTimeout(() => this.startWithRetry(attempt + 1), delay);
      });
  }

  /** Belt-and-suspenders: if onclose fires and the built-in policy somehow
   *  didn't already recover, force a fresh connection attempt. */
  private scheduleManualRecovery(): void {
    setTimeout(() => {
      if (this._state() === 'down') {
        this.hub = null;
        this.connect();
      }
    }, 5000);
  }

  /** A laptop going to sleep/resuming, or a backgrounded tab, can leave the
   *  socket dead without onclose ever firing cleanly. Checking on tab focus
   *  catches that case too. */
  private bindVisibilityRecovery(): void {
    if (this.visibilityBound || typeof document === 'undefined') return;
    this.visibilityBound = true;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this._state() === 'down') {
        this.hub = null;
        this.connect();
      }
    });
  }
}

function readCount(payload: unknown): number | null {
  const raw =
    typeof payload === 'number'
      ? payload
      : payload && typeof payload === 'object'
        ? ((payload as Record<string, unknown>)['onSiteNow']
            ?? (payload as Record<string, unknown>)['count'])
        : undefined;

  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}