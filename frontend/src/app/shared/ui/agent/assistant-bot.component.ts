import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * A friendly floating robot for the agent's empty state. Pure SVG + CSS -
 * no image asset, no external dependency, themes automatically since it
 * uses the brand tokens for its fill colours.
 */
@Component({
  selector: 'acms-assistant-bot',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" aria-hidden="true">
      <span class="shadow"></span>

      <svg class="bot" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="bot-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stop-color="var(--violet)" />
            <stop offset="100%" stop-color="var(--blue)" />
          </linearGradient>
          <radialGradient id="bot-glow">
            <stop offset="0%"  stop-color="#fff" stop-opacity=".9" />
            <stop offset="100%" stop-color="#fff" stop-opacity="0" />
          </radialGradient>
        </defs>

        <!-- Antenna -->
        <g class="antenna">
          <line x1="60" y1="22" x2="60" y2="10" stroke="url(#bot-body)" stroke-width="3" stroke-linecap="round" />
          <circle cx="60" cy="8" r="9" fill="url(#bot-glow)" class="antenna-glow" />
          <circle cx="60" cy="8" r="4" fill="var(--amber)" />
        </g>

        <!-- Ears -->
        <rect x="14" y="46" width="9" height="20" rx="4.5" fill="url(#bot-body)" opacity=".85" />
        <rect x="97" y="46" width="9" height="20" rx="4.5" fill="url(#bot-body)" opacity=".85" />

        <!-- Head -->
        <rect x="22" y="24" width="76" height="66" rx="26" fill="url(#bot-body)" />
        <rect x="22" y="24" width="76" height="66" rx="26" fill="none"
              stroke="#fff" stroke-opacity=".18" stroke-width="1.5" />

        <!-- Face plate -->
        <rect x="32" y="40" width="56" height="38" rx="16" fill="#0E1330" opacity=".28" />

        <!-- Eyes -->
        <g class="eyes">
          <rect x="42" y="52" width="10" height="14" rx="5" fill="#fff" />
          <rect x="68" y="52" width="10" height="14" rx="5" fill="#fff" />
        </g>

        <!-- Smile -->
        <path class="mouth" d="M46 70 Q60 80 74 70" fill="none"
              stroke="#fff" stroke-width="3.4" stroke-linecap="round" />

        <!-- Cheeks -->
        <circle cx="38" cy="68" r="4" fill="var(--rose)" opacity=".45" />
        <circle cx="82" cy="68" r="4" fill="var(--rose)" opacity=".45" />
      </svg>

      <!-- Orbiting sparkle particles -->
      <span class="spark spark--a"></span>
      <span class="spark spark--b"></span>
      <span class="spark spark--c"></span>
    </div>
  `,
  styles: [`
    .wrap {
      position: relative;
      width: 108px; height: 108px;
      display: grid; place-items: center;
      margin-bottom: 6px;
    }

    .bot {
      width: 100%; height: 100%;
      filter: drop-shadow(0 10px 20px rgba(91,76,214,.35));
      animation: bob 3.2s ease-in-out infinite, wobble 5.5s ease-in-out infinite;
      transform-origin: 60% 90%;
    }
    @keyframes bob {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-7px); }
    }
    @keyframes wobble {
      0%, 100% { rotate: -3deg; }
      50%      { rotate: 3deg; }
    }

    .antenna { transform-origin: 60px 22px; animation: antenna-sway 3.2s ease-in-out infinite; }
    @keyframes antenna-sway {
      0%, 100% { transform: rotate(-4deg); }
      50%      { transform: rotate(4deg); }
    }
    .antenna-glow { animation: glow 1.8s ease-in-out infinite; transform-origin: 60px 8px; }
    @keyframes glow {
      0%, 100% { opacity: .5; transform: scale(1); }
      50%      { opacity: 1;  transform: scale(1.3); }
    }

    /* Blink: mostly open, brief close, staggered so it reads as a natural
       blink rather than a metronome. */
    .eyes { animation: blink 4.6s ease-in-out infinite; transform-origin: 60px 59px; }
    @keyframes blink {
      0%, 92%, 100% { transform: scaleY(1); }
      95%           { transform: scaleY(.12); }
    }

    .mouth { animation: smile 3.2s ease-in-out infinite; transform-origin: 60px 74px; }
    @keyframes smile {
      0%, 100% { transform: scaleX(1); }
      50%      { transform: scaleX(1.08) translateY(-.5px); }
    }

    .shadow {
      position: absolute; bottom: 2px; left: 50%;
      width: 54px; height: 10px; border-radius: 50%;
      background: radial-gradient(ellipse, rgba(91,76,214,.28), transparent 70%);
      transform: translateX(-50%);
      animation: shadow-pulse 3.2s ease-in-out infinite;
    }
    @keyframes shadow-pulse {
      0%, 100% { transform: translateX(-50%) scale(1); opacity: .6; }
      50%      { transform: translateX(-50%) scale(.8); opacity: .35; }
    }

    .spark {
      position: absolute; width: 5px; height: 5px; border-radius: 50%;
      background: var(--teal); box-shadow: 0 0 8px var(--teal);
    }
    .spark--a { top: 6%;  right: 2%;  animation: orbit-a 5s linear infinite; }
    .spark--b { bottom: 18%; left: -2%; background: var(--amber); box-shadow: 0 0 8px var(--amber);
                animation: orbit-b 6.5s linear infinite; }
    .spark--c { top: 40%; right: -4%; background: var(--rose); box-shadow: 0 0 8px var(--rose);
                animation: orbit-c 4.2s linear infinite; }
    @keyframes orbit-a {
      0%, 100% { transform: translate(0,0); opacity: .8; }
      50%      { transform: translate(-8px, 10px); opacity: .3; }
    }
    @keyframes orbit-b {
      0%, 100% { transform: translate(0,0); opacity: .7; }
      50%      { transform: translate(10px, -8px); opacity: .25; }
    }
    @keyframes orbit-c {
      0%, 100% { transform: translate(0,0); opacity: .75; }
      50%      { transform: translate(-6px, -10px); opacity: .3; }
    }

    @media (prefers-reduced-motion: reduce) {
      .bot, .antenna, .antenna-glow, .eyes, .mouth, .shadow, .spark {
        animation: none;
      }
    }
  `],
})
export class AssistantBotComponent {}