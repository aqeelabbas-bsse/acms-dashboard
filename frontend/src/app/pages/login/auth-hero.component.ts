import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Animated "secure perimeter" infographic for the login screen.
 *
 * Pure SVG + CSS: no raster asset, no licensing question, themes with the
 * app, ~5KB. Every animation is transform/opacity/stroke-dashoffset only,
 * so it stays on the compositor and costs nothing on the main thread.
 */
@Component({
  selector: 'acms-auth-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hero" aria-hidden="true">
      <!-- Soft coloured bloom behind the graphic - what makes it read as vivid -->
      <span class="bloom bloom--v"></span>
      <span class="bloom bloom--b"></span>
      <span class="bloom bloom--t"></span>

      <svg viewBox="0 0 520 520" class="svg">
        <defs>
          <linearGradient id="ah-ring" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%"   stop-color="var(--violet)" />
            <stop offset="55%"  stop-color="var(--blue)" />
            <stop offset="100%" stop-color="var(--teal)" />
          </linearGradient>

          <linearGradient id="ah-spoke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stop-color="var(--violet)" stop-opacity=".1" />
            <stop offset="50%"  stop-color="var(--blue)"   stop-opacity=".85" />
            <stop offset="100%" stop-color="var(--teal)"   stop-opacity=".1" />
          </linearGradient>

          <radialGradient id="ah-core">
            <stop offset="0%"   stop-color="#fff"          stop-opacity=".95" />
            <stop offset="45%"  stop-color="var(--violet)" />
            <stop offset="100%" stop-color="var(--violet-deep)" />
          </radialGradient>

          <!-- Rotating scan beam -->
          <linearGradient id="ah-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="var(--blue)"   stop-opacity=".55" />
            <stop offset="100%" stop-color="var(--violet)" stop-opacity="0" />
          </linearGradient>

          <filter id="ah-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" /><feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Expanding pulse rings -->
        <g class="pulses" fill="none" stroke="url(#ah-ring)" stroke-width="2">
          <circle cx="260" cy="260" r="70" class="p1" />
          <circle cx="260" cy="260" r="70" class="p2" />
          <circle cx="260" cy="260" r="70" class="p3" />
        </g>

        <!-- Static perimeter zones -->
        <g fill="none" stroke="url(#ah-ring)">
          <circle cx="260" cy="260" r="106" stroke-width="2.4" opacity=".55" />
          <circle cx="260" cy="260" r="160" stroke-width="1.8"
                  stroke-dasharray="6 10" opacity=".42" />
          <circle cx="260" cy="260" r="214" stroke-width="1.4"
                  stroke-dasharray="3 12" opacity=".3" />
        </g>

        <!-- Rotating scan beam -->
        <g class="beam">
          <path d="M260 260 L260 46 A214 214 0 0 1 411 108 Z" fill="url(#ah-beam)" />
        </g>

        <!-- Spokes with travelling data packets -->
        <g stroke="url(#ah-spoke)" stroke-width="2.2" fill="none" stroke-linecap="round">
          <path d="M84 344 L260 260 L436 176" class="spoke s1" />
          <path d="M120 150 L260 260 L400 370" class="spoke s2" />
          <path d="M260 46  L260 260 L260 474" class="spoke s3" />
        </g>

        <!-- Orbiting satellites -->
        <g class="orbit orbit--a">
          <circle cx="260" cy="100" r="7" class="sat sat--v" />
        </g>
        <g class="orbit orbit--b">
          <circle cx="260" cy="154" r="5" class="sat sat--b" />
        </g>
        <g class="orbit orbit--c">
          <circle cx="260" cy="46" r="5.5" class="sat sat--t" />
        </g>

        <!-- Fixed checkpoint nodes -->
        <g class="nodes">
          <circle cx="84"  cy="344" r="7" />
          <circle cx="436" cy="176" r="7" />
          <circle cx="120" cy="150" r="5" />
          <circle cx="400" cy="370" r="5" />
        </g>

        <!-- Core badge -->
        <g class="core" filter="url(#ah-glow)">
          <circle cx="260" cy="260" r="46" fill="url(#ah-core)" />
          <path d="M260 235 l20 7.5v14c0 12.5-8.5 21-20 23-11.5-2-20-10.5-20-23v-14z"
                fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round" />
          <path d="M251.5 258.5 l6 6 10.5-10.5" fill="none" stroke="#fff"
                stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </svg>

      <!-- Floating glass stat chips, anchored inside the composition -->
      <div class="chip chip--a">
        <span class="k">On site now</span>
        <span class="v">Live<i class="dot"></i></span>
      </div>
      <div class="chip chip--b">
        <span class="k">Card workflow</span>
        <span class="v">3 stages</span>
      </div>
      <div class="chip chip--c">
        <span class="k">Ask ACMS</span>
        <span class="v">Plain English</span>
      </div>
    </div>
  `,
  styles: [`
    .hero {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      max-height: 100%;
      display: grid;
      place-items: center;
      isolation: isolate;
    }

    .svg { width: 100%; height: 100%; display: block; overflow: visible; }

    /* ---- Colour bloom: the single biggest vibrancy lever ---- */
    .bloom {
      position: absolute; border-radius: 50%;
      filter: blur(64px); pointer-events: none; z-index: -1;
    }
    .bloom--v {
      width: 58%; height: 58%; top: 4%; left: 6%;
      background: var(--violet); opacity: .30;
      animation: drift 17s ease-in-out infinite alternate;
    }
    .bloom--b {
      width: 52%; height: 52%; bottom: 6%; right: 4%;
      background: var(--blue); opacity: .26;
      animation: drift 21s ease-in-out infinite alternate-reverse;
    }
    .bloom--t {
      width: 40%; height: 40%; bottom: 18%; left: 20%;
      background: var(--teal); opacity: .20;
      animation: drift 25s ease-in-out infinite alternate;
    }
    @keyframes drift {
      to { transform: translate3d(9%, -7%, 0) scale(1.14); }
    }

    /* ---- Expanding pulse rings ---- */
    .pulses circle { transform-origin: 260px 260px; opacity: 0; }
    .p1 { animation: pulse 4.2s ease-out infinite; }
    .p2 { animation: pulse 4.2s ease-out infinite 1.4s; }
    .p3 { animation: pulse 4.2s ease-out infinite 2.8s; }
    @keyframes pulse {
      0%   { transform: scale(.55); opacity: .75; }
      70%  { opacity: .18; }
      100% { transform: scale(3.1); opacity: 0; }
    }

    /* ---- Rotating scan beam ---- */
    .beam { transform-origin: 260px 260px; animation: spin 11s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ---- Data packets travelling along the spokes ---- */
    .spoke {
      stroke-dasharray: 26 340;
      stroke-dashoffset: 366;
      animation: travel 3.4s linear infinite;
    }
    .s2 { animation-delay: -1.1s; }
    .s3 { animation-delay: -2.2s; }
    @keyframes travel { to { stroke-dashoffset: -26; } }

    /* ---- Orbiting satellites ---- */
    .orbit { transform-origin: 260px 260px; }
    .orbit--a { animation: spin 16s linear infinite; }
    .orbit--b { animation: spin 9s  linear infinite reverse; }
    .orbit--c { animation: spin 26s linear infinite; }

    .sat { filter: drop-shadow(0 0 7px currentColor); }
    .sat--v { fill: var(--violet); color: var(--violet); }
    .sat--b { fill: var(--blue);   color: var(--blue); }
    .sat--t { fill: var(--teal);   color: var(--teal); }

    .nodes circle {
      fill: var(--blue); opacity: .8;
      filter: drop-shadow(0 0 6px var(--blue));
    }
    .nodes circle:nth-child(1),
    .nodes circle:nth-child(2) { fill: var(--violet); filter: drop-shadow(0 0 8px var(--violet)); }

    .core { transform-origin: 260px 260px; animation: breathe 4s ease-in-out infinite; }
    @keyframes breathe {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.045); }
    }

    /* ---- Floating glass chips ---- */
    .chip {
      position: absolute;
      display: grid; gap: 2px;
      padding: 11px 17px;
      border-radius: var(--r-md);
      border: 1px solid var(--glass-border);
      background: var(--glass-strong);
      backdrop-filter: blur(var(--blur-surface)) saturate(200%);
      -webkit-backdrop-filter: blur(var(--blur-surface)) saturate(200%);
      box-shadow: var(--sh-lift), var(--glass-inset);
      animation: float 7s ease-in-out infinite;
      white-space: nowrap;
    }
    .chip--a { top: 8%;    left: -2%;  animation-delay: 0s; }
    .chip--b { top: 42%;   right: -4%; animation-delay: -2.4s; }
    .chip--c { bottom: 9%; left: 8%;   animation-delay: -4.8s; }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-9px); }
    }

    .k { font-size: 10px; font-weight: 700; letter-spacing: .09em;
         text-transform: uppercase; color: var(--ink-muted); }
    .v { display: flex; align-items: center; gap: 7px;
         font-size: var(--fs-base); font-weight: 700; color: var(--ink); }
    .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--success-fg);
      box-shadow: 0 0 0 3px var(--success-bg);
      animation: blink 1.8s ease-in-out infinite;
    }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }

    @media (prefers-reduced-motion: reduce) {
      .bloom, .pulses circle, .beam, .spoke,
      .orbit, .core, .chip, .dot { animation: none; }
      .pulses circle { opacity: .3; }
      .spoke { stroke-dasharray: none; stroke-dashoffset: 0; }
    }
  `],
})
export class AuthHeroComponent {}