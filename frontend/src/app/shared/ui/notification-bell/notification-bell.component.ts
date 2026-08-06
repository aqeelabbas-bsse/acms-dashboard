// =============================================================================
// src/app/shared/ui/notification-bell/notification-bell.component.ts
// =============================================================================

import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild,
  computed, inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { AcmsNotification } from '../../../core/models/notification.models';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'acms-notification-bell',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <button
        #bell
        class="bell"
        type="button"
        [class.bell--on]="open()"
        [attr.aria-expanded]="open()"
        aria-haspopup="true"
        [attr.aria-label]="ariaLabel()"
        (click)="toggle()">
        <acms-icon name="bell" [size]="17" [weight]="2" />
        @if (notifications.hasUnread()) {
          <span class="badge" [class.badge--wide]="notifications.unreadCount() > 9">
            {{ notifications.unreadCount() > 9 ? '9+' : notifications.unreadCount() }}
          </span>
          <span class="ping" aria-hidden="true"></span>
        }
      </button>

      @if (open()) {
        <div class="panel" role="dialog" aria-label="Notifications">
          <header class="panel__head">
            <div class="panel__titles">
              <span class="panel__title">Notifications</span>
              <span class="panel__sub">
                @if (notifications.hasUnread()) {
                  {{ notifications.unreadCount() }} unread
                } @else {
                  You're all caught up
                }
              </span>
            </div>
            @if (items().length > 0) {
              <div class="panel__acts">
                <button class="link" type="button"
                        [disabled]="!notifications.hasUnread()"
                        (click)="notifications.markAllRead()">
                  Mark all read
                </button>
                <button class="link link--quiet" type="button" (click)="notifications.clearAll()">
                  Clear
                </button>
              </div>
            }
          </header>

          <div class="panel__body">
            @if (items().length === 0) {
              <div class="none">
                <span class="none__icon"><acms-icon name="bell" [size]="20" [weight]="1.8" /></span>
                <span class="none__title">Nothing yet</span>
                <span class="none__msg">
                  Activity relevant to your role will appear here as it happens.
                </span>
              </div>
            } @else {
              @for (group of grouped(); track group.label) {
                <div class="group__label">{{ group.label }}</div>
                <ul class="list">
                  @for (n of group.items; track n.id) {
                    <li>
                      <button
                        class="item"
                        type="button"
                        [class.item--unread]="!n.read"
                        [attr.data-tone]="n.tone"
                        (click)="activate(n)">
                        <span class="item__icon">
                          <acms-icon [name]="n.icon" [size]="15" [weight]="2.1" />
                        </span>
                        <span class="item__body">
                          <span class="item__title">{{ n.title }}</span>
                          @if (n.detail) { <span class="item__detail">{{ n.detail }}</span> }
                          <span class="item__time">{{ relative(n.at) }}</span>
                        </span>
                        @if (!n.read) { <span class="item__dot" aria-hidden="true"></span> }
                      </button>
                    </li>
                  }
                </ul>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .wrap { position: relative; display: inline-flex; }

    /* --- Bell trigger ---------------------------------------------------- */
    .bell {
      position: relative; display: grid; place-items: center;
      width: 36px; height: 36px; border-radius: 11px;
      background: transparent; color: inherit; cursor: pointer;
      border: 1px solid transparent;
      transition: background .18s ease, border-color .18s ease, transform .18s ease;
    }
    .bell:hover {
      background: color-mix(in srgb, currentColor 9%, transparent);
      transform: translateY(-1px);
    }
    .bell--on {
      background: color-mix(in srgb, var(--violet-fg, #8B5CF6) 16%, transparent);
      border-color: color-mix(in srgb, var(--violet-fg, #8B5CF6) 34%, transparent);
      color: var(--violet-fg, #8B5CF6);
    }
    .bell:focus-visible {
      outline: 2px solid var(--violet-fg, #8B5CF6); outline-offset: 2px;
    }

    .badge {
      position: absolute; top: 3px; right: 3px;
      min-width: 16px; height: 16px; padding: 0 4px;
      display: grid; place-items: center;
      border-radius: 999px;
      font-size: .62rem; font-weight: 700; line-height: 1;
      font-variant-numeric: tabular-nums;
      color: #fff;
      background: linear-gradient(135deg, #F43F5E, #D946EF);
      box-shadow: 0 0 0 2px var(--glass, rgba(14,20,40,.9));
    }
    .badge--wide { padding: 0 5px; }

    .ping {
      position: absolute; top: 5px; right: 5px;
      width: 12px; height: 12px; border-radius: 999px;
      background: #F43F5E; opacity: .55;
      animation: ping 2.4s cubic-bezier(0, 0, .2, 1) infinite;
      pointer-events: none;
    }
    @keyframes ping {
      0%        { transform: scale(1);   opacity: .5; }
      70%, 100% { transform: scale(2.1); opacity: 0; }
    }

    /* --- Panel ------------------------------------------------------------
       Deliberately simple: a solid, opaque, theme-correct card. No
       backdrop-filter, no scrim, nothing that can touch anything outside
       this dropdown's own box.

       Colour: an elevated surface should read as a lighter, more saturated
       STEP UP from the base canvas - not just "darker". A near-black panel
       next to a rich blue-violet dashboard looks like a hole in the UI, not
       something floating above it. This is a genuine blue-navy, richer than
       the ambient background, with a faint violet edge tying back to the
       app's accent colour rather than leaning toward black. */
    .panel {
      position: absolute; top: calc(100% + 10px); right: 0; z-index: 95;
      width: min(380px, calc(100vw - 32px));
      border-radius: var(--r-lg, 16px);
      overflow: hidden;

      background: linear-gradient(165deg,
        rgba(30, 41, 82, .97) 0%, rgba(16, 24, 52, .98) 55%, rgba(24, 20, 56, .96) 100%);
      border: 1px solid var(--glass-border);
      box-shadow: var(--sh-lift), var(--glass-inset);

      animation: drop 220ms cubic-bezier(.16, 1, .3, 1);
      transform-origin: top right;
    }
    /* Light theme - same solid-card treatment, correct polarity. */
    :host-context([data-theme='light']) .panel {
      background: linear-gradient(165deg,
        rgba(255, 255, 255, .96) 0%, rgba(248, 248, 252, .98) 60%, rgba(250, 246, 255, .96) 100%);
    }

    @keyframes drop {
      from { opacity: 0; transform: translateY(-8px) scale(.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel { animation: none; }
      .ping  { animation: none; }
    }

    .panel__head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; padding: 13px 15px 11px;
      border-bottom: 1px solid var(--track);
    }
    .panel__titles { display: grid; gap: 2px; }
    .panel__title {
      font-family: var(--font-display, inherit);
      font-size: .92rem; font-weight: 650;
    }
    .panel__sub { font-size: .72rem; color: var(--ink-muted); }
    .panel__acts { display: flex; gap: 10px; flex: none; }

    .link {
      background: none; border: 0; cursor: pointer; padding: 2px 0;
      font-size: .74rem; font-weight: 600; color: var(--violet-fg, #8B5CF6);
    }
    .link:disabled { opacity: .4; cursor: default; }
    .link--quiet { color: var(--ink-muted); font-weight: 500; }
    .link--quiet:hover { color: var(--ink); }

    .panel__body { max-height: min(420px, 60vh); overflow-y: auto; overscroll-behavior: contain; }

    .group__label {
      position: sticky; top: 0; z-index: 1;
      padding: 8px 15px 6px;
      font-size: .66rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
      color: var(--ink-muted);
      background: inherit;
    }

    .list { list-style: none; margin: 0; padding: 0; }

    .item {
      position: relative; width: 100%; text-align: left; cursor: pointer;
      display: flex; align-items: flex-start; gap: 11px;
      padding: 10px 15px;
      background: none; border: 0; color: inherit;
      transition: background .15s ease;
    }
    .item:hover { background: var(--hover-wash); }
    .item:focus-visible { outline: 2px solid var(--violet-fg, #8B5CF6); outline-offset: -2px; }
    .item--unread { background: color-mix(in srgb, var(--violet-fg, #8B5CF6) 8%, transparent); }

    .item__icon {
      display: grid; place-items: center; flex: none;
      width: 30px; height: 30px; border-radius: 9px; margin-top: 1px;
      background: color-mix(in srgb, var(--tone, #64748B) 16%, transparent);
      color: var(--tone, #64748B);
    }
    .item[data-tone="ok"]     { --tone: #059669; }
    .item[data-tone="info"]   { --tone: #2563EB; }
    .item[data-tone="warn"]   { --tone: #B45309; }
    .item[data-tone="danger"] { --tone: #E11D48; }
    .item[data-tone="muted"]  { --tone: #64748B; }

    .item__body { display: grid; gap: 2px; min-width: 0; flex: 1; }
    .item__title { font-size: .81rem; font-weight: 550; line-height: 1.4; }
    .item--unread .item__title { font-weight: 650; }
    .item__detail {
      font-size: .73rem; color: var(--ink-muted); line-height: 1.4;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .item__time { font-size: .69rem; color: var(--ink-dim, var(--ink-muted)); font-variant-numeric: tabular-nums; }

    .item__dot {
      flex: none; align-self: center;
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--violet-fg, #8B5CF6);
    }

    .none {
      display: grid; justify-items: center; gap: 5px;
      padding: 34px 24px; text-align: center;
    }
    .none__icon {
      display: grid; place-items: center; width: 42px; height: 42px;
      border-radius: 13px; margin-bottom: 4px;
      background: var(--hover-wash); color: var(--ink-muted);
    }
    .none__title { font-size: .86rem; font-weight: 600; }
    .none__msg { font-size: .75rem; color: var(--ink-muted); line-height: 1.5; max-width: 24ch; }
  `],
})
export class NotificationBellComponent {
  readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  @ViewChild('bell') bellEl?: ElementRef<HTMLButtonElement>;

  readonly open = signal(false);
  readonly items = this.notifications.items;

  readonly ariaLabel = computed(() => {
    const n = this.notifications.unreadCount();
    return n === 0 ? 'Notifications' : `Notifications, ${n} unread`;
  });

  /** Today / Yesterday / Earlier, in that order, preserving newest-first within each. */
  readonly grouped = computed(() => {
    const buckets: Record<string, AcmsNotification[]> = { Today: [], Yesterday: [], Earlier: [] };
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86_400_000;

    for (const n of this.items()) {
      const t = new Date(n.at).getTime();
      if (t >= startOfToday) buckets['Today'].push(n);
      else if (t >= startOfYesterday) buckets['Yesterday'].push(n);
      else buckets['Earlier'].push(n);
    }

    return (['Today', 'Yesterday', 'Earlier'] as const)
      .filter((label) => buckets[label].length > 0)
      .map((label) => ({ label, items: buckets[label] }));
  });

  toggle(): void { this.open.set(!this.open()); }

  close(returnFocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.bellEl?.nativeElement.focus();
  }

  activate(n: AcmsNotification): void {
    this.notifications.markRead(n.id);
    if (n.route) {
      this.close();
      this.router.navigate([n.route]);
    }
  }

  relative(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';

    const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (secs < 45) return 'just now';
    if (secs < 90) return 'a minute ago';

    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min ago`;

    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;

    const days = Math.round(hrs / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.close(true); }
}