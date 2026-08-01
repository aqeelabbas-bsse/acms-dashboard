import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  inject, output, signal, viewChild,
} from '@angular/core';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'acms-topbar',
  standalone: true,
  imports: [IconComponent],
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

        <button class="circle" type="button" aria-label="Notifications">
          <acms-icon name="bell" [size]="17" />
          <span class="badge"></span>
        </button>

        <div class="user">
          <div class="avatar">{{ auth.initials() }}</div>
          <div class="meta">
            <div class="name">{{ auth.username() }}</div>
            <div class="role">{{ auth.role() ?? 'Not signed in' }}</div>
          </div>
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

    .circle {
      position: relative; width: 38px; height: 38px; border-radius: 50%;
      display: grid; place-items: center; border: none; cursor: pointer;
      background: var(--hover-wash); color: var(--ink-soft);
      transition: background var(--t-fast) var(--ease);
    }
    .circle:hover { background: var(--hover-wash-2); }
    .badge {
      position: absolute; top: 8px; right: 9px;
      width: 7px; height: 7px; border-radius: 50%; background: var(--rose);
    }

    .user {
      display: flex; align-items: center; gap: 9px;
      padding: 4px 14px 4px 4px; border-radius: var(--r-pill);
      background: var(--hover-wash); cursor: pointer;
    }
    .avatar {
      width: 30px; height: 30px; border-radius: 50%;
      display: grid; place-items: center;
      font-family: var(--font-display); font-weight: 700; font-size: var(--fs-xs);
      color: #fff; background: linear-gradient(135deg, var(--amber), #F76B1C);
    }
    .name { font-size: var(--fs-sm); font-weight: 600; line-height: 1.2; }
    .role { font-size: var(--fs-xs); color: var(--ink-dim); }

    @media (max-width: 1024px) { .burger { display: grid; } }
    @media (max-width: 820px)  { .search, .meta { display: none; } }
  `],
})
export class TopbarComponent {
  readonly toggleNav = output<void>();

  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly focused = signal(false);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** Ctrl/Cmd + K focuses search. */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.searchInput()?.nativeElement.focus();
    }
  }
}