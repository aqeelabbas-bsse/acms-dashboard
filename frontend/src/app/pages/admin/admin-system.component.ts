import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AnalyticsService, EtlRunResult } from '../../core/services/analytics.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ACMS_ROLES, ROLE_DESCRIPTION, ROLE_TONE } from '../../core/models/admin.models';
import { environment } from '../../../environments/environment';

/**
 * System tab of the Admin console.
 *
 * The analytics refresh (POST /v1/analytics/etl/run) is Admin-only and had no
 * UI anywhere in the application — the only way to trigger it was PowerShell
 * with a hand-assembled bearer token. That is fine for a developer and useless
 * for whoever inherits this system, so it lives here now, with its result
 * reported rather than swallowed.
 *
 * The role reference below it is the same ROLE_DESCRIPTION map the create/edit
 * form uses. Duplicating the text would guarantee the two drift apart.
 */
@Component({
  selector: 'acms-admin-system',
  standalone: true,
  imports: [GlassCardComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid stagger">

      <!-- Analytics refresh -->
      <acms-glass-card title="Analytics refresh"
                       subtitle="Rebuild the daily summary tables behind the trend charts">
        <p class="copy">
          The dashboard's trend charts read from three precomputed summary tables
          rather than aggregating the transactional tables live. A scheduled job
          rebuilds them every hour; this runs it immediately.
        </p>

        <div class="row">
          <label class="fld">
            <span class="fld__l">Look back</span>
            <select [value]="lookback()" (change)="lookback.set(+val($event))">
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </select>
          </label>

          <button class="btn btn--primary" type="button"
                  [disabled]="running()" (click)="runEtl()">
            <acms-icon name="refresh" [size]="14" [weight]="2.2"
                       [class.spin]="running()" />
            {{ running() ? 'Running...' : 'Run refresh now' }}
          </button>
        </div>

        @if (result(); as r) {
          <div class="res" role="status" aria-live="polite">
            <div class="res__head">
              <acms-icon name="check" [size]="15" [weight]="2.6" />
              <strong>Refresh complete</strong>
              <span class="res__ms">{{ r.durationMs }} ms</span>
            </div>
            <dl class="res__grid">
              <div><dt>Days processed</dt><dd>{{ r.daysProcessed }}</dd></div>
              <div><dt>Card requests read</dt><dd>{{ r.cardRequestsRead }}</dd></div>
              <div><dt>Visits read</dt><dd>{{ r.visitsRead }}</dd></div>
              <div><dt>Window</dt><dd>{{ r.from }} &rarr; {{ r.to }}</dd></div>
            </dl>
          </div>
        }

        @if (error(); as e) {
          <div class="alert" role="alert">
            <acms-icon name="alert" [size]="16" [weight]="2.2" />
            <span>{{ e }}</span>
          </div>
        }

        <p class="note">
          <acms-icon name="alert" [size]="12" />
          Safe to run as often as you like &mdash; it rewrites summary rows keyed
          on the date rather than appending, so repeat runs cannot duplicate data.
        </p>
      </acms-glass-card>

      <!-- Session -->
      <acms-glass-card title="Session" subtitle="Your current sign-in">
        <dl class="kv">
          <div><dt>Signed in as</dt><dd>{{ auth.username?.() ?? '\u2014' }}</dd></div>
          <div><dt>Role</dt><dd>{{ auth.role?.() ?? '\u2014' }}</dd></div>
          <div><dt>API endpoint</dt><dd class="mono">{{ apiUrl }}</dd></div>
          <div><dt>Real-time hub</dt><dd class="mono">{{ hubUrl }}</dd></div>
          <div><dt>Build</dt><dd>{{ buildMode }}</dd></div>
        </dl>
      </acms-glass-card>

      <!-- Role reference -->
      <acms-glass-card class="wide" title="Role reference"
                       subtitle="What each role can do. Every restriction is enforced server-side.">
        <div class="roles">
          @for (r of roles; track r) {
            <div class="role" [attr.data-tone]="tone(r)">
              <span class="role__n">{{ r }}</span>
              <span class="role__d">{{ describe(r) }}</span>
            </div>
          }
        </div>
        <p class="note">
          <acms-icon name="alert" [size]="12" />
          The Angular client hides controls a role cannot use, but that is a
          convenience only &mdash; the same rules are re-checked on every API call,
          so hiding a button is never what actually prevents the action.
        </p>
      </acms-glass-card>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .grid {
      display: grid; grid-template-columns: 1.35fr 1fr;
      gap: var(--s-5); align-items: start;
    }
    .wide { grid-column: 1 / -1; }

    .copy { margin: 0 0 var(--s-4); font-size: var(--fs-sm);
            color: var(--ink-muted); line-height: 1.6; }

    .row { display: flex; align-items: flex-end; gap: var(--s-3); flex-wrap: wrap; }
    .fld { display: flex; flex-direction: column; gap: 5px; }
    .fld__l { font-size: var(--fs-xs); font-weight: 600; color: var(--ink-dim); }
    .fld select {
      height: 38px; padding: 0 13px;
      border: 1px solid var(--glass-border); border-radius: var(--r-pill);
      background: var(--hover-wash); color: var(--ink);
      font-family: var(--font-body); font-size: var(--fs-sm); font-weight: 600;
      cursor: pointer;
    }
    .fld select:focus-visible {
      outline: none; border-color: rgba(124,108,240,.55);
      box-shadow: 0 0 0 3px rgba(124,108,240,.14);
    }

    .spin { animation: spin 900ms linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .res {
      margin-top: var(--s-4); padding: var(--s-4);
      border-radius: var(--r-md);
      background: var(--success-bg);
      animation: reveal var(--t-base) var(--ease);
    }
    @keyframes reveal { from { opacity: 0; transform: translateY(-4px); } }
    .res__head { display: flex; align-items: center; gap: 8px;
                 font-size: var(--fs-sm); color: var(--success-fg); }
    .res__ms { margin-left: auto; font-size: var(--fs-xs); opacity: .8;
               font-variant-numeric: tabular-nums; }
    .res__grid {
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: 9px var(--s-4); margin: var(--s-3) 0 0;
    }
    .res__grid dt { font-size: var(--fs-xs); color: var(--ink-dim); }
    .res__grid dd { margin: 1px 0 0; font-size: var(--fs-sm);
                    font-weight: 600; color: var(--ink);
                    font-variant-numeric: tabular-nums; }

    .alert {
      display: flex; align-items: center; gap: 9px;
      margin-top: var(--s-4); padding: 11px var(--s-4);
      border-radius: var(--r-md);
      background: var(--danger-bg); color: var(--ink-soft);
      font-size: var(--fs-sm);
    }
    .alert acms-icon { color: var(--danger-fg); flex-shrink: 0; }

    .note {
      display: flex; align-items: flex-start; gap: 6px;
      margin: var(--s-4) 0 0; font-size: var(--fs-xs);
      color: var(--ink-dim); line-height: 1.55;
    }
    .note acms-icon { flex-shrink: 0; margin-top: 2px; }

    .kv { margin: 0; display: grid; gap: 11px; }
    .kv > div { display: flex; align-items: baseline; justify-content: space-between;
                gap: var(--s-4); padding-bottom: 10px;
                border-bottom: 1px solid var(--track); }
    .kv > div:last-child { border-bottom: none; padding-bottom: 0; }
    .kv dt { font-size: var(--fs-xs); color: var(--ink-dim); flex-shrink: 0; }
    .kv dd { margin: 0; font-size: var(--fs-sm); font-weight: 600;
             color: var(--ink); text-align: right;
             overflow-wrap: anywhere; }
    .kv .mono { font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
                font-size: var(--fs-xs); font-weight: 500; }

    .roles { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-3); }
    .role {
      display: grid; gap: 5px; padding: var(--s-4);
      border-radius: var(--r-md);
      background: var(--hover-wash);
      border-left: 3px solid var(--tone-fg);
    }
    .role[data-tone='rose']   { --tone-fg: var(--danger-fg); }
    .role[data-tone='violet'] { --tone-fg: var(--violet-fg); }
    .role[data-tone='blue']   { --tone-fg: var(--info-fg); }
    .role[data-tone='cyan']   { --tone-fg: var(--teal-fg); }
    .role[data-tone='muted']  { --tone-fg: var(--ink-dim); }
    .role__n { font-family: var(--font-display); font-size: var(--fs-sm);
               font-weight: 700; color: var(--tone-fg); }
    .role__d { font-size: var(--fs-xs); color: var(--ink-soft); line-height: 1.5; }

    @media (max-width: 1100px) {
      .grid { grid-template-columns: 1fr; }
      .roles { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) { .roles { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) {
      .spin { animation: none; }
      .res { animation: none; }
    }
  `],
})
export class AdminSystemComponent {
  private readonly analytics = inject(AnalyticsService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly roles = ACMS_ROLES;
  protected readonly lookback = signal(90);
  protected readonly running = signal(false);
  protected readonly result = signal<EtlRunResult | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly apiUrl = environment.apiUrl;
  protected readonly hubUrl = environment.hubUrl;
  protected readonly buildMode = environment.production ? 'Production' : 'Development';

  protected val(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }

  protected describe(r: (typeof ACMS_ROLES)[number]): string {
    return ROLE_DESCRIPTION[r];
  }

  protected tone(r: string): string {
    return ROLE_TONE[r] ?? 'muted';
  }

  protected runEtl(): void {
    this.running.set(true);
    this.error.set(null);
    this.result.set(null);

    this.analytics.runEtl(this.lookback()).subscribe({
      next: r => {
        this.result.set(r);
        this.running.set(false);
        this.toast.success(`Analytics refreshed — ${r.daysProcessed} days processed.`);
      },
      error: e => {
        this.running.set(false);
        // A long backfill can outlast the browser's patience even though the
        // job itself completes, so the message says so rather than implying
        // the refresh definitely failed.
        this.error.set(
          e?.error?.error?.message ??
          (e?.status === 403 ? 'Only an Admin can run the analytics refresh.' : null) ??
          (e?.status === 0 ? 'No response from the API. The refresh may still be running on the server — check back in a moment.' : null) ??
          'The refresh could not be completed.');
      },
    });
  }
}