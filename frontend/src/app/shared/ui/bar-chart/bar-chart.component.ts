import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarGroup { label: string; a: number; b: number; }

@Component({
  selector: 'acms-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      @if (groups().length) {
        <div class="cols">
          @for (g of scaled(); track g.label) {
            <div class="col" [attr.title]="g.label + ': ' + g.a + ' / ' + g.b">
              <div class="stack">
                <span class="bar bar--a" [style.height.%]="g.hA"></span>
                <span class="bar bar--b" [style.height.%]="g.hB"></span>
              </div>
              <span class="tick">{{ g.label }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="empty">No data yet</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .wrap { height: 220px; }
    .cols { display: flex; align-items: flex-end; gap: 12px; height: 100%; padding-top: 8px; }
    .col { flex: 1; display: flex; flex-direction: column; align-items: center;
           gap: 8px; height: 100%; justify-content: flex-end; }
    .stack { display: flex; gap: 4px; align-items: flex-end;
             justify-content: center; width: 100%; height: 100%; }
    .bar {
      width: 9px; border-radius: 5px 5px 2px 2px;
      transform-origin: bottom;
      animation: grow 700ms var(--ease) both;
      transition: opacity var(--t-fast) var(--ease);
    }
    .bar--a { background: linear-gradient(180deg, #A99CFF, var(--violet-deep)); }
    .bar--b { background: linear-gradient(180deg, #7EE3C8, var(--teal)); }
    .col:hover .bar { opacity: .72; }
    .tick { font-size: var(--fs-xs); color: var(--ink-dim); font-weight: 500; }
    .empty { display: grid; place-items: center; height: 100%;
             color: var(--ink-dim); font-size: var(--fs-sm); }
    @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
    @media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
  `],
})
export class BarChartComponent {
  readonly groups = input<BarGroup[]>([]);

  protected readonly scaled = computed(() => {
    const g = this.groups();
    const max = Math.max(1, ...g.flatMap(x => [x.a, x.b]));
    return g.map(x => ({ ...x, hA: (x.a / max) * 100, hB: (x.b / max) * 100 }));
  });
}