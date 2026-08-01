import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      // Phase 9 adds /login (outside the shell) plus guards.
      // Phase 10 adds employees / card-requests / visitors / rfid.
    ],
  },
  { path: '**', redirectTo: '' },
];