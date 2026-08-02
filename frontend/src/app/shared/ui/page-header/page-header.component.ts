import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'acms-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="hd rise">
      <div>
        @if (eyebrow()) { <div class="eyebrow">{{ eyebrow() }}</div> }
        <h1 class="t">{{ title() }}</h1>
        @if (subtitle()) { <p class="s">{{ subtitle() }}</p> }
      </div>
      <div class="tools"><ng-content></ng-content></div>
    </header>
  `,
  styles: [`
    .hd {
      display: flex; align-items: flex-end; justify-content: space-between;
      gap: var(--s-6); flex-wrap: wrap; margin-bottom: var(--s-6);
    }
    .t { font-size: var(--fs-2xl); font-weight: 700; margin: 6px 0 4px; }
    .s { margin: 0; color: var(--ink-muted); }
    .tools { display: flex; align-items: center; gap: var(--s-3); flex-wrap: wrap; }
  `],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly eyebrow = input<string>();
}