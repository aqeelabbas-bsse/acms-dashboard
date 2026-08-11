import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],       // guards every child in one place
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'employees',
        loadComponent: () =>
          import('./pages/employees/employees.component').then(m => m.EmployeesComponent),
      },
      {
        path: 'employees/:cnic',
        loadComponent: () =>
          import('./pages/employees/employee-profile.component')
            .then(m => m.EmployeeProfileComponent),
      },
      {
        path: 'card-requests',
        loadComponent: () =>
          import('./pages/card-requests/card-requests.component')
            .then(m => m.CardRequestsComponent),
      },
      {
        path: 'visitors',
        loadComponent: () =>
          import('./pages/visitors/visitors.component').then(m => m.VisitorsComponent),
      },
      {
        // Staff cards (dbo.PersonalRFID) - distinct population from visitor
        // passes, so it gets its own route rather than a filter on /visitor-rfid.
        path: 'personal-rfid',
        loadComponent: () =>
          import('./pages/personal-rfid/personal-rfid.component')
            .then(m => m.PersonalRfidComponent),
      },
      {
        // Visitor passes (dbo.VisitorsRFID). Renamed from the ambiguous '/rfid'.
        path: 'visitor-rfid',
        loadComponent: () =>
          import('./pages/rfid/rfid.component').then(m => m.RfidComponent),
      },
      {
        // Anyone with the old URL bookmarked lands on the visitor screen, which
        // is what '/rfid' always actually showed.
        path: 'rfid',
        redirectTo: 'visitor-rfid',
        pathMatch: 'full',
      },
      {
        // Phase 14: real Admin Console (user management), replacing the
        // DashboardComponent placeholder that lived here through Phase 13.
        path: 'admin',
        canActivate: [roleGuard('Admin')],
        loadComponent: () =>
          import('./pages/admin/admin.component').then(m => m.AdminComponent),
      },
      {
        // Help centre: in-app FAQ plus the downloadable User Guide and
        // Technical Documentation. Open to every signed-in role - the
        // Technical Documentation card inside it is Admin-gated on its own,
        // because it lists development credentials.
        path: 'help',
        loadComponent: () =>
          import('./pages/help/help.component').then(m => m.HelpComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];