import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export interface Step { label: string; caption?: string | null; }

@Component({
  selector: 'acms-stepper',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="st">
      @for (s of steps(); track s.label; let i = $index; let last = $last) {
        <li class="step" [class.done]="i < current()" [class.now]="i === current()">
          <span class="node">
            @if (i < current()) {
              <acms-icon name="check" [size]="13" [weight]="3" />
            } @else {
              {{ i + 1 }}
            }
          </span>
          <div class="txt">
            <div class="lb">{{ s.label }}</div>
            @if (s.caption) { <div class="cap">{{ s.caption }}</div> }
          </div>
          @if (!last) { <span class="bar"></span> }
        </li>
      }
    </ol>
  `,
  styles: [`
    .st { list-style: none; display: flex; padding: 0; margin: 0; }
    .step { flex: 1; display: flex; align-items: flex-start; gap: 10px; position: relative; }

    .node {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      display: grid; place-items: center;
      font-size: var(--fs-xs); font-weight: 700;
      background: var(--hover-wash); color: var(--ink-dim);
      border: 1px solid var(--track);
      transition: all var(--t-base) var(--ease);
    }
    .done .node {
      background: linear-gradient(135deg, var(--violet), var(--violet-deep));
      color: #fff; border-color: transparent; box-shadow: var(--sh-brand);
    }
    .now .node {
      background: var(--violet-bg); color: var(--violet-fg);
      border-color: rgba(124,108,240,.4);
      box-shadow: 0 0 0 4px rgba(124,108,240,.13);
    }

    .txt { padding-top: 4px; min-width: 0; }
    .lb { font-size: var(--fs-sm); font-weight: 600; color: var(--ink-muted); }
    .done .lb, .now .lb { color: var(--ink); }
    .cap { font-size: var(--fs-xs); color: var(--ink-dim); margin-top: 1px; }

    .bar {
      position: absolute; left: 28px; right: 10px; top: 13px; height: 2px;
      border-radius: 2px; background: var(--track);
    }
    .done .bar { background: linear-gradient(90deg, var(--violet), var(--violet-deep)); }

    @media (max-width: 640px) {
      .st { flex-direction: column; gap: var(--s-4); }
      .step { flex: none; }
      .bar { display: none; }
    }
  `],
})
export class StepperComponent {
  readonly steps = input.required<Step[]>();
  /** Index of the step currently in progress. Steps before it render as done. */
  readonly current = input(0);
}