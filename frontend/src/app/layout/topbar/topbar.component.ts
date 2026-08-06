import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  inject, output, signal, viewChild,
} from '@angular/core';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { NotificationBellComponent } from '../../shared/ui/notification-bell/notification-bell.component';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'acms-topbar',
  standalone: true,
  imports: [IconComponent, NotificationBellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top">
      <button class="burger" type="button" (click)="toggleNav.emit()"
              aria-label="Toggle navigation">
        <acms-icon name="menu" [size]="18" />
      </button>

      <div class="search" [class.on]="focused()">
        <acms-icon name="search" [size]="15" />
        <input #searchInput type="search" aria-label="Search"
               placeholder="Search employees, visitors, cards..."
               (focus)="focused.set(true)" (blur)="focused.set(false)" />
      </div>

      <div class="right">
        <div class="tt" role="group" aria-label="Colour theme">
          <button type="button" [class.on]="theme.resolved() === 'light'"
                  (click)="theme.set('light')" aria-label="Light theme">
            <acms-icon name="sun" [size]="15" [weight]="2" />
          </button>
          <button type="button" [class.on]="theme.resolved() === 'dark'"
                  (click)="theme.set('dark')" aria-label="Dark theme">
            <acms-icon name="moon" [size]="15" [weight]="2" />
          </button>
        </div>

        <!-- FR-RT-03: replaces the old static bell + hardcoded dot. Owns its
             own trigger, badge, and dropdown panel - nothing else in the
             topbar needs to know about it. -->
        <acms-notification-bell />

        <div class="user" (click)="menuOpen.set(!menuOpen())" tabindex="0" role="button"
             (keydown.enter)="menuOpen.set(!menuOpen())" aria-haspopup="menu">
          <div class="avatar">{{ auth.initials() }}</div>
          <div class="meta">
            <div class="name">{{ auth.username() ?? 'Unknown' }}</div>
            <div class="role">{{ auth.role() ?? 'No role' }}</div>
          </div>
          <acms-icon class="caret" name="chevron" [size]="15" [weight]="2" />

          @if (menuOpen()) {
            <div class="menu" role="menu">
              <div class="menu__head">
                <div class="menu__name">{{ auth.username() }}</div>
                <span class="pill pill--violet">{{ auth.role() }}</span>
              </div>
              <button class="menu__item" type="button" (click)="logout($event)">
                <acms-icon name="logout" [size]="16" />
                Sign out
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    .top {
      display: flex; align-items: center; gap: var(--s-4);
      padding: 11px var(--s-4);
      position: sticky; top: 18px; z-index: 20;
      background: var(--glass);
      backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      border: 1px solid var(--glass-border);
      border-radius: var(--r-pill);
      box-shadow: var(--sh-float), var(--glass-inset);
      transition: background var(--t-base) var(--ease);
    }

    .burger {
      display: none; width: 38px; height: 38px; border-radius: 50%;
      place-items: center; border: none; cursor: pointer;
      background: var(--hover-wash); color: var(--ink-soft);
    }

    .search {
      flex: 1; max-width: 420px;
      display: flex; align-items: center; gap: 9px;
      height: 38px; padding: 0 15px;
      border: 1px solid transparent; border-radius: var(--r-pill);
      background: var(--hover-wash); color: var(--ink-dim);
      transition: all var(--t-fast) var(--ease);
    }
    .search.on {
      border-color: rgba(124,108,240,.45);
      box-shadow: 0 0 0 4px rgba(124,108,240,.12);
    }
    .search input {
      flex: 1; min-width: 0;
      border: none; outline: none; background: transparent;
      font-family: var(--font-body); font-size: var(--fs-base); color: var(--ink);
    }
    .search input::placeholder { color: var(--ink-dim); }

    .right { display: flex; align-items: center; gap: var(--s-2); margin-left: auto; }

    .tt { display: flex; gap: 3px; padding: 3px;
          border-radius: var(--r-pill); background: var(--hover-wash); }
    .tt button {
      width: 30px; height: 30px; border-radius: 50%;
      display: grid; place-items: center;
      border: none; background: transparent; color: var(--ink-dim); cursor: pointer;
      transition: all var(--t-base) var(--ease);
    }
    .tt button.on {
      background: var(--glass-strong); color: var(--violet-fg);
      box-shadow: 0 2px 6px rgba(0,0,0,.12);
    }

    .user { position: relative; user-select: none;
      display: flex; align-items: center; gap: 9px;
      padding: 4px 14px 4px 4px; border-radius: var(--r-pill);
      background: var(--hover-wash); cursor: pointer;
    }
    .caret { color: var(--ink-dim); }
    .avatar {
      width: 30px; height: 30px; border-radius: 50%;
      display: grid; place-items: center;
      font-family: var(--font-display); font-weight: 700; font-size: var(--fs-xs);
      color: #fff; background: linear-gradient(135deg, var(--amber), #F76B1C);
    }
    .name { font-size: var(--fs-sm); font-weight: 600; line-height: 1.2; }
    .role { font-size: var(--fs-xs); color: var(--ink-dim); }

    .menu {
      position: absolute; top: calc(100% + 10px); right: 0;
      min-width: 208px; padding: var(--s-2);
      border-radius: var(--r-md);
      border: 1px solid var(--glass-border);
      background: var(--glass-strong);
      backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      box-shadow: var(--sh-lift), var(--glass-inset);
      animation: riseIn var(--t-base) var(--ease) both;
      z-index: 40;
    }
    .menu__head {
      display: flex; align-items: center; justify-content: space-between; gap: var(--s-3);
      padding: var(--s-3); margin-bottom: var(--s-2);
      border-bottom: 1px solid var(--track);
    }
    .menu__name { font-size: var(--fs-sm); font-weight: 600; }
    .menu__item {
      display: flex; align-items: center; gap: var(--s-3);
      width: 100%; padding: 10px var(--s-3);
      border: none; border-radius: var(--r-sm);
      background: transparent; color: var(--ink-soft);
      font-family: var(--font-body); font-size: var(--fs-sm);
      text-align: left; cursor: pointer;
      transition: all var(--t-fast) var(--ease);
    }
    .menu__item:hover { background: var(--danger-bg); color: var(--danger-fg); }

    @media (max-width: 1024px) { .burger { display: grid; } }
    @media (max-width: 820px)  { .search, .meta { display: none; } }
  `],
})
export class TopbarComponent {
  readonly toggleNav = output<void>();

  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly focused = signal(false);
  protected readonly menuOpen = signal(false);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** Ctrl/Cmd + K focuses search. */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.searchInput()?.nativeElement.focus();
    }
  }

  protected logout(event: Event): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.auth.logout();
  }
}