import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';

@Component({
  selector: 'acms-modal',
  standalone: true,
  imports: [IconComponent, FocusTrapDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scrim" (click)="close.emit()"></div>
    <div class="dlg" role="dialog" aria-modal="true" acmsFocusTrap
         [attr.aria-labelledby]="titleId" [style.max-width.px]="width()">
      <header class="hd">
        <div>
          <h2 class="t" [id]="titleId">{{ title() }}</h2>
          @if (subtitle()) { <p class="s">{{ subtitle() }}</p> }
        </div>
        <button type="button" class="x" (click)="close.emit()" aria-label="Close">
          <acms-icon name="close" [size]="16" [weight]="2.2" />
        </button>
      </header>

      <div class="body"><ng-content></ng-content></div>

      <footer class="ft"><ng-content select="[modalFooter]"></ng-content></footer>
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 100;
            display: grid; place-items: center; padding: var(--s-5); }
    .scrim {
      position: absolute; inset: 0;
      background: rgba(10, 12, 30, .45);
      backdrop-filter: blur(3px);
      animation: fade var(--t-base) var(--ease) both;
    }
    @keyframes fade { from { opacity: 0; } }

    .dlg {
      position: relative; width: 100%; max-height: 88vh;
      display: flex; flex-direction: column;
      padding: var(--s-6);
      border-radius: var(--r-xl);
      border: 1px solid var(--glass-border);
      background: var(--glass-strong);
      backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      box-shadow: var(--sh-lift), var(--glass-inset);
      animation: pop var(--t-base) var(--ease) both;
    }
    @keyframes pop {
      from { opacity: 0; transform: translateY(14px) scale(.98); }
    }

    .hd { display: flex; align-items: flex-start; justify-content: space-between;
          gap: var(--s-4); margin-bottom: var(--s-5); }
    .t { font-size: var(--fs-lg); font-weight: 700; }
    .s { margin: 3px 0 0; font-size: var(--fs-sm); color: var(--ink-muted); }
    .x {
      display: grid; place-items: center; width: 32px; height: 32px; flex-shrink: 0;
      border: none; border-radius: 50%;
      background: var(--hover-wash); color: var(--ink-muted); cursor: pointer;
      transition: all var(--t-fast) var(--ease);
    }
    .x:hover { background: var(--hover-wash-2); color: var(--ink); }

    .body { overflow-y: auto; flex: 1; }
    .ft { display: flex; justify-content: flex-end; gap: var(--s-3);
          margin-top: var(--s-6); }
    .ft:empty { display: none; }
  `],
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly width = input(480);
  readonly close = output<void>();

  protected readonly titleId = `dlg-${Math.random().toString(36).slice(2, 9)}`;

  @HostListener('document:keydown.escape')
  protected onEscape(): void { this.close.emit(); }
}