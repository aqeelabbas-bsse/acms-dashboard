import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { IconName } from '../../shared/ui/icon/icons';
import { Role } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';

interface NavItem { label: string; path: string; icon: IconName; roles?: Role[]; }
interface NavGroup { title: string; items: NavItem[]; }

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

      <div class="cta">
        <div class="cta-row">
          <acms-icon name="sparkle" [size]="15" [weight]="2" />
          <span>Ask ACMS</span>
        </div>
        <p>Query access data in plain English - no SQL needed.</p>
        <button type="button" (click)="askAgent.emit()">Open assistant</button>
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
    .nav.active {
      background: linear-gradient(135deg, rgba(124,108,240,.18), rgba(62,142,247,.12));
      color: var(--violet-fg); font-weight: 600;
      box-shadow: inset 0 0 0 1px rgba(124,108,240,.22);
    }
    .nav.active acms-icon { opacity: 1; }

    .cta {
      margin-top: var(--s-4); padding: var(--s-4);
      border-radius: var(--r-md); position: relative; overflow: hidden;
      background: linear-gradient(150deg, #7C6CF0, #5B4CD6 60%, #3E8EF7);
      color: #fff; box-shadow: var(--sh-brand);
    }
    .cta::after {
      content: ''; position: absolute; top: -30%; right: -20%;
      width: 140px; height: 140px; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,.32), transparent 70%);
    }
    .cta-row { display: flex; align-items: center; gap: 7px;
               font-weight: 600; font-size: var(--fs-sm);
               position: relative; z-index: 1; }
    .cta p { margin: 6px 0 var(--s-3); font-size: var(--fs-xs);
             line-height: 1.5; opacity: .9; position: relative; z-index: 1; }
    .cta button {
      position: relative; z-index: 1; width: 100%; padding: 9px;
      border: none; border-radius: 11px;
      background: rgba(255,255,255,.22); color: #fff;
      font-weight: 600; font-size: var(--fs-sm); cursor: pointer;
      transition: background var(--t-fast) var(--ease);
    }
    .cta button:hover { background: rgba(255,255,255,.34); }

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
  readonly askAgent = output<void>();

  protected readonly auth = inject(AuthService);

  protected readonly groups: NavGroup[] = [
    { title: 'Overview', items: [
      { label: 'Dashboard', path: '/dashboard', icon: 'grid' },
    ]},
    { title: 'Access control', items: [
      { label: 'Employees',     path: '/employees',     icon: 'users' },
      { label: 'Card requests', path: '/card-requests', icon: 'card' },
      { label: 'Visitors',      path: '/visitors',      icon: 'userCheck' },
      { label: 'RFID cards',    path: '/rfid',          icon: 'rfid' },
    ]},
    { title: 'System', items: [
      { label: 'Admin', path: '/admin', icon: 'shield', roles: ['Admin'] },
    ]},
  ];
}