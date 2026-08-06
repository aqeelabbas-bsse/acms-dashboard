// =============================================================================
// src/app/pages/admin/user-form-modal.component.ts
// =============================================================================

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

@Component({
  selector: 'acms-user-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- FIXED: acms-modal has no [open] input in this codebase - the whole
         element is conditionally rendered instead. UserFormModalComponent
         itself stays permanently mounted in the parent (admin-users.component
         holds a #formModal ViewChild), so this @if only toggles the inner
         modal markup, not this component's own lifecycle. -->
    @if (open) {
    <acms-modal
      [title]="user ? 'Edit account' : 'New account'"
      (close)="dismiss()">

      @if (error()) {
        <div class="alert" role="alert">
          {{ error() }}
        </div>
      }

      <form class="form" [formGroup]="form" (ngSubmit)="submit()">

        <!-- Username: create only. Identity treats it as the login key, and
             renaming would silently invalidate anything that referenced it. -->
        @if (!user) {
          <label class="field">
            <span class="field__label">Username</span>
            <input class="input" type="text" formControlName="username"
                   autocomplete="off" placeholder="e.g. security2" />
            @if (touched('username')) {
              <span class="field__err">
                3-50 characters, letters and digits or . _ &#64; + -
              </span>
            }
          </label>
        } @else {
          <div class="field">
            <span class="field__label">Username</span>
            <div class="readonly">
              {{ user.username }}
            </div>
            <span class="field__hint">Usernames cannot be changed after creation.</span>
          </div>
        }

        <label class="field">
          <span class="field__label">Email <span class="opt">(optional)</span></span>
          <input class="input" type="email" formControlName="email"
                 autocomplete="off" placeholder="name&#64;nastp.gov.pk" />
          @if (touched('email')) {
            <span class="field__err">Enter a valid email address.</span>
          }
        </label>

        @if (!user) {
          <label class="field">
            <span class="field__label">Temporary password</span>
            <div class="pw">
              <input class="input" [type]="showPw() ? 'text' : 'password'"
                     formControlName="password" autocomplete="new-password" />
              <button class="pw__toggle pw__toggle--text" type="button"
                      [attr.aria-label]="showPw() ? 'Hide password' : 'Show password'"
                      (click)="showPw.set(!showPw())">
                {{ showPw() ? 'Hide' : 'Show' }}
              </button>
            </div>
            @if (touched('password')) {
              <span class="field__err">At least 8 characters.</span>
            }
            <span class="field__hint">
              Share this out of band. There is no password-reset email flow.
            </span>
          </label>
        }

        <div class="field">
          <span class="field__label">Role</span>
          <div class="roles" role="radiogroup" aria-label="Role">
            @for (r of roles; track r) {
              <button type="button" class="role" [class.role--on]="form.value.role === r"
                      role="radio" [attr.aria-checked]="form.value.role === r"
                      (click)="form.patchValue({ role: r })">
                <span class="role__name">{{ r }}</span>
                <span class="role__desc">{{ describe(r) }}</span>
              </button>
            }
          </div>
        </div>

        <!-- Password reset lives inside edit mode rather than as a separate
             modal: an admin resetting a password is almost always already
             looking at that user's record. -->
        @if (user) {
          <div class="field">
            <span class="field__label">Reset password <span class="opt">(optional)</span></span>
            <div class="pw">
              <input class="input" [type]="showPw() ? 'text' : 'password'"
                     formControlName="newPassword" autocomplete="new-password"
                     placeholder="Leave blank to keep the current password" />
              <button class="pw__toggle pw__toggle--text" type="button"
                      [attr.aria-label]="showPw() ? 'Hide password' : 'Show password'"
                      (click)="showPw.set(!showPw())">
                {{ showPw() ? 'Hide' : 'Show' }}
              </button>
            </div>
            <span class="field__hint">
              Resetting signs the user out of any active session on their next request.
            </span>
          </div>
        }

        <div class="actions">
          <button class="btn" type="button" (click)="dismiss()" [disabled]="busy()">
            Cancel
          </button>
          <button class="btn btn--primary" type="submit" [disabled]="busy() || form.invalid">
            @if (busy()) { Saving... } @else { {{ user ? 'Save changes' : 'Create account' }} }
          </button>
        </div>
      </form>
    </acms-modal>
    }
  `,
  styles: [`
    .form { display: grid; gap: 16px; }
    .field { display: grid; gap: 6px; }
    .field__label { font-size: .82rem; font-weight: 600; color: var(--ink); }
    .field__hint  { font-size: .76rem; color: var(--ink-2, var(--ink)); opacity: .72; }
    .field__err   { font-size: .76rem; color: var(--danger, #E11D48); }
    .opt { font-weight: 400; opacity: .6; }
    .readonly {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-radius: var(--r-md, 10px);
      background: var(--surface-2, rgba(127,127,127,.08));
      font-variant-numeric: tabular-nums;
    }
    .pw { position: relative; }
    .pw .input { width: 100%; padding-right: 42px; }
    .pw__toggle {
      position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
      background: none; border: 0; cursor: pointer; padding: 6px 8px;
      color: inherit; opacity: .7; border-radius: 8px;
    }
    .pw__toggle:hover { opacity: 1; }
    .pw__toggle--text {
      font-size: .74rem; font-weight: 600; letter-spacing: .01em;
    }

    .roles { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .role {
      text-align: left; display: grid; gap: 3px; cursor: pointer;
      padding: 10px 12px; border-radius: var(--r-md, 10px);
      border: 1px solid var(--line, rgba(127,127,127,.28));
      background: transparent; color: inherit;
      transition: border-color .15s ease, background .15s ease;
    }
    .role:hover { border-color: var(--accent, #8B5CF6); }
    .role--on {
      border-color: var(--accent, #8B5CF6);
      background: color-mix(in srgb, var(--accent, #8B5CF6) 12%, transparent);
    }
    .role__name { font-weight: 600; font-size: .86rem; }
    .role__desc { font-size: .74rem; opacity: .75; line-height: 1.35; }

    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }

    @media (max-width: 620px) {
      .roles { grid-template-columns: 1fr; }
    }
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

  /** Called by the parent right before flipping `open` to true. */
  prepare(user: AdminUser | null): void {
    this.user = user;
    this.error.set(null);
    this.showPw.set(false);

    if (user) {
      // Edit mode: username and password aren't part of this submission.
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
        error: (e) => this.fail(e),
      });
      return;
    }

    // Edit mode runs up to three independent calls. They're sequenced rather
    // than parallel so a rejected role change (last-admin rule) doesn't leave
    // a half-applied edit with no clear message.
    const id = this.user.id;
    const roleChanged = v.role !== this.user.role;
    const wantsReset = !!v.newPassword;

    this.admin.updateUser(id, { email }).subscribe({
      next: () => {
        if (!roleChanged) return this.afterRole(id, wantsReset, v.newPassword);
        this.admin.setRole(id, v.role).subscribe({
          next: () => this.afterRole(id, wantsReset, v.newPassword),
          error: (e) => this.fail(e),
        });
      },
      error: (e) => this.fail(e),
    });
  }

  private afterRole(id: string, wantsReset: boolean, newPassword: string): void {
    if (!wantsReset) return this.done('Account updated.');

    this.admin.resetPassword(id, newPassword).subscribe({
      next: () => this.done('Account updated and password reset.'),
      error: (e) => this.fail(e),
    });
  }

  private done(message: string): void {
    this.busy.set(false);
    this.notifyOk(message);
    this.saved.emit();
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.error.set(this.admin.describeError(e));
  }

  // --- Toast adapter --------------------------------------------------------
  // Single place to fix if ToastService's method names differ from success().
  private notifyOk(message: string): void {
    this.toast.success(message);
  }
}