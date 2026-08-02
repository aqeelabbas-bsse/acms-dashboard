import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuroraBackgroundComponent } from '../aurora-background/aurora-background.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ToastHostComponent } from '../../shared/ui/toast-host/toast-host.component';
import { ConfirmHostComponent } from "../../shared/ui/confirm-host/confirm-host.component";

@Component({
  selector: 'acms-shell',
  standalone: true,
  imports: [RouterOutlet, AuroraBackgroundComponent, SidebarComponent,
    TopbarComponent, IconComponent, ToastHostComponent, ConfirmHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <a class="skip" href="#main">Skip to main content</a>
    <acms-aurora-background />

    <div class="shell">
      <acms-sidebar [open]="navOpen()"
                    (navigate)="navOpen.set(false)"
                    (askAgent)="onAskAgent()" />

      @if (navOpen()) {
        <div class="scrim" (click)="navOpen.set(false)" aria-hidden="true"></div>
      }

      <div class="main">
        <acms-topbar (toggleNav)="navOpen.update(v => !v)" />
        <main class="content"><router-outlet /></main>
      </div>
    </div>

    <button class="orb" type="button" (click)="onAskAgent()" aria-label="Ask ACMS">
      <acms-icon name="sparkle" [size]="22" [weight]="2" />
    </button>

    <acms-toast-host />
    <acms-confirm-host />
  `,
  styles: [`
    .shell { display: flex; min-height: 100vh; padding: 18px 20px 20px 18px; gap: 18px; }
    .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
    .content { flex: 1; padding: 2px 4px var(--s-12); }

    .scrim {
      position: fixed; inset: 0; z-index: 50;
      background: rgba(10, 12, 30, .45);
      backdrop-filter: blur(2px);
      animation: fadeIn var(--t-base) var(--ease) both;
    }
    @keyframes fadeIn { from { opacity: 0; } }

    .orb {
      position: fixed; bottom: 28px; right: 30px;
      width: 56px; height: 56px; border-radius: 50%;
      display: grid; place-items: center;
      border: none; cursor: pointer; color: #fff; z-index: 40;
      background: linear-gradient(135deg, var(--violet), var(--violet-deep) 55%, var(--blue));
      box-shadow: var(--sh-brand);
      transition: transform var(--t-base) var(--ease);
    }
    .orb:hover { transform: scale(1.06); }
    .orb::before {
      content: ''; position: absolute; inset: -8px;
      border-radius: 50%; border: 1.5px solid rgba(124,108,240,.4);
      animation: ring 2.4s ease-out infinite;
    }
    @keyframes ring {
      0%   { transform: scale(.85); opacity: .8; }
      100% { transform: scale(1.35); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) { .orb::before { animation: none; } }

    @media (max-width: 1024px) { .shell { padding: 14px; } }
    @media (max-width: 640px)  { .shell { padding: 10px; } .orb { bottom: 18px; right: 18px; } }
  `],
})
export class ShellComponent {
  readonly navOpen = signal(false);

  protected onAskAgent(): void {
    // Phase 13 opens the NL agent slide-over from here.
    console.info('[ACMS] Agent panel arrives in Phase 13');
  }
}