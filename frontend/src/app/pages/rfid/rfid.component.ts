import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { VisitorRfidService } from '../../core/services/visitor-rfid.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { VisitorRfid } from '../../core/models/api.models';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent, BadgeTone } from '../../shared/ui/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SegmentedComponent, SegmentOption } from '../../shared/ui/segmented/segmented.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

@Component({
  selector: 'acms-rfid',
  standalone: true,
  imports: [
    ReactiveFormsModule, GlassCardComponent, PageHeaderComponent, StatusBadgeComponent,
    EmptyStateComponent, ModalComponent, SegmentedComponent, IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <acms-page-header eyebrow="Access control" title="RFID cards"
                      subtitle="Card status and access revocation">
      <acms-segmented [options]="scopes" [(value)]="scope" />
    </acms-page-header>

    @if (error()) {
      <div class="alert" role="alert"><acms-icon name="alert" [size]="16" /> {{ error() }}</div>
    }

    <section class="tiles stagger">
      <div class="tile"><span class="k">{{ rows().length }}</span><span class="v">Total cards</span></div>
      <div class="tile"><span class="k ok">{{ activeCount() }}</span><span class="v">Active</span></div>
      <div class="tile"><span class="k bad">{{ blockedCount() }}</span><span class="v">Blocked</span></div>
    </section>

    <acms-glass-card [flush]="true">
      @if (loading()) {
        <div class="pad" role="status" aria-live="polite">
          <span class="sr-only">Loading records</span>
          @for (i of [1,2,3,4]; track i) { <div class="skeleton row-sk"></div> }
        </div>
      } @else if (rows().length === 0) {
        <acms-empty-state icon="rfid" title="No RFID cards"
          message="No cards match this view." />
      } @else {
        <div class="tbl-wrap">
          <table class="tbl">
            <caption class="sr-only">RFID cards and their block status</caption>
            <thead>
              <tr>
                <th scope="col">Card number</th>
                <th scope="col">Status</th>
                <th scope="col">Presence</th>
                <th scope="col">Activated</th>
                <th scope="col" class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (c of rows(); track c.smartCardNo) {
                <tr>
                  <td class="mono strong">{{ c.smartCardNo }}</td>
                  <td>
                    <acms-status-badge [dot]="true"
                      [label]="statusLabel(c)" [tone]="statusTone(c)" />
                  </td>
                  <td>
                    <acms-status-badge
                      [label]="c.checkStatus ? 'Checked in' : 'Not present'"
                      [tone]="c.checkStatus ? 'info' : 'neutral'" />
                  </td>
                  <td>{{ date(c.activeDate) || '&mdash;' }}</td>
                  <td class="right">
                    <div class="actions">
                      @if (!c.isBlocked && auth.hasRole('Admin', 'Security')) {
                        <button class="btn btn--danger btn--sm" type="button"
                                (click)="openBlock(c)">
                          <acms-icon name="ban" [size]="13" /> Block
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </acms-glass-card>

    @if (blocking(); as card) {
      <acms-modal title="Block RFID card"
                  [subtitle]="'Revoking access for ' + card.smartCardNo"
                  [width]="460" (close)="blocking.set(null)">
        <div class="warn">
          <acms-icon name="alert" [size]="16" />
          <span>This immediately revokes site access for this card. A reason is
                mandatory and is recorded against the card.</span>
        </div>

        <form [formGroup]="form" class="form-grid" novalidate>
          <label class="fld">
            <span class="fld__lab">Reason <span class="req">*</span></span>
            <textarea formControlName="reason" [class.bad]="bad('reason')"
                      placeholder="Security incident - unauthorized area access"></textarea>
            @if (bad('reason')) {
              <span class="fld__err">At least 5 characters required</span>
            }
          </label>
        </form>

        @if (saveError()) { <div class="alert mt" role="alert"><acms-icon name="alert" [size]="15" /> {{ saveError() }}</div> }

        <div modalFooter>
          <button class="btn btn--ghost" type="button" (click)="blocking.set(null)">Cancel</button>
          <button class="btn btn--danger" type="button" [disabled]="saving()" (click)="confirmBlock()">
            {{ saving() ? 'Blocking...' : 'Block card' }}
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

    .warn {
      display: flex; gap: 10px; align-items: flex-start;
      margin-bottom: var(--s-5); padding: 12px var(--s-4);
      border-radius: var(--r-sm);
      background: var(--warn-bg); color: var(--warn-fg);
      font-size: var(--fs-sm); line-height: 1.5;
    }
    .warn acms-icon { flex-shrink: 0; margin-top: 1px; }

    .pad { padding: var(--s-6); display: grid; gap: 10px; }
    .row-sk { height: 40px; }
  `],
})
export class RfidComponent {
  private readonly svc = inject(VisitorRfidService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly rows = signal<VisitorRfid[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly scope = signal('');

  protected readonly blocking = signal<VisitorRfid | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly scopes: SegmentOption[] = [
    { label: 'All cards', value: '' },
    { label: 'Blocked', value: 'true' },
  ];

  protected readonly activeCount = computed(() =>
    this.rows().filter(c => !c.isBlocked).length);
  protected readonly blockedCount = computed(() =>
    this.rows().filter(c => c.isBlocked).length);

  protected readonly form = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(5)]],
  });

  constructor() {
    effect(() => { const s = this.scope(); this.fetch(s); });
  }

  protected statusLabel(c: VisitorRfid): string {
    return c.isBlocked ? 'Blocked' : c.isActive ? 'Active' : 'Inactive';
  }
  protected statusTone(c: VisitorRfid): BadgeTone {
    return c.isBlocked ? 'danger' : c.isActive ? 'success' : 'neutral';
  }
  protected date(v: string | null): string {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined,
      { day: 'numeric', month: 'short', year: 'numeric' });
  }
  protected bad(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected openBlock(c: VisitorRfid): void {
    this.form.reset(); this.saveError.set(null); this.blocking.set(c);
  }

  protected confirmBlock(): void {
    const card = this.blocking();
    if (!card) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.saving.set(true); this.saveError.set(null);
    this.svc.block(card.smartCardNo, this.form.getRawValue().reason).subscribe({
      next: () => {
        this.saving.set(false);
        this.blocking.set(null);
        this.toast.warn('Card blocked', `${card.smartCardNo} can no longer access the site.`);
        this.fetch(this.scope());
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(err?.error?.error?.message ?? 'Could not block the card.');
      },
    });
  }

  private fetch(scope: string): void {
    this.loading.set(true); this.error.set(null);
    this.svc.list(scope === 'true' ? true : undefined).subscribe({
      next: r => { this.rows.set(r ?? []); this.loading.set(false); },
      error: err => {
        this.error.set(err?.error?.error?.message ?? 'Could not load RFID cards.');
        this.rows.set([]); this.loading.set(false);
      },
    });
  }
}