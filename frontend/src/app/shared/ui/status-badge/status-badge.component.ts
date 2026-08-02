import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeTone = 'success' | 'danger' | 'warn' | 'info' | 'violet' | 'neutral';

@Component({
  selector: 'acms-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="b" [attr.data-tone]="tone()">
    @if (dot()) { <i class="dot"></i> }{{ label() }}
  </span>`,
  styles: [`
    .b {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px; border-radius: var(--r-pill);
      font-size: var(--fs-xs); font-weight: 700; white-space: nowrap;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    [data-tone='success'] { background: var(--success-bg); color: var(--success-fg); }
    [data-tone='danger']  { background: var(--danger-bg);  color: var(--danger-fg); }
    [data-tone='warn']    { background: var(--warn-bg);    color: var(--warn-fg); }
    [data-tone='info']    { background: var(--info-bg);    color: var(--info-fg); }
    [data-tone='violet']  { background: var(--violet-bg);  color: var(--violet-fg); }
    [data-tone='neutral'] { background: var(--hover-wash); color: var(--ink-muted); }
  `],
})
export class StatusBadgeComponent {
  readonly label = input.required<string>();
  readonly tone = input<BadgeTone>('neutral');
  readonly dot = input(false);
}