import {
  ChangeDetectionStrategy, Component, OnInit, computed, inject, signal,
} from '@angular/core';
import { SignalrService, AuditEvent } from '../../../core/services/signalr.service';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

type Tone = 'success' | 'info' | 'warn' | 'danger' | 'violet';

interface FeedRow {
  key: string;
  icon: IconName;
  tone: Tone;
  text: string;
  at: string;
}

/**
 * Icon/tone per event type. Keys MUST match the string literals the backend
 * controllers actually pass to IAuditBroadcaster.BroadcastAsync(...) - they
 * previously didn't (CardSubmitted vs the real CardRequestSubmitted,
 * VisitorCheckIn/Out vs the real VisitorCheckedIn/Out), which silently sent
 * every card-submitted and visitor event through the generic fallback and
 * printed the raw type string instead of readable text.
 *
 * No `text` field here anymore - the backend's `description` is already a
 * complete, correct sentence per event, so the feed displays that directly
 * rather than reconstructing a sentence from a second, independently
 * maintained copy of the same information.
 */
const MAP: Record<string, { icon: IconName; tone: Tone }> = {
  CardRequestSubmitted:    { icon: 'card',      tone: 'violet' },
  CardVerified:            { icon: 'check',     tone: 'success' },
  CardPrinted:             { icon: 'printer',   tone: 'info' },
  VisitorCheckedIn:        { icon: 'userCheck', tone: 'info' },
  VisitorCheckedOut:       { icon: 'logout',    tone: 'warn' },
  CardBlocked:             { icon: 'ban',       tone: 'danger' },
  PersonalCardBlocked:     { icon: 'ban',       tone: 'danger' },
  PersonalCardReactivated: { icon: 'check',     tone: 'success' },
};

@Component({
  selector: 'acms-audit-feed',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="feed" role="log" aria-live="polite" aria-label="Live audit events">
      @if (rows().length === 0) {
        <div class="idle">
          <span class="ic"><acms-icon name="activity" [size]="20" /></span>
          <div class="t">{{ idleTitle() }}</div>
          <div class="m">{{ idleMessage() }}</div>
        </div>
      } @else {
        @for (r of rows(); track r.key) {
          <div class="row">
            <span class="ic" [attr.data-tone]="r.tone">
              <acms-icon [name]="r.icon" [size]="14" [weight]="2.2" />
            </span>
            <div class="body">
              <div class="txt">{{ r.text }}</div>
              <div class="time">{{ ago(r.at) }}</div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .feed { display: flex; flex-direction: column; gap: 2px;
            max-height: 320px; overflow-y: auto; }

    .row {
      display: flex; gap: 11px; align-items: flex-start;
      padding: 10px 6px; border-radius: var(--r-sm);
      animation: slideIn var(--t-base) var(--ease) both;
      transition: background var(--t-fast) var(--ease);
    }
    .row:hover { background: var(--hover-wash); }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
    }

    .ic { display: grid; place-items: center; width: 30px; height: 30px;
          border-radius: 10px; flex-shrink: 0; }
    [data-tone='success'] { background: var(--success-bg); color: var(--success-fg); }
    [data-tone='info']    { background: var(--info-bg);    color: var(--info-fg); }
    [data-tone='warn']    { background: var(--warn-bg);    color: var(--warn-fg); }
    [data-tone='danger']  { background: var(--danger-bg);  color: var(--danger-fg); }
    [data-tone='violet']  { background: var(--violet-bg);  color: var(--violet-fg); }

    .body { min-width: 0; }
    .txt { font-size: var(--fs-sm); color: var(--ink-soft); }
    .txt b { color: var(--ink); font-weight: 600; }
    .time { font-size: var(--fs-xs); color: var(--ink-dim); margin-top: 1px; }

    .idle {
      display: grid; place-items: center; gap: 6px;
      padding: var(--s-10) var(--s-4); text-align: center;
    }
    .idle .ic { width: 44px; height: 44px; border-radius: var(--r-md);
                background: var(--info-bg); color: var(--info-fg); }
    .idle .t { font-family: var(--font-display); font-weight: 600;
               font-size: var(--fs-base); color: var(--ink-muted); }
    .idle .m { font-size: var(--fs-xs); color: var(--ink-dim); max-width: 32ch; }

    @media (prefers-reduced-motion: reduce) { .row { animation: none; } }
  `],
})
export class AuditFeedComponent implements OnInit {
  private readonly hub = inject(SignalrService);

  protected readonly rows = computed<FeedRow[]>(() =>
    this.hub.events().map((e, i) => this.toRow(e, i)));

  protected readonly idleTitle = computed(() =>
    this.hub.state() === 'live' ? 'Listening for events'
      : this.hub.state() === 'reconnecting' ? 'Reconnecting'
      : this.hub.state() === 'down' ? 'Feed disconnected'
      : 'Connecting');

  protected readonly idleMessage = computed(() =>
    this.hub.state() === 'live'
      ? 'Verify a card or check a visitor in to see it appear here instantly.'
      : this.hub.state() === 'down'
        ? 'The real-time connection dropped. It will retry automatically.'
        : 'Establishing the real-time connection...');

  /** Re-render relative timestamps once a minute without touching the data. */
  private readonly tick = signal(0);

  ngOnInit(): void {
    this.hub.connect();
    setInterval(() => this.tick.update(t => t + 1), 60_000);
  }

  private toRow(e: AuditEvent, i: number): FeedRow {
    const m = MAP[e.type] ?? { icon: 'activity' as IconName, tone: 'info' as Tone };
    // Fallback only fires for a genuinely unmapped type, which should now be
    // rare - and even then description (composed server-side) is still shown
    // rather than the bare machine type string.
    const text = e.description || e.type;
    return { key: `${e.at}-${e.type}-${i}`, icon: m.icon, tone: m.tone, text, at: e.at };
  }

  protected ago(iso: string): string {
    this.tick();                      // dependency: forces refresh on tick
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (secs < 10) return 'Just now';
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
}