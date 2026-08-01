import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface DonutSlice { label: string; value: number; colour: string; }

const R = 38;
const CIRC = 2 * Math.PI * R;   // ~238.76

@Component({
  selector: 'acms-donut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <svg viewBox="0 0 100 100" width="128" height="128" role="img"
           [attr.aria-label]="caption() + ': ' + total()">
        <circle cx="50" cy="50" r="38" fill="none"
                stroke="var(--track)" stroke-width="13" />
        @for (s of arcs(); track s.label) {
          <circle cx="50" cy="50" r="38" fill="none"
                  [attr.stroke]="s.colour" stroke-width="13" stroke-linecap="round"
                  [attr.stroke-dasharray]="s.dash" [attr.stroke-dashoffset]="s.offset"
                  transform="rotate(-90 50 50)" />
        }
        <text x="50" y="47" text-anchor="middle" font-family="Poppins"
              font-weight="700" font-size="19" fill="currentColor">{{ total() }}</text>
        <text x="50" y="62" text-anchor="middle" font-family="Inter"
              font-size="7.5" fill="currentColor" opacity=".55">{{ caption() }}</text>
      </svg>

      <div class="legend">
        @for (s of slices(); track s.label) {
          <div class="row">
            <span class="dot" [style.background]="s.colour"></span>
            <span class="lab">{{ s.label }}</span>
            <span class="val">{{ s.value }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .wrap { display: flex; flex-direction: column; align-items: center; gap: 16px; }
    svg circle { transition: stroke-dasharray var(--t-slow) var(--ease); }
    .legend { width: 100%; display: flex; flex-direction: column; gap: 9px; }
    .row { display: flex; align-items: center; gap: 9px; font-size: var(--fs-sm); }
    .dot { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
    .lab { color: var(--ink-muted); flex: 1; }
    .val { font-weight: 700; }
  `],
})
export class DonutChartComponent {
  readonly slices = input<DonutSlice[]>([]);
  readonly caption = input('total');

  protected readonly total = computed(() =>
    this.slices().reduce((sum, s) => sum + s.value, 0));

  protected readonly arcs = computed(() => {
    const t = this.total() || 1;
    let consumed = 0;
    return this.slices().map(s => {
      const len = (s.value / t) * CIRC;
      const arc = {
        label: s.label,
        colour: s.colour,
        dash: `${len.toFixed(1)} ${CIRC.toFixed(1)}`,
        offset: (-consumed).toFixed(1),
      };
      consumed += len;
      return arc;
    });
  });
}