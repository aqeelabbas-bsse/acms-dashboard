import {
  AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef,
  HostListener, OnDestroy, OnInit, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../../core/services/agent.service';
import { ChatMessage } from '../../../core/models/agent.models';
import { IconComponent } from '../icon/icon.component';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';
import { AssistantBotComponent } from './assistant-bot.component';

/** Staged labels shown while waiting. Gemini round trips run 2-6s; a static
 *  spinner for that long feels broken, whereas narrating the real pipeline
 *  makes the wait legible and shorter-feeling. */
const STAGES = [
  'Reading your question',
  'Writing a read-only query',
  'Checking it is safe to run',
  'Querying the database',
  'Putting it in plain English',
];

@Component({
  selector: 'acms-agent-panel',
  standalone: true,
  imports: [FormsModule, IconComponent, FocusTrapDirective, AssistantBotComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (agent.isOpen()) {
      <div class="scrim" (click)="agent.close()" aria-hidden="true"></div>

      <aside class="panel" [class.full]="fullscreen()" acmsFocusTrap
             role="dialog" aria-modal="true" aria-label="Ask ACMS assistant">

        <!-- Header -->
        <header class="hd">
          <div class="stage hd__stage">
            <div class="brand">
              <span class="orb">
                <span class="orb__ring"></span>
                <acms-icon name="sparkle" [size]="17" [weight]="2" />
              </span>
              <div>
                <div class="t">Ask ACMS</div>
                <div class="s">Plain-English questions, read-only answers</div>
              </div>
            </div>
            <div class="hd__act">
              @if (!agent.isEmpty()) {
                <button type="button" class="ghost-ic" (click)="agent.clear()"
                        aria-label="Clear conversation" title="Clear conversation">
                  <acms-icon name="refresh" [size]="15" />
                </button>
              }
              <button type="button" class="ghost-ic" (click)="fullscreen.set(!fullscreen())"
                      [attr.aria-label]="fullscreen() ? 'Exit full screen' : 'Full screen'"
                      [attr.title]="fullscreen() ? 'Exit full screen' : 'Full screen'">
                <acms-icon [name]="fullscreen() ? 'chevronR' : 'chevronL'" [size]="15" [weight]="2.2" />
              </button>
              <button type="button" class="ghost-ic" (click)="agent.close()"
                      aria-label="Close assistant">
                <acms-icon name="close" [size]="16" [weight]="2.2" />
              </button>
            </div>
          </div>
        </header>

        <!-- Thread -->
        <div class="thread" [class.no-scroll]="agent.isEmpty()" #thread>
          <div class="stage">
            @if (agent.isEmpty()) {
              <div class="intro">
                <acms-assistant-bot />
                <h3 class="intro__t">What would you like to know?</h3>
                <p class="intro__m">
                  Ask about employees, visitors, card requests or RFID cards.
                  I translate your question into a read-only query &mdash; I can
                  never change or delete anything.
                </p>
              </div>
            } @else {
              @for (m of agent.messages(); track m.id) {
                @if (m.role === 'user') {
                  <div class="msg msg--user">
                    <div class="bub bub--user">{{ m.text }}</div>
                  </div>
                } @else {
                  <div class="msg msg--agent">
                    <span class="av"><acms-icon name="sparkle" [size]="13" [weight]="2.2" /></span>

                    <div class="col">
                      @if (m.status === 'pending') {
                        <div class="bub bub--agent thinking">
                          <span class="dots"><i></i><i></i><i></i></span>
                          <span class="stage-label">{{ stage() }}</span>
                        </div>
                      } @else {
                        <div class="bub bub--agent"
                             [class.bub--refused]="m.status === 'refused'"
                             [class.bub--error]="m.status === 'error'">
                          @if (m.status === 'refused') {
                            <div class="flag"><acms-icon name="shield" [size]="13" [weight]="2.2" /> Blocked by safety check</div>
                          }
                          @if (m.status === 'error') {
                            <div class="flag"><acms-icon name="alert" [size]="13" [weight]="2.2" /> Could not answer</div>
                          }
                          <p class="answer">{{ reveal(m) }}</p>
                        </div>

                        @if (m.status === 'done') {
                          <div class="meta">
                            @if (m.rowCount !== undefined) {
                              <span class="tag">{{ m.rowCount }} {{ m.rowCount === 1 ? 'row' : 'rows' }}</span>
                            }
                            @if (m.elapsedMs !== undefined) {
                              <span class="tag">{{ (m.elapsedMs / 1000).toFixed(1) }}s</span>
                            }
                            <button type="button" class="tag tag--btn" (click)="copy(m.text)">
                              <acms-icon name="card" [size]="11" /> Copy
                            </button>
                          </div>

                        }
                      }
                    </div>
                  </div>
                }
              }
            }
          </div>
        </div>

        <!-- Suggestion chips -->
        @if (agent.isEmpty()) {
          <div class="stage">
            <div class="chips" [class.chips--grid]="fullscreen()">
              @for (c of agent.chips(); track c.question) {
                <button type="button" class="chip" (click)="send(c.question)">
                  {{ c.label }}
                </button>
              }
            </div>
          </div>
        }

        <!-- Composer -->
        <div class="stage">
          <div class="composer" [class.on]="focused()">
            <textarea #input rows="1"
                      [(ngModel)]="draft"
                      (focus)="focused.set(true)" (blur)="focused.set(false)"
                      (keydown)="onKey($event)"
                      (input)="autosize()"
                      [disabled]="agent.busy()"
                      placeholder="Ask about visitors, cards, employees..."
                      aria-label="Your question"></textarea>
            <button type="button" class="send"
                    [disabled]="!draft.trim() || agent.busy()"
                    (click)="send(draft)" aria-label="Send question">
              <acms-icon name="arrowRight" [size]="17" [weight]="2.4" />
            </button>
          </div>
          <div class="hint">
            <kbd>Enter</kbd> to send &middot; <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
            &middot; each question is independent &mdash; I don't remember earlier turns yet
          </div>
        </div>
      </aside>
    }
  `,
  styles: [`
    :host { display: contents; }

    .scrim {
      position: fixed; inset: 0; z-index: 110;
      background: rgba(10, 12, 30, .42);
      backdrop-filter: blur(3px);
      animation: fade var(--t-base) var(--ease) both;
    }
    @keyframes fade { from { opacity: 0; } }

    .panel {
      position: fixed; top: 14px; right: 14px; bottom: 14px; z-index: 120;
      width: min(460px, calc(100vw - 28px));
      display: flex; flex-direction: column;
      padding: var(--s-5);
      border-radius: var(--r-xl);
      border: 1px solid var(--glass-border);
      background: var(--glass-strong);
      backdrop-filter: blur(var(--blur-chrome)) saturate(190%);
      -webkit-backdrop-filter: blur(var(--blur-chrome)) saturate(190%);
      box-shadow: var(--sh-lift), var(--glass-inset);
      animation: slideIn var(--t-base) var(--ease) both;
      transition: right var(--t-base) var(--ease), left var(--t-base) var(--ease),
                  width var(--t-base) var(--ease);
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(28px) scale(.985); }
    }
    .panel.full { left: 14px; width: auto; }

    /* Every content region shares one centered column definition. */
    .stage {
      width: 100%;
      max-width: 460px;
      margin-inline: auto;
      transition: max-width var(--t-base) var(--ease);
    }
    .panel.full .stage { max-width: 800px; }

    /* ---- Header ---- */
    .hd { padding-bottom: var(--s-4); border-bottom: 1px solid var(--track); }
    .hd__stage { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-3); }
    .brand { display: flex; align-items: center; gap: 11px; }

    .orb {
      position: relative; display: grid; place-items: center;
      width: 38px; height: 38px; border-radius: 13px; color: #fff; flex-shrink: 0;
      background: linear-gradient(135deg, var(--violet), var(--blue));
      box-shadow: var(--sh-brand);
    }
    .orb__ring {
      position: absolute; inset: -5px; border-radius: 16px;
      background: conic-gradient(from 0deg, transparent, var(--violet), transparent 60%);
      opacity: .55; animation: spin 3.2s linear infinite;
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
              mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .hd .t { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-md); }
    .hd .s { font-size: var(--fs-xs); color: var(--ink-muted); }
    .hd__act { display: flex; gap: 6px; flex-shrink: 0; }
    .ghost-ic {
      display: grid; place-items: center; width: 32px; height: 32px;
      border: none; border-radius: 50%; cursor: pointer;
      background: var(--hover-wash); color: var(--ink-muted);
      transition: all var(--t-fast) var(--ease);
    }
    .ghost-ic:hover { background: var(--hover-wash-2); color: var(--ink); }

    /* ---- Thread ---- */
    .thread { flex: 1; min-height: 0; overflow-y: auto; padding: var(--s-5) 2px; }
    .thread.no-scroll { overflow-y: hidden; }
    .thread .stage { display: flex; flex-direction: column; gap: var(--s-4); }

    .intro { display: grid; place-items: center; gap: 8px; text-align: center;
         padding: var(--s-6) var(--s-4); margin: auto 0; }
    .intro__t { font-size: var(--fs-lg); font-weight: 700; }
    .intro__m { margin: 0; max-width: 34ch; font-size: var(--fs-sm);
                color: var(--ink-muted); line-height: 1.6; }

    .msg { display: flex; gap: 10px; animation: rise var(--t-base) var(--ease) both; }
    @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
    .msg--user { justify-content: flex-end; }
    .msg--agent { align-items: flex-start; }
    .col { min-width: 0; display: flex; flex-direction: column; gap: 7px; flex: 1; }

    .av {
      display: grid; place-items: center; width: 26px; height: 26px;
      border-radius: 9px; flex-shrink: 0; color: #fff; margin-top: 2px;
      background: linear-gradient(135deg, var(--violet), var(--blue));
    }

    .bub {
      padding: 11px 15px; border-radius: 16px;
      font-size: var(--fs-base); line-height: 1.6;
      max-width: 76%; width: fit-content; word-wrap: break-word;
    }
    .panel.full .bub { max-width: 640px; }
    .bub--user {
      color: #fff; border-bottom-right-radius: 5px; margin-left: auto;
      background: linear-gradient(135deg, var(--violet), var(--violet-deep));
      box-shadow: var(--sh-brand);
    }
    .bub--agent {
      border-bottom-left-radius: 5px;
      background: var(--hover-wash);
      border: 1px solid var(--glass-border);
      color: var(--ink-soft);
    }
    .bub--refused { background: var(--warn-bg); border-color: transparent; }
    .bub--error   { background: var(--danger-bg); border-color: transparent; }

    .flag {
      display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
      font-size: var(--fs-xs); font-weight: 700;
      letter-spacing: .04em; text-transform: uppercase;
    }
    .bub--refused .flag { color: var(--warn-fg); }
    .bub--error   .flag { color: var(--danger-fg); }
    .answer { margin: 0; white-space: pre-wrap; }

    .thinking { display: flex; align-items: center; gap: 10px; }
    .dots { display: inline-flex; gap: 4px; }
    .dots i {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--violet-fg);
      animation: bounce 1.3s ease-in-out infinite;
    }
    .dots i:nth-child(2) { animation-delay: .16s; }
    .dots i:nth-child(3) { animation-delay: .32s; }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: .45; }
      30%           { transform: translateY(-5px); opacity: 1; }
    }
    .stage-label { font-size: var(--fs-sm); color: var(--ink-muted); }

    .meta { display: flex; flex-wrap: wrap; gap: 6px; padding-left: 2px; }
    .tag {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 9px; border-radius: var(--r-pill);
      font-family: var(--font-body);
      font-size: 10.5px; font-weight: 600;
      background: var(--hover-wash); color: var(--ink-muted);
      border: 1px solid transparent;
    }
    .tag--btn { cursor: pointer; transition: all var(--t-fast) var(--ease); }
    .tag--btn:hover { background: var(--violet-bg); color: var(--violet-fg); }

    /* ---- Chips: full text, never clipped ---- */
    .chips { display: flex; flex-wrap: wrap; gap: 7px; padding-bottom: var(--s-4); }
    .chips--grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .chip {
      padding: 9px 15px; border-radius: var(--r-md);
      border: 1px solid var(--glass-border);
      background: var(--hover-wash); color: var(--ink-soft);
      font-family: var(--font-body); font-size: var(--fs-sm); font-weight: 600;
      line-height: 1.4; text-align: left;
      white-space: normal; word-break: break-word;
      cursor: pointer; transition: all var(--t-fast) var(--ease);
    }
    .chip:hover {
      background: var(--violet-bg); color: var(--violet-fg);
      border-color: rgba(124,108,240,.3); transform: translateY(-1px);
    }

    .thread {
  flex: 1; min-height: 0; overflow-y: auto; padding: var(--s-5) 2px;
  scrollbar-gutter: stable;
}

    /* ---- Composer ---- */
    .composer {
      display: flex; align-items: flex-end; gap: 8px;
      padding: 8px 8px 8px 16px;
      border-radius: 20px;
      border: 1px solid var(--glass-border);
      background: var(--hover-wash);
      transition: all var(--t-fast) var(--ease);
    }
    .composer.on {
      border-color: rgba(124,108,240,.5);
      box-shadow: 0 0 0 4px rgba(124,108,240,.12);
      background: var(--glass-strong);
    }
    textarea {
      flex: 1; min-width: 0; max-height: 132px;
      border: none; outline: none; background: transparent; resize: none;
      padding: 9px 0;
      font-family: var(--font-body); font-size: var(--fs-base);
      line-height: 1.5; color: var(--ink);
    }
    textarea::placeholder { color: var(--ink-dim); }
    textarea:disabled { opacity: .6; }

    .send {
      display: grid; place-items: center; width: 40px; height: 40px;
      flex-shrink: 0; border: none; border-radius: 50%; cursor: pointer;
      color: #fff;
      background: linear-gradient(135deg, var(--violet), var(--blue));
      box-shadow: var(--sh-brand);
      transition: transform var(--t-fast) var(--ease), opacity var(--t-fast) var(--ease);
    }
    .send:hover:not(:disabled) { transform: scale(1.06); }
    .send:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }

    .hint { padding-top: 8px; text-align: center;
            font-size: 10.5px; color: var(--ink-dim); }
    kbd {
      padding: 2px 5px; border-radius: 5px;
      background: var(--hover-wash); border: 1px solid var(--glass-border);
      font-family: var(--font-body); font-size: 10px;
    }

    @media (max-width: 560px) {
      .panel { top: 8px; right: 8px; bottom: 8px; width: calc(100vw - 16px); }
      .panel.full { left: 8px; }
      .bub { max-width: 90%; }
    }

    @media (prefers-reduced-motion: reduce) {
      .panel, .msg, .orb__ring, .dots i { animation: none; }
    }
  `],
})
export class AgentPanelComponent implements OnInit, AfterViewChecked, OnDestroy {
  protected readonly agent = inject(AgentService);

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');
  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');

  protected draft = '';
  protected readonly focused = signal(false);
  protected readonly fullscreen = signal(false);

  private readonly stageIx = signal(0);
  protected readonly stage = computed(() => STAGES[this.stageIx() % STAGES.length]);
  private stageTimer: ReturnType<typeof setInterval> | null = null;

  private readonly revealed = signal<Record<string, number>>({});
  private revealTimer: ReturnType<typeof setInterval> | null = null;

  private lastCount = 0;

  constructor() {
    effect(() => {
      if (this.agent.busy()) {
        this.stageIx.set(0);
        this.stageTimer ??= setInterval(
          () => this.stageIx.update(i => i + 1), 1400);
      } else if (this.stageTimer) {
        clearInterval(this.stageTimer);
        this.stageTimer = null;
      }
    });

    effect(() => {
      const last = this.agent.messages().at(-1);
      if (last?.role === 'agent' && last.status !== 'pending'
          && this.revealed()[last.id] === undefined) {
        this.startReveal(last.id, last.text.length);
      }
    });

    effect(() => {
      if (this.agent.isOpen()) {
        queueMicrotask(() => this.input()?.nativeElement.focus());
      }
    });
  }

  ngOnInit(): void {
    this.agent.loadSuggestions();
  }

  ngAfterViewChecked(): void {
    const count = this.agent.messages().length;
    if (count !== this.lastCount) {
      this.lastCount = count;
      this.scrollToBottom();
    }
  }

  ngOnDestroy(): void {
    if (this.stageTimer) clearInterval(this.stageTimer);
    if (this.revealTimer) clearInterval(this.revealTimer);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.agent.isOpen()) this.agent.close();
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send(this.draft);
    }
  }

  protected send(text: string): void {
    const q = text.trim();
    if (!q || this.agent.busy()) return;
    this.agent.ask(q);
    this.draft = '';
    queueMicrotask(() => this.autosize());
  }

  protected autosize(): void {
    const el = this.input()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text);
  }

  protected reveal(m: ChatMessage): string {
    const n = this.revealed()[m.id];
    return n === undefined ? m.text : m.text.slice(0, n);
  }

  private startReveal(id: string, total: number): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.revealed.update(r => ({ ...r, [id]: total }));
      return;
    }
    this.revealed.update(r => ({ ...r, [id]: 0 }));
    if (this.revealTimer) clearInterval(this.revealTimer);

    const step = Math.max(1, Math.round(total / 60));
    this.revealTimer = setInterval(() => {
      const cur = this.revealed()[id] ?? 0;
      const next = cur + step;
      if (next >= total) {
        this.revealed.update(r => ({ ...r, [id]: total }));
        if (this.revealTimer) { clearInterval(this.revealTimer); this.revealTimer = null; }
      } else {
        this.revealed.update(r => ({ ...r, [id]: next }));
      }
      this.scrollToBottom();
    }, 16);
  }

  private scrollToBottom(): void {
    const el = this.thread()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}