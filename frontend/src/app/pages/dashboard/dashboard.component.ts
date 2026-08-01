import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AnalyticsService } from '../../core/services/analytics.service';
import { series } from '../../core/utils/etl';
import { EtlRow, FunnelStats, KpiSummary } from '../../core/models/api.models';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card/kpi-card.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SegmentedComponent, SegmentOption } from '../../shared/ui/segmented/segmented.component';
import { BarChartComponent, BarGroup } from '../../shared/ui/bar-chart/bar-chart.component';
import { AreaChartComponent } from '../../shared/ui/area-chart/area-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/ui/donut-chart/donut-chart.component';

@Component({
  selector: 'acms-dashboard',
  standalone: true,
  imports: [
    GlassCardComponent, KpiCardComponent, IconComponent, SegmentedComponent,
    BarChartComponent, AreaChartComponent, DonutChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page rise">
      <div>
        <div class="eyebrow">{{ today }}</div>
        <h1 class="title">Good {{ partOfDay }}, <span class="grad-text">Aqeel</span></h1>
        <p class="sub">Here's what's happening across access control right now.</p>
      </div>
      <div class="tools">
        <acms-segmented [options]="ranges" [(value)]="range" />
        <button class="primary" type="button" (click)="load()" [disabled]="loading()">
          <acms-icon name="refresh" [size]="15" [weight]="2" />
          Refresh
        </button>
      </div>
    </header>

    @if (error()) {
      <div class="alert rise">
        <acms-icon name="cross" [size]="17" [weight]="2" />
        <div>
          <strong>Couldn't load analytics.</strong> {{ error() }}
          <span class="hint">
            Expected until Phase 9 - /analytics/summary requires a JWT.
            See the token workaround in Step 15.
          </span>
        </div>
      </div>
    }

    <section class="kpis stagger">
      <acms-kpi-card label="Total employees" tone="violet" icon="users"
        [value]="kpi()?.totalEmployees ?? null" [loading]="loading()"
        [spark]="submittedSeries()" note="Registered smart-card profiles" />

      <acms-kpi-card label="Active cards" tone="teal" icon="card"
        [value]="kpi()?.activeCards ?? null" [loading]="loading()"
        [spark]="printedSeries()" note="Cards issued and active" />

      <acms-kpi-card label="On site now" tone="blue" icon="pin"
        [value]="kpi()?.onSiteNow ?? null" [loading]="loading()"
        note="Visitors not yet checked out" />

      <acms-kpi-card label="Pending requests" tone="amber" icon="clock"
        [value]="kpi()?.pendingRequests ?? null" [loading]="loading()"
        note="Awaiting verification or printing" />
    </section>

    <section class="grid stagger">
      <acms-glass-card title="Card activity dynamics"
                       subtitle="Submitted vs printed over time">
        <span cardAction class="pill pill--violet">ETL</span>
        <acms-bar-chart [groups]="barGroups()" />
        <div class="legend">
          <span><i class="sw sw--a"></i>Submitted</span>
          <span><i class="sw sw--b"></i>Printed</span>
        </div>
      </acms-glass-card>

      <acms-glass-card title="Live activity" subtitle="Real-time audit feed">
        <span cardAction class="pill pill--success live">Live</span>
        <div class="feed">
          <div class="fitem">
            <span class="fic info"><acms-icon name="activity" [size]="14" [weight]="2.2" /></span>
            <div>
              <div class="ftext">Waiting for events</div>
              <div class="ftime">SignalR feed connects in Phase 12</div>
            </div>
          </div>
        </div>
      </acms-glass-card>
    </section>

    <section class="grid3 stagger">
      <acms-glass-card title="Request funnel" subtitle="Submitted to printed">
        @if (funnel(); as f) {
          <div class="funnel">
            <div class="frow">
              <span class="flab">Submitted</span>
              <div class="ftrack"><span class="ffill f1" [style.width.%]="pct(f.submitted, f)"></span></div>
              <span class="fval">{{ f.submitted }}</span>
            </div>
            <div class="frow">
              <span class="flab">Verified</span>
              <div class="ftrack"><span class="ffill f2" [style.width.%]="pct(f.verified, f)"></span></div>
              <span class="fval">{{ f.verified }}</span>
            </div>
            <div class="frow">
              <span class="flab">Printed</span>
              <div class="ftrack"><span class="ffill f3" [style.width.%]="pct(f.printed, f)"></span></div>
              <span class="fval">{{ f.printed }}</span>
            </div>
          </div>
        } @else {
          <div class="empty">Funnel data unavailable</div>
        }
      </acms-glass-card>

      <acms-glass-card title="Card status" subtitle="Active vs pending">
        <acms-donut-chart [slices]="statusSlices()" caption="total cards" />
      </acms-glass-card>

      <acms-glass-card title="Visitor traffic" subtitle="Entries over time">
        <acms-area-chart [points]="trafficSeries()" label="Visitor entries trend" />
        <div class="legend"><span><i class="sw sw--c"></i>Daily entries</span></div>
      </acms-glass-card>
    </section>

    <div class="ai rise">
      <acms-icon name="sparkle" [size]="17" [weight]="2" />
      <span>Ask ACMS - "How many visitors checked in today?"</span>
      <button type="button" aria-label="Send">
        <acms-icon name="arrowRight" [size]="16" [weight]="2.2" />
      </button>
    </div>

    @if (updatedAt()) {
      <p class="stamp">Last updated {{ updatedAt() }}</p>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: var(--s-6); }

    .page { display: flex; align-items: flex-end; justify-content: space-between;
            gap: var(--s-6); flex-wrap: wrap; }
    .title { font-size: var(--fs-2xl); font-weight: 700; margin: 6px 0 4px; }
    .sub { margin: 0; color: var(--ink-muted); }
    .tools { display: flex; align-items: center; gap: var(--s-3); flex-wrap: wrap; }

    .primary {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 9px 18px; border: none; border-radius: var(--r-pill);
      background: linear-gradient(135deg, var(--violet), var(--violet-deep));
      color: #fff; font-size: var(--fs-base); font-weight: 600; cursor: pointer;
      box-shadow: var(--sh-brand);
      transition: transform var(--t-fast) var(--ease);
    }
    .primary:hover:not(:disabled) { transform: translateY(-1px); }
    .primary:disabled { opacity: .55; cursor: not-allowed; }

    .alert {
      display: flex; gap: var(--s-3); align-items: flex-start;
      padding: var(--s-4) var(--s-5); border-radius: var(--r-md);
      background: var(--danger-bg); color: var(--ink-soft);
      font-size: var(--fs-sm);
    }
    .alert acms-icon { color: var(--danger-fg); flex-shrink: 0; }
    .hint { display: block; margin-top: 4px; color: var(--ink-muted); }

    .kpis  { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-5); }
    .grid  { display: grid; grid-template-columns: 1.55fr 1fr; gap: var(--s-5); }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-5); }

    .legend { display: flex; gap: var(--s-5); margin-top: var(--s-3); }
    .legend span { display: flex; align-items: center; gap: 6px;
                   font-size: var(--fs-xs); color: var(--ink-muted); }
    .sw { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
    .sw--a { background: var(--violet-deep); }
    .sw--b { background: var(--teal); }
    .sw--c { background: var(--blue); }

    .live::before {
      content: ''; width: 6px; height: 6px; border-radius: 50%;
      background: currentColor; animation: blink 1.6s infinite;
    }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }

    .feed { display: flex; flex-direction: column; gap: 2px; }
    .fitem { display: flex; gap: 11px; align-items: flex-start;
             padding: 9px 6px; border-radius: var(--r-sm); }
    .fic { width: 30px; height: 30px; border-radius: 10px;
           display: grid; place-items: center; flex-shrink: 0; }
    .fic.info { background: var(--info-bg); color: var(--info-fg); }
    .ftext { font-size: var(--fs-sm); color: var(--ink-soft); }
    .ftime { font-size: var(--fs-xs); color: var(--ink-dim); margin-top: 1px; }

    .funnel { display: flex; flex-direction: column; gap: var(--s-4); }
    .frow { display: grid; grid-template-columns: 78px 1fr 30px;
            align-items: center; gap: 10px; }
    .flab { font-size: var(--fs-sm); color: var(--ink-soft); font-weight: 500; }
    .ftrack { height: 11px; border-radius: var(--r-pill);
              background: var(--track); overflow: hidden; }
    .ffill { display: block; height: 100%; border-radius: var(--r-pill);
             transition: width var(--t-slow) var(--ease); }
    .f1 { background: linear-gradient(90deg, var(--violet), var(--violet-deep)); }
    .f2 { background: linear-gradient(90deg, #7EA7FF, var(--blue)); }
    .f3 { background: linear-gradient(90deg, #7EE3C8, var(--teal)); }
    .fval { font-size: var(--fs-sm); font-weight: 700; text-align: right; }

    .empty { display: grid; place-items: center; min-height: 120px;
             color: var(--ink-dim); font-size: var(--fs-sm); }

    .ai {
      display: flex; align-items: center; gap: var(--s-3);
      padding: 10px 10px 10px var(--s-5); border-radius: var(--r-pill);
      background: linear-gradient(120deg, rgba(124,108,240,.14), rgba(62,142,247,.10));
      border: 1px solid rgba(124,108,240,.24);
    }
    .ai > acms-icon { color: var(--violet-fg); flex-shrink: 0; }
    .ai span { flex: 1; font-size: var(--fs-base); color: var(--ink-dim); }
    .ai button {
      width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
      display: grid; place-items: center; border: none; cursor: pointer; color: #fff;
      background: linear-gradient(135deg, var(--violet), var(--blue));
      box-shadow: var(--sh-brand);
    }

    .stamp { margin: 0; font-size: var(--fs-xs); color: var(--ink-dim); }

    @media (max-width: 1280px) {
      .kpis { grid-template-columns: repeat(2, 1fr); }
      .grid, .grid3 { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) { .kpis { grid-template-columns: 1fr; } }
  `],
})
export class DashboardComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService);

  protected readonly kpi = signal<KpiSummary | null>(null);
  protected readonly funnel = signal<FunnelStats | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly updatedAt = signal<string | null>(null);

  protected readonly submittedSeries = signal<number[]>([]);
  protected readonly printedSeries = signal<number[]>([]);
  protected readonly trafficSeries = signal<number[]>([]);
  protected readonly barGroups = signal<BarGroup[]>([]);
  protected readonly statusSlices = signal<DonutSlice[]>([]);

  protected readonly range = signal('30');
  protected readonly ranges: SegmentOption[] = [
    { label: 'Today', value: '1' },
    { label: '7 days', value: '7' },
    { label: '30 days', value: '30' },
  ];

  protected readonly today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  protected get partOfDay(): string {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  }

  ngOnInit(): void { this.load(); }

  protected pct(value: number, f: FunnelStats): number {
    const base = Math.max(f.submitted, 1);
    return Math.min(100, Math.round((value / base) * 100));
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.analytics.getSummary().subscribe({
      next: data => {
        this.kpi.set(data);
        this.loading.set(false);
        this.updatedAt.set(new Date().toLocaleTimeString());
        this.statusSlices.set([
          { label: 'Active',  value: data.activeCards,     colour: 'url(#none)' },
          { label: 'Pending', value: data.pendingRequests, colour: '#F4536B' },
        ].map((s, i) => ({ ...s, colour: i === 0 ? '#7C6CF0' : '#F4536B' })));
      },
      error: err => {
        this.error.set(
          err?.error?.error?.message ??
          (err?.status === 401 ? 'Unauthorized (401) - no JWT yet.' : null) ??
          (err?.status === 0 ? 'No response. Is the backend running on port 5000?' : null) ??
          err?.message ?? 'Unknown error',
        );
        this.loading.set(false);
      },
    });

    // Trend data. Fails silently - a missing chart must never break the KPIs.
    this.analytics.getFunnel().subscribe({
      next: f => this.funnel.set(f),
      error: () => this.funnel.set(null),
    });

    this.analytics.getDailyCards().subscribe({
      next: rows => {
        this.submittedSeries.set(series(rows, 'submitted'));
        this.printedSeries.set(series(rows, 'printed'));
        this.barGroups.set(this.toBars(rows));
      },
      error: () => { /* charts render their own empty state */ },
    });

    this.analytics.getTraffic().subscribe({
      next: rows => this.trafficSeries.set(series(rows, 'entrycount')),
      error: () => { /* same */ },
    });
  }

  /** Last 8 ETL rows as grouped bars. */
  private toBars(rows: EtlRow[]): BarGroup[] {
    const sub = series(rows, 'submitted', 8);
    const pri = series(rows, 'printed', 8);
    if (!sub.length || sub.length !== pri.length) return [];
    const tail = rows.slice(-8);
    return sub.map((a, i) => ({
      label: this.shortDate(tail[i]),
      a,
      b: pri[i],
    }));
  }

  private shortDate(row: EtlRow): string {
    const key = Object.keys(row).find(k => /date/i.test(k));
    const raw = key ? row[key] : null;
    if (typeof raw !== 'string') return '';
    const d = new Date(raw);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
}