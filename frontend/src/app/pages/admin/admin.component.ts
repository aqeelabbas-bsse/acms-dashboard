import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { AdminUsersComponent } from './admin-users.component';

@Component({
  selector: 'acms-admin',
  standalone: true,
  imports: [PageHeaderComponent, AdminUsersComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <acms-page-header
      eyebrow="Administration"
      title="Admin Console"
      subtitle="Manage accounts and roles">
    </acms-page-header>

    <acms-admin-users />
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class AdminComponent {}