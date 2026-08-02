import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

@Component({
  selector: 'acms-empty-state',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="es">
      <span class="ic"><acms-icon [name]="icon()" [size]="24" /></span>
      <div class="t">{{ title() }}</div>
      @if (message()) { <div class="m">{{ message() }}</div> }
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .es {
      display: grid; place-items: center; gap: 8px;
      padding: var(--s-12) var(--s-6); text-align: center;
    }
    .ic {
      display: grid; place-items: center; width: 52px; height: 52px;
      border-radius: var(--r-md); margin-bottom: 4px;
      background: var(--violet-bg); color: var(--violet-fg);
    }
    .t { font-family: var(--font-display); font-weight: 600;
         font-size: var(--fs-md); color: var(--ink); }
    .m { font-size: var(--fs-sm); color: var(--ink-muted); max-width: 40ch; }
  `],
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input<string>();
  readonly icon = input<IconName>('inbox');
}