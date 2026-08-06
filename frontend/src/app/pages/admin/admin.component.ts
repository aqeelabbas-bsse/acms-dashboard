// =============================================================================
// src/app/pages/admin/admin.component.ts
// =============================================================================

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { SegmentedComponent, SegmentOption } from '../../shared/ui/segmented/segmented.component';
import { AdminUsersComponent } from './admin-users.component';
import { AdminSignoffComponent } from './admin-signoff.component';

@Component({
  selector: 'acms-admin',
  standalone: true,
  imports: [
    PageHeaderComponent, SegmentedComponent, AdminUsersComponent, AdminSignoffComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <acms-page-header
      eyebrow="Administration"
      title="Admin console"
      subtitle="Accounts, roles, and project delivery status">
      <acms-segmented [options]="tabs" [(value)]="tab" />
    </acms-page-header>

    <!-- @if rather than hidden divs: the users table fires three HTTP calls on
         init, and there's no reason to pay for them while the supervisor is
         looking at the sign-off view. -->
    @if (tab() === 'users') {
      <acms-admin-users />
    } @else {
      <acms-admin-signoff />
    }
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class AdminComponent {
  readonly tab = signal<'users' | 'signoff'>('users');

  readonly tabs: SegmentOption[] = [
    { label: 'Users', value: 'users' },
    { label: 'Sign-off', value: 'signoff' },
  ];
}