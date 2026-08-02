import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ModalComponent } from '../modal/modal.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'acms-confirm-host',
  standalone: true,
  imports: [ModalComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.pending(); as p) {
      <acms-modal [title]="p.title" [width]="420" (close)="svc.settle(false)">
        <div class="body" [class.danger]="p.danger">
          <span class="ic"><acms-icon name="alert" [size]="18" [weight]="2.2" /></span>
          <p class="msg">{{ p.message }}</p>
        </div>
        <div modalFooter>
          <button class="btn btn--ghost" type="button" (click)="svc.settle(false)">Cancel</button>
          <button type="button" (click)="svc.settle(true)"
                  [class]="p.danger ? 'btn btn--danger' : 'btn btn--primary'">
            {{ p.confirmLabel ?? 'Confirm' }}
          </button>
        </div>
      </acms-modal>
    }
  `,
  styles: [`
    .body { display: flex; gap: 13px; align-items: flex-start; }
    .ic {
      display: grid; place-items: center; width: 38px; height: 38px;
      border-radius: 12px; flex-shrink: 0;
      background: var(--warn-bg); color: var(--warn-fg);
    }
    .danger .ic { background: var(--danger-bg); color: var(--danger-fg); }
    .msg { margin: 0; font-size: var(--fs-base); color: var(--ink-soft); line-height: 1.6; }
  `],
})
export class ConfirmHostComponent {
  protected readonly svc = inject(ConfirmService);
}