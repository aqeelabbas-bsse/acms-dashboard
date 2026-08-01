import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const W = 100, H = 30;

@Component({
  selector: 'acms-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient [attr.id]="gradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   [attr.stop-color]="colour()" stop-opacity=".30" />
            <stop offset="100%" [attr.stop-color]="colour()" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path class="area" [attr.d]="g.area" [attr.fill]="'url(#' + gradId + ')'" />
        <path class="line" [attr.d]="g.line" [attr.stroke]="colour()"
              fill="none" stroke-width="2" pathLength="100"
              vector-effect="non-scaling-stroke"
              stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 30px; }
    svg { width: 100%; height: 100%; display: block; overflow: visible; }
    .line {
      stroke-dasharray: 100; stroke-dashoffset: 100;
      animation: draw 1100ms var(--ease) 180ms forwards;
    }
    .area { opacity: 0; animation: fade 700ms var(--ease) 700ms forwards; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    @keyframes fade { to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .line { stroke-dashoffset: 0; animation: none; }
      .area { opacity: 1; animation: none; }
    }
  `],
})
export class SparklineComponent {
  readonly points = input<number[]>([]);
  readonly colour = input('#7C6CF0');

  protected readonly gradId = `spk-${Math.random().toString(36).slice(2, 9)}`;

  protected readonly geometry = computed(() => {
    const v = this.points();
    if (v.length < 2) return null;
    const min = Math.min(...v), max = Math.max(...v);
    const span = max - min || 1;
    const stepX = W / (v.length - 1);
    const coords = v.map((n, i) =>
      `${(i * stepX).toFixed(2)},${(H - 3 - ((n - min) / span) * (H - 6)).toFixed(2)}`);
    const line = `M${coords.join(' L')}`;
    return { line, area: `${line} L${W},${H} L0,${H} Z` };
  });
}