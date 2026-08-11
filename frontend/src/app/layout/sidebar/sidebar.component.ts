import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { IconName } from '../../shared/ui/icon/icons';
import { Role } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';

interface NavItem { label: string; path: string; icon: IconName; roles?: Role[]; }
interface NavGroup { title: string; items: NavItem[]; }

/**
 * ── On the removed "Ask ACMS" card ───────────────────────────────────────
 * The sidebar used to end with a violet promo card whose only function was to
 * open the assistant. The floating orb in the bottom-right corner already does
 * exactly that, from every screen, and stays visible when the sidebar is
 * collapsed on narrow viewports — so the card was a second entry point to the
 * same panel, occupying the largest block of colour in the navigation and
 * competing with the nav items for attention.
 *
 * Removing it leaves the orb as the single entry point (its tooltip carries
 * the "query in plain English" line the card used to make) and gives the
 * sidebar room for the Help group.
 *
 * The `askAgent` output is kept on the component so ShellComponent's existing
 * binding does not break, and so a future contextual "ask about this screen"
 * affordance has somewhere to attach.
 */
@Component({
  selector: 'acms-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="side" [class.open]="open()">
      <div class="brand">
        <div class="mark">A</div>
        <div>
          <div class="bname">ACMS</div>
          <div class="bsub">Access Control</div>
        </div>
      </div>

      <nav class="nav-wrap">
        @for (g of groups; track g.title) {
          <div class="group">{{ g.title }}</div>
          @for (item of g.items; track item.path) {
            @if (!item.roles || auth.hasRole(...item.roles)) {
              <a class="nav" [routerLink]="item.path"
                 routerLinkActive="active"
                 [routerLinkActiveOptions]="{ exact: false }"
                 (click)="navigate.emit()">
                <acms-icon [name]="item.icon" [size]="18" />
                <span>{{ item.label }}</span>
              </a>
            }
          }
        }
      </nav>

      <div class="foot">
        <span class="foot__v">ACMS Dashboard v1.0</span>
        <span class="foot__o">NASTP</span>
      </div>
    </aside>
  `,
  styles: [`
    .side {
      width: var(--sidebar-w); flex-shrink: 0;
      align-self: flex-start; position: sticky; top: 18px;
      height: calc(100vh - 36px);
      display: flex; flex-direction: column;
      padding: var(--s-5) var(--s-4);
      background: var(--glass);
      backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      border: 1px solid var(--glass-border);
      border-radius: var(--r-xl);
      box-shadow: var(--sh-float), var(--glass-inset);
      transition: background var(--t-base) var(--ease),
                  transform var(--t-base) var(--ease);
    }

    .brand { display: flex; align-items: center; gap: 11px; padding: 4px 6px var(--s-6); }
    .mark {
      width: 38px; height: 38px; border-radius: 13px; flex-shrink: 0;
      display: grid; place-items: center;
      font-family: var(--font-display); font-weight: 700; font-size: 16px; color: #fff;
      background: linear-gradient(135deg, var(--violet), var(--blue));
      box-shadow: var(--sh-brand);
    }
    .bname { font-family: var(--font-display); font-weight: 700; font-size: 15px; }
    .bsub { font-size: var(--fs-xs); color: var(--ink-dim); font-weight: 500; }

    .nav-wrap { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
    .group {
      font-size: 10px; font-weight: 700; letter-spacing: .09em;
      text-transform: uppercase; color: var(--ink-dim);
      padding: var(--s-4) 10px 7px;
    }
    .group:first-child { padding-top: 2px; }

    .nav {
      display: flex; align-items: center; gap: 11px;
      padding: 10px 12px; border-radius: 13px;
      color: var(--ink-soft); font-size: var(--fs-base); font-weight: 500;
      text-decoration: none; cursor: pointer;
      transition: all var(--t-fast) var(--ease);
    }
    .nav acms-icon { opacity: .72; flex-shrink: 0; }
    .nav:hover { background: var(--hover-wash); color: var(--ink); }
    .nav:focus-visible { outline: 2px solid var(--violet-fg); outline-offset: -2px; }
    .nav.active {
      background: linear-gradient(135deg, rgba(124,108,240,.18), rgba(62,142,247,.12));
      color: var(--violet-fg); font-weight: 600;
      box-shadow: inset 0 0 0 1px rgba(124,108,240,.22);
    }
    .nav.active acms-icon { opacity: 1; }

    /* Replaces the promo card: a quiet build stamp that grounds the panel
       without competing with the navigation above it. */
    .foot {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: 8px; margin-top: var(--s-4); padding: var(--s-4) 12px 4px;
      border-top: 1px solid var(--track);
    }
    .foot__v { font-size: var(--fs-xs); color: var(--ink-dim); }
    .foot__o { font-size: 10px; font-weight: 700; letter-spacing: .08em;
               text-transform: uppercase; color: var(--ink-dim); opacity: .7; }

    @media (max-width: 1024px) {
      .side {
        position: fixed; top: 18px; left: 18px; z-index: 60;
        height: calc(100vh - 36px);
        transform: translateX(calc(-100% - 24px));
      }
      .side.open { transform: translateX(0); }
    }
  `],
})
export class SidebarComponent {
  readonly open = input(false);
  readonly navigate = output<void>();
  /** Retained for ShellComponent's existing binding; no longer fired here. */
  readonly askAgent = output<void>();

  protected readonly auth = inject(AuthService);

  protected readonly groups: NavGroup[] = [
    { title: 'Overview', items: [
      { label: 'Dashboard', path: '/dashboard', icon: 'grid' },
    ]},
    // Split into two groups so the personal and visitor card populations are
    // never presented as one pool. They are separate tables, separate
    // lifecycles, and separate day-to-day jobs - the sidebar should say so.
    { title: 'Personnel', items: [
      { label: 'Employees',     path: '/employees',     icon: 'users' },
      { label: 'Card requests', path: '/card-requests', icon: 'card' },
      { label: 'Personal RFID', path: '/personal-rfid', icon: 'rfid' },
    ]},
    { title: 'Visitors', items: [
      { label: 'Visitor log',   path: '/visitors',      icon: 'userCheck' },
      { label: 'Visitor RFID',  path: '/visitor-rfid',  icon: 'rfid' },
    ]},
    { title: 'System', items: [
      { label: 'Admin', path: '/admin', icon: 'shield', roles: ['Admin'] },
    ]},
    { title: 'Help', items: [
      { label: 'FAQ & User Guide', path: '/help', icon: 'help' },
    ]},
  ];
}