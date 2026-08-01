import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The gradient canvas behind the whole app. Pure CSS - no canvas element,
 * no requestAnimationFrame loop - so it costs nothing on the main thread.
 * Only transform and opacity animate, keeping it on the compositor.
 * Colours come from tokens, so it re-themes with the rest of the app.
 */
@Component({
  selector: 'acms-aurora-background',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="aurora" aria-hidden="true">
      <span class="blob b1"></span>
      <span class="blob b2"></span>
      <span class="blob b3"></span>
    </div>
  `,
  styles: [`
    .aurora {
      position: fixed; inset: 0; z-index: -1; overflow: hidden;
      background: var(--canvas);
      transition: background var(--t-base) var(--ease);
    }
    .blob {
      position: absolute; border-radius: 50%;
      filter: blur(72px);
      opacity: var(--blob-opacity);
      will-change: transform;
      transition: opacity var(--t-base) var(--ease),
                  background var(--t-base) var(--ease);
    }
    .b1 { width: 520px; height: 520px; top: -120px; right: 6%;
          background: radial-gradient(circle, var(--blob-1) 0%, transparent 70%);
          animation: drift1 28s ease-in-out infinite alternate; }
    .b2 { width: 460px; height: 460px; bottom: -140px; left: 2%;
          background: radial-gradient(circle, var(--blob-2) 0%, transparent 70%);
          animation: drift2 34s ease-in-out infinite alternate; }
    .b3 { width: 380px; height: 380px; top: 38%; right: 26%;
          background: radial-gradient(circle, var(--blob-3) 0%, transparent 70%);
          opacity: calc(var(--blob-opacity) * .7);
          animation: drift3 40s ease-in-out infinite alternate; }

    @keyframes drift1 { to { transform: translate3d(-70px, 60px, 0) scale(1.12); } }
    @keyframes drift2 { to { transform: translate3d(90px, -50px, 0) scale(1.09); } }
    @keyframes drift3 { to { transform: translate3d(-60px, -70px, 0) scale(1.16); } }

    @media (prefers-reduced-motion: reduce) { .blob { animation: none; } }
  `],
})
export class AuroraBackgroundComponent {}