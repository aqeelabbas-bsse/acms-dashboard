// =============================================================================
// src/app/pages/admin/admin-users.component.ts
// =============================================================================

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
import { SegmentedComponent, SegmentOption } from '../../shared/ui/segmented/segmented.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { UserFormModalComponent } from './user-form-modal.component';

@Component({
  selector: 'acms-admin-users',
  standalone: true,
  imports: [
    GlassCardComponent, SearchInputComponent, PaginatorComponent, EmptyStateComponent,
    SegmentedComponent, IconComponent, UserFormModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Stat tiles. Built inline rather than reusing KpiCardComponent: those
         carry fixed gradient artwork sized for the dashboard's 4-up hero row,
         which reads as visual shouting on a settings screen. -->
    <div class="tiles">
      @for (t of tiles(); track t.label) {
        <acms-glass-card>
          <div class="tile">
            <span class="tile__icon" [attr.data-tone]="t.tone">
              <acms-icon [name]="t.icon" [size]="18" [weight]="2.2" />
            </span>
            <div class="tile__body">
              <span class="tile__value">{{ t.value }}</span>
              <span class="tile__label">{{ t.label }}</span>
            </div>
          </div>
        </acms-glass-card>
      }
    </div>

    <div class="toolbar">
      <acms-search-input [(value)]="search" placeholder="Search username or email..." />
      <acms-segmented [options]="roleOptions" [(value)]="roleFilter" />
      <acms-segmented [options]="statusOptions" [(value)]="statusFilter" />
      <button class="btn btn--primary" type="button" (click)="openCreate()">
        New account
      </button>
    </div>

    @if (error()) {
      <div class="alert" role="alert">
        {{ error() }}
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
        <div class="table-wrap">
          <table class="table">
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
                <tr [class.row--off]="!u.isActive">
                  <td>
                    <div class="acct">
                      <span class="avatar" [attr.data-tone]="tone(u.role)">
                        {{ initials(u.username) }}
                      </span>
                      <div class="acct__text">
                        <span class="acct__name">
                          {{ u.username }}
                          @if (isMe(u)) { <span class="you">you</span> }
                        </span>
                        <span class="acct__mail">{{ u.email || 'No email on file' }}</span>
                      </div>
                    </div>
                  </td>
                  <td><span class="pill" [attr.data-tone]="tone(u.role)">{{ u.role }}</span></td>
                  <td>
                    <span class="pill" [attr.data-tone]="u.isActive ? 'ok' : 'muted'">
                      {{ u.isActive ? 'Active' : 'Deactivated' }}
                    </span>
                  </td>
                  <td class="ta-r">
                    <div class="row-actions">
                      <button class="btn btn--sm" type="button"
                              [disabled]="busyId() === u.id"
                              (click)="openEdit(u)">
                        Edit
                      </button>
                      <button class="btn btn--sm"
                              [class.btn--danger]="u.isActive"
                              type="button"
                              [disabled]="busyId() === u.id || isMe(u)"
                              [attr.title]="isMe(u) ? 'You cannot deactivate your own account' : null"
                              (click)="toggleStatus(u)">
                        @if (busyId() === u.id) {
                          Working...
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

        <div class="pad-sm">
          <acms-paginator
            [page]="page()"
            [limit]="limit"
            [total]="total()"
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
    .tiles {
      display: grid; gap: 14px; margin-bottom: 18px;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    }
    .tile { display: flex; align-items: center; gap: 12px; }
    .tile__icon {
      display: grid; place-items: center; width: 38px; height: 38px;
      border-radius: 11px; flex: none;
      background: color-mix(in srgb, var(--tone, #8B5CF6) 16%, transparent);
      color: var(--tone, #8B5CF6);
    }
    .tile__icon[data-tone="ok"]     { --tone: #10B981; }
    .tile__icon[data-tone="muted"]  { --tone: #64748B; }
    .tile__icon[data-tone="violet"] { --tone: #8B5CF6; }
    .tile__icon[data-tone="rose"]   { --tone: #E11D48; }
    .tile__body { display: grid; }
    .tile__value {
      font-family: var(--font-display, inherit);
      font-size: 1.5rem; font-weight: 700; line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .tile__label { font-size: .76rem; opacity: .75; }

    .toolbar {
      display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
      margin-bottom: 14px;
    }
    .toolbar > acms-search-input { flex: 1 1 240px; }

    .table-wrap { overflow-x: auto; }
    .ta-r { text-align: right; }
    .row--off { opacity: .62; }

    .acct { display: flex; align-items: center; gap: 10px; }
    .avatar {
      display: grid; place-items: center; width: 34px; height: 34px; flex: none;
      border-radius: 50%; font-size: .74rem; font-weight: 700; letter-spacing: .02em;
      background: color-mix(in srgb, var(--tone, #8B5CF6) 20%, transparent);
      color: var(--tone, #8B5CF6);
    }
    .avatar[data-tone="rose"]   { --tone: #E11D48; }
    .avatar[data-tone="violet"] { --tone: #8B5CF6; }
    .avatar[data-tone="blue"]   { --tone: #3B82F6; }
    .avatar[data-tone="cyan"]   { --tone: #0891B2; }
    .avatar[data-tone="muted"]  { --tone: #64748B; }

    .acct__text { display: grid; min-width: 0; }
    .acct__name { font-weight: 600; font-size: .88rem; display: flex; align-items: center; gap: 6px; }
    .acct__mail {
      font-size: .76rem; opacity: .7;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .you {
      font-size: .64rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .06em; padding: 1px 6px; border-radius: 999px;
      background: color-mix(in srgb, currentColor 14%, transparent); opacity: .8;
    }

    .pill {
      display: inline-block; padding: 3px 10px; border-radius: 999px;
      font-size: .74rem; font-weight: 600; white-space: nowrap;
      background: color-mix(in srgb, var(--tone, #64748B) 16%, transparent);
      color: var(--tone, #64748B);
    }
    .pill[data-tone="rose"]   { --tone: #E11D48; }
    .pill[data-tone="violet"] { --tone: #7C3AED; }
    .pill[data-tone="blue"]   { --tone: #2563EB; }
    .pill[data-tone="cyan"]   { --tone: #0E7490; }
    .pill[data-tone="ok"]     { --tone: #047857; }
    .pill[data-tone="muted"]  { --tone: #475569; }

    .row-actions { display: inline-flex; gap: 8px; justify-content: flex-end; }

    .pad-sm { padding: 12px 16px; }

    @media (max-width: 720px) {
      .toolbar > acms-search-input { flex: 1 1 100%; }
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

  readonly roleOptions: SegmentOption[] = [
    { label: 'All roles', value: '' },
    { label: 'Admin', value: 'Admin' },
    { label: 'Security', value: 'Security' },
    { label: 'Printer', value: 'Printer' },
    { label: 'Viewer', value: 'Viewer' },
  ];

  readonly statusOptions: SegmentOption[] = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Deactivated', value: 'inactive' },
  ];

  readonly isFiltered = computed(() =>
    !!this.search().trim() || !!this.roleFilter() || !!this.statusFilter());

  readonly tiles = computed(() => {
    const s = this.stats();
    // `as const` preserves literal string types so they satisfy IconComponent's
    // strict `name` union. 'userX' isn't a registered icon here - reusing
    // 'users' for the Deactivated tile until a dedicated icon is confirmed;
    // the tone colour still carries the distinction visually.
    return [
      { label: 'Total accounts', value: s?.totalUsers ?? '-',   icon: 'users',     tone: 'violet' },
      { label: 'Active',         value: s?.activeUsers ?? '-',  icon: 'userCheck', tone: 'ok' },
      { label: 'Deactivated',    value: s?.inactiveUsers ?? '-',icon: 'users',     tone: 'muted' },
      { label: 'Admins',         value: s?.byRole?.['Admin'] ?? '-', icon: 'shield', tone: 'rose' },
    ] as const;
  });

  private debounce?: ReturnType<typeof setTimeout>;
  private lastFilterKey = '';

  constructor() {
    // Single fetch effect. Reading every filter signal here is what subscribes
    // this effect to them - do not move these reads into the timeout callback,
    // or the effect stops re-running when filters change.
    effect(() => {
      const q: UserQuery = {
        page: this.page(),
        limit: this.limit,
        search: this.search(),
        role: this.roleFilter(),
        status: this.statusFilter() as UserQuery['status'],
      };

      // Any filter change resets to page 1, otherwise you land on an empty
      // page 3 of a two-page result and think the screen is broken.
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

  // --- Data -----------------------------------------------------------------

  private fetch(q: UserQuery): void {
    this.loading.set(true);
    this.error.set(null);

    this.admin.getUsersPage(q).subscribe({
      next: (res) => {
        this.rows.set(res.rows);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.admin.describeError(e));
        this.rows.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }

  private loadStats(): void {
    this.admin.getStats().subscribe({
      next: (s) => this.stats.set(s),
      // A failed stats call must not blank the table - the tiles just show "-".
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

  // --- Actions --------------------------------------------------------------

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

    const ok = await this.askConfirm(
      deactivating ? 'Deactivate account' : 'Reactivate account',
      deactivating
        ? `${u.username} will not be able to sign in. Their record and history are kept, and you can reactivate them at any time.`
        : `${u.username} will be able to sign in again with their existing password.`,
      deactivating ? 'Deactivate' : 'Reactivate',
    );
    if (!ok) return;

    this.busyId.set(u.id);
    this.admin.setStatus(u.id, !u.isActive).subscribe({
      next: () => {
        this.busyId.set(null);
        this.notifyOk(deactivating
          ? `${u.username} deactivated.`
          : `${u.username} reactivated.`);
        this.refresh();
      },
      error: (e) => {
        this.busyId.set(null);
        // The last-admin and self-deactivation rules come back as 409 with a
        // real explanation - show it rather than a generic failure.
        this.notifyErr(this.admin.describeError(e));
      },
    });
  }

  // --- View helpers ---------------------------------------------------------

  tone(role: string): string { return ROLE_TONE[role] ?? 'muted'; }

  isMe(u: AdminUser): boolean {
    return this.auth.username?.() === u.username;
  }

  initials(username: string): string {
    const clean = username.replace(/[^a-zA-Z0-9]/g, '');
    return (clean.slice(0, 2) || '??').toUpperCase();
  }

  // --- Service adapters -----------------------------------------------------
  // If ToastService / ConfirmService signatures differ from these, this is the
  // only place in the file that needs editing.

  private notifyOk(message: string): void { this.toast.success(message); }
  private notifyErr(message: string): void { this.toast.error(message); }

  private askConfirm(title: string, message: string, confirmText: string): Promise<boolean> {
    // FIXED: this codebase's ConfirmRequest doesn't have a confirmText field -
    // only title/message compiled clean. `confirmText` param is kept so
    // toggleStatus() doesn't need editing; it's just unused here until
    // ConfirmService's real shape (button label field, if any) is confirmed.
    void confirmText;
    return this.confirm.ask({ title, message });
  }
}