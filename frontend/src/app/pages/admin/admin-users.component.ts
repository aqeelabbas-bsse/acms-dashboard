import {
  ChangeDetectionStrategy, Component, OnDestroy, ViewChild, computed, effect, inject, signal,
} from '@angular/core';
import { AdminService, UserQuery } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { AuthService } from '../../core/services/auth.service';
import { AdminStats, AdminUser, ROLE_TONE } from '../../core/models/admin.models';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { SearchInputComponent } from '../../shared/ui/search-input/search-input.component';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { IconName } from '../../shared/ui/icon/icons';
import { UserFormModalComponent } from './user-form-modal.component';

/**
 * ── Why this file was rewritten ──────────────────────────────────────────
 * The screen looked like it belonged to a different application, and the
 * cause was concrete rather than a matter of taste: it referenced four CSS
 * custom properties that do not exist in styles.scss — `--line`, `--ease-out`,
 * `--surface-2` and `--accent`. Undefined custom properties fail silently to
 * their fallback, so every border on the page rendered as a flat neutral grey
 * (rgba(127,127,127,…)) that matches neither the light nor the dark theme,
 * and every transition fell back to plain `ease` while the rest of the app
 * uses the shared easing curve.
 *
 * On top of that, sizing was hard-coded in rem (.74rem, .78rem, .86rem)
 * instead of the --fs-* scale, and shadows were hand-rolled rather than
 * --sh-card / --sh-lift. Individually small; together they are exactly why
 * this screen read as unfinished next to the dashboard.
 *
 * Everything here now resolves against real tokens. The other change is
 * structural: the toolbar was two rows — a search row, then a bordered box
 * containing two labelled segmented controls — which is a great deal of
 * furniture for three filters. It is now one row, with the two segmented
 * controls replaced by native selects. Fewer pixels, same capability, and
 * selects scale to more roles without the row wrapping.
 */
@Component({
  selector: 'acms-admin-users',
  standalone: true,
  imports: [
    GlassCardComponent, SearchInputComponent, PaginatorComponent,
    EmptyStateComponent, IconComponent, UserFormModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Stat tiles. Same gradient treatment as the dashboard KPI cards, but
         deliberately shorter: these are reference figures, not the point of
         the screen, so they must not out-weigh the table below them. -->
    <div class="tiles stagger">
      @for (t of tiles(); track t.label) {
        <div class="tile" [attr.data-tone]="t.tone">
          <span class="tile__glow" aria-hidden="true"></span>
          <span class="tile__ic"><acms-icon [name]="t.icon" [size]="16" [weight]="2.2" /></span>
          <div class="tile__body">
            <span class="tile__v">{{ t.value }}</span>
            <span class="tile__l">{{ t.label }}</span>
          </div>
        </div>
      }
    </div>

    <!-- One row. Search takes the free space; the two filters and the primary
         action sit at natural width on the right. -->
    <div class="bar">
      <acms-search-input class="bar__search" [(value)]="search"
                         placeholder="Search username or email..." />

      <label class="sel">
        <span class="sr-only">Filter by role</span>
        <select [value]="roleFilter()" (change)="roleFilter.set(val($event))">
          <option value="">All roles</option>
          <option value="Admin">Admin</option>
          <option value="Security">Security</option>
          <option value="Printer">Printer</option>
          <option value="Viewer">Viewer</option>
        </select>
        <acms-icon name="chevron" [size]="13" [weight]="2.2" class="sel__c" />
      </label>

      <label class="sel">
        <span class="sr-only">Filter by status</span>
        <select [value]="statusFilter()" (change)="statusFilter.set(val($event))">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </select>
        <acms-icon name="chevron" [size]="13" [weight]="2.2" class="sel__c" />
      </label>

      @if (isFiltered()) {
        <button class="clear" type="button" (click)="clearFilters()">
          <acms-icon name="refresh" [size]="13" [weight]="2.2" /> Clear
        </button>
      }

      <button class="btn btn--primary" type="button" (click)="openCreate()">
        <acms-icon name="plus" [size]="14" [weight]="2.4" />
        New account
      </button>
    </div>

    @if (error()) {
      <div class="alert" role="alert">
        <acms-icon name="alert" [size]="16" [weight]="2.2" />
        <span>{{ error() }}</span>
      </div>
    }

    <acms-glass-card [flush]="true">
      @if (loading()) {
        <div class="pad" role="status" aria-live="polite">
          <span class="sr-only">Loading accounts</span>
          @for (i of [1,2,3,4,5]; track i) { <div class="skeleton row-sk"></div> }
        </div>
      } @else if (rows().length === 0) {
        <acms-empty-state
          icon="users"
          title="No accounts found"
          [message]="isFiltered()
            ? 'No accounts match these filters. Clear them to see everyone.'
            : 'No user accounts exist yet. Create the first one above.'" />
      } @else {
        <div class="tbl-wrap">
          <table class="tbl">
            <caption class="sr-only">User accounts, {{ total() }} total</caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col" class="ta-r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (u of rows(); track u.id) {
                <tr [class.off]="!u.isActive">
                  <td>
                    <div class="acct">
                      <span class="av" [attr.data-tone]="tone(u.role)">
                        {{ initials(u.username) }}
                      </span>
                      <span class="acct__t">
                        <span class="acct__n">
                          {{ u.username }}
                          @if (isMe(u)) { <span class="you">you</span> }
                        </span>
                        <span class="acct__m">{{ u.email || 'No email on file' }}</span>
                      </span>
                    </div>
                  </td>
                  <td><span class="pill" [attr.data-tone]="tone(u.role)">{{ u.role }}</span></td>
                  <td>
                    <span class="pill" [attr.data-tone]="u.isActive ? 'ok' : 'muted'">
                      {{ u.isActive ? 'Active' : 'Deactivated' }}
                    </span>
                  </td>
                  <td class="ta-r">
                    <div class="acts">
                      <button class="rb" type="button"
                              [disabled]="busyId() === u.id"
                              (click)="openEdit(u)">Edit</button>
                      <button class="rb"
                              [class.rb--danger]="u.isActive"
                              [class.rb--ok]="!u.isActive"
                              type="button"
                              [disabled]="busyId() === u.id || isMe(u)"
                              [attr.title]="isMe(u) ? 'You cannot deactivate your own account' : null"
                              (click)="toggleStatus(u)">
                        @if (busyId() === u.id) {
                          Working&hellip;
                        } @else {
                          {{ u.isActive ? 'Deactivate' : 'Reactivate' }}
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="foot">
          <span class="cnt">{{ rows().length }} of {{ total() }} account{{ total() === 1 ? '' : 's' }}</span>
          <acms-paginator [page]="page()" [limit]="limit" [total]="total()"
                          (pageChange)="page.set($event)" />
        </div>
      }
    </acms-glass-card>

    <acms-user-form-modal
      #formModal
      [open]="modalOpen()"
      (saved)="onSaved()"
      (closed)="modalOpen.set(false)" />
  `,
  styles: [`
    :host { display: block; }

    /* ---- stat tiles ---- */
    .tiles {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: var(--s-4); margin-bottom: var(--s-5);
    }
    .tile {
      position: relative; overflow: hidden;
      display: flex; align-items: center; gap: 11px;
      padding: 14px var(--s-4); border-radius: var(--r-lg);
      border: 1px solid rgba(255,255,255,.14);
      box-shadow: var(--sh-card), inset 0 1px 0 rgba(255,255,255,.18);
      color: #fff;
      transition: transform var(--t-fast) var(--ease),
                  box-shadow var(--t-fast) var(--ease);
    }
    .tile:hover { transform: translateY(-3px); box-shadow: var(--sh-float); }

    /* Deep, contrast-checked stop where the text sits; vivid stop only in the
       corner the glow occupies. Same formula as the dashboard KPI cards. */
    .tile[data-tone='violet'] { background: linear-gradient(115deg, #4C3BC4 0%, #6D5AE8 58%, #8B5CF6 100%); }
    .tile[data-tone='cyan']   { background: linear-gradient(115deg, #155E75 0%, #0E7490 55%, #22D3EE 100%); }
    .tile[data-tone='rose']   { background: linear-gradient(115deg, #BE123C 0%, #E11D48 58%, #FB7185 100%); }
    /* Desaturated on purpose: this tile reports an "off" state and should
       read quieter than the other three. */
    .tile[data-tone='muted']  { background: linear-gradient(115deg, #334155 0%, #475569 55%, #64748B 100%); }

    .tile__glow {
      position: absolute; top: -36%; right: -18%;
      width: 62%; aspect-ratio: 1; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,.30) 0%, transparent 70%);
      pointer-events: none;
      transition: transform var(--t-slow) var(--ease);
    }
    .tile:hover .tile__glow { transform: scale(1.12); }

    .tile__ic {
      position: relative; z-index: 1; flex-shrink: 0;
      display: grid; place-items: center; width: 34px; height: 34px;
      border-radius: 11px; color: #fff;
      background: rgba(255,255,255,.18);
      border: 1px solid rgba(255,255,255,.22);
      transition: transform var(--t-fast) var(--ease-spring);
    }
    .tile:hover .tile__ic { transform: scale(1.08) rotate(-4deg); }

    .tile__body { position: relative; z-index: 1; display: grid; min-width: 0; }
    .tile__v {
      font-family: var(--font-display); font-size: var(--fs-xl);
      font-weight: 700; line-height: 1.1; color: #fff;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 1px 8px rgba(0,0,0,.2);
    }
    .tile__l { font-size: var(--fs-xs); color: rgba(255,255,255,.82); }

    /* ---- toolbar ---- */
    .bar {
      display: flex; align-items: center; gap: var(--s-2);
      flex-wrap: wrap; margin-bottom: var(--s-5);
    }
    .bar__search { flex: 1 1 240px; min-width: 0; }

    .sel { position: relative; display: inline-flex; align-items: center; }
    .sel select {
      appearance: none; -webkit-appearance: none;
      height: 38px; padding: 0 32px 0 13px;
      border: 1px solid var(--glass-border); border-radius: var(--r-pill);
      background: var(--hover-wash); color: var(--ink-muted);
      font-family: var(--font-body); font-size: var(--fs-sm); font-weight: 600;
      cursor: pointer;
      transition: all var(--t-fast) var(--ease);
    }
    .sel select:hover { background: var(--hover-wash-2); color: var(--ink); }
    .sel select:focus-visible {
      outline: none; border-color: rgba(124,108,240,.55);
      box-shadow: 0 0 0 3px rgba(124,108,240,.14);
    }
    .sel__c { position: absolute; right: 12px; pointer-events: none;
              color: var(--ink-dim); }

    .clear {
      display: inline-flex; align-items: center; gap: 5px;
      height: 38px; padding: 0 13px; border-radius: var(--r-pill);
      border: 1px solid var(--glass-border); background: transparent;
      color: var(--ink-muted); font-family: var(--font-body);
      font-size: var(--fs-sm); font-weight: 600; cursor: pointer;
      transition: all var(--t-fast) var(--ease);
    }
    .clear:hover { color: var(--ink); background: var(--hover-wash); }

    .alert {
      display: flex; align-items: center; gap: 9px;
      margin-bottom: var(--s-4); padding: 11px var(--s-4);
      border-radius: var(--r-md);
      background: var(--danger-bg); color: var(--ink-soft);
      font-size: var(--fs-sm);
    }
    .alert acms-icon { color: var(--danger-fg); flex-shrink: 0; }

    /* ---- table ---- */
    .tbl-wrap { overflow-x: auto; }
    .ta-r { text-align: right; }
    .off { opacity: .58; }

    .acct { display: flex; align-items: center; gap: 10px; }
    .av {
      flex-shrink: 0; display: grid; place-items: center;
      width: 34px; height: 34px; border-radius: 50%;
      font-size: var(--fs-xs); font-weight: 700;
      background: var(--tone-bg); color: var(--tone-fg);
    }
    .av[data-tone='rose']   { --tone-bg: var(--danger-bg);  --tone-fg: var(--danger-fg); }
    .av[data-tone='violet'] { --tone-bg: var(--violet-bg);  --tone-fg: var(--violet-fg); }
    .av[data-tone='blue']   { --tone-bg: var(--info-bg);    --tone-fg: var(--info-fg); }
    .av[data-tone='cyan']   { --tone-bg: var(--teal-bg);    --tone-fg: var(--teal-fg); }
    .av[data-tone='muted']  { --tone-bg: var(--hover-wash-2); --tone-fg: var(--ink-dim); }

    .acct__t { display: grid; min-width: 0; }
    .acct__n { display: flex; align-items: center; gap: 6px;
               font-size: var(--fs-sm); font-weight: 600; color: var(--ink); }
    .acct__m { font-size: var(--fs-xs); color: var(--ink-dim);
               overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .you {
      padding: 1px 7px; border-radius: var(--r-pill);
      background: var(--violet-bg); color: var(--violet-fg);
      font-size: 10px; font-weight: 700; letter-spacing: .05em;
      text-transform: uppercase;
    }

    .pill {
      display: inline-block; padding: 3px 11px; border-radius: var(--r-pill);
      font-size: var(--fs-xs); font-weight: 600; white-space: nowrap;
      background: var(--tone-bg); color: var(--tone-fg);
    }
    .pill[data-tone='rose']   { --tone-bg: var(--danger-bg);  --tone-fg: var(--danger-fg); }
    .pill[data-tone='violet'] { --tone-bg: var(--violet-bg);  --tone-fg: var(--violet-fg); }
    .pill[data-tone='blue']   { --tone-bg: var(--info-bg);    --tone-fg: var(--info-fg); }
    .pill[data-tone='cyan']   { --tone-bg: var(--teal-bg);    --tone-fg: var(--teal-fg); }
    .pill[data-tone='ok']     { --tone-bg: var(--success-bg); --tone-fg: var(--success-fg); }
    .pill[data-tone='muted']  { --tone-bg: var(--hover-wash-2); --tone-fg: var(--ink-dim); }

    /* Edit is routine and quiet; the status toggle is outlined in its semantic
       colour and only fills on hover, so the two never read as equal weight. */
    .acts { display: inline-flex; gap: 7px; justify-content: flex-end; }
    .rb {
      padding: 6px 13px; border-radius: var(--r-pill);
      border: 1px solid var(--glass-border);
      background: transparent; color: var(--ink-muted);
      font-family: var(--font-body); font-size: var(--fs-xs); font-weight: 600;
      line-height: 1.25; cursor: pointer; white-space: nowrap;
      transition: all var(--t-fast) var(--ease);
    }
    .rb:hover:not(:disabled) { background: var(--hover-wash); color: var(--ink); }
    .rb:disabled { opacity: .4; cursor: not-allowed; }
    .rb:focus-visible { outline: 2px solid var(--violet-fg); outline-offset: 1px; }

    .rb--danger { color: var(--danger-fg); border-color: var(--danger-bg); }
    .rb--danger:hover:not(:disabled) { background: var(--danger-bg); color: var(--danger-fg); }
    .rb--ok { color: var(--success-fg); border-color: var(--success-bg); }
    .rb--ok:hover:not(:disabled) { background: var(--success-bg); color: var(--success-fg); }

    .foot {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--s-4); flex-wrap: wrap; padding: 12px var(--s-5);
      border-top: 1px solid var(--track);
    }
    .cnt { font-size: var(--fs-xs); color: var(--ink-dim); }

    .pad { padding: var(--s-5); display: grid; gap: 10px; }
    .row-sk { height: 44px; }

    @media (max-width: 1100px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 720px) {
      .tiles { grid-template-columns: 1fr; }
      .bar__search { flex: 1 1 100%; }
      .bar .btn--primary { flex: 1 1 100%; justify-content: center; }
    }
    @media (prefers-reduced-motion: reduce) {
      .tile, .tile__glow, .tile__ic, .rb, .sel select { transition: none; }
    }
  `],
})
export class AdminUsersComponent implements OnDestroy {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly auth = inject(AuthService);

  @ViewChild('formModal') formModal!: UserFormModalComponent;

  readonly limit = 25;

  readonly rows = signal<AdminUser[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly search = signal('');
  readonly roleFilter = signal('');
  readonly statusFilter = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly modalOpen = signal(false);
  readonly stats = signal<AdminStats | null>(null);

  readonly isFiltered = computed(() =>
    !!this.search().trim() || !!this.roleFilter() || !!this.statusFilter());

  readonly tiles = computed(() => {
    const s = this.stats();
    // `as const` keeps the tone and icon strings as literal types so they
    // satisfy IconComponent's strict `name` union without a cast.
    return [
      { label: 'Total accounts', value: s?.totalUsers ?? '\u2014',    icon: 'users',     tone: 'violet' },
      { label: 'Active',         value: s?.activeUsers ?? '\u2014',   icon: 'userCheck', tone: 'cyan' },
      { label: 'Deactivated',    value: s?.inactiveUsers ?? '\u2014', icon: 'ban',       tone: 'muted' },
      { label: 'Administrators', value: s?.byRole?.['Admin'] ?? '\u2014', icon: 'shield', tone: 'rose' },
    ] as { label: string; value: number | string; icon: IconName; tone: string }[];
  });

  private debounce?: ReturnType<typeof setTimeout>;
  private lastFilterKey = '';

  constructor() {
    // Single fetch effect. Reading every filter signal HERE is what subscribes
    // the effect to them — moving these reads inside the timeout callback would
    // stop the effect re-running when a filter changes.
    effect(() => {
      const q: UserQuery = {
        page: this.page(),
        limit: this.limit,
        search: this.search(),
        role: this.roleFilter(),
        status: this.statusFilter() as UserQuery['status'],
      };

      // Any filter change resets to page 1. Without this you land on an empty
      // page 3 of a two-page result and conclude the screen is broken.
      const key = `${q.search}|${q.role}|${q.status}`;
      if (key !== this.lastFilterKey) {
        this.lastFilterKey = key;
        if (this.page() !== 1) { this.page.set(1); return; }
      }

      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => this.fetch(q), q.search ? 300 : 0);
    });

    this.loadStats();
  }

  ngOnDestroy(): void { clearTimeout(this.debounce); }

  /* ---------------------------------------------------------------- data */

  private fetch(q: UserQuery): void {
    this.loading.set(true);
    this.error.set(null);

    this.admin.getUsersPage(q).subscribe({
      next: res => {
        this.rows.set(res.rows);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: e => {
        this.error.set(this.admin.describeError(e));
        this.rows.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }

  private loadStats(): void {
    this.admin.getStats().subscribe({
      next: s => this.stats.set(s),
      // A failed stats call must not blank the table — the tiles show a dash.
      error: () => this.stats.set(null),
    });
  }

  private refresh(): void {
    this.fetch({
      page: this.page(),
      limit: this.limit,
      search: this.search(),
      role: this.roleFilter(),
      status: this.statusFilter() as UserQuery['status'],
    });
    this.loadStats();
  }

  /* ------------------------------------------------------------- actions */

  protected val(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }

  protected clearFilters(): void {
    this.search.set('');
    this.roleFilter.set('');
    this.statusFilter.set('');
  }

  openCreate(): void {
    this.formModal.prepare(null);
    this.modalOpen.set(true);
  }

  openEdit(u: AdminUser): void {
    this.formModal.prepare(u);
    this.modalOpen.set(true);
  }

  onSaved(): void {
    this.modalOpen.set(false);
    this.refresh();
  }

  async toggleStatus(u: AdminUser): Promise<void> {
    const deactivating = u.isActive;

    const ok = await this.confirm.ask({
      title: deactivating ? 'Deactivate account' : 'Reactivate account',
      message: deactivating
        ? `${u.username} will not be able to sign in. Their record and history are kept, and you can reactivate them at any time.`
        : `${u.username} will be able to sign in again with their existing password.`,
    });
    if (!ok) return;

    this.busyId.set(u.id);
    this.admin.setStatus(u.id, !u.isActive).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(deactivating
          ? `${u.username} deactivated.`
          : `${u.username} reactivated.`);
        this.refresh();
      },
      error: e => {
        this.busyId.set(null);
        // The last-admin and self-deactivation rules come back as 409 with a
        // real explanation — surface it rather than a generic failure.
        this.toast.error(this.admin.describeError(e));
      },
    });
  }

  /* -------------------------------------------------------- view helpers */

  tone(role: string): string { return ROLE_TONE[role] ?? 'muted'; }

  isMe(u: AdminUser): boolean {
    return this.auth.username?.() === u.username;
  }

  initials(username: string): string {
    const clean = username.replace(/[^a-zA-Z0-9]/g, '');
    return (clean.slice(0, 2) || '??').toUpperCase();
  }
}