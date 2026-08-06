// =============================================================================
// src/app/pages/admin/admin-signoff.component.ts
// =============================================================================

import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import {
  MILESTONE_NAMES, OPEN_ITEMS, PHASES, PhaseRow, PhaseStatus, SIGNOFF_AS_OF,
} from './signoff.data';

@Component({
  selector: 'acms-admin-signoff',
  standalone: true,
  imports: [GlassCardComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <acms-glass-card>
      <div class="hero">
        <div class="ring" [style.--pct]="pct()">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ring__track" cx="60" cy="60" r="52" />
            <circle class="ring__fill" cx="60" cy="60" r="52"
                    [attr.stroke-dasharray]="circumference"
                    [attr.stroke-dashoffset]="dashOffset()" />
          </svg>
          <div class="ring__label">
            <span class="ring__pct">{{ pct() }}<span class="ring__sym">%</span></span>
            <span class="ring__sub">complete</span>
          </div>
        </div>

        <div class="hero__text">
          <h2 class="hero__title">ACMS Dashboard delivery status</h2>
          <p class="hero__sub">
            {{ doneCount() }} of {{ phases.length }} phases closed out, 1 in progress.
            Figures reflect the implementation plan's phase list, not lines of code.
          </p>
          <div class="legend">
            <span class="lg"><i class="dot dot--done"></i> Complete</span>
            <span class="lg"><i class="dot dot--active"></i> In progress</span>
            <span class="lg"><i class="dot dot--pending"></i> Not started</span>
          </div>
          <p class="asof">
            <acms-icon name="clock" [size]="13" />
            Status as of {{ asOf }} &middot; maintained manually alongside the plan document
          </p>
        </div>
      </div>
    </acms-glass-card>

    @for (m of milestones; track m) {
      <section class="ms">
        <header class="ms__head">
          <h3 class="ms__title">
            <span class="ms__num">{{ m }}</span>
            {{ milestoneName(m) }}
          </h3>
          <span class="ms__count">{{ doneIn(m) }} / {{ phasesIn(m).length }}</span>
        </header>

        <acms-glass-card [flush]="true">
          <ul class="phases">
            @for (p of phasesIn(m); track p.n) {
              <li class="phase" [attr.data-status]="p.status">
                <span class="phase__mark" [attr.aria-label]="statusLabel(p.status)">
                  @if (p.status === 'done') {
                    <acms-icon name="check" [size]="13" [weight]="3" />
                  } @else if (p.status === 'active') {
                    <span class="pulse"></span>
                  }
                </span>
                <div class="phase__body">
                  <span class="phase__name">
                    <span class="phase__n">Phase {{ p.n }}</span>{{ p.name }}
                  </span>
                  <span class="phase__note">{{ p.note }}</span>
                </div>
                <span class="phase__state">{{ statusLabel(p.status) }}</span>
              </li>
            }
          </ul>
        </acms-glass-card>
      </section>
    }

    <section class="ms">
      <header class="ms__head">
        <h3 class="ms__title">
          <span class="ms__num ms__num--warn">
            <acms-icon name="alert" [size]="13" [weight]="2.4" />
          </span>
          Open items for supervisor decision
        </h3>
        <span class="ms__count">{{ openItems.length }}</span>
      </header>

      <acms-glass-card [flush]="true">
        <ul class="opens">
          @for (o of openItems; track o.title) {
            <li class="open">
              <div class="open__head">
                <span class="open__title">{{ o.title }}</span>
                <span class="open__ref">{{ o.ref }}</span>
              </div>
              <p class="open__detail">{{ o.detail }}</p>
            </li>
          }
        </ul>
      </acms-glass-card>
    </section>
  `,
  styles: [`
    :host { display: block; }

    .hero { display: flex; align-items: center; gap: 26px; flex-wrap: wrap; }

    .ring { position: relative; width: 132px; height: 132px; flex: none; }
    .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring__track {
      fill: none; stroke: currentColor; stroke-width: 9; opacity: .13;
    }
    .ring__fill {
      fill: none; stroke: url(#none); stroke-width: 9; stroke-linecap: round;
      stroke: #8B5CF6;
      transition: stroke-dashoffset .8s cubic-bezier(.16,1,.3,1);
    }
    .ring__label {
      position: absolute; inset: 0; display: grid; place-content: center;
      text-align: center; line-height: 1.05;
    }
    .ring__pct {
      font-family: var(--font-display, inherit);
      font-size: 2rem; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .ring__sym { font-size: 1rem; opacity: .6; margin-left: 1px; }
    .ring__sub { font-size: .72rem; opacity: .7; }

    .hero__text { flex: 1 1 300px; min-width: 0; }
    .hero__title {
      font-family: var(--font-display, inherit);
      font-size: 1.18rem; font-weight: 700; margin: 0 0 6px;
    }
    .hero__sub { margin: 0 0 12px; font-size: .85rem; opacity: .8; line-height: 1.5; }

    .legend { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
    .lg { display: inline-flex; align-items: center; gap: 6px; font-size: .76rem; opacity: .85; }
    .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .dot--done    { background: #10B981; }
    .dot--active  { background: #8B5CF6; }
    .dot--pending { background: #64748B; opacity: .55; }

    .asof {
      display: inline-flex; align-items: center; gap: 6px;
      margin: 0; font-size: .74rem; opacity: .62;
    }

    .ms { margin-top: 22px; }
    .ms__head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; margin-bottom: 10px;
    }
    .ms__title {
      display: flex; align-items: center; gap: 10px; margin: 0;
      font-family: var(--font-display, inherit); font-size: .98rem; font-weight: 650;
    }
    .ms__num {
      display: grid; place-items: center; width: 24px; height: 24px; flex: none;
      border-radius: 8px; font-size: .78rem; font-weight: 700;
      background: color-mix(in srgb, #8B5CF6 16%, transparent); color: #7C3AED;
    }
    .ms__num--warn {
      background: color-mix(in srgb, #E8A33D 20%, transparent); color: #B45309;
    }
    .ms__count { font-size: .78rem; opacity: .68; font-variant-numeric: tabular-nums; }

    .phases, .opens { list-style: none; margin: 0; padding: 0; }

    .phase {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line, rgba(127,127,127,.16));
    }
    .phase:last-child { border-bottom: 0; }

    .phase__mark {
      display: grid; place-items: center; width: 20px; height: 20px; flex: none;
      margin-top: 2px; border-radius: 50%;
      border: 1.5px solid var(--line, rgba(127,127,127,.35));
      color: #fff;
    }
    .phase[data-status="done"] .phase__mark {
      background: #10B981; border-color: #10B981;
    }
    .phase[data-status="active"] .phase__mark {
      border-color: #8B5CF6; background: transparent;
    }
    .pulse {
      width: 8px; height: 8px; border-radius: 50%; background: #8B5CF6;
      animation: pulse 1.8s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1;  transform: scale(1); }
      50%      { opacity: .45; transform: scale(.75); }
    }
    @media (prefers-reduced-motion: reduce) {
      .pulse { animation: none; }
      .ring__fill { transition: none; }
    }

    .phase__body { display: grid; gap: 2px; min-width: 0; flex: 1; }
    .phase__name { font-size: .86rem; font-weight: 600; }
    .phase__n {
      display: inline-block; margin-right: 8px; opacity: .55;
      font-variant-numeric: tabular-nums; font-weight: 500;
    }
    .phase__note { font-size: .76rem; opacity: .7; line-height: 1.45; }
    .phase__state {
      font-size: .72rem; font-weight: 600; opacity: .7; white-space: nowrap;
      align-self: center;
    }
    .phase[data-status="pending"] { opacity: .68; }

    .open {
      padding: 13px 16px;
      border-bottom: 1px solid var(--line, rgba(127,127,127,.16));
    }
    .open:last-child { border-bottom: 0; }
    .open__head {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: 12px; flex-wrap: wrap; margin-bottom: 3px;
    }
    .open__title { font-size: .86rem; font-weight: 650; }
    .open__ref { font-size: .72rem; opacity: .6; white-space: nowrap; }
    .open__detail { margin: 0; font-size: .78rem; opacity: .78; line-height: 1.5; }

    @media (max-width: 640px) {
      .phase__state { display: none; }
    }
  `],
})
export class AdminSignoffComponent {
  readonly phases = PHASES;
  readonly openItems = OPEN_ITEMS;
  readonly asOf = SIGNOFF_AS_OF;
  readonly milestones: (1 | 2 | 3)[] = [1, 2, 3];

  readonly circumference = 2 * Math.PI * 52;

  readonly doneCount = computed(() => this.phases.filter((p) => p.status === 'done').length);

  /** In-progress phases count as half, so the bar moves during a phase. */
  readonly pct = computed(() => {
    const weighted = this.phases.reduce(
      (sum, p) => sum + (p.status === 'done' ? 1 : p.status === 'active' ? 0.5 : 0), 0);
    return Math.round((weighted / this.phases.length) * 100);
  });

  readonly dashOffset = computed(() =>
    this.circumference * (1 - this.pct() / 100));

  milestoneName(m: 1 | 2 | 3): string { return MILESTONE_NAMES[m]; }

  phasesIn(m: 1 | 2 | 3): PhaseRow[] {
    return this.phases.filter((p) => p.milestone === m);
  }

  doneIn(m: 1 | 2 | 3): number {
    return this.phasesIn(m).filter((p) => p.status === 'done').length;
  }

  statusLabel(s: PhaseStatus): string {
    return s === 'done' ? 'Complete' : s === 'active' ? 'In progress' : 'Not started';
  }
}