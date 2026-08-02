import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';
import { SparklineComponent } from '../sparkline/sparkline.component';

export type KpiTone = 'violet' | 'cyan' | 'blue' | 'rose';

/** Sparkline stroke per tone - light enough to read on the gradient. */
const SPARK_HEX: Record<KpiTone, string> = {
  violet: '#C4B5FD',
  cyan:   '#67E8F9',
  blue:   '#93C5FD',
  rose:   '#FDA4AF',
};

@Component({
  selector: 'acms-kpi-card',
  standalone: true,
  imports: [IconComponent, SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpi" [attr.data-tone]="tone()">
      <!-- Soft radial glow in the vivid corner - no ring/dot art. The
           gradient itself is the visual; this just adds a lit, raised feel. -->
      <span class="glow"></span>

      <span class="sheen"></span>

      <div class="top">
        <span class="ic"><acms-icon [name]="icon()" [size]="17" [weight]="2" /></span>
        @if (delta() !== null) {
          <span class="trend" [class.trend--down]="(delta() ?? 0) < 0">
            <acms-icon [name]="(delta() ?? 0) < 0 ? 'trendDown' : 'trendUp'"
                       [size]="10" [weight]="3" />
            {{ absDelta() }}%
          </span>
        }
      </div>

      <div class="label">{{ label() }}</div>

      @if (loading()) {
        <div class="sk"></div>
      } @else {
        <div class="value">{{ display() }}</div>
      }

      @if (note()) { <div class="note">{{ note() }}</div> }

      @if (spark().length > 1 && !loading()) {
        <div class="spark"><acms-sparkline [points]="spark()" [colour]="sparkHex()" /></div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .kpi {
      position: relative;
      height: 100%;
      overflow: hidden;
      padding: var(--s-5);
      border-radius: var(--r-lg);
      border: 1px solid rgba(255, 255, 255, .14);
      box-shadow: var(--sh-card), inset 0 1px 0 rgba(255, 255, 255, .18);
      transition: transform var(--t-base) var(--ease),
                  box-shadow var(--t-base) var(--ease);
      /* Every colour below is fixed, not token-driven: these cards keep the
         same vivid identity in light and dark mode by design. */
      color: #fff;
    }
    .kpi:hover { transform: translateY(-4px); box-shadow: var(--sh-lift); }

    /* Deep stop on the left where text sits (6-7:1 with white), vivid stop
       top-right behind the artwork only. */
    [data-tone='violet'] { background: linear-gradient(115deg, #4C3BC4 0%, #6D5AE8 58%, #8B5CF6 100%); }
    [data-tone='cyan']   { background: linear-gradient(115deg, #155E75 0%, #0E7490 55%, #22D3EE 100%); }
    [data-tone='blue']   { background: linear-gradient(115deg, #1D4ED8 0%, #2563EB 58%, #60A5FA 100%); }
    [data-tone='rose']   { background: linear-gradient(115deg, #BE123C 0%, #E11D48 58%, #FB7185 100%); }

    .glow {
      position: absolute; top: -18%; right: -14%;
      width: 65%; aspect-ratio: 1; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,.30) 0%, transparent 70%);
      pointer-events: none;
      transition: opacity var(--t-slow) var(--ease), transform var(--t-slow) var(--ease);
    }
    .kpi:hover .glow { transform: scale(1.12); opacity: .85; }

    /* Specular sweep on hover */
    .sheen {
      position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: linear-gradient(105deg,
        transparent 34%, rgba(255,255,255,.13) 47%,
        rgba(255,255,255,.05) 55%, transparent 64%);
      transform: translateX(-125%);
      transition: transform 760ms var(--ease);
    }
    .kpi:hover .sheen { transform: translateX(125%); }

    .top {
      position: relative; z-index: 2;
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: var(--s-4);
    }
    .ic {
      display: grid; place-items: center; width: 38px; height: 38px;
      border-radius: 12px; color: #fff;
      background: rgba(255, 255, 255, .18);
      border: 1px solid rgba(255, 255, 255, .22);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.25);
      transition: transform var(--t-base) var(--ease-spring);
    }
    .kpi:hover .ic { transform: scale(1.08) rotate(-5deg); }

    .trend {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 4px 9px; border-radius: var(--r-pill);
      font-size: var(--fs-xs); font-weight: 700;
      background: rgba(255, 255, 255, .2);
      border: 1px solid rgba(255, 255, 255, .2);
      color: #fff;
    }
    .trend--down { background: rgba(0, 0, 0, .22); }

    .label {
      position: relative; z-index: 2;
      font-size: var(--fs-sm); font-weight: 600;
      color: rgba(255, 255, 255, .82);
      margin-bottom: 5px;
    }
    .value {
      position: relative; z-index: 2;
      font-family: var(--font-display);
      font-size: 34px; font-weight: 700;
      line-height: 1.05; letter-spacing: -.03em;
      color: #fff;
      text-shadow: 0 2px 12px rgba(0, 0, 0, .18);
    }
    .sk {
      position: relative; z-index: 2;
      height: 34px; width: 78px; border-radius: var(--r-sm);
      background: linear-gradient(90deg,
        rgba(255,255,255,.14) 25%, rgba(255,255,255,.28) 50%, rgba(255,255,255,.14) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    .note {
      position: relative; z-index: 2;
      margin-top: 6px;
      font-size: var(--fs-xs);
      color: rgba(255, 255, 255, .72);
    }
    .spark { position: relative; z-index: 2; margin-top: var(--s-3); }

    @media (prefers-reduced-motion: reduce) {
      .kpi, .art, .sheen, .ic { transition: none; }
      .sk { animation: none; }
    }
  `],
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input<number | null>(null);
  readonly note = input<string>();
  readonly tone = input<KpiTone>('violet');
  readonly icon = input<IconName>('grid');
  readonly loading = input(false);
  /** Percent change vs previous period. Leave null unless it is REAL. */
  readonly delta = input<number | null>(null);
  readonly spark = input<number[]>([]);

  protected readonly display = signal('0');
  protected readonly absDelta = computed(() => Math.abs(this.delta() ?? 0));
  protected readonly sparkHex = computed(() => SPARK_HEX[this.tone()]);

  constructor() {
    effect(() => {
      const v = this.value();
      if (v === null || this.loading()) return;
      this.animateTo(v);
    });
  }

  private animateTo(target: number): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.display.set(target.toLocaleString());
      return;
    }
    const duration = 780;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      this.display.set(Math.round(target * eased).toLocaleString());
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}