import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'acms-glass-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" [class.card--hover]="hoverable()" [class.card--flush]="flush()">
      @if (title()) {
        <header class="head">
          <div>
            <h3 class="title">{{ title() }}</h3>
            @if (subtitle()) { <p class="sub">{{ subtitle() }}</p> }
          </div>
          <ng-content select="[cardAction]"></ng-content>
        </header>
      }
      <div class="body"><ng-content></ng-content></div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .card {
      height: 100%;
      padding: var(--s-6);
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
    .card--hover:hover { transform: translateY(-3px); box-shadow: var(--sh-lift), var(--glass-inset); }
    .card--flush { padding: 0; }

    .head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--s-4); margin-bottom: var(--s-5);
    }
    .title { font-size: var(--fs-md); font-weight: 600; }
    .sub { margin: 2px 0 0; font-size: var(--fs-sm); color: var(--ink-muted); }
  `],
})
export class GlassCardComponent {
  readonly title = input<string>();
  readonly subtitle = input<string>();
  readonly hoverable = input(false);
  readonly flush = input(false);
}