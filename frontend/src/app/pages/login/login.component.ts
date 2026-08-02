import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuroraBackgroundComponent } from '../../layout/aurora-background/aurora-background.component';
import { AuthHeroComponent } from './auth-hero.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { IconName } from '../../shared/ui/icon/icons';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

interface Feature { title: string; icon: IconName; tone: string; }

@Component({
  selector: 'acms-login',
  standalone: true,
  imports: [ReactiveFormsModule, AuroraBackgroundComponent, AuthHeroComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <acms-aurora-background />

    <div class="auth">
      <!-- Brand + infographic column -->
      <aside class="brand rise">
        <header class="brand__top">
          <div class="mark">A</div>
          <div>
            <div class="bname">ACMS</div>
            <div class="bsub">Access Control Management</div>
          </div>
        </header>

        <div class="pitch">
          <h1 class="headline">
            Access data, <span class="grad-text">answered instantly.</span>
          </h1>
          <p class="copy">
            Live occupancy, card-request workflow, and a natural-language
            assistant &mdash; in one secure place.
          </p>
        </div>

        <div class="stage"><acms-auth-hero /></div>

        <ul class="feats">
          @for (f of features; track f.title) {
            <li class="feat">
              <span class="feat__ic" [attr.data-tone]="f.tone">
                <acms-icon [name]="f.icon" [size]="14" [weight]="2.2" />
              </span>
              {{ f.title }}
            </li>
          }
        </ul>

        <footer class="brand__foot">
          NASTP &middot; National Aerospace Science &amp; Technology Park
        </footer>
      </aside>

      <!-- Form column -->
      <main class="panel">
        <div class="card rise">
          <div class="card__top">
            <div>
              <h2 class="card__title">Sign in</h2>
              <p class="card__sub">Enter your credentials to continue</p>
            </div>
            <div class="tt" role="group" aria-label="Colour theme">
              <button type="button" [class.on]="theme.resolved() === 'light'"
                      (click)="theme.set('light')" aria-label="Light theme">
                <acms-icon name="sun" [size]="15" [weight]="2" />
              </button>
              <button type="button" [class.on]="theme.resolved() === 'dark'"
                      (click)="theme.set('dark')" aria-label="Dark theme">
                <acms-icon name="moon" [size]="15" [weight]="2" />
              </button>
            </div>
          </div>

          @if (expiredNotice()) {
            <div class="note note--warn" role="status">
              Your session expired. Please sign in again.
            </div>
          }
          @if (error()) {
            <div class="note note--err" role="alert">{{ error() }}</div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <label class="field">
              <span class="field__lab">Username</span>
              <div class="input" [class.bad]="invalid('username')">
                <acms-icon name="users" [size]="16" />
                <input type="text" formControlName="username" autocomplete="username"
                       placeholder="your.username" spellcheck="false" />
              </div>
              @if (invalid('username')) { <span class="err">Username is required</span> }
            </label>

            <label class="field">
              <span class="field__lab">Password</span>
              <div class="input" [class.bad]="invalid('password')">
                <acms-icon name="shield" [size]="16" />
                <input [type]="showPw() ? 'text' : 'password'" formControlName="password"
                       autocomplete="current-password" placeholder="Enter your password" />
                <button type="button" class="eye" (click)="showPw.set(!showPw())"
                        [attr.aria-label]="showPw() ? 'Hide password' : 'Show password'"
                        [attr.aria-pressed]="showPw()">
                  <acms-icon [name]="showPw() ? 'close' : 'eye'" [size]="15" />
                </button>
              </div>
              @if (invalid('password')) { <span class="err">Password is required</span> }
            </label>

            <button class="submit" type="submit" [disabled]="loading()">
              @if (loading()) {
                <span class="spin"></span> Signing in&hellip;
              } @else {
                Sign in
                <acms-icon name="arrowRight" [size]="16" [weight]="2.4" />
              }
            </button>
          </form>

          <div class="no-signup">
            <acms-icon name="shield" [size]="15" />
            <div>
              ACMS accounts are provisioned by an administrator.
              <a class="link" href="mailto:supervisor&#64;nastp.gov.pk">Request access &rarr;</a>
            </div>
          </div>

          <!-- DEV ONLY - remove this block and demoAccounts before deployment (Phase 16) -->
          <div class="demo">
            <div class="demo__lab">Demo accounts &middot; dev only</div>
            <div class="chips">
              @for (d of demoAccounts; track d.user) {
                <button type="button" class="chip" (click)="fill(d.user, d.pass)">
                  {{ d.role }}
                </button>
              }
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* Locked to the viewport: the screen never scrolls as a whole.
       Only the form card scrolls internally if a short window demands it. */
    .auth {
      display: grid;
      grid-template-columns: 1.08fr .92fr;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
    }

    /* ---- Brand column ---- */
    .brand {
      display: flex; flex-direction: column;
      gap: clamp(10px, 1.6vh, 22px);
      padding: clamp(20px, 3vh, 40px) clamp(24px, 3vw, 48px);
      min-width: 0; min-height: 0;
      overflow: hidden;
    }
    .brand__top { display: flex; align-items: center; gap: var(--s-3); flex-shrink: 0; }
    .mark {
      width: 44px; height: 44px; border-radius: 14px; flex-shrink: 0;
      display: grid; place-items: center;
      font-family: var(--font-display); font-weight: 700; font-size: 18px; color: #fff;
      background: linear-gradient(135deg, var(--violet), var(--blue));
      box-shadow: var(--sh-brand);
    }
    .bname { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-md); }
    .bsub { font-size: var(--fs-xs); color: var(--ink-muted); }

    .pitch { flex-shrink: 0; }
    /* nowrap keeps the whole sentence on one line; the vw term shrinks it
       rather than wrapping, so the hero always fits below without scroll. */
    .headline {
      font-size: clamp(22px, 2.55vw, 40px);
      line-height: 1.15; font-weight: 700; letter-spacing: -.035em;
      white-space: nowrap; margin-bottom: 10px;
    }
    .copy {
      margin: 0; color: var(--ink-muted);
      font-size: clamp(13px, .95vw, 16px); line-height: 1.6; max-width: 52ch;
    }

    /* The hero takes whatever vertical space is left over. */
    .stage {
      flex: 1; min-height: 0;
      display: grid; place-items: center;
      padding: clamp(4px, 1vh, 14px) 0;
    }
    acms-auth-hero { display: block; height: 100%; aspect-ratio: 1 / 1; }

    .feats { list-style: none; padding: 0; margin: 0; flex-shrink: 0;
             display: flex; flex-wrap: wrap; gap: 10px; }
    .feat {
      display: flex; align-items: center; gap: 9px;
      padding: 8px 15px 8px 8px; border-radius: var(--r-pill);
      background: var(--glass);
      backdrop-filter: blur(var(--blur-surface)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--blur-surface)) saturate(180%);
      border: 1px solid var(--glass-border);
      box-shadow: var(--sh-card), var(--glass-inset);
      font-size: var(--fs-sm); font-weight: 600; color: var(--ink-soft);
      white-space: nowrap;
    }
    .feat__ic { width: 26px; height: 26px; border-radius: 8px;
                display: grid; place-items: center; flex-shrink: 0; }
    [data-tone='violet'] { background: var(--violet-bg); color: var(--violet-fg); }
    [data-tone='teal']   { background: var(--teal-bg);   color: var(--teal-fg); }
    [data-tone='blue']   { background: var(--info-bg);   color: var(--info-fg); }

    .brand__foot { flex-shrink: 0; font-size: var(--fs-xs); color: var(--ink-dim); }

    /* ---- Form column ---- */
    .panel {
      display: grid; place-items: center;
      padding: clamp(20px, 3vh, 40px) clamp(24px, 3vw, 56px);
      min-height: 0; overflow-y: auto;
    }
    .card {
      width: 100%; max-width: 560px;
      padding: clamp(28px, 3.4vh, 44px) clamp(28px, 2.6vw, 44px);
      border-radius: var(--r-xl);
      background: var(--glass-strong);
      backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      -webkit-backdrop-filter: blur(var(--blur-chrome)) saturate(180%);
      border: 1px solid var(--glass-border);
      box-shadow: var(--sh-lift), var(--glass-inset);
    }
    .card__top { display: flex; justify-content: space-between;
                 align-items: flex-start; margin-bottom: clamp(20px, 2.6vh, 32px); }
    .card__title { font-size: clamp(22px, 1.9vw, 28px); font-weight: 700; letter-spacing: -.03em; }
    .card__sub { margin: 5px 0 0; font-size: var(--fs-base); color: var(--ink-muted); }

    .tt { display: flex; gap: 3px; padding: 3px; flex-shrink: 0;
          border-radius: var(--r-pill); background: var(--hover-wash); }
    .tt button {
      width: 30px; height: 30px; border-radius: 50%;
      display: grid; place-items: center; border: none;
      background: transparent; color: var(--ink-muted); cursor: pointer;
      transition: all var(--t-base) var(--ease);
    }
    .tt button.on { background: var(--glass-strong); color: var(--violet-fg);
                    box-shadow: 0 2px 6px rgba(0,0,0,.12); }

    .note { margin-bottom: var(--s-5); padding: 12px var(--s-4);
            border-radius: var(--r-sm); font-size: var(--fs-sm); }
    .note--err  { background: var(--danger-bg); color: var(--danger-fg); }
    .note--warn { background: var(--warn-bg);   color: var(--warn-fg); }

    form { display: grid; gap: clamp(14px, 1.9vh, 22px); }
    .field { display: grid; gap: var(--s-2); }
    .field__lab { font-size: var(--fs-sm); font-weight: 600; color: var(--ink-soft); }

    .input {
      display: flex; align-items: center; gap: 11px;
      height: clamp(46px, 5.4vh, 54px); padding: 0 17px;
      border-radius: 15px; border: 1px solid transparent;
      background: var(--hover-wash); color: var(--ink-muted);
      transition: all var(--t-fast) var(--ease);
    }
    .input:focus-within {
      border-color: rgba(124,108,240,.55);
      background: var(--glass-strong);
      box-shadow: 0 0 0 4px rgba(124,108,240,.13);
    }
    .input.bad { border-color: rgba(244,83,107,.5); }
    .input input {
      flex: 1; min-width: 0;
      border: none; outline: none; background: transparent;
      font-family: var(--font-body); font-size: var(--fs-md); color: var(--ink);
    }
    .input input::placeholder { color: var(--ink-dim); }
    .eye { display: grid; place-items: center; width: 28px; height: 28px; padding: 0;
           border: none; background: transparent; color: var(--ink-muted); cursor: pointer; }
    .eye:hover { color: var(--ink); }
    .err { font-size: var(--fs-xs); color: var(--danger-fg); }

    .submit {
      display: flex; align-items: center; justify-content: center; gap: var(--s-2);
      height: clamp(48px, 5.6vh, 56px); margin-top: 4px;
      border: none; border-radius: 15px;
      font-family: var(--font-body); font-size: var(--fs-md); font-weight: 600; color: #fff;
      background: linear-gradient(120deg, var(--violet), var(--violet-deep) 55%, var(--blue));
      background-size: 200% 100%;
      box-shadow: var(--sh-brand); cursor: pointer;
      transition: transform var(--t-fast) var(--ease),
                  box-shadow var(--t-base) var(--ease),
                  background-position var(--t-slow) var(--ease);
    }
    .submit:hover:not(:disabled) {
      transform: translateY(-1px);
      background-position: 100% 0;
    }
    .submit:disabled { opacity: .65; cursor: not-allowed; }

    .spin {
      width: 15px; height: 15px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .no-signup {
      display: flex; gap: 11px; align-items: flex-start;
      margin-top: clamp(16px, 2.2vh, 26px); padding: var(--s-4);
      border-radius: var(--r-md);
      background: var(--hover-wash);
      font-size: var(--fs-sm); color: var(--ink-muted); line-height: 1.55;
    }
    .no-signup acms-icon { color: var(--violet-fg); flex-shrink: 0; margin-top: 1px; }
    .link { color: var(--violet-fg); font-weight: 600; white-space: nowrap; }

    .demo { margin-top: clamp(14px, 1.9vh, 22px); padding-top: var(--s-4);
            border-top: 1px solid var(--track); }
    .demo__lab {
      margin-bottom: var(--s-3); font-size: 10px; font-weight: 700;
      letter-spacing: .09em; text-transform: uppercase; color: var(--ink-muted);
    }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      padding: 7px 15px; border-radius: var(--r-pill);
      border: 1px solid var(--glass-border); background: var(--hover-wash);
      color: var(--ink-muted); font-family: var(--font-body);
      font-size: var(--fs-xs); font-weight: 600; cursor: pointer;
      transition: all var(--t-fast) var(--ease);
    }
    .chip:hover { background: var(--violet-bg); color: var(--violet-fg); }

    /* Below this width the infographic can't breathe - drop to form only. */
    @media (max-width: 1180px) {
      .auth { grid-template-columns: 1fr; overflow-y: auto; height: auto; min-height: 100vh; }
      .brand { display: none; }
      .panel { padding: var(--s-6); overflow: visible; }
    }
    /* Very short windows: let the page scroll rather than crush the layout. */
    @media (max-height: 620px) {
      .auth { height: auto; min-height: 100vh; overflow-y: auto; }
      .stage { min-height: 260px; }
    }
  `],
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly theme = inject(ThemeService);

  protected readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPw = signal(false);
  protected readonly expiredNotice = signal(false);

  private returnUrl = '/dashboard';

  // DEV ONLY - delete this array and the .demo markup before deployment
  protected readonly demoAccounts = [
    { role: 'Admin',    user: 'admin',     pass: 'Admin@12345' },
    { role: 'Security', user: 'security1', pass: 'Security@12345' },
    { role: 'Printer',  user: 'printer1',  pass: 'Printer@12345' },
    { role: 'Viewer',   user: 'viewer1',   pass: 'Viewer@12345' },
  ];

  protected readonly features: Feature[] = [
    { title: 'Live monitoring',  icon: 'activity', tone: 'violet' },
    { title: 'Card workflow',    icon: 'card',     tone: 'teal' },
    { title: 'Natural language', icon: 'sparkle',  tone: 'blue' },
  ];

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl('/dashboard');
      return;
    }
    const qp = this.route.snapshot.queryParamMap;
    this.returnUrl = qp.get('returnUrl') || '/dashboard';
    this.expiredNotice.set(qp.get('reason') === 'expired');
  }

  protected invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected fill(user: string, pass: string): void {
    this.form.setValue({ username: user, password: pass });
    this.error.set(null);
  }

  protected submit(): void {
    this.error.set(null);
    this.expiredNotice.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { username, password } = this.form.getRawValue();

    this.auth.login(username, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl(this.returnUrl);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(
          err?.error?.error?.message ??
          (err?.status === 0
            ? 'Cannot reach the server. Is the backend running on port 5000?'
            : 'Sign-in failed. Please try again.'),
        );
      },
    });
  }
}