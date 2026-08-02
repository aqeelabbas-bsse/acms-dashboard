import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'acms-paginator',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <div class="pg">
        <span class="info">
          {{ from() }}&ndash;{{ to() }} of {{ total() }}
        </span>
        <div class="ctrls">
          <button type="button" class="nav" [disabled]="page() <= 1"
                  (click)="page.set(page() - 1)" aria-label="Previous page">
            <acms-icon name="chevronL" [size]="15" [weight]="2.2" />
          </button>
          <span class="cur">{{ page() }} / {{ pages() }}</span>
          <button type="button" class="nav" [disabled]="page() >= pages()"
                  (click)="page.set(page() + 1)" aria-label="Next page">
            <acms-icon name="chevronR" [size]="15" [weight]="2.2" />
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .pg {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--s-4); padding-top: var(--s-4); flex-wrap: wrap;
    }
    .info { font-size: var(--fs-sm); color: var(--ink-muted); }
    .ctrls { display: flex; align-items: center; gap: var(--s-2); }
    .cur { font-size: var(--fs-sm); font-weight: 600; min-width: 54px; text-align: center; }
    .nav {
      display: grid; place-items: center; width: 32px; height: 32px;
      border: 1px solid var(--glass-border); border-radius: 50%;
      background: var(--hover-wash); color: var(--ink-soft); cursor: pointer;
      transition: all var(--t-fast) var(--ease);
    }
    .nav:hover:not(:disabled) { background: var(--hover-wash-2); color: var(--ink); }
    .nav:disabled { opacity: .38; cursor: not-allowed; }
  `],
})
export class PaginatorComponent {
  readonly page = model(1);
  readonly limit = input(25);
  readonly total = input(0);

  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.limit())));
  protected readonly from = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.limit() + 1);
  protected readonly to = computed(() =>
    Math.min(this.page() * this.limit(), this.total()));
}