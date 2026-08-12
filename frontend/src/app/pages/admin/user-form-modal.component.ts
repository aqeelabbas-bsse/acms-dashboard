import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import {
  ACMS_ROLES, AcmsRole, AdminUser, ROLE_DESCRIPTION,
} from '../../core/models/admin.models';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

/**
 * Create / edit account form.
 *
 * Behaviour is unchanged from the previous version — the same validators, the
 * same sequenced update calls, the same messages. What changed is the styling:
 * this file referenced `--line`, `--surface-2` and `--accent`, none of which
 * exist in styles.scss, so its borders and its selected-role highlight were
 * rendering from hard-coded fallbacks rather than from the theme. Sizes were
 * also in raw rem instead of the --fs-* scale. Everything now resolves against
 * real tokens, so the modal matches every other dialog in the app and follows
 * the light/dark switch correctly.
 */
@Component({
  selector: 'acms-user-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- acms-modal has no [open] input in this codebase, so the whole element
         is conditionally rendered. This component itself stays permanently
         mounted (the parent holds a #formModal ViewChild), so this @if toggles
         only the inner markup, never this component's lifecycle. -->
    @if (open) {
    <acms-modal [title]="user ? 'Edit account' : 'New account'"
                [subtitle]="user ? user.username : 'Create a sign-in for a colleague'"
                [width]="620"
                (close)="dismiss()">

      @if (error()) {
        <div class="alert" role="alert">
          <acms-icon name="alert" [size]="16" [weight]="2.2" />
          <span>{{ error() }}</span>
        </div>
      }

      <form class="form" [formGroup]="form" (ngSubmit)="submit()">

        <!-- Username is create-only: Identity treats it as the login key, and
             renaming would silently invalidate anything that referenced it. -->
        @if (!user) {
          <label class="fld">
            <span class="fld__l">Username</span>
            <input class="input" type="text" formControlName="username"
                   autocomplete="off" placeholder="e.g. security2" />
            @if (touched('username')) {
              <span class="fld__e">
                3&ndash;50 characters. Letters, digits, and . _ &#64; + &minus;
              </span>
            }
          </label>
        } @else {
          <div class="fld">
            <span class="fld__l">Username</span>
            <div class="ro">{{ user.username }}</div>
            <span class="fld__h">Usernames cannot be changed after creation.</span>
          </div>
        }

        <label class="fld">
          <span class="fld__l">Email <span class="opt">optional</span></span>
          <input class="input" type="email" formControlName="email"
                 autocomplete="off" placeholder="name&#64;nastp.gov.pk" />
          @if (touched('email')) {
            <span class="fld__e">Enter a valid email address.</span>
          }
        </label>

        @if (!user) {
          <label class="fld">
            <span class="fld__l">Temporary password</span>
            <div class="pw">
              <input class="input" [type]="showPw() ? 'text' : 'password'"
                     formControlName="password" autocomplete="new-password" />
              <button class="pw__t" type="button"
                      [attr.aria-label]="showPw() ? 'Hide password' : 'Show password'"
                      (click)="showPw.set(!showPw())">
                {{ showPw() ? 'Hide' : 'Show' }}
              </button>
            </div>
            @if (touched('password')) {
              <span class="fld__e">At least 8 characters.</span>
            }
            <span class="fld__h">
              Share this out of band. There is no password-reset email flow.
            </span>
          </label>
        }

        <div class="fld">
          <span class="fld__l">Role</span>
          <div class="roles" role="radiogroup" aria-label="Role">
            @for (r of roles; track r) {
              <button type="button" class="role" [class.on]="form.value.role === r"
                      role="radio" [attr.aria-checked]="form.value.role === r"
                      (click)="form.patchValue({ role: r })">
                <span class="role__n">
                  {{ r }}
                  @if (form.value.role === r) {
                    <acms-icon name="check" [size]="13" [weight]="2.8" />
                  }
                </span>
                <span class="role__d">{{ describe(r) }}</span>
              </button>
            }
          </div>
        </div>

        <!-- Password reset lives inside edit mode rather than in a separate
             dialog: an admin resetting a password is almost always already
             looking at that user's record. -->
        @if (user) {
          <div class="fld">
            <span class="fld__l">Reset password <span class="opt">optional</span></span>
            <div class="pw">
              <input class="input" [type]="showPw() ? 'text' : 'password'"
                     formControlName="newPassword" autocomplete="new-password"
                     placeholder="Leave blank to keep the current password" />
              <button class="pw__t" type="button"
                      [attr.aria-label]="showPw() ? 'Hide password' : 'Show password'"
                      (click)="showPw.set(!showPw())">
                {{ showPw() ? 'Hide' : 'Show' }}
              </button>
            </div>
            <span class="fld__h">
              Resetting signs the user out of any active session on their next request.
            </span>
          </div>
        }

        <div class="acts">
          <button class="btn btn--ghost" type="button" (click)="dismiss()"
                  [disabled]="busy()">Cancel</button>
          <button class="btn btn--primary" type="submit"
                  [disabled]="busy() || form.invalid">
            @if (busy()) { Saving&hellip; }
            @else { {{ user ? 'Save changes' : 'Create account' }} }
          </button>
        </div>
      </form>
    </acms-modal>
    }
  `,
  styles: [`
    .alert {
      display: flex; align-items: center; gap: 9px;
      margin-bottom: var(--s-4); padding: 11px var(--s-4);
      border-radius: var(--r-md);
      background: var(--danger-bg); color: var(--ink-soft);
      font-size: var(--fs-sm);
    }
    .alert acms-icon { color: var(--danger-fg); flex-shrink: 0; }

    .form { display: grid; gap: var(--s-5); }
    .fld { display: grid; gap: 6px; }
    .fld__l { display: flex; align-items: center; gap: 7px;
              font-size: var(--fs-sm); font-weight: 600; color: var(--ink); }
    .fld__h { font-size: var(--fs-xs); color: var(--ink-dim); line-height: 1.5; }
    .fld__e { font-size: var(--fs-xs); color: var(--danger-fg); }
    .opt {
      padding: 1px 7px; border-radius: var(--r-pill);
      background: var(--hover-wash-2); color: var(--ink-dim);
      font-size: 10px; font-weight: 600; letter-spacing: .04em;
      text-transform: uppercase;
    }

    .ro {
      display: flex; align-items: center;
      padding: 10px 13px; border-radius: var(--r-sm);
      background: var(--hover-wash); color: var(--ink-muted);
      border: 1px solid var(--glass-border);
      font-size: var(--fs-sm); font-variant-numeric: tabular-nums;
    }

    .pw { position: relative; }
    .pw .input { width: 100%; padding-right: 62px; }
    .pw__t {
      position: absolute; right: 7px; top: 50%; transform: translateY(-50%);
      padding: 5px 9px; border: none; border-radius: var(--r-sm);
      background: var(--hover-wash-2); color: var(--ink-muted);
      font-family: var(--font-body); font-size: var(--fs-xs); font-weight: 600;
      cursor: pointer; transition: all var(--t-fast) var(--ease);
    }
    .pw__t:hover { color: var(--ink); }

    /* Four role cards in a 2x2 grid. The selected one gets a violet border,
       a tinted fill and a tick, so selection is carried by three cues rather
       than by border colour alone. */
    .roles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
             gap: var(--s-2); }
    .role {
      display: grid; gap: 3px; padding: 11px 13px;
      border-radius: var(--r-md);
      border: 1px solid var(--glass-border);
      background: transparent; color: var(--ink);
      font-family: var(--font-body); text-align: left; cursor: pointer;
      transition: all var(--t-fast) var(--ease);
    }
    .role:hover { background: var(--hover-wash); }
    .role:focus-visible { outline: 2px solid var(--violet-fg); outline-offset: 1px; }
    .role.on {
      border-color: rgba(124,108,240,.55);
      background: var(--violet-bg);
      box-shadow: inset 0 0 0 1px rgba(124,108,240,.18);
    }
    .role__n { display: flex; align-items: center; gap: 6px;
               font-size: var(--fs-sm); font-weight: 600; }
    .role.on .role__n { color: var(--violet-fg); }
    .role__d { font-size: var(--fs-xs); color: var(--ink-dim); line-height: 1.45; }

    .acts { display: flex; justify-content: flex-end; gap: var(--s-2);
            margin-top: 2px; }

    @media (max-width: 620px) {
      .roles { grid-template-columns: 1fr; }
      .acts { flex-direction: column-reverse; }
      .acts .btn { width: 100%; justify-content: center; }
    }
    @media (prefers-reduced-motion: reduce) { .role, .pw__t { transition: none; } }
  `],
})
export class UserFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);

  /** Null = create mode. */
  @Input() user: AdminUser | null = null;
  @Input() open = false;

  @Output() saved = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  readonly roles = ACMS_ROLES;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPw = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50),
                    Validators.pattern(/^[a-zA-Z0-9._@+-]+$/)]],
    email: ['', [Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['Viewer' as AcmsRole, [Validators.required]],
    newPassword: ['', [Validators.minLength(8)]],
  });

  /** Called by the parent immediately before flipping `open` to true. */
  prepare(user: AdminUser | null): void {
    this.user = user;
    this.error.set(null);
    this.showPw.set(false);

    if (user) {
      // Edit mode: username and password are not part of this submission.
      this.form.controls.username.disable();
      this.form.controls.password.disable();
      this.form.reset({
        username: user.username,
        email: user.email ?? '',
        password: '',
        role: (user.role === '-' ? 'Viewer' : user.role) as AcmsRole,
        newPassword: '',
      });
    } else {
      this.form.controls.username.enable();
      this.form.controls.password.enable();
      this.form.reset({ username: '', email: '', password: '', role: 'Viewer', newPassword: '' });
    }
  }

  describe(r: AcmsRole): string { return ROLE_DESCRIPTION[r]; }

  touched(name: 'username' | 'email' | 'password'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  dismiss(): void {
    if (this.busy()) return;
    this.closed.emit();
  }

  submit(): void {
    if (this.form.invalid || this.busy()) return;

    this.busy.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    const email = v.email.trim() ? v.email.trim() : null;

    if (!this.user) {
      this.admin.createUser({
        username: v.username.trim(),
        email,
        password: v.password,
        role: v.role,
      }).subscribe({
        next: () => this.done(`Account "${v.username.trim()}" created.`),
        error: e => this.fail(e),
      });
      return;
    }

    // Edit mode runs up to three independent calls. They are sequenced rather
    // than parallel so a rejected role change (the last-admin rule) cannot
    // leave a half-applied edit with no clear message.
    const id = this.user.id;
    const roleChanged = v.role !== this.user.role;
    const wantsReset = !!v.newPassword;

    this.admin.updateUser(id, { email }).subscribe({
      next: () => {
        if (!roleChanged) return this.afterRole(id, wantsReset, v.newPassword);
        this.admin.setRole(id, v.role).subscribe({
          next: () => this.afterRole(id, wantsReset, v.newPassword),
          error: e => this.fail(e),
        });
      },
      error: e => this.fail(e),
    });
  }

  private afterRole(id: string, wantsReset: boolean, newPassword: string): void {
    if (!wantsReset) return this.done('Account updated.');

    this.admin.resetPassword(id, newPassword).subscribe({
      next: () => this.done('Account updated and password reset.'),
      error: e => this.fail(e),
    });
  }

  private done(message: string): void {
    this.busy.set(false);
    this.toast.success(message);
    this.saved.emit();
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.error.set(this.admin.describeError(e));
  }
}