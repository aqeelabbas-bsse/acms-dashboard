import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardRequestsService } from '../../core/services/card-requests.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { CardRequest, CardRequestStatus } from '../../core/models/api.models';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SegmentedComponent, SegmentOption } from '../../shared/ui/segmented/segmented.component';
import { StepperComponent, Step } from '../../shared/ui/stepper/stepper.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

@Component({
  selector: 'acms-card-requests',
  standalone: true,
  imports: [
    ReactiveFormsModule, GlassCardComponent, PageHeaderComponent, PaginatorComponent,
    StatusBadgeComponent, EmptyStateComponent, ModalComponent, SegmentedComponent,
    StepperComponent, IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <acms-page-header eyebrow="Access control" title="Card requests"
                      subtitle="Submitted, verified, printed - tracked end to end">
      <acms-segmented [options]="filters" [(value)]="status" />
      @if (auth.hasRole('Admin', 'Security')) {
        <button class="btn btn--primary" type="button" (click)="openSubmit()">
          <acms-icon name="plus" [size]="15" [weight]="2.4" /> New request
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
        <acms-empty-state icon="card" title="No card requests"
          message="Nothing matches this filter yet." />
      } @else {
        <div class="tbl-wrap">
          <table class="tbl">
            <caption class="sr-only">Card requests and their workflow stage</caption>
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">CNIC</th>
                <th scope="col">Stage</th>
                <th scope="col">Last activity</th>
                <th scope="col" class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (c of rows(); track c.crid) {
                <tr>
                  <td class="strong">#{{ c.crid }}</td>
                  <td class="mono">{{ c.cnic || '&mdash;' }}</td>
                  <td>
                    <acms-status-badge [dot]="true" [label]="label(c)" [tone]="tone(c)" />
                  </td>
                  <td>{{ date(c.printingDate ?? c.markedOn ?? c.processDate) || '&mdash;' }}</td>
                  <td class="right">
                    <div class="actions">
                      <button class="btn btn--ghost btn--sm" type="button" (click)="open(c)">
                        <acms-icon name="eye" [size]="13" /> Track
                      </button>
                      @if (!c.isVerified && auth.hasRole('Admin', 'Security')) {
                        <button class="btn btn--primary btn--sm" type="button"
                                [disabled]="busy() === c.crid" (click)="verify(c)">
                          <acms-icon name="check" [size]="13" [weight]="2.6" /> Verify
                        </button>
                      }
                      @if (c.isVerified && !c.isPrinted && auth.hasRole('Admin', 'Printer')) {
                        <button class="btn btn--primary btn--sm" type="button"
                                [disabled]="busy() === c.crid" (click)="print(c)">
                          <acms-icon name="printer" [size]="13" /> Print
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

    <!-- Workflow tracker -->
    @if (tracked(); as t) {
      <acms-modal [title]="'Request #' + t.crid" subtitle="Approval workflow"
                  [width]="560" (close)="tracked.set(null)">
        <acms-stepper [steps]="stepsFor(t)" [current]="stepIndex(t)" />
        <dl class="meta">
          <div><dt>CNIC</dt><dd class="mono">{{ t.cnic || '&mdash;' }}</dd></div>
          <div><dt>Printed by</dt><dd>{{ t.printBy || '&mdash;' }}</dd></div>
          <div style="grid-column: 1 / -1"><dt>Remarks</dt><dd>{{ t.remarks || 'None' }}</dd></div>
        </dl>
        <div modalFooter>
          <button class="btn btn--ghost" type="button" (click)="tracked.set(null)">Close</button>
        </div>
      </acms-modal>
    }

    <!-- Submit form -->
    @if (submitOpen()) {
      <acms-modal title="New card request" subtitle="Link a request to an employee CNIC"
                  [width]="480" (close)="submitOpen.set(false)">
        <form [formGroup]="form" class="form-grid" novalidate>
          <label class="fld">
            <span class="fld__lab">Employee CNIC <span class="req">*</span></span>
            <input type="text" formControlName="cnic" placeholder="3520112345671"
                   [class.bad]="bad('cnic')" />
            @if (bad('cnic')) { <span class="fld__err">13&ndash;15 digits required</span> }
          </label>
          <label class="fld">
            <span class="fld__lab">Remarks</span>
            <textarea formControlName="remarks"
                      placeholder="New card request / renewal reason..."></textarea>
          </label>
        </form>
        @if (saveError()) { <div class="alert mt" role="alert"><acms-icon name="alert" [size]="15" /> {{ saveError() }}</div> }
        <div modalFooter>
          <button class="btn btn--ghost" type="button" (click)="submitOpen.set(false)">Cancel</button>
          <button class="btn btn--primary" type="button" [disabled]="saving()" (click)="save()">
            {{ saving() ? 'Submitting...' : 'Submit request' }}
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

    .meta {
      display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-4);
      margin: var(--s-8) 0 0; padding-top: var(--s-5);
      border-top: 1px solid var(--track);
    }
    dt { font-size: var(--fs-xs); font-weight: 700; letter-spacing: .07em;
         text-transform: uppercase; color: var(--ink-dim); margin-bottom: 3px; }
    dd { margin: 0; font-size: var(--fs-base); color: var(--ink); }
    dd.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
  `],
})
export class CardRequestsComponent {
  private readonly svc = inject(CardRequestsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly rows = signal<CardRequest[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<number | null>(null);

  protected readonly status = signal('');
  protected readonly page = signal(1);
  protected readonly limit = 25;

  protected readonly tracked = signal<CardRequest | null>(null);
  protected readonly submitOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly filters: SegmentOption[] = [
    { label: 'All', value: '' },
    { label: 'Submitted', value: 'submitted' },
    { label: 'Verified', value: 'verified' },
    { label: 'Printed', value: 'printed' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    cnic: ['', [Validators.required, Validators.minLength(13), Validators.maxLength(15)]],
    remarks: [''],
  });

  constructor() {
    effect(() => { this.status(); this.page.set(1); });
    effect(() => { const p = this.page(), s = this.status(); this.fetch(p, s); });
  }

  protected label(c: CardRequest): string {
    return c.isPrinted ? 'Printed' : c.isVerified ? 'Verified' : 'Submitted';
  }
  protected tone(c: CardRequest): 'success' | 'info' | 'warn' {
    return c.isPrinted ? 'success' : c.isVerified ? 'info' : 'warn';
  }
  protected stepIndex(c: CardRequest): number {
    return c.isPrinted ? 3 : c.isVerified ? 2 : 1;
  }
  protected stepsFor(c: CardRequest): Step[] {
    return [
      { label: 'Submitted', caption: this.date(c.processDate) },
      { label: 'Verified',  caption: c.isVerified ? this.date(c.markedOn) : 'Pending' },
      { label: 'Printed',   caption: c.isPrinted ? this.date(c.printingDate) : 'Pending' },
    ];
  }
  protected date(v: string | null | undefined): string {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined,
      { day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected open(c: CardRequest): void { this.tracked.set(c); }
  protected bad(control: string): boolean {
    const ctl = this.form.get(control);
    return !!ctl && ctl.invalid && (ctl.touched || ctl.dirty);
  }
  protected openSubmit(): void {
    this.form.reset(); this.saveError.set(null); this.submitOpen.set(true);
  }

  protected verify(c: CardRequest): void {
    this.busy.set(c.crid);
    this.svc.verify(c.crid).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(`Request #${c.crid} verified`);
        this.refresh();
      },
      error: err => {
        this.busy.set(null);
        this.toast.error('Verification failed',
          err?.error?.error?.message ?? 'The server rejected the request.');
      },
    });
  }

  protected print(c: CardRequest): void {
    this.busy.set(c.crid);
    this.svc.print(c.crid).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(`Request #${c.crid} marked printed`);
        this.refresh();
      },
      error: err => {
        this.busy.set(null);
        this.toast.error('Print failed', err?.error?.error?.message
          ?? 'A request must be verified before it can be printed.');
      },
    });
  }

  protected save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.saveError.set(null);
    this.svc.submit(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.submitOpen.set(false);
        this.toast.success('Card request submitted');
        this.refresh();
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(err?.error?.error?.message ?? 'Could not submit the request.');
      },
    });
  }

  private refresh(): void { this.fetch(this.page(), this.status()); }

  private fetch(page: number, status: string): void {
    this.loading.set(true); this.error.set(null);
    this.svc.list({ page, limit: this.limit, status: (status || '') as CardRequestStatus | '' })
      .subscribe({
        next: r => { this.rows.set(r.items); this.total.set(r.total); this.loading.set(false); },
        error: err => {
          this.error.set(err?.error?.error?.message ?? 'Could not load card requests.');
          this.rows.set([]); this.loading.set(false);
        },
      });
  }
}