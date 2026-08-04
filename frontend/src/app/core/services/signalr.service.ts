import { Injectable, computed, inject, signal } from '@angular/core';
import {
  HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel,
} from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export type ConnState = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'down';

/** Shape broadcast by AuditBroadcaster on the backend. */
export interface AuditEvent {
  type: string;                 // 'CardVerified' | 'CardPrinted' | 'VisitorCheckIn' | ...
  at: string;                   // ISO timestamp
  cardRequestId?: number;
  visitorId?: number;
  cnic?: string;
  name?: string;
  card?: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private readonly auth = inject(AuthService);
  private hub: HubConnection | null = null;

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
      // WebSocket upgrades don't carry Authorization headers, which is why
      // the backend's OnMessageReceived handler reads ?access_token=.
      .withUrl(`${environment.hubUrl}/audit`, {
        accessTokenFactory: () => this.auth.token() ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
      .configureLogging(LogLevel.Warning)
      .build();

    this.hub.on('AuditEvent', (evt: AuditEvent) => this.push(evt));
    this.hub.on('OccupancyChanged', (count: number) => this._occupancy.set(count));

    this.hub.onreconnecting(() => this._state.set('reconnecting'));
    this.hub.onreconnected(() => this._state.set('live'));
    this.hub.onclose(() => this._state.set('down'));

    this.hub.start()
      .then(() => this._state.set('live'))
      .catch(() => this._state.set('down'));
  }

  disconnect(): void {
    if (this.hub?.state === HubConnectionState.Connected) void this.hub.stop();
    this.hub = null;
    this._state.set('idle');
  }

  /** Newest first, capped so a long session can't grow unbounded. */
  private push(evt: AuditEvent): void {
    this._events.update(list => [evt, ...list].slice(0, 60));
  }

  /** Lets the dashboard seed the counter from the REST call before the
   *  first hub push arrives, so the tile is never blank. */
  seedOccupancy(count: number): void {
    if (this._occupancy() === null) this._occupancy.set(count);
  }
}