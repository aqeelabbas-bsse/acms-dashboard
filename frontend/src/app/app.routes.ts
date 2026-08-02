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
        path: 'rfid',
        loadComponent: () =>
          import('./pages/rfid/rfid.component').then(m => m.RfidComponent),
      },
      {
        path: 'admin',
        canActivate: [roleGuard('Admin')],
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];