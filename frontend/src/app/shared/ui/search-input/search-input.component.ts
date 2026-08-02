import { ChangeDetectionStrategy, Component, effect, input, model, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'acms-search-input',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" [class.on]="focused()">
      <acms-icon name="search" [size]="15" />
      <input type="search" [attr.placeholder]="placeholder()" [attr.aria-label]="placeholder()"
             [value]="draft()"
             (input)="onInput($event)"
             (focus)="focused.set(true)" (blur)="focused.set(false)" />
      @if (draft()) {
        <button type="button" class="clr" (click)="clear()" aria-label="Clear search">
          <acms-icon name="close" [size]="13" [weight]="2.4" />
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .wrap {
      display: flex; align-items: center; gap: 9px;
      height: 38px; padding: 0 14px; min-width: 240px;
      border: 1px solid transparent; border-radius: var(--r-pill);
      background: var(--hover-wash); color: var(--ink-dim);
      transition: all var(--t-fast) var(--ease);
    }
    .wrap.on {
      border-color: rgba(124,108,240,.45);
      box-shadow: 0 0 0 4px rgba(124,108,240,.12);
    }
    input {
      flex: 1; min-width: 0; border: none; outline: none; background: transparent;
      font-family: var(--font-body); font-size: var(--fs-base); color: var(--ink);
    }
    input::placeholder { color: var(--ink-dim); }
    .clr {
      display: grid; place-items: center; width: 20px; height: 20px;
      border: none; border-radius: 50%; background: var(--hover-wash-2);
      color: var(--ink-muted); cursor: pointer; flex-shrink: 0;
    }
  `],
})
export class SearchInputComponent {
  readonly value = model('');
  readonly placeholder = input('Search...');
  readonly debounce = input(350);

  protected readonly draft = signal('');
  protected readonly focused = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Keep the visible text in sync if the parent resets `value` externally.
    effect(() => this.draft.set(this.value()));
  }

  protected onInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.draft.set(v);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.value.set(v), this.debounce());
  }

  protected clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.draft.set('');
    this.value.set('');
  }
}