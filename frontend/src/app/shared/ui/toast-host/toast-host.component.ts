import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, ToastTone } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

const ICON: Record<ToastTone, IconName> = {
  success: 'check', danger: 'alert', info: 'bell', warn: 'alert',
};

@Component({
  selector: 'acms-toast-host',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- aria-live means screen readers announce these without stealing focus -->
    <div class="host" role="status" aria-live="polite" aria-atomic="false">
      @for (t of toast.toasts(); track t.id) {
        <div class="ts" [attr.data-tone]="t.tone">
          <span class="ic"><acms-icon [name]="icon(t.tone)" [size]="15" [weight]="2.4" /></span>
          <div class="txt">
            <div class="tt">{{ t.title }}</div>
            @if (t.message) { <div class="tm">{{ t.message }}</div> }
          </div>
          <button type="button" class="x" (click)="toast.dismiss(t.id)" aria-label="Dismiss">
            <acms-icon name="close" [size]="13" [weight]="2.4" />
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .host {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      z-index: 120; display: flex; flex-direction: column; gap: 10px;
      width: min(420px, calc(100vw - 32px)); pointer-events: none;
    }
    .ts {
      display: flex; align-items: flex-start; gap: 11px;
      padding: 13px var(--s-4); pointer-events: auto;
      border-radius: var(--r-md);
      border: 1px solid var(--glass-border);
      background: var(--glass-strong);
      backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      box-shadow: var(--sh-lift), var(--glass-inset);
      animation: toastIn var(--t-base) var(--ease) both;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(14px) scale(.97); }
    }
    .ic {
      display: grid; place-items: center; width: 28px; height: 28px;
      border-radius: 9px; flex-shrink: 0;
    }
    [data-tone='success'] .ic { background: var(--success-bg); color: var(--success-fg); }
    [data-tone='danger']  .ic { background: var(--danger-bg);  color: var(--danger-fg); }
    [data-tone='info']    .ic { background: var(--info-bg);    color: var(--info-fg); }
    [data-tone='warn']    .ic { background: var(--warn-bg);    color: var(--warn-fg); }

    .txt { flex: 1; min-width: 0; }
    .tt { font-size: var(--fs-sm); font-weight: 600; color: var(--ink); }
    .tm { font-size: var(--fs-xs); color: var(--ink-muted); margin-top: 2px; line-height: 1.45; }
    .x {
      display: grid; place-items: center; width: 24px; height: 24px; flex-shrink: 0;
      border: none; border-radius: 50%;
      background: var(--hover-wash); color: var(--ink-muted); cursor: pointer;
    }
    .x:hover { background: var(--hover-wash-2); color: var(--ink); }
  `],
})
export class ToastHostComponent {
  protected readonly toast = inject(ToastService);
  protected icon(tone: ToastTone): IconName { return ICON[tone]; }
}