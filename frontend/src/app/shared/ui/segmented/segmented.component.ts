import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SegmentOption { label: string; value: string; }

@Component({
  selector: 'acms-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seg" role="tablist">
      @for (o of options(); track o.value) {
        <button type="button" role="tab" class="btn"
                [class.on]="o.value === value()"
                [attr.aria-selected]="o.value === value()"
                (click)="value.set(o.value)">{{ o.label }}</button>
      }
    </div>
  `,
  styles: [`
    .seg { display: inline-flex; padding: 3px; border-radius: var(--r-pill);
           background: var(--hover-wash); }
    .btn {
      border: none; background: transparent;
      padding: 7px 15px; border-radius: var(--r-pill);
      font-size: var(--fs-sm); font-weight: 600;
      color: var(--ink-muted); cursor: pointer; white-space: nowrap;
      transition: color var(--t-fast) var(--ease),
                  background var(--t-base) var(--ease);
    }
    .btn:hover { color: var(--ink); }
    .btn.on {
      background: var(--glass-strong);
      color: var(--violet-fg);
      box-shadow: 0 2px 8px rgba(0,0,0,.10);
    }
  `],
})
export class SegmentedComponent {
  readonly options = input.required<SegmentOption[]>();
  readonly value = model.required<string>();
}