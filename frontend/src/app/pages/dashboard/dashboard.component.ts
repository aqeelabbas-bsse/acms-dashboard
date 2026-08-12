import {
  ChangeDetectionStrategy, Component, ElementRef, OnInit,
  computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { ChartData } from 'chart.js';
import { AnalyticsService } from '../../core/services/analytics.service';
import { ChartThemeService } from '../../core/services/chart-theme.service';
import { SignalrService } from '../../core/services/signalr.service';
import { ExportService } from '../../core/services/export.service';
import { series, numField } from '../../core/utils/etl';
import { EtlRow, FunnelStats, KpiSummary } from '../../core/models/api.models';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card/kpi-card.component';
import { ChartComponent } from '../../shared/ui/chart/chart.component';
import { AuditFeedComponent } from '../../shared/ui/audit-feed/audit-feed.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SegmentedComponent, SegmentOption } from '../../shared/ui/segmented/segmented.component';
import { ExportMenuComponent, ExportFormat } from '../../shared/ui/export-menu/export-menu.component';
import { DrilldownModalComponent } from '../../shared/ui/drilldown/drilldown-modal.component';
import { DrilldownService } from '../../core/services/drilldown.service';
import { DRILLDOWN_META, DRILL_TILE_KINDS, DrilldownKind } from '../../core/models/drilldown.models';

@Component({
  selector: 'acms-dashboard',
  standalone: true,
  imports: [
    GlassCardComponent, KpiCardComponent, ChartComponent, AuditFeedComponent,
    IconComponent, SegmentedComponent, ExportMenuComponent, DrilldownModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #printArea>
      <header class="page rise">
        <div>
          <div class="eyebrow">{{ today }}</div>
          <h1 class="title">Good {{ partOfDay }}, <span class="grad-text">Aqeel Abbas</span></h1>
          <p class="sub">Here's what's happening across access control right now.</p>
        </div>

        <div class="tools">
          <acms-segmented [options]="ranges" [(value)]="range" />

          <!-- One Export control instead of two buttons: "Export" and "PDF"
               were both exports, differing only in file type. -->
          <acms-export-menu [disabled]="loading()" (exportAs)="onExport($event)" />

          <button class="primary" type="button" (click)="load()" [disabled]="loading()">
            <acms-icon name="refresh" [size]="15" [weight]="2" />
            Refresh
          </button>
        </div>
      </header>

      @if (error()) {
        <div class="alert" role="alert">
          <acms-icon name="alert" [size]="17" [weight]="2.2" />
          <div><strong>Couldn't load analytics.</strong> {{ error() }}</div>
        </div>
      }

      <!-- KPI row. Every card is drillable: clicking opens the same
           breakdown -> searchable grid flow as the tiles below, and each one
           publishes the SQL predicate behind its number. -->
      <section class="kpis stagger">
        <acms-kpi-card label="Total Employees" tone="violet" icon="users"
          [value]="kpi()?.totalEmployees ?? null" [loading]="loading()"
          note="Registered smart-card profiles"
          [clickable]="true" (drill)="openDrilldown('total-employees')" />

        <acms-kpi-card label="Active Visitor Cards" tone="cyan" icon="card"
          [value]="kpi()?.activeCards ?? null" [loading]="loading()"
          note="Passes issued and not blocked"
          [clickable]="true" (drill)="openDrilldown('active-visitor-cards')" />

        <acms-kpi-card label="Visitors On Site Now" tone="blue" icon="pin"
          [value]="liveOccupancy()" [loading]="loading()"
          [note]="occupancyNote()"
          [clickable]="true" (drill)="openDrilldown('visitors-on-site')" />

        <acms-kpi-card label="Pending Staff Requests" tone="rose" icon="clock"
          [value]="kpi()?.pendingRequests ?? null" [loading]="loading()"
          note="Awaiting verification or printing"
          [clickable]="true" (drill)="openDrilldown('pending-requests')" />
      </section>

      <!-- Primary analytics row -->
      <section class="grid stagger">
        <acms-glass-card title="Card activity dynamics"
                         subtitle="Submitted vs printed over the selected period">
          <span cardAction class="pill pill--violet">ETL</span>
          <acms-chart type="bar" [data]="activityData()" [options]="activityOpts"
                      [loading]="loading()" [height]="270"
                      ariaLabel="Grouped bar chart of cards submitted versus printed per day"
                      emptyIcon="bars"
                      emptyMessage="No card activity recorded in this window." />
          <div class="legend">
            <span><i style="background:#8B5CF6"></i>Submitted</span>
            <span><i style="background:#22D3EE"></i>Printed</span>
          </div>
        </acms-glass-card>

        <acms-glass-card title="Live activity" subtitle="Real-time audit feed">
          <span cardAction class="pill" [attr.data-conn]="hub.state()">
            <i class="dot"></i>{{ connLabel() }}
          </span>
          <acms-audit-feed />
        </acms-glass-card>
      </section>

      <!-- Access control breakdown - click any tile to drill from a KPI into a
           category histogram into a searchable grid. -->
      <section class="drill-tiles stagger">
        @for (t of drilldownTiles(); track t.kind) {
          <button type="button" class="dtile" [attr.data-tone]="t.tone" (click)="openDrilldown(t.kind)">
            <span class="dtile__ic"><acms-icon [name]="t.icon" [size]="17" [weight]="2" /></span>
            <span class="dtile__n">{{ t.value === null ? '\u2014' : t.value }}</span>
            <span class="dtile__l">{{ t.title }}</span>
          </button>
        }
      </section>

      <acms-drilldown-modal [kind]="openKind()" (closed)="openKind.set(null)" />

      <!-- Secondary analytics row -->
      <section class="grid3 stagger">
        <acms-glass-card title="Request funnel" subtitle="Submitted to printed">
          <acms-chart type="bar" [data]="funnelData()" [options]="funnelOpts"
                      [loading]="loading()" [height]="220"
                      ariaLabel="Horizontal funnel of card requests by stage"
                      emptyIcon="card"
                      emptyMessage="No requests submitted in this period." />
          @if (conversion() !== null) {
            <div class="conv">
              <span class="conv__k">{{ conversion() }}%</span>
              <span class="conv__v">submitted &rarr; printed conversion</span>
            </div>
          }
          @if (funnelBasis(); as basis) {
            <p class="basis"><acms-icon name="alert" [size]="11" />{{ basis }}</p>
          }
        </acms-glass-card>

        <acms-glass-card title="Card status" subtitle="Active vs pending">
          <acms-chart type="doughnut" [data]="statusData()" [options]="donutOpts"
                      [loading]="loading()" [height]="220"
                      ariaLabel="Doughnut chart of active versus pending cards"
                      emptyIcon="rfid" />
        </acms-glass-card>

        <acms-glass-card title="Visitor traffic" subtitle="Entries and exits">
          <acms-chart type="line" [data]="trafficData()" [options]="trafficOpts"
                      [loading]="loading()" [height]="220"
                      ariaLabel="Line chart of visitor entries and exits over time"
                      emptyIcon="activity"
                      emptyMessage="No visitor movement in this window." />
          <div class="legend">
            <span><i style="background:#3B82F6"></i>Entries</span>
            <span><i style="background:#F59E0B"></i>Exits</span>
          </div>
        </acms-glass-card>
      </section>

      @if (updatedAt()) {
        <p class="stamp">
          <acms-icon name="clock" [size]="12" />
          Last updated {{ updatedAt() }}
        </p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .page { display: flex; align-items: flex-end; justify-content: space-between;
            gap: var(--s-6); flex-wrap: wrap; margin-bottom: var(--s-6);
            position: relative; z-index: 5; }
    .title { font-size: var(--fs-2xl); font-weight: 700; margin: 6px 0 4px; }
    .sub { margin: 0; color: var(--ink-muted); }
    .tools { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; }

    .primary {
      display: inline-flex; align-items: center; gap: 7px;
      height: 38px; padding: 0 16px;
      border-radius: var(--r-pill);
      font-family: var(--font-body); font-size: var(--fs-sm); font-weight: 600;
      cursor: pointer; white-space: nowrap;
      transition: all var(--t-fast) var(--ease);
      border: none; color: #fff;
      background: linear-gradient(135deg, var(--violet), var(--violet-deep));
      box-shadow: var(--sh-brand);
    }
    .primary:hover:not(:disabled) { transform: translateY(-1px); }
    .primary:disabled { opacity: .5; cursor: not-allowed; }

    .alert {
      display: flex; gap: var(--s-3); align-items: flex-start;
      margin-bottom: var(--s-5); padding: var(--s-4) var(--s-5);
      border-radius: var(--r-md);
      background: var(--danger-bg); color: var(--ink-soft); font-size: var(--fs-sm);
    }
    .alert acms-icon { color: var(--danger-fg); flex-shrink: 0; }

    .drill-tiles {
      display: grid; grid-template-columns: repeat(5, 1fr);
      gap: var(--s-4); margin: 0 0 var(--s-6);
    }
    .dtile {
      position: relative;
      overflow: hidden;
      display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
      padding: var(--s-4) var(--s-5); border-radius: var(--r-lg);
      border: 1px solid rgba(255, 255, 255, .14);
      box-shadow: var(--sh-card), inset 0 1px 0 rgba(255,255,255,.18);
      cursor: pointer; text-align: left; font: inherit; color: #fff;
      transition: transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
    }
    .dtile:hover { transform: translateY(-3px); box-shadow: var(--sh-float), inset 0 1px 0 rgba(255,255,255,.18); }
    .dtile:focus-visible { outline: none; box-shadow: var(--sh-float), 0 0 0 3px rgba(255,255,255,.85); }

    /* Same formula as the big KPI cards: deep, contrast-checked stop where
       the text sits (all >=5:1 with white), vivid stop only in the far
       corner where no text lives. */
    .dtile[data-tone='teal']   { background: linear-gradient(115deg, #155E63 0%, #0E7490 55%, #22D3EE 100%); }
    .dtile[data-tone='rose']   { background: linear-gradient(115deg, #9F1239 0%, #E11D48 55%, #FB7185 100%); }
    .dtile[data-tone='amber']  { background: linear-gradient(115deg, #92400E 0%, #D97706 55%, #FBBF24 100%); }
    .dtile[data-tone='blue']   { background: linear-gradient(115deg, #1E3A8A 0%, #2563EB 55%, #60A5FA 100%); }
    .dtile[data-tone='violet'] { background: linear-gradient(115deg, #4C3BC4 0%, #6D5AE8 55%, #8B5CF6 100%); }
    .dtile[data-tone='cyan']   { background: linear-gradient(115deg, #155E75 0%, #0E7490 55%, #22D3EE 100%); }

    .dtile::after {
      content: '';
      position: absolute; top: -30%; right: -18%;
      width: 70%; aspect-ratio: 1; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,.32) 0%, transparent 70%);
      pointer-events: none;
      transition: opacity var(--t-slow) var(--ease);
    }
    .dtile:hover::after { opacity: 1.15; }

    .dtile__ic {
      position: relative; z-index: 1;
      display: grid; place-items: center; width: 30px; height: 30px;
      border-radius: 9px;
      background: rgba(255, 255, 255, .18);
      border: 1px solid rgba(255, 255, 255, .22);
      color: #fff;
      transition: transform var(--t-fast) var(--ease-spring);
    }
    .dtile:hover .dtile__ic { transform: scale(1.08) rotate(-4deg); }

    .dtile__n {
      position: relative; z-index: 1;
      font-family: var(--font-display); font-size: var(--fs-lg); font-weight: 700;
      color: #fff;
      text-shadow: 0 1px 8px rgba(0,0,0,.25);
    }
    .dtile__l {
      position: relative; z-index: 1;
      font-size: var(--fs-xs); color: rgba(255, 255, 255, .82);
    }
    @media (max-width: 900px) { .drill-tiles { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px) { .drill-tiles { grid-template-columns: 1fr; } }

    .kpis  { display: grid; grid-template-columns: repeat(4, 1fr);
             gap: var(--s-5); margin-bottom: var(--s-5); }
    .grid  { display: grid; grid-template-columns: 1.55fr 1fr;
             gap: var(--s-5); margin-bottom: var(--s-5); }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-5); }

    .legend { display: flex; gap: var(--s-5); margin-top: var(--s-3); }
    .legend span { display: flex; align-items: center; gap: 6px;
                   font-size: var(--fs-xs); color: var(--ink-muted); }
    .legend i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }

    /* Connection pill reflects real hub state, not a hardcoded "Live" */
    .pill .dot { width: 6px; height: 6px; border-radius: 50%;
                 background: currentColor; margin-right: 5px; }
    .pill[data-conn='live']         { background: var(--success-bg); color: var(--success-fg); }
    .pill[data-conn='live'] .dot    { animation: blink 1.6s ease-in-out infinite; }
    .pill[data-conn='connecting'],
    .pill[data-conn='reconnecting'] { background: var(--warn-bg); color: var(--warn-fg); }
    .pill[data-conn='reconnecting'] .dot { animation: blink .8s ease-in-out infinite; }
    .pill[data-conn='down'],
    .pill[data-conn='idle']         { background: var(--danger-bg); color: var(--danger-fg); }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }

    .conv { display: flex; align-items: baseline; gap: 8px; margin-top: var(--s-3);
            padding-top: var(--s-3); border-top: 1px solid var(--track); }
    .conv__k { font-family: var(--font-display); font-size: var(--fs-lg);
               font-weight: 700; color: var(--violet-fg); }
    .conv__v { font-size: var(--fs-xs); color: var(--ink-muted); }

    /* States which population the percentage describes. Without it the figure
       invites the reading "printed / submitted on these same days", which is
       what made an out-of-cohort result look like a bug. */
    .basis { display: flex; align-items: flex-start; gap: 6px;
             margin: 8px 0 0; font-size: var(--fs-xs); color: var(--ink-dim);
             line-height: 1.5; }
    .basis acms-icon { flex-shrink: 0; margin-top: 3px; }

    .stamp { display: flex; align-items: center; gap: 6px;
             margin: var(--s-6) 0 0; font-size: var(--fs-xs); color: var(--ink-dim); }

    @media (max-width: 1280px) {
      .kpis { grid-template-columns: repeat(2, 1fr); }
      .grid, .grid3 { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) { .kpis { grid-template-columns: 1fr; } }
  `],
})
export class DashboardComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService);
  private readonly drilldownSvc = inject(DrilldownService);
  private readonly ct = inject(ChartThemeService);
  private readonly exporter = inject(ExportService);
  protected readonly hub = inject(SignalrService);

  /* ---------- Drill-downs ---------- */

  protected readonly openKind = signal<DrilldownKind | null>(null);

  private readonly drilldownTotals = signal<Partial<Record<DrilldownKind, number>>>({});

  /** Only the five tile kinds render here. The four KPI kinds share the same
   *  modal but already have their number from /analytics/summary. */
  protected readonly drilldownTiles = computed(() => {
    const totals = this.drilldownTotals();
    return DRILL_TILE_KINDS.map(kind => ({
      kind,
      icon: DRILLDOWN_META[kind].icon,
      title: DRILLDOWN_META[kind].title,
      tone: DRILLDOWN_META[kind].tone,
      value: totals[kind] ?? null,
    }));
  });

  protected openDrilldown(kind: DrilldownKind): void {
    this.openKind.set(kind);
  }

  /** Fires each tile's summary independently so one slow or failing kind never
   *  blocks the other four from showing their counts. */
  private loadDrilldownTotals(): void {
    DRILL_TILE_KINDS.forEach(kind => {
      this.drilldownSvc.summary(kind).subscribe({
        next: s => this.drilldownTotals.update(t => ({ ...t, [kind]: s.total })),
        error: () => { /* tile shows an em-dash; the modal surfaces the real error */ },
      });
    });
  }

  private readonly printArea = viewChild<ElementRef<HTMLElement>>('printArea');

  protected readonly kpi = signal<KpiSummary | null>(null);
  protected readonly funnel = signal<FunnelStats | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly updatedAt = signal<string | null>(null);

  private readonly dailyRows = signal<EtlRow[]>([]);
  private readonly trafficRows = signal<EtlRow[]>([]);

  protected readonly range = signal('30');
  protected readonly ranges: SegmentOption[] = [
    { label: 'Today', value: '1' },
    { label: '7 days', value: '7' },
    { label: '30 days', value: '30' },
    { label: '90 days', value: '90' },
  ];

  protected readonly today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  protected get partOfDay(): string {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  }

  /* ---------- Live occupancy: hub value wins, REST value seeds it ---------- */

  protected readonly liveOccupancy = computed(() =>
    this.hub.occupancy() ?? this.kpi()?.onSiteNow ?? null);

  protected readonly occupancyNote = computed(() =>
    this.hub.isLive() ? 'Updating live' : 'Visitors not yet checked out');

  protected readonly connLabel = computed(() => {
    switch (this.hub.state()) {
      case 'live': return 'Live';
      case 'connecting': return 'Connecting';
      case 'reconnecting': return 'Reconnecting';
      default: return 'Offline';
    }
  });

  /* ---------- Chart data ---------- */

  private readonly labels = computed(() =>
    this.dailyRows().slice(-14).map(r => this.shortDate(r)));

  protected readonly activityData = computed<ChartData>(() => ({
    labels: this.labels(),
    datasets: [
      {
        label: 'Submitted',
        data: series(this.dailyRows(), 'submitted', 14),
        backgroundColor: this.ct.series.violet,
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.72,
        categoryPercentage: 0.68,
      },
      {
        label: 'Printed',
        data: series(this.dailyRows(), 'printed', 14),
        backgroundColor: this.ct.series.cyan,
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.72,
        categoryPercentage: 0.68,
      },
    ],
  }));

  protected readonly activityOpts = {
    plugins: { legend: { display: false } },
  };

  /**
   * Reads from `funnel().totals`, not a flat object - the API returns a daily
   * points[] series plus an aggregate totals{} block. The totals are a cohort:
   * requests SUBMITTED in the window, tracked to their current stage, so the
   * three bars decrease monotonically and the rate cannot exceed 100%.
   */
  protected readonly funnelData = computed<ChartData>(() => {
    const f = this.funnel();
    if (!f) return { labels: [], datasets: [] };
    const t = f.totals;
    return {
      labels: ['Submitted', 'Verified', 'Printed'],
      datasets: [{
        label: 'Requests',
        data: [t.submitted, t.verified, t.printed],
        backgroundColor: [
          this.ct.series.violet, this.ct.series.blue, this.ct.series.cyan,
        ],
        borderRadius: 8,
        borderSkipped: false,
        barPercentage: 0.66,
      }],
    };
  });

  /** Horizontal bars read as a funnel far better than vertical ones. */
  protected readonly funnelOpts = {
    indexAxis: 'y' as const,
    scales: {
      x: { beginAtZero: true, grid: { display: false }, border: { display: false } },
      y: { grid: { display: false }, border: { display: false } },
    },
  };

  protected readonly conversion = computed(() => {
    const f = this.funnel();
    if (!f || !f.totals.submitted) return null;
    return Math.round(f.totals.overallConversionRate);
  });

  protected readonly funnelBasis = computed(() => this.funnel()?.totals?.basis ?? null);

  protected readonly statusData = computed<ChartData>(() => {
    const k = this.kpi();
    if (!k) return { labels: [], datasets: [] };
    return {
      labels: ['Active', 'Pending'],
      datasets: [{
        data: [k.activeCards, k.pendingRequests],
        backgroundColor: [this.ct.series.violet, this.ct.series.rose],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    };
  });

  protected readonly donutOpts = {
    cutout: '68%',
    scales: undefined,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          usePointStyle: true, pointStyle: 'circle' as const,
          boxWidth: 8, boxHeight: 8, padding: 14,
          font: { family: 'Inter, sans-serif', size: 12 },
        },
      },
    },
  };

  protected readonly trafficData = computed<ChartData>(() => {
    const entries = series(this.trafficRows(), 'entrycount', 14);
    const exits = series(this.trafficRows(), 'exitcount', 14);
    if (!entries.length) return { labels: [], datasets: [] };

    return {
      labels: this.trafficRows().slice(-14).map(r => this.shortDate(r)),
      datasets: [
        {
          label: 'Entries',
          data: entries,
          borderColor: this.ct.series.blue,
          pointRadius: 0, pointHoverRadius: 5,
          borderWidth: 2.4, tension: 0.38, fill: true,
          backgroundColor: (c: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
            const a = c.chart.chartArea;
            return a ? this.ct.gradient(c.chart.ctx, a, this.ct.series.blue)
                     : 'transparent';
          },
        },
        {
          label: 'Exits',
          data: exits,
          borderColor: this.ct.series.amber,
          pointRadius: 0, pointHoverRadius: 5,
          borderWidth: 2, tension: 0.38,
          borderDash: [5, 4], fill: false,
        },
      ],
    };
  });

  protected readonly trafficOpts = { plugins: { legend: { display: false } } };

  constructor() {
    // Refetch whenever the range segment changes.
    effect(() => { const r = this.range(); this.fetch(+r); });
  }

  ngOnInit(): void {
    this.hub.connect();
    this.loadDrilldownTotals();
  }

  protected load(): void { this.fetch(+this.range()); }

  /* ---------- Export ---------- */

  protected onExport(format: ExportFormat): void {
    if (format === 'csv') this.exportCsv();
    else this.print();
  }

  private exportCsv(): void {
    const rows = this.dailyRows();
    if (!rows.length) return;
    this.exporter.exportCsv(rows, [
      { header: 'Date',      value: r => this.rawDate(r) },
      { header: 'Submitted', value: r => numField(r, 'submitted') },
      { header: 'Verified',  value: r => numField(r, 'verified') },
      { header: 'Printed',   value: r => numField(r, 'printed') },
    ], 'acms-card-activity');
  }

  private print(): void {
    const el = this.printArea()?.nativeElement;
    if (el) this.exporter.printElement(el, 'ACMS Dashboard');
  }

  /* ---------- Data ---------- */

  private fetch(days: number): void {
    this.loading.set(true);
    this.error.set(null);

    const to = new Date();
    const from = new Date(Date.now() - (days - 1) * 86_400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    this.analytics.getSummary().subscribe({
      next: data => {
        this.kpi.set(data);
        this.hub.seedOccupancy(data.onSiteNow);
        this.loading.set(false);
        this.updatedAt.set(new Date().toLocaleTimeString());
      },
      error: err => {
        this.error.set(
          err?.error?.error?.message ??
          (err?.status === 401 ? 'Unauthorized (401) - your session may have expired.' : null) ??
          (err?.status === 0 ? 'No response. Is the backend running on port 5000?' : null) ??
          err?.message ?? 'Unknown error');
        this.loading.set(false);
      },
    });

    // Trend endpoints fail silently: a missing chart must never break the KPIs.
    this.analytics.getFunnel(iso(from), iso(to)).subscribe({
      next: f => this.funnel.set(f),
      error: () => this.funnel.set(null),
    });

    this.analytics.getDailyCards(iso(from), iso(to)).subscribe({
      next: rows => this.dailyRows.set(rows ?? []),
      error: () => this.dailyRows.set([]),
    });

    this.analytics.getTraffic(iso(from), iso(to)).subscribe({
      next: rows => this.trafficRows.set(rows ?? []),
      error: () => this.trafficRows.set([]),
    });
  }

  private rawDate(row: EtlRow): string {
    const key = Object.keys(row).find(k => /date/i.test(k));
    const raw = key ? row[key] : null;
    return typeof raw === 'string' ? raw.slice(0, 10) : '';
  }

  private shortDate(row: EtlRow): string {
    const raw = this.rawDate(row);
    if (!raw) return '';
    const d = new Date(raw);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
}