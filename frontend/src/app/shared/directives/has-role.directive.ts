import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models/api.models';

/**
 * Structural directive - shows content only for the listed roles.
 *   <button *acmsHasRole="['Admin','Security']">Verify</button>
 *
 * Cosmetic only. The API is what actually enforces permissions.
 */
@Directive({ selector: '[acmsHasRole]', standalone: true })
export class HasRoleDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly acmsHasRole = input<Role[]>([]);

  constructor() {
    effect(() => {
      const allowed = this.acmsHasRole();
      this.vcr.clear();
      if (this.auth.hasRole(...allowed)) {
        this.vcr.createEmbeddedView(this.tpl);
      }
    });
  }
}