import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  inject, input, output, signal,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export type ExportFormat = 'csv' | 'pdf';

/**
 * One Export control with a format menu, replacing the separate "Export" and
 * "PDF" buttons that used to sit side by side.
 *
 * They were two buttons doing the same job — both export the current view, they
 * only differ in file type — so a format is a property of the export, not a
 * separate action. Collapsing them also removes the guess about what the
 * unlabelled "Export" button produced.
 */
@Component({
  selector: 'acms-export-menu',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <button type="button" class="trigger" [disabled]="disabled()"
              (click)="toggle()" [attr.aria-expanded]="open()"
              aria-haspopup="menu" aria-label="Export options">
        <acms-icon name="inbox" [size]="14" [weight]="2" />
        {{ label() }}
        <acms-icon name="chevron" [size]="12" [weight]="2.4"
                   class="caret" [class.caret--up]="open()" />
      </button>

      @if (open()) {
        <div class="menu" role="menu">
          <button type="button" role="menuitem" class="item" (click)="pick('csv')">
            <span class="item__ic item__ic--csv">CSV</span>
            <span class="item__txt">
              <strong>Spreadsheet</strong>
              <small>Opens directly in Excel</small>
            </span>
          </button>
          <button type="button" role="menuitem" class="item" (click)="pick('pdf')">
            <span class="item__ic item__ic--pdf">PDF</span>
            <span class="item__txt">
              <strong>Printable report</strong>
              <small>Charts included, via print dialog</small>
            </span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .wrap { position: relative; }

    .trigger {
      display: inline-flex; align-items: center; gap: 7px;
      height: 38px; padding: 0 14px;
      border: 1px solid var(--glass-border); border-radius: var(--r-pill);
      background: var(--hover-wash); color: var(--ink-muted);
      font-family: var(--font-body); font-size: var(--fs-sm); font-weight: 600;
      cursor: pointer; white-space: nowrap;
      transition: all var(--t-fast) var(--ease);
    }
    .trigger:hover:not(:disabled) { background: var(--hover-wash-2); color: var(--ink); }
    .trigger:disabled { opacity: .5; cursor: not-allowed; }
    .caret { transition: transform var(--t-fast) var(--ease); }
    .caret--up { transform: rotate(180deg); }

    .menu {
      position: absolute; top: calc(100% + 8px); right: 0; z-index: 40;
      min-width: 244px; padding: 6px;
      border-radius: var(--r-md);
      border: 1px solid var(--glass-border);
      /* Solid, not translucent: this menu opens over the dashboard header,
         which already applies its own backdrop-filter. Nesting a second one
         silently drops the blur, so the panel is opaque by design. */
      background: var(--surface-solid, #1B1F3A);
      box-shadow: var(--sh-float);
      animation: pop var(--t-fast) var(--ease);
    }
    :host-context([data-theme='light']) .menu { background: #FFFFFF; }
    @keyframes pop { from { opacity: 0; transform: translateY(-5px); } }

    .item {
      display: flex; align-items: center; gap: 11px; width: 100%;
      padding: 9px 10px; border: none; border-radius: var(--r-sm);
      background: transparent; color: var(--ink);
      font-family: var(--font-body); text-align: left; cursor: pointer;
      transition: background var(--t-fast) var(--ease);
    }
    .item:hover, .item:focus-visible { background: var(--hover-wash); outline: none; }

    .item__ic {
      flex-shrink: 0; display: grid; place-items: center;
      width: 34px; height: 34px; border-radius: 9px;
      font-size: 10px; font-weight: 800; letter-spacing: .03em; color: #fff;
    }
    .item__ic--csv { background: linear-gradient(135deg, #0E7490, #22D3EE); }
    .item__ic--pdf { background: linear-gradient(135deg, #BE123C, #FB7185); }

    .item__txt { display: flex; flex-direction: column; gap: 1px; }
    .item__txt strong { font-size: var(--fs-sm); font-weight: 600; }
    .item__txt small { font-size: var(--fs-xs); color: var(--ink-dim); }
  `],
})
export class ExportMenuComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly label = input('Export');
  readonly disabled = input(false);
  readonly exportAs = output<ExportFormat>();

  protected readonly open = signal(false);

  protected toggle(): void {
    this.open.update(v => !v);
  }

  protected pick(format: ExportFormat): void {
    this.open.set(false);
    this.exportAs.emit(format);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(e: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }
}