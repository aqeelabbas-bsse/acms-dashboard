import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { GlassCardComponent } from '../../shared/ui/glass-card/glass-card.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { IconName } from '../../shared/ui/icon/icons';
import { SearchInputComponent } from '../../shared/ui/search-input/search-input.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models/api.models';

interface FaqItem {
  q: string;
  /** Answer paragraphs. Split rather than one blob so long answers stay readable. */
  a: string[];
}

interface FaqGroup {
  title: string;
  icon: IconName;
  items: FaqItem[];
}

interface DocCard {
  title: string;
  blurb: string;
  file: string;
  icon: IconName;
  tone: 'violet' | 'teal';
  meta: string;
  /** Omit to show the card to everyone. */
  roles?: Role[];
  note?: string;
}

/**
 * Help centre — the in-app FAQ plus downloadable documentation.
 *
 * The FAQ here and the FAQ in the User Guide PDF are kept deliberately in
 * step: the same questions, the same answers. Somebody who reads one and then
 * the other should never find them disagreeing. When an answer changes, change
 * it in both.
 *
 * The PDFs are served as plain static assets from `public/docs/`, so clicking
 * a card downloads the file directly with no backend round-trip and no auth
 * token needed for the download itself.
 */
@Component({
  selector: 'acms-help',
  standalone: true,
  imports: [
    GlassCardComponent, IconComponent, SearchInputComponent, EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page rise">
      <div>
        <div class="eyebrow">Help</div>
        <h1 class="title">FAQ &amp; <span class="grad-text">User Guide</span></h1>
        <p class="sub">
          Answers to the questions that come up most, plus the full documentation
          set as downloadable PDFs.
        </p>
      </div>
    </header>

    <!-- Documents -->
    <section class="docs stagger">
      @for (d of visibleDocs(); track d.file) {
        <a class="doc" [attr.data-tone]="d.tone" [href]="'docs/' + d.file"
           [attr.download]="d.file">
          <span class="doc__ic"><acms-icon [name]="d.icon" [size]="20" [weight]="1.9" /></span>
          <span class="doc__body">
            <span class="doc__t">{{ d.title }}</span>
            <span class="doc__b">{{ d.blurb }}</span>
            @if (d.note) { <span class="doc__n">{{ d.note }}</span> }
            <span class="doc__m">{{ d.meta }}</span>
          </span>
          <span class="doc__dl">
            <acms-icon name="download" [size]="17" [weight]="2.1" />
          </span>
        </a>
      }
    </section>

    <!-- FAQ -->
    <acms-glass-card title="Frequently asked questions"
                     subtitle="Search, or open a section to browse">
      <div class="tools">
        <acms-search-input [value]="query()" (valueChange)="query.set($event)"
                           placeholder="Search the FAQ..." />
        @if (query()) {
          <span class="hits">{{ hitCount() }} matching</span>
        }
        <button type="button" class="ghost" (click)="toggleAll()">
          <acms-icon [name]="allOpen() ? 'close' : 'plus'" [size]="13" [weight]="2.2" />
          {{ allOpen() ? 'Collapse all' : 'Expand all' }}
        </button>
      </div>

      @if (filtered().length === 0) {
        <acms-empty-state icon="search" title="Nothing matches that"
          message="Try a shorter phrase, or download the User Guide for the full manual." />
      } @else {
        @for (g of filtered(); track g.title) {
          <section class="grp">
            <h3 class="grp__t">
              <acms-icon [name]="g.icon" [size]="15" [weight]="2" />
              {{ g.title }}
              <span class="grp__n">{{ g.items.length }}</span>
            </h3>

            @for (item of g.items; track item.q) {
              <div class="qa" [class.qa--open]="isOpen(item.q)">
                <button type="button" class="qa__q" (click)="toggle(item.q)"
                        [attr.aria-expanded]="isOpen(item.q)">
                  <span>{{ item.q }}</span>
                  <acms-icon name="chevron" [size]="15" [weight]="2.2" class="qa__c" />
                </button>
                @if (isOpen(item.q)) {
                  <div class="qa__a">
                    @for (p of item.a; track p) { <p>{{ p }}</p> }
                  </div>
                }
              </div>
            }
          </section>
        }
      }
    </acms-glass-card>

    <p class="stamp">
      <acms-icon name="alert" [size]="12" />
      When reporting a problem, include the screen, what you clicked, what you
      expected, what happened, and the time &mdash; the time is what lets the
      matching server log entry be found.
    </p>
  `,
  styles: [`
    :host { display: block; }

    .page { margin-bottom: var(--s-6); }
    .title { font-size: var(--fs-2xl); font-weight: 700; margin: 6px 0 4px; }
    .sub { margin: 0; color: var(--ink-muted); max-width: 62ch; }

    /* ---- document cards ---- */
    .docs {
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: var(--s-5); margin-bottom: var(--s-6);
    }
    .doc {
      position: relative; overflow: hidden;
      display: flex; align-items: flex-start; gap: var(--s-4);
      padding: var(--s-5); border-radius: var(--r-lg);
      border: 1px solid rgba(255,255,255,.14);
      box-shadow: var(--sh-card), inset 0 1px 0 rgba(255,255,255,.18);
      color: #fff; text-decoration: none;
      transition: transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
    }
    .doc:hover { transform: translateY(-3px); box-shadow: var(--sh-float); }
    .doc:focus-visible { outline: none; box-shadow: var(--sh-float), 0 0 0 3px rgba(255,255,255,.85); }
    .doc[data-tone='violet'] { background: linear-gradient(115deg, #4C3BC4 0%, #6D5AE8 58%, #8B5CF6 100%); }
    .doc[data-tone='teal']   { background: linear-gradient(115deg, #155E63 0%, #0E7490 55%, #22D3EE 100%); }
    .doc::after {
      content: ''; position: absolute; top: -34%; right: -14%;
      width: 62%; aspect-ratio: 1; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,.28) 0%, transparent 70%);
      pointer-events: none;
    }

    .doc__ic {
      position: relative; z-index: 1; flex-shrink: 0;
      display: grid; place-items: center; width: 44px; height: 44px;
      border-radius: 13px;
      background: rgba(255,255,255,.18);
      border: 1px solid rgba(255,255,255,.22);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.25);
    }
    .doc__body { position: relative; z-index: 1; display: flex;
                 flex-direction: column; gap: 3px; min-width: 0; }
    .doc__t { font-family: var(--font-display); font-size: var(--fs-lg);
              font-weight: 700; }
    .doc__b { font-size: var(--fs-sm); color: rgba(255,255,255,.86); line-height: 1.5; }
    .doc__n { margin-top: 4px; font-size: var(--fs-xs);
              color: rgba(255,255,255,.94); font-weight: 600; }
    .doc__m { margin-top: 6px; font-size: var(--fs-xs); color: rgba(255,255,255,.7); }

    .doc__dl {
      position: relative; z-index: 1; flex-shrink: 0; margin-left: auto;
      display: grid; place-items: center; width: 34px; height: 34px;
      border-radius: 50%; background: rgba(255,255,255,.2);
      transition: transform var(--t-fast) var(--ease-spring),
                  background var(--t-fast) var(--ease);
    }
    .doc:hover .doc__dl { transform: translateY(2px); background: rgba(255,255,255,.32); }

    /* ---- FAQ ---- */
    .tools { display: flex; align-items: center; gap: 10px;
             flex-wrap: wrap; margin-bottom: var(--s-5); }
    .hits { font-size: var(--fs-xs); color: var(--ink-dim); }
    .ghost {
      display: inline-flex; align-items: center; gap: 6px;
      margin-left: auto; height: 34px; padding: 0 13px;
      border: 1px solid var(--glass-border); border-radius: var(--r-pill);
      background: var(--hover-wash); color: var(--ink-muted);
      font-family: var(--font-body); font-size: var(--fs-xs); font-weight: 600;
      cursor: pointer; transition: all var(--t-fast) var(--ease);
    }
    .ghost:hover { color: var(--ink); background: var(--hover-wash-2); }

    .grp { margin-bottom: var(--s-6); }
    .grp:last-child { margin-bottom: 0; }
    .grp__t {
      display: flex; align-items: center; gap: 8px;
      margin: 0 0 var(--s-3); padding-bottom: 9px;
      border-bottom: 1px solid var(--track);
      font-size: var(--fs-sm); font-weight: 700;
      color: var(--ink-muted); text-transform: uppercase; letter-spacing: .04em;
    }
    .grp__t acms-icon { color: var(--violet-fg); }
    .grp__n {
      margin-left: auto; padding: 2px 8px; border-radius: 999px;
      background: var(--hover-wash); color: var(--ink-dim);
      font-size: 10px; font-weight: 700; letter-spacing: 0;
    }

    .qa { border-bottom: 1px solid var(--track); }
    .qa:last-child { border-bottom: none; }
    .qa__q {
      display: flex; align-items: center; gap: var(--s-4); width: 100%;
      padding: 13px 2px; border: none; background: transparent;
      color: var(--ink); font-family: var(--font-body);
      font-size: var(--fs-base); font-weight: 500; text-align: left;
      cursor: pointer; transition: color var(--t-fast) var(--ease);
    }
    .qa__q:hover { color: var(--violet-fg); }
    .qa__q:focus-visible { outline: 2px solid var(--violet-fg); outline-offset: 2px;
                           border-radius: var(--r-sm); }
    .qa__c { margin-left: auto; flex-shrink: 0; color: var(--ink-dim);
             transition: transform var(--t-fast) var(--ease); }
    .qa--open .qa__q { color: var(--violet-fg); font-weight: 600; }
    .qa--open .qa__c { transform: rotate(180deg); }

    .qa__a { padding: 0 2px 15px; animation: reveal var(--t-base) var(--ease); }
    .qa__a p { margin: 0 0 9px; font-size: var(--fs-sm); line-height: 1.65;
               color: var(--ink-soft); max-width: 78ch; }
    .qa__a p:last-child { margin-bottom: 0; }
    @keyframes reveal { from { opacity: 0; transform: translateY(-4px); } }

    .stamp { display: flex; align-items: flex-start; gap: 7px;
             margin: var(--s-6) 0 0; font-size: var(--fs-xs);
             color: var(--ink-dim); line-height: 1.55; max-width: 80ch; }
    .stamp acms-icon { flex-shrink: 0; margin-top: 2px; }

    @media (max-width: 900px) { .docs { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) {
      .doc, .doc__dl, .qa__c { transition: none; }
      .qa__a { animation: none; }
    }
  `],
})
export class HelpComponent {
  private readonly auth = inject(AuthService);

  protected readonly query = signal('');
  private readonly open = signal<Set<string>>(new Set());

  /* ------------------------------------------------------- documents */

  private readonly docs: DocCard[] = [
    {
      title: 'User Guide',
      blurb: 'The complete operating manual — every screen, every action, '
           + 'roles, searching, and the full FAQ.',
      file: 'ACMS-User-Guide.pdf',
      icon: 'book',
      tone: 'violet',
      meta: 'PDF \u00b7 18 pages \u00b7 v1.0',
    },
    {
      title: 'Technical Documentation',
      blurb: 'Installation, database scripts, configuration, credentials, the '
           + 'API surface, security model and troubleshooting.',
      file: 'ACMS-Technical-Documentation.pdf',
      icon: 'fileText',
      tone: 'teal',
      meta: 'PDF \u00b7 22 pages \u00b7 v1.0',
      // Contains the seeded development account passwords and the secret-key
      // reference. Anyone who can read it can sign in as an administrator, so
      // it is not offered to Security, Printer or Viewer accounts.
      roles: ['Admin'],
      note: 'Administrators only \u2014 contains credentials',
    },
  ];

  protected readonly visibleDocs = computed(() =>
    this.docs.filter(d => !d.roles || this.auth.hasRole(...d.roles)));

  /* ------------------------------------------------------------- FAQ */

  private readonly groups: FaqGroup[] = [
    {
      title: 'Numbers and reports',
      icon: 'bars',
      items: [
        {
          q: 'Why do "Visitors on site now" and "Active visitor cards" show different numbers?',
          a: [
            'They count different things. "Visitors on site now" counts visits with no checkout recorded. "Active visitor cards" counts physical passes that are switched on and not blocked.',
            'A pass sitting unissued in a drawer is an active card with nobody holding it. A visitor checked in without a pass number recorded is a person on site with no pass linked to them. Both are normal, and both make the two numbers differ.',
            'Click "Visitors on site now" — the breakdown labels every row by its pass link state, so you can see exactly which case applies to each person.',
          ],
        },
        {
          q: 'The dashboard shows a different count from the one I get querying the database directly.',
          a: [
            'Open the metric and press "How this is counted". It shows the exact SQL predicate the dashboard used, which you can copy into SSMS and run yourself.',
            'The commonest cause is that one query is narrower than the other. For example, security blocks are a subset of all deactivated cards — both numbers are correct, they just answer different questions.',
          ],
        },
        {
          q: 'Why is a filtered count lower than the number on the tile?',
          a: [
            'A filter is applied. The footer of the list reads "Showing X of Y (filtered from Z)", and every active filter appears as a removable chip above the table. Press Reset to clear them all at once.',
          ],
        },
        {
          q: 'Why did the funnel percentage change when I changed the date range?',
          a: [
            'The funnel follows the requests submitted inside the window you selected, through to whatever stage they have reached now. A different window is a different set of requests, so a different percentage is expected.',
          ],
        },
        {
          q: 'Can the funnel conversion ever go above 100%?',
          a: [
            'No. It tracks one set of requests from start to finish, and printed requests are always a subset of submitted ones.',
            'The daily bar chart above it works differently — it records each event on the day it happened, so a card submitted in July and printed in August appears in both months.',
          ],
        },
        {
          q: 'What is the difference between the two Export options?',
          a: [
            'Spreadsheet (CSV) downloads the underlying figures and opens straight in Excel. Printable report (PDF) opens your browser print dialog with the charts included — choose "Save as PDF" as the destination.',
          ],
        },
      ],
    },
    {
      title: 'Cards',
      icon: 'card',
      items: [
        {
          q: 'What is the difference between a staff card and a visitor pass?',
          a: [
            'A staff card belongs to one employee, is issued after a card request is approved, and lasts for years. A visitor pass is handed out at the gate, returned the same day, and reissued to somebody else tomorrow.',
            'They live in separate registers because they behave completely differently. Merging them would make card reuse impossible to represent.',
          ],
        },
        {
          q: 'A card is deactivated but is not showing as blocked. Why?',
          a: [
            'Blocking is a deliberate security action and always carries a recorded reason. A card handed back on resignation is withdrawn, not blocked.',
            'The Deactivated Staff Cards tile shows both together, because that is what a direct database query returns. Use the status filter inside it to see only the security blocks.',
          ],
        },
        {
          q: 'Can I undo a block?',
          a: [
            'Yes. Press Reactivate and give a reason. The original block reason and note stay in the card remarks permanently — reactivating never erases history.',
          ],
        },
        {
          q: 'Who is allowed to block a card?',
          a: ['Security staff and administrators.'],
        },
      ],
    },
    {
      title: 'Visitors',
      icon: 'userCheck',
      items: [
        {
          q: 'I forgot to check a visitor out yesterday. What should I do?',
          a: [
            'Check them out now, and add a remark noting the real departure time — the exit time recorded will be the moment you press the button.',
            'Until this is done the visitor stays counted as being on site and their pass stays tied up.',
          ],
        },
        {
          q: 'I checked someone in without recording the pass number. Does it matter?',
          a: [
            'Yes. The visit log and the pass inventory are linked by that number. Without it the system can still show the visitor as present but cannot tell which pass they are carrying, and the row appears under "No pass recorded".',
            'Edit the visit and add the number as soon as you can.',
          ],
        },
        {
          q: 'Can the same pass be issued to two visitors at once?',
          a: [
            'It should not be. If two open visits share a pass number, one of them is almost certainly a missed checkout.',
          ],
        },
      ],
    },
    {
      title: 'Access and accounts',
      icon: 'shield',
      items: [
        {
          q: 'A button I need is missing from my screen.',
          a: [
            'Almost certainly a role restriction rather than a fault. Viewer accounts are read-only; Security can act on visitors and cards; Printer can mark requests printed; Admin can do everything.',
            'Ask your administrator if you need a different role.',
          ],
        },
        {
          q: 'My account is locked.',
          a: ['Five failed sign-in attempts lock an account. An administrator can unlock it from the Admin screen.'],
        },
        {
          q: 'I have forgotten my password.',
          a: [
            'An administrator issues a new one. Nobody — including the administrator — can retrieve your existing password, because it is not stored in a readable form.',
          ],
        },
        {
          q: 'Why can I not see photographs or fingerprint data?',
          a: [
            'By design. Biometric data, scanned documents and home addresses are blocked at the database level for every dashboard user and for the assistant.',
            'This dashboard is a monitoring and analytics tool, not a system for retrieving identity documents.',
          ],
        },
      ],
    },
    {
      title: 'Ask ACMS',
      icon: 'sparkle',
      items: [
        {
          q: 'My question was refused for security reasons.',
          a: [
            'The query the assistant generated touched something outside its permitted area — usually a table or column it is not allowed to read.',
            'Rephrase more specifically, and say "staff cards" or "visitor passes" rather than just "cards", since those are separate populations. If a reasonable question keeps failing, note the exact wording and report it — refusals are logged.',
          ],
        },
        {
          q: 'Does the assistant need an internet connection?',
          a: [
            'Not necessarily. It prefers an online model for answer quality but falls back automatically to a model running on the local machine.',
            'Answers may take longer offline, particularly the first one after the server starts, while the local model loads into memory.',
          ],
        },
        {
          q: 'Can the assistant change data?',
          a: [
            'No. It is restricted to read-only queries, and that restriction is enforced by the database account it uses rather than by the assistant behaving well.',
          ],
        },
        {
          q: 'Can other people see my questions?',
          a: ['No. History is tied to your account and is cleared when you sign out.'],
        },
      ],
    },
    {
      title: 'Display and performance',
      icon: 'activity',
      items: [
        {
          q: 'The live feed says Reconnecting or Offline.',
          a: [
            'The connection to the server dropped. It retries automatically and recovers on its own — including after a server restart or after your laptop wakes from sleep.',
            'Everything else on the page keeps working; only the live updates pause.',
          ],
        },
        {
          q: 'A tile shows a dash instead of a number.',
          a: [
            'That figure could not be loaded. Press Refresh. If it persists, open the tile — the panel will show the underlying error.',
          ],
        },
        {
          q: 'A time looks several hours out.',
          a: [
            'All timestamps are stored in UTC and converted to your computer local time zone for display. If a time looks wrong, check the computer clock and time-zone setting first.',
          ],
        },
        {
          q: 'Which browsers are supported?',
          a: ['Current versions of Chrome, Edge and Firefox. Internet Explorer is not supported.'],
        },
      ],
    },
  ];

  /** Matches across question and answer, so searching for a symptom works as
   *  well as searching for a keyword in the heading. */
  protected readonly filtered = computed<FaqGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.groups;

    return this.groups
      .map(g => ({
        ...g,
        items: g.items.filter(i =>
          i.q.toLowerCase().includes(q) ||
          i.a.some(p => p.toLowerCase().includes(q))),
      }))
      .filter(g => g.items.length > 0);
  });

  protected readonly hitCount = computed(() =>
    this.filtered().reduce((n, g) => n + g.items.length, 0));

  protected readonly allOpen = computed(() =>
    this.hitCount() > 0 && this.open().size >= this.hitCount());

  protected isOpen(q: string): boolean {
    return this.open().has(q);
  }

  protected toggle(q: string): void {
    this.open.update(set => {
      const next = new Set(set);
      if (!next.delete(q)) next.add(q);
      return next;
    });
  }

  protected toggleAll(): void {
    if (this.allOpen()) {
      this.open.set(new Set());
      return;
    }
    this.open.set(new Set(this.filtered().flatMap(g => g.items.map(i => i.q))));
  }
}