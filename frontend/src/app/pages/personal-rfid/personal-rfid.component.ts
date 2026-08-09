import {
  ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PersonalRfidService } from '../../core/services/personal-rfid.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  BLOCK_REASON_LABELS, BlockReasonOption, PersonalRfid, PersonalRfidStatus,
} from '../../core/models/personal-rfid.models';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent, BadgeTone } from '../../shared/ui/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SegmentedComponent, SegmentOption } from '../../shared/ui/segmented/segmented.component';
import { SearchInputComponent } from '../../shared/ui/search-input/search-input.component';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

/**
 * Staff RFID cards (dbo.PersonalRFID).
 *
 * The visitor equivalent lives at /visitor-rfid. Keeping them as two screens
 * rather than one filtered screen is the fix for "personal and visitor cards are
 * mixed up" — a Security officer revoking a departed employee's badge and one
 * revoking a contractor's day pass are doing different jobs with different
 * consequences, and the UI should not make them look interchangeable.
 */
@Component({
  selector: 'acms-personal-rfid',
  standalone: true,
  imports: [
    ReactiveFormsModule, GlassCardComponent, PageHeaderComponent, StatusBadgeComponent,
    EmptyStateComponent, ModalComponent, SegmentedComponent, SearchInputComponent,
    PaginatorComponent, IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <acms-page-header eyebrow="Access control" title="Personal RFID cards"
                      subtitle="Staff card-to-personnel mapping, issuance and revocation">
      <acms-segmented [options]="scopes" [(value)]="scope" />
    </acms-page-header>

    @if (error()) {
      <div class="alert" role="alert"><acms-icon name="alert" [size]="16" /> {{ error() }}</div>
    }

    <section class="tiles stagger">
      <div class="tile"><span class="k">{{ total() }}</span><span class="v">Cards in this view</span></div>
      <div class="tile"><span class="k ok">{{ activeCount() }}</span><span class="v">Active on page</span></div>
      <div class="tile"><span class="k bad">{{ blockedCount() }}</span><span class="v">Blocked on page</span></div>
    </section>

    <acms-glass-card [flush]="true">
      <div class="toolbar">
        <acms-search-input [(value)]="search"
                           placeholder="Search by CNIC or card number..." />
      </div>

      @if (loading()) {
        <div class="pad" role="status" aria-live="polite">
          <span class="sr-only">Loading staff cards</span>
          @for (i of [1,2,3,4,5]; track i) { <div class="skeleton row-sk"></div> }
        </div>
      } @else if (rows().length === 0) {
        <acms-empty-state icon="rfid" title="No personal cards"
          message="No staff RFID cards match this view." />
      } @else {
        <div class="tbl-wrap">
          <table class="tbl">
            <caption class="sr-only">Staff RFID cards, holders and block status</caption>
            <thead>
              <tr>
                <th scope="col">Holder</th>
                <th scope="col">Card number</th>
                <th scope="col">Status</th>
                <th scope="col">Access</th>
                <th scope="col">Activated</th>
                <th scope="col" class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (c of rows(); track c.regId) {
                <tr>
                  <td>
                    <div class="strong">{{ c.holderName || 'Unknown holder' }}</div>
                    <div class="sub mono">{{ c.cnic || '&mdash;' }}</div>
                  </td>
                  <td class="mono">{{ c.smartCardNo || '&mdash;' }}</td>
                  <td>
                    <acms-status-badge [dot]="true"
                      [label]="statusLabel(c)" [tone]="statusTone(c)" />
                    @if (c.isBlocked && c.blockReason) {
                      <div class="sub">{{ reasonLabel(c.blockReason) }}</div>
                    }
                  </td>
                  <td>
                    <acms-status-badge
                      [label]="c.fullAccess === 1 ? 'Full access' : 'Escorted'"
                      [tone]="c.fullAccess === 1 ? 'info' : 'neutral'" />
                  </td>
                  <td>{{ date(c.activationDate) || '&mdash;' }}</td>
                  <td class="right">
                    <div class="actions">
                      @if (auth.hasRole('Admin', 'Security')) {
                        @if (c.isBlocked) {
                          <button class="btn btn--ghost btn--sm" type="button"
                                  (click)="openReactivate(c)">
                            <acms-icon name="check" [size]="13" /> Reactivate
                          </button>
                        } @else {
                          <button class="btn btn--danger btn--sm" type="button"
                                  (click)="openBlock(c)">
                            <acms-icon name="ban" [size]="13" /> Block
                          </button>
                        }
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <acms-paginator [(page)]="page" [limit]="limit" [total]="total()" />
      }
    </acms-glass-card>

    <!-- Block: category is required, which is what makes the
         "blocked cards, reason-wise" drill-down possible at all. -->
    @if (blocking(); as card) {
      <acms-modal title="Block staff card"
                  [subtitle]="'Revoking access for ' + (card.holderName || card.cnic || 'this holder')"
                  [width]="500" (close)="blocking.set(null)">
        <div class="warn">
          <acms-icon name="alert" [size]="16" />
          <span>This immediately revokes site access for this staff card. Both a
                category and a written reason are recorded against the card and
                appear in the blocked-cards analytics.</span>
        </div>

        <form [formGroup]="blockForm" class="form-grid" novalidate>
          <label class="fld">
            <span class="fld__lab">Category <span class="req">*</span></span>
            <select formControlName="category" [class.bad]="badBlock('category')">
              <option value="" disabled>Select a reason category...</option>
              @for (r of reasons(); track r.code) {
                <option [value]="r.code">{{ r.label }}</option>
              }
            </select>
            @if (badBlock('category')) {
              <span class="fld__err">Choose a category</span>
            }
          </label>

          <label class="fld">
            <span class="fld__lab">Details <span class="req">*</span></span>
            <textarea formControlName="reason" [class.bad]="badBlock('reason')"
                      placeholder="Badge not returned after final working day"></textarea>
            @if (badBlock('reason')) {
              <span class="fld__err">At least 5 characters required</span>
            }
          </label>
        </form>

        @if (saveError()) {
          <div class="alert mt" role="alert"><acms-icon name="alert" [size]="15" /> {{ saveError() }}</div>
        }

        <div modalFooter>
          <button class="btn btn--ghost" type="button" (click)="blocking.set(null)">Cancel</button>
          <button class="btn btn--danger" type="button" [disabled]="saving()" (click)="confirmBlock()">
            {{ saving() ? 'Blocking...' : 'Block card' }}
          </button>
        </div>
      </acms-modal>
    }

    @if (reactivating(); as card) {
      <acms-modal title="Reactivate staff card"
                  [subtitle]="'Restoring access for ' + (card.holderName || card.cnic || 'this holder')"
                  [width]="460" (close)="reactivating.set(null)">
        <div class="warn">
          <acms-icon name="alert" [size]="16" />
          <span>This restores site access. The original block reason is kept in
                the card history rather than erased.</span>
        </div>

        <form [formGroup]="reactivateForm" class="form-grid" novalidate>
          <label class="fld">
            <span class="fld__lab">Reason <span class="req">*</span></span>
            <textarea formControlName="reason" [class.bad]="badReactivate('reason')"
                      placeholder="Badge recovered and re-verified by security"></textarea>
            @if (badReactivate('reason')) {
              <span class="fld__err">At least 5 characters required</span>
            }
          </label>
        </form>

        @if (saveError()) {
          <div class="alert mt" role="alert"><acms-icon name="alert" [size]="15" /> {{ saveError() }}</div>
        }

        <div modalFooter>
          <button class="btn btn--ghost" type="button" (click)="reactivating.set(null)">Cancel</button>
          <button class="btn" type="button" [disabled]="saving()" (click)="confirmReactivate()">
            {{ saving() ? 'Reactivating...' : 'Reactivate card' }}
          </button>
        </div>
      </acms-modal>
    }
  `,
  styles: [`
    :host { display: block; }
    .alert {
      display: flex; align-items: center; gap: 9px;
      margin-bottom: var(--s-5); padding: 12px var(--s-5);
      border-radius: var(--r-md);
      background: var(--danger-bg); color: var(--danger-fg); font-size: var(--fs-sm);
    }
    .alert.mt { margin: var(--s-4) 0 0; }

    .tiles { display: grid; grid-template-columns: repeat(3, 1fr);
             gap: var(--s-5); margin-bottom: var(--s-5); }
    .tile {
      display: grid; gap: 2px;
      padding: var(--s-5); border-radius: var(--r-lg);
      border: 1px solid var(--glass-border);
      background: var(--glass-strong);
      backdrop-filter: blur(var(--blur-surface)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--blur-surface)) saturate(180%);
      box-shadow: var(--sh-card), var(--glass-inset);
    }
    .k { font-family: var(--font-display); font-size: var(--fs-xl);
         font-weight: 700; line-height: 1.1;
         background: var(--num-grad); -webkit-background-clip: text;
         background-clip: text; -webkit-text-fill-color: transparent; }
    .k.ok  { background: none; -webkit-text-fill-color: var(--success-fg); }
    .k.bad { background: none; -webkit-text-fill-color: var(--danger-fg); }
    .v { font-size: var(--fs-sm); color: var(--ink-muted); }
    @media (max-width: 720px) { .tiles { grid-template-columns: 1fr; } }

    .toolbar { padding: var(--s-5) var(--s-5) 0; }
    .sub { font-size: var(--fs-xs); color: var(--ink-muted); margin-top: 2px; }

    .warn {
      display: flex; gap: 10px; align-items: flex-start;
      margin-bottom: var(--s-5); padding: 12px var(--s-4);
      border-radius: var(--r-sm);
      background: var(--warn-bg); color: var(--warn-fg);
      font-size: var(--fs-sm); line-height: 1.5;
    }
    .warn acms-icon { flex-shrink: 0; margin-top: 1px; }

    .pad { padding: var(--s-6); display: grid; gap: 10px; }
    .row-sk { height: 44px; }
  `],
})
export class PersonalRfidComponent implements OnInit {
  private readonly svc = inject(PersonalRfidService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly rows = signal<PersonalRfid[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly scope = signal('all');
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly limit = 25;

  protected readonly reasons = signal<BlockReasonOption[]>(
    Object.entries(BLOCK_REASON_LABELS)
      .filter(([code]) => code !== 'Unspecified')
      .map(([code, label]) => ({ code, label })));

  protected readonly blocking = signal<PersonalRfid | null>(null);
  protected readonly reactivating = signal<PersonalRfid | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly scopes: SegmentOption[] = [
    { label: 'All',      value: 'all' },
    { label: 'Active',   value: 'active' },
    { label: 'Blocked',  value: 'blocked' },
    { label: 'Inactive', value: 'inactive' },
  ];

  protected readonly activeCount = computed(() =>
    this.rows().filter(c => c.isActive && !c.isBlocked).length);
  protected readonly blockedCount = computed(() =>
    this.rows().filter(c => c.isBlocked).length);

  protected readonly blockForm = this.fb.nonNullable.group({
    category: ['', [Validators.required]],
    reason: ['', [Validators.required, Validators.minLength(5)]],
  });

  protected readonly reactivateForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(5)]],
  });

  constructor() {
    // Any filter change resets to page 1 — otherwise a narrowed result set can
    // leave the user stranded on a page that no longer exists, showing an empty
    // grid that looks like "no data" rather than "wrong page".
    effect(() => {
      this.scope();
      this.search();
      this.page.set(1);
    });

    effect(() => {
      const scope = this.scope();
      const search = this.search();
      const page = this.page();
      this.fetch(scope, search, page);
    });
  }

  ngOnInit(): void {
    // Server list is authoritative; the constant map is only a fallback so the
    // dropdown is never empty if this call fails.
    this.svc.blockReasons().subscribe({
      next: list => { if (list?.length) this.reasons.set(list); },
      error: () => { /* fallback already seeded */ },
    });
  }

  private fetch(scope: string, search: string, page: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.svc.list({
      status: scope as PersonalRfidStatus,
      search: search || undefined,
      page,
      limit: this.limit,
    }).subscribe({
      next: env => {
        this.rows.set(env.data ?? []);
        this.total.set(readTotal(env.meta) ?? env.data?.length ?? 0);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.error?.message ?? 'Could not load staff RFID cards.');
        this.rows.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }

  protected statusLabel(c: PersonalRfid): string {
    return c.isBlocked ? 'Blocked' : c.isActive ? 'Active' : 'Inactive';
  }

  protected statusTone(c: PersonalRfid): BadgeTone {
    return c.isBlocked ? 'danger' : c.isActive ? 'success' : 'neutral';
  }

  protected reasonLabel(code: string): string {
    return this.reasons().find(r => r.code === code)?.label
        ?? BLOCK_REASON_LABELS[code]
        ?? code;
  }

  protected date(v: string | null): string {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined,
      { day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected badBlock(control: string): boolean {
    const c = this.blockForm.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected badReactivate(control: string): boolean {
    const c = this.reactivateForm.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected openBlock(c: PersonalRfid): void {
    this.blockForm.reset({ category: '', reason: '' });
    this.saveError.set(null);
    this.blocking.set(c);
  }

  protected openReactivate(c: PersonalRfid): void {
    this.reactivateForm.reset({ reason: '' });
    this.saveError.set(null);
    this.reactivating.set(c);
  }

  protected confirmBlock(): void {
    const card = this.blocking();
    if (!card) return;
    if (this.blockForm.invalid) { this.blockForm.markAllAsTouched(); return; }

    const { category, reason } = this.blockForm.getRawValue();
    this.saving.set(true);
    this.saveError.set(null);

    this.svc.block(card.regId, category, reason).subscribe({
      next: () => {
        this.saving.set(false);
        this.blocking.set(null);
        this.toast.success('Card blocked', this.reasonLabel(category));
        this.fetch(this.scope(), this.search(), this.page());
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(err?.error?.error?.message ?? 'Could not block this card.');
      },
    });
  }

  protected confirmReactivate(): void {
    const card = this.reactivating();
    if (!card) return;
    if (this.reactivateForm.invalid) { this.reactivateForm.markAllAsTouched(); return; }

    this.saving.set(true);
    this.saveError.set(null);

    this.svc.reactivate(card.regId, this.reactivateForm.getRawValue().reason).subscribe({
      next: () => {
        this.saving.set(false);
        this.reactivating.set(null);
        this.toast.success('Card reactivated');
        this.fetch(this.scope(), this.search(), this.page());
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(err?.error?.error?.message ?? 'Could not reactivate this card.');
      },
    });
  }
}

/** `meta` is loosely typed on the envelope; read `total` without an `any` cast. */
function readTotal(meta: Record<string, unknown> | undefined): number | null {
  const t = meta?.['total'];
  return typeof t === 'number' && Number.isFinite(t) ? t : null;
}