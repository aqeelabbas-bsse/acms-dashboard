import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';
import { SparklineComponent } from '../sparkline/sparkline.component';

export type KpiTone = 'violet' | 'teal' | 'blue' | 'amber' | 'rose';

const TONE_HEX: Record<KpiTone, string> = {
  violet: '#7C6CF0', teal: '#12C4A6', blue: '#3E8EF7',
  amber: '#F5A524',  rose: '#F4536B',
};

@Component({
  selector: 'acms-kpi-card',
  standalone: true,
  imports: [IconComponent, SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpi" [attr.data-tone]="tone()">
      <div class="top">
        <span class="ic"><acms-icon [name]="icon()" [size]="16" /></span>
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
        <div class="skeleton sk"></div>
      } @else {
        <div class="value">{{ display() }}</div>
      }

      @if (note()) { <div class="note">{{ note() }}</div> }

      @if (spark().length > 1 && !loading()) {
        <div class="spark"><acms-sparkline [points]="spark()" [colour]="hex()" /></div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .kpi {
      height: 100%;
      padding: var(--s-5);
      border-radius: var(--r-lg);
      border: 1px solid var(--glass-border);
      background: var(--glass-strong);
      backdrop-filter: blur(var(--blur-surface)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--blur-surface)) saturate(180%);
      box-shadow: var(--sh-card), var(--glass-inset);
      transition: transform var(--t-base) var(--ease),
                  box-shadow var(--t-base) var(--ease),
                  background var(--t-base) var(--ease);
    }
    .kpi:hover { transform: translateY(-4px); box-shadow: var(--sh-lift), var(--glass-inset); }

    .top { display: flex; align-items: center; justify-content: space-between;
           margin-bottom: var(--s-4); }
    .ic { display: grid; place-items: center; width: 34px; height: 34px;
          border-radius: var(--r-sm);
          transition: transform var(--t-base) var(--ease-spring); }
    .kpi:hover .ic { transform: scale(1.08) rotate(-4deg); }

    [data-tone='violet'] .ic { background: var(--violet-bg);  color: var(--violet-fg); }
    [data-tone='teal']   .ic { background: var(--teal-bg);    color: var(--teal-fg); }
    [data-tone='blue']   .ic { background: var(--info-bg);    color: var(--info-fg); }
    [data-tone='amber']  .ic { background: var(--warn-bg);    color: var(--warn-fg); }
    [data-tone='rose']   .ic { background: var(--danger-bg);  color: var(--danger-fg); }

    .trend { display: inline-flex; align-items: center; gap: 3px;
             padding: 3px 8px; border-radius: var(--r-pill);
             font-size: var(--fs-xs); font-weight: 700;
             background: var(--success-bg); color: var(--success-fg); }
    .trend--down { background: var(--danger-bg); color: var(--danger-fg); }

    .label { font-size: var(--fs-sm); color: var(--ink-muted);
             font-weight: 500; margin-bottom: 4px; }
    .value {
      font-family: var(--font-display);
      font-size: 27px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1;
      background: var(--num-grad);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .sk { height: 30px; width: 74px; }
    .note { font-size: var(--fs-xs); color: var(--ink-dim); margin-top: 5px; }
    .spark { margin-top: var(--s-3); }
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
  protected readonly hex = computed(() => TONE_HEX[this.tone()]);

  constructor() {
    // Count-up: a number landing feels like data arriving, not appearing.
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