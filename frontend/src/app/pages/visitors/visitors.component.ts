import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { VisitorsService } from '../../core/services/visitors.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { Visitor } from '../../core/models/api.models';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { SearchInputComponent } from '../../shared/ui/search-input/search-input.component';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SegmentedComponent, SegmentOption } from '../../shared/ui/segmented/segmented.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

@Component({
  selector: 'acms-visitors',
  standalone: true,
  imports: [
    ReactiveFormsModule, GlassCardComponent, PageHeaderComponent, SearchInputComponent,
    PaginatorComponent, StatusBadgeComponent, EmptyStateComponent, ModalComponent,
    SegmentedComponent, IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <acms-page-header eyebrow="Access control" title="Visitors"
                      subtitle="Registration, check-in and check-out">
      <acms-search-input [(value)]="search" placeholder="Search by name or CNIC..." />
      <acms-segmented [options]="scopes" [(value)]="scope" />
      @if (auth.hasRole('Admin', 'Security')) {
        <button class="btn btn--primary" type="button" (click)="openRegister()">
          <acms-icon name="plus" [size]="15" [weight]="2.4" /> Register visitor
        </button>
      }
    </acms-page-header>

    @if (error()) {
      <div class="alert" role="alert"><acms-icon name="alert" [size]="16" /> {{ error() }}</div>
    }

    <acms-glass-card [flush]="true">
      @if (loading()) {
        <div class="pad" role="status" aria-live="polite">
          <span class="sr-only">Loading records</span>
          @for (i of [1,2,3,4,5]; track i) { <div class="skeleton row-sk"></div> }
        </div>
      } @else if (rows().length === 0) {
        <acms-empty-state icon="userCheck" title="No visitors found"
          [message]="scope() === 'true' ? 'Nobody is currently on site.'
                                        : 'No visitor records match this view.'" />
      } @else {
        <div class="tbl-wrap">
          <table class="tbl">
            <caption class="sr-only">Visitor registrations and on-site status</caption>
            <thead>
              <tr>
                <th scope="col">Visitor</th>
                <th scope="col">Company</th>
                <th scope="col">RFID card</th>
                <th scope="col">Entry</th>
                <th scope="col">Status</th>
                <th scope="col" class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (v of rows(); track v.id) {
                <tr>
                  <td>
                    <div class="who">
                      <span class="who__av">{{ initials(v.name) }}</span>
                      <div>
                        <div class="strong">{{ v.name || 'Unnamed' }}</div>
                        <div class="sub mono">{{ v.cnic }}</div>
                      </div>
                    </div>
                  </td>
                  <td>{{ v.companyName || '&mdash;' }}</td>
                  <td class="mono">{{ v.cardSerialNumber || '&mdash;' }}</td>
                  <td>{{ time(v.entryDate) || '&mdash;' }}</td>
                  <td>
                    <acms-status-badge [dot]="true"
                      [label]="v.exitDate ? 'Checked out' : 'On site'"
                      [tone]="v.exitDate ? 'neutral' : 'success'" />
                  </td>
                  <td class="right">
                    <div class="actions">
                      @if (!v.exitDate && auth.hasRole('Admin', 'Security')) {
                        <button class="btn btn--ghost btn--sm" type="button"
                                [disabled]="busy() === v.id" (click)="checkout(v)">
                          <acms-icon name="logout" [size]="13" /> Check out
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="pad-x">
          <acms-paginator [(page)]="page" [limit]="limit" [total]="total()" />
        </div>
      }
    </acms-glass-card>

    @if (registerOpen()) {
      <acms-modal title="Register visitor" subtitle="Records entry and issues an RFID card"
                  [width]="540" (close)="registerOpen.set(false)">
        <form [formGroup]="form" class="form-grid form-grid--2" novalidate>
          <label class="fld">
            <span class="fld__lab">CNIC <span class="req">*</span></span>
            <input type="text" formControlName="cnic" placeholder="4210112345001"
                   [class.bad]="bad('cnic')" />
            @if (bad('cnic')) { <span class="fld__err">13&ndash;15 digits required</span> }
          </label>
          <label class="fld">
            <span class="fld__lab">Full name <span class="req">*</span></span>
            <input type="text" formControlName="name" placeholder="Imran Qureshi"
                   [class.bad]="bad('name')" />
            @if (bad('name')) { <span class="fld__err">Name is required</span> }
          </label>
          <label class="fld">
            <span class="fld__lab">Company</span>
            <input type="text" formControlName="companyName" placeholder="TechSupply Co." />
          </label>
          <label class="fld">
            <span class="fld__lab">Designation</span>
            <input type="text" formControlName="designation" placeholder="IT Contractor" />
          </label>
          <label class="fld">
            <span class="fld__lab">Contact no.</span>
            <input type="text" formControlName="contactNo" placeholder="0300-1234567" />
          </label>
          <label class="fld">
            <span class="fld__lab">RFID card no.</span>
            <input type="text" formControlName="cardSerialNumber" placeholder="VRFID-009" />
          </label>
        </form>
        @if (saveError()) { <div class="alert mt" role="alert"><acms-icon name="alert" [size]="15" /> {{ saveError() }}</div> }
        <div modalFooter>
          <button class="btn btn--ghost" type="button" (click)="registerOpen.set(false)">Cancel</button>
          <button class="btn btn--primary" type="button" [disabled]="saving()" (click)="save()">
            {{ saving() ? 'Registering...' : 'Register and check in' }}
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
    .pad { padding: var(--s-6); display: grid; gap: 10px; }
    .pad-x { padding: 0 var(--s-6) var(--s-5); }
    .row-sk { height: 40px; }
    .sub { font-size: var(--fs-xs); color: var(--ink-muted); margin-top: 1px; }
  `],
})
export class VisitorsComponent {
  private readonly svc = inject(VisitorsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthService);

  protected readonly rows = signal<Visitor[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<number | null>(null);

  protected readonly search = signal('');
  protected readonly scope = signal('');
  protected readonly page = signal(1);
  protected readonly limit = 25;

  protected readonly registerOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly scopes: SegmentOption[] = [
    { label: 'All', value: '' },
    { label: 'On site', value: 'true' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    cnic: ['', [Validators.required, Validators.minLength(13), Validators.maxLength(15)]],
    name: ['', Validators.required],
    companyName: [''],
    designation: [''],
    contactNo: [''],
    cardSerialNumber: [''],
  });

  constructor() {
    effect(() => { this.search(); this.scope(); this.page.set(1); });
    effect(() => {
      const p = this.page(), s = this.search(), sc = this.scope();
      this.fetch(p, s, sc);
    });
  }

  protected initials(name: string | null): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  protected time(v: string | null): string {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined,
      { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  protected bad(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected openRegister(): void {
    this.form.reset(); this.saveError.set(null); this.registerOpen.set(true);
  }

  protected async checkout(v: Visitor): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Check out visitor',
      message: `Record ${v.name || 'this visitor'} as having left the site? `
             + `This sets their exit timestamp and cannot be undone from here.`,
      confirmLabel: 'Check out',
    });
    if (!ok) return;

    this.busy.set(v.id);
    this.svc.checkout(v.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success('Visitor checked out', v.name ?? undefined);
        this.refresh();
      },
      error: err => {
        this.busy.set(null);
        this.toast.error('Check-out failed',
          err?.error?.error?.message ?? 'The server rejected the request.');
      },
    });
  }

  protected save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.saveError.set(null);
    this.svc.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.registerOpen.set(false);
        this.toast.success('Visitor registered', 'Entry recorded and card issued.');
        this.refresh();
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(err?.error?.error?.message ?? 'Could not register the visitor.');
      },
    });
  }

  private refresh(): void { this.fetch(this.page(), this.search(), this.scope()); }

  private fetch(page: number, search: string, scope: string): void {
    this.loading.set(true); this.error.set(null);
    this.svc.list({
      page, limit: this.limit,
      search: search || undefined,
      onSite: scope === 'true' ? true : undefined,
    }).subscribe({
      next: r => { this.rows.set(r.items); this.total.set(r.total); this.loading.set(false); },
      error: err => {
        this.error.set(err?.error?.error?.message ?? 'Could not load visitors.');
        this.rows.set([]); this.loading.set(false);
      },
    });
  }
}