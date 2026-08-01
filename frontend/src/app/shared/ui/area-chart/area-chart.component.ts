import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const W = 320, H = 150, PAD = 8;

@Component({
  selector: 'acms-area-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 320 150" preserveAspectRatio="none" role="img"
         [attr.aria-label]="label()">
      <defs>
        <linearGradient [attr.id]="gradId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   [attr.stop-color]="colour()" stop-opacity=".34" />
          <stop offset="100%" [attr.stop-color]="colour()" stop-opacity="0" />
        </linearGradient>
      </defs>

      <g stroke="var(--gridline)" stroke-width="1" vector-effect="non-scaling-stroke">
        <line x1="0" y1="30" x2="320" y2="30" />
        <line x1="0" y1="75" x2="320" y2="75" />
        <line x1="0" y1="120" x2="320" y2="120" />
      </g>

      @if (geometry(); as g) {
        <path class="area" [attr.d]="g.area" [attr.fill]="'url(#' + gradId + ')'" />
        <path class="line" [attr.d]="g.line" [attr.stroke]="colour()" fill="none"
              stroke-width="2.4" pathLength="100" vector-effect="non-scaling-stroke"
              stroke-linecap="round" stroke-linejoin="round" />
        <circle class="head" [attr.cx]="g.lastX" [attr.cy]="g.lastY" r="4"
                [attr.fill]="colour()" vector-effect="non-scaling-stroke" />
        <circle class="head" [attr.cx]="g.lastX" [attr.cy]="g.lastY" r="8" fill="none"
                [attr.stroke]="colour()" stroke-width="1.5" opacity=".4"
                vector-effect="non-scaling-stroke" />
      } @else {
        <text x="160" y="80" text-anchor="middle" font-size="11"
              fill="var(--ink-dim)" font-family="Inter">No data yet</text>
      }
    </svg>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 150px; }
    svg { width: 100%; height: 100%; display: block; }
    .line { stroke-dasharray: 100; stroke-dashoffset: 100;
            animation: draw 1200ms var(--ease) 120ms forwards; }
    .area { opacity: 0; animation: fade 600ms var(--ease) 800ms forwards; }
    .head { opacity: 0; animation: fade 400ms var(--ease) 1200ms forwards; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    @keyframes fade { to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .line { stroke-dashoffset: 0; animation: none; }
      .area, .head { opacity: 1; animation: none; }
    }
  `],
})
export class AreaChartComponent {
  readonly points = input<number[]>([]);
  readonly colour = input('#3E8EF7');
  readonly label = input('Trend chart');

  protected readonly gradId = `area-${Math.random().toString(36).slice(2, 9)}`;

  protected readonly geometry = computed(() => {
    const v = this.points();
    if (v.length < 2) return null;
    const min = Math.min(...v), max = Math.max(...v);
    const span = max - min || 1;
    const stepX = W / (v.length - 1);
    const y = (n: number) => H - PAD - ((n - min) / span) * (H - PAD * 2 - 12);
    const coords = v.map((n, i) => `${(i * stepX).toFixed(1)},${y(n).toFixed(1)}`);
    const line = `M${coords.join(' L')}`;
    return {
      line,
      area: `${line} L${W},${H} L0,${H} Z`,
      lastX: W,
      lastY: +y(v[v.length - 1]).toFixed(1),
    };
  });
}