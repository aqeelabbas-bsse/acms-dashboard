import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EmployeesService } from '../../core/services/employees.service';
import { CardRequestsService } from '../../core/services/card-requests.service';
import { CardRequest, EmployeeDetail } from '../../core/models/api.models';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { IconName } from '../../shared/ui/icon/icons';

@Component({
  selector: 'acms-employee-profile',
  standalone: true,
  imports: [RouterLink, GlassCardComponent, StatusBadgeComponent,
            EmptyStateComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/employees">
      <acms-icon name="chevronL" [size]="14" [weight]="2.4" /> Back to employees
    </a>

    @if (loading()) {
      <div class="skeleton hero-sk"></div>
    } @else if (error()) {
      <acms-glass-card>
        <acms-empty-state icon="alert" title="Couldn't load this profile" [message]="error()!" />
      </acms-glass-card>
    } @else if (emp(); as e) {
      <section class="hero rise">
        <span class="av">{{ initials(e.name) }}</span>
        <div class="who">
          <h1 class="nm">{{ e.name || 'Unnamed' }}</h1>
          <p class="dg">{{ e.designation || 'No designation on record' }}</p>
          <div class="tags">
            <acms-status-badge [dot]="true"
              [label]="e.isActive ? 'Active' : 'Inactive'"
              [tone]="e.isActive ? 'success' : 'neutral'" />
            @if (e.rank) { <acms-status-badge [label]="e.rank" tone="violet" /> }
          </div>
        </div>
      </section>

      <div class="grid stagger">
        <acms-glass-card title="Identity" subtitle="Profile details on file">
          <dl class="dl">
            @for (f of fields(e); track f.label) {
              <div class="row">
                <dt><acms-icon [name]="f.icon" [size]="15" /> {{ f.label }}</dt>
                <dd [class.mono]="f.mono">{{ f.value || '&mdash;' }}</dd>
              </div>
            }
          </dl>
        </acms-glass-card>

        <acms-glass-card title="Card history" subtitle="Requests linked to this CNIC">
          @if (historyLoading()) {
            <div class="skeleton hist-sk"></div>
          } @else if (history().length === 0) {
            <acms-empty-state icon="card" title="No card requests"
              message="This employee has no card requests on record." />
          } @else {
            <ul class="tl">
              @for (h of history(); track h.crid) {
                <li class="ti">
                  <span class="dot" [attr.data-tone]="tone(h)"></span>
                  <div>
                    <div class="ti__t">
                      Request #{{ h.crid }}
                      <acms-status-badge [label]="label(h)" [tone]="tone(h)" />
                    </div>
                    <div class="ti__d">{{ date(h.printingDate ?? h.markedOn ?? h.processDate) }}</div>
                    @if (h.remarks) { <div class="ti__r">{{ h.remarks }}</div> }
                  </div>
                </li>
              }
            </ul>
          }
        </acms-glass-card>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .back {
      display: inline-flex; align-items: center; gap: 5px;
      margin-bottom: var(--s-5);
      font-size: var(--fs-sm); font-weight: 600; color: var(--ink-muted);
      transition: color var(--t-fast) var(--ease);
    }
    .back:hover { color: var(--violet-fg); }

    .hero {
      display: flex; align-items: center; gap: var(--s-5);
      padding: var(--s-6); margin-bottom: var(--s-5);
      border-radius: var(--r-lg);
      border: 1px solid var(--glass-border);
      background: var(--glass-strong);
      backdrop-filter: blur(var(--blur-surface)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--blur-surface)) saturate(180%);
      box-shadow: var(--sh-card), var(--glass-inset);
    }
    .av {
      width: 68px; height: 68px; border-radius: 22px; flex-shrink: 0;
      display: grid; place-items: center;
      font-family: var(--font-display); font-weight: 700; font-size: 24px; color: #fff;
      background: linear-gradient(135deg, var(--violet), var(--blue));
      box-shadow: var(--sh-brand);
    }
    .nm { font-size: var(--fs-xl); font-weight: 700; }
    .dg { margin: 3px 0 9px; font-size: var(--fs-base); color: var(--ink-muted); }
    .tags { display: flex; gap: 7px; flex-wrap: wrap; }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-5); }
    @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }

    .dl { margin: 0; display: grid; gap: 2px; }
    .row {
      display: grid; grid-template-columns: 160px 1fr; gap: var(--s-4);
      align-items: center; padding: 10px 0;
      border-bottom: 1px solid var(--track);
    }
    .row:last-child { border-bottom: none; }
    dt {
      display: flex; align-items: center; gap: 8px;
      font-size: var(--fs-sm); color: var(--ink-muted);
    }
    dd { margin: 0; font-size: var(--fs-base); font-weight: 500; color: var(--ink); }
    dd.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }

    .tl { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-4); }
    .ti { display: flex; gap: 12px; align-items: flex-start; }
    .dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
    [data-tone='success'] { background: var(--success-fg); }
    [data-tone='info']    { background: var(--info-fg); }
    [data-tone='warn']    { background: var(--warn-fg); }
    .ti__t { display: flex; align-items: center; gap: 8px;
             font-size: var(--fs-sm); font-weight: 600; }
    .ti__d { font-size: var(--fs-xs); color: var(--ink-dim); margin-top: 2px; }
    .ti__r { font-size: var(--fs-sm); color: var(--ink-muted); margin-top: 4px; }

    .hero-sk { height: 116px; margin-bottom: var(--s-5); border-radius: var(--r-lg); }
    .hist-sk { height: 160px; }
  `],
})
export class EmployeeProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(EmployeesService);
  private readonly cards = inject(CardRequestsService);

  protected readonly emp = signal<EmployeeDetail | null>(null);
  protected readonly history = signal<CardRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly historyLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const cnic = this.route.snapshot.paramMap.get('cnic');
    if (!cnic) { this.error.set('No CNIC in the URL.'); this.loading.set(false); return; }

    this.svc.getOne(cnic).subscribe({
      next: e => { this.emp.set(e); this.loading.set(false); },
      error: err => {
        this.error.set(err?.error?.error?.message ?? 'Employee not found.');
        this.loading.set(false);
      },
    });

    // Card history: the API has no per-employee filter, so pull a page and
    // filter client-side. Fine at this data volume; revisit if it grows.
    this.cards.list({ limit: 100 }).subscribe({
      next: r => {
        this.history.set(r.items.filter(c => c.cnic === cnic));
        this.historyLoading.set(false);
      },
      error: () => { this.history.set([]); this.historyLoading.set(false); },
    });
  }

  protected initials(name: string | null): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  protected fields(e: EmployeeDetail): { label: string; value: string | null; icon: IconName; mono?: boolean }[] {
    return [
      { label: 'CNIC',        value: e.cnic,        icon: 'card',     mono: true },
      { label: 'Father name', value: e.fatherName,  icon: 'users' },
      { label: 'Service no.', value: e.serviceNo,   icon: 'shield',   mono: true },
      { label: 'Email',       value: e.email,       icon: 'mail' },
      { label: 'Contact',     value: e.contactNo,   icon: 'phone' },
      { label: 'Company',     value: e.companyName, icon: 'building' },
      { label: 'Card expiry', value: this.date(e.expiryDate), icon: 'calendar' },
    ];
  }

  protected label(c: CardRequest): string {
    return c.isPrinted ? 'Printed' : c.isVerified ? 'Verified' : 'Submitted';
  }

  protected tone(c: CardRequest): 'success' | 'info' | 'warn' {
    return c.isPrinted ? 'success' : c.isVerified ? 'info' : 'warn';
  }

  protected date(v: string | null | undefined): string {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined,
      { day: 'numeric', month: 'short', year: 'numeric' });
  }
}