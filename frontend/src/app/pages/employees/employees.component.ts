import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EmployeesService } from '../../core/services/employees.service';
import { AuthService } from '../../core/services/auth.service';
import { EmployeeListItem } from '../../core/models/api.models';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { SearchInputComponent } from '../../shared/ui/search-input/search-input.component';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

@Component({
  selector: 'acms-employees',
  standalone: true,
  imports: [
    ReactiveFormsModule, GlassCardComponent, PageHeaderComponent, SearchInputComponent,
    PaginatorComponent, StatusBadgeComponent, EmptyStateComponent, ModalComponent, IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <acms-page-header eyebrow="Access control" title="Employees"
                      subtitle="Search and manage smart-card profiles">
      <acms-search-input [(value)]="search" placeholder="Search by name or CNIC..." />
      <select class="sel" [value]="activeFilter()"
              (change)="onFilter($event)" aria-label="Filter by status">
        <option value="">All statuses</option>
        <option value="true">Active only</option>
        <option value="false">Inactive only</option>
      </select>
      @if (auth.hasRole('Admin')) {
        <button class="btn btn--primary" type="button" (click)="openCreate()">
          <acms-icon name="plus" [size]="15" [weight]="2.4" /> New employee
        </button>
      }
    </acms-page-header>

    @if (error()) {
      <div class="alert"><acms-icon name="alert" [size]="16" /> {{ error() }}</div>
    }

    <acms-glass-card [flush]="true">
      @if (loading()) {
        <div class="pad">
          @for (i of [1,2,3,4,5]; track i) { <div class="skeleton row-sk"></div> }
        </div>
      } @else if (rows().length === 0) {
        <acms-empty-state icon="users" title="No employees found"
          [message]="search() ? 'Nothing matches that search. Try a different term.'
                              : 'No smart-card profiles have been registered yet.'" />
      } @else {
        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>CNIC</th>
                <th>Designation</th>
                <th>Status</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (e of rows(); track e.cnic) {
                <tr>
                  <td>
                    <div class="who">
                      <span class="who__av">{{ initials(e.name) }}</span>
                      <span class="strong">{{ e.name || 'Unnamed' }}</span>
                    </div>
                  </td>
                  <td class="mono">{{ e.cnic }}</td>
                  <td>{{ e.designation || '&mdash;' }}</td>
                  <td>
                    <acms-status-badge [dot]="true"
                      [label]="e.isActive ? 'Active' : 'Inactive'"
                      [tone]="e.isActive ? 'success' : 'neutral'" />
                  </td>
                  <td class="right">
                    <div class="actions">
                      <button class="btn btn--ghost btn--sm" type="button"
                              (click)="view(e.cnic)">
                        <acms-icon name="eye" [size]="13" /> View
                      </button>
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

    @if (createOpen()) {
      <acms-modal title="New employee" subtitle="Create a smart-card profile"
                  [width]="520" (close)="createOpen.set(false)">
        <form [formGroup]="form" class="form-grid form-grid--2" novalidate>
          <label class="fld">
            <span class="fld__lab">CNIC <span class="req">*</span></span>
            <input type="text" formControlName="cnic" placeholder="3520112345671"
                   [class.bad]="bad('cnic')" />
            @if (bad('cnic')) { <span class="fld__err">13&ndash;15 digits required</span> }
          </label>
          <label class="fld">
            <span class="fld__lab">Full name <span class="req">*</span></span>
            <input type="text" formControlName="name" placeholder="Muhammad Aqeel Abbas"
                   [class.bad]="bad('name')" />
            @if (bad('name')) { <span class="fld__err">Name is required</span> }
          </label>
          <label class="fld">
            <span class="fld__lab">Designation</span>
            <input type="text" formControlName="designation" placeholder="Software Engineer" />
          </label>
          <label class="fld">
            <span class="fld__lab">Contact no.</span>
            <input type="text" formControlName="contactNo" placeholder="0300-1234567" />
          </label>
          <label class="fld" style="grid-column: 1 / -1">
            <span class="fld__lab">Email</span>
            <input type="email" formControlName="email" placeholder="name@nastp.gov.pk"
                   [class.bad]="bad('email')" />
            @if (bad('email')) { <span class="fld__err">Enter a valid email address</span> }
          </label>
        </form>

        @if (saveError()) { <div class="alert mt"><acms-icon name="alert" [size]="15" /> {{ saveError() }}</div> }

        <div modalFooter>
          <button class="btn btn--ghost" type="button" (click)="createOpen.set(false)">Cancel</button>
          <button class="btn btn--primary" type="button"
                  [disabled]="saving()" (click)="save()">
            {{ saving() ? 'Saving...' : 'Create employee' }}
          </button>
        </div>
      </acms-modal>
    }
  `,
  styles: [`
    :host { display: block; }
    .sel {
      height: 38px; padding: 0 14px;
      border: 1px solid var(--glass-border); border-radius: var(--r-pill);
      background: var(--hover-wash); color: var(--ink-soft);
      font-family: var(--font-body); font-size: var(--fs-sm); font-weight: 500;
      outline: none; cursor: pointer;
    }
    .alert {
      display: flex; align-items: center; gap: 9px;
      margin-bottom: var(--s-5); padding: 12px var(--s-5);
      border-radius: var(--r-md);
      background: var(--danger-bg); color: var(--danger-fg);
      font-size: var(--fs-sm);
    }
    .alert.mt { margin: var(--s-4) 0 0; }
    .pad { padding: var(--s-6); display: grid; gap: 10px; }
    .pad-x { padding: 0 var(--s-6) var(--s-5); }
    .row-sk { height: 40px; }
  `],
})
export class EmployeesComponent implements OnInit {
  private readonly svc = inject(EmployeesService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);

  protected readonly rows = signal<EmployeeListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly activeFilter = signal<string>('');
  protected readonly page = signal(1);
  protected readonly limit = 25;

  protected readonly createOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    cnic: ['', [Validators.required, Validators.minLength(13), Validators.maxLength(15)]],
    name: ['', Validators.required],
    designation: [''],
    contactNo: [''],
    email: ['', Validators.email],
  });

  constructor() {
    // Any filter change refetches. Search/filter changes reset to page 1.
    effect(() => {
      this.search(); this.activeFilter();
      this.page.set(1);
    });
    effect(() => {
      const p = this.page(), s = this.search(), a = this.activeFilter();
      this.fetch(p, s, a);
    });
  }

  ngOnInit(): void { /* effects above drive the initial load */ }

  protected initials(name: string | null): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  protected onFilter(e: Event): void {
    this.activeFilter.set((e.target as HTMLSelectElement).value);
  }

  protected view(cnic: string): void {
    this.router.navigate(['/employees', cnic]);
  }

  protected bad(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected openCreate(): void {
    this.form.reset();
    this.saveError.set(null);
    this.createOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set(null);

    this.svc.create(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.fetch(this.page(), this.search(), this.activeFilter());
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(err?.error?.error?.message ?? 'Could not create the employee.');
      },
    });
  }

  private fetch(page: number, search: string, active: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list({
      page,
      limit: this.limit,
      search: search || undefined,
      isActive: active === '' ? undefined : active === 'true',
    }).subscribe({
      next: r => { this.rows.set(r.items); this.total.set(r.total); this.loading.set(false); },
      error: err => {
        this.error.set(err?.error?.error?.message ?? 'Could not load employees.');
        this.rows.set([]); this.loading.set(false);
      },
    });
  }
}