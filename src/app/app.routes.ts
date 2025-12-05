import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

// Auth Components
import { Login  } from './components/login/login.component';
import { Signup } from './components/signup/signup.component';

// Dashboard Components
import { ContractorDashboard } from './components/dashboards/contractor-dashboard/contractor-dashboard';
import { SupplierDashboard } from './components/dashboards/supplier-dashboard/supplier-dashboard';
import { AdminDashboard } from './components/dashboards/admin-dashboard/admin-dashboard';
import { InventoryComponent } from './components/inventory/inventory.component';
import { RequestsComponent } from './components/requests/requests.component';
import { QuotationsComponent } from './components/quotations/quotations.component';
import { SupplierProfileComponent } from './components/supplier-profile/supplier-profile.component';
import { ProjectsComponent } from './components/projects/projects.component';
import { MaterialRequestsComponent } from './components/material-requests/material-requests.component';
import { ContractorQuotationsComponent } from './components/contractor-quotations/contractor-quotations.component';
import { ContractorProfileComponent } from './components/contractor-profile/contractor-profile.component';
import { AdminUsersComponent } from './components/admin-users/admin-users.component';
import { AdminContractorsComponent } from './components/admin-contractors/admin-contractors.component';
import { AdminSuppliersComponent } from './components/admin-suppliers/admin-suppliers.component';
import { AdminReportsComponent } from './components/admin-reports/admin-reports.component';
import { AdminSettingsComponent } from './components/admin-settings/admin-settings.component';

// Public Components
import { MaterialMap } from './components/material-map/material-map';
import { DecisionSupport } from './components/decision-support/decision-support'
import { Profile } from './components/profile/profile'; 
import { AddMaterial } from './components/add-site/add-site';;

export const routes: Routes = [
  { 
    path: '', 
    redirectTo: 'login', 
    pathMatch: 'full' 
  },
  { 
    path: 'login', 
    component: Login 
  },
  { 
    path: 'signup', 
    component: Signup 
  },
  // Public routes (no auth required)
  { 
    path: 'materials', 
    component: MaterialMap 
  },
  { 
    path: 'support', 
    component: DecisionSupport 
  },
  // Protected dashboard routes (auth required)
  { 
    path: 'contractor-dashboard', 
    component: ContractorDashboard,
    canActivate: [AuthGuard],
    children: [
      { path: 'projects', component: ProjectsComponent },
      { path: 'material-requests', component: MaterialRequestsComponent },
      { path: 'quotations', component: ContractorQuotationsComponent },
      { path: 'profile', component: ContractorProfileComponent },
      { path: 'materials-map', component: MaterialMap },
      { path: 'support', component: DecisionSupport }
    ]
  },
  { 
    path: 'supplier-dashboard', 
    component: SupplierDashboard,
    canActivate: [AuthGuard],
    children: [
      //{ path: '', component: SupplierDashboard },
      { path: 'inventory', component: InventoryComponent },
      { path: 'requests', component: RequestsComponent },
      { path: 'quotations', component: QuotationsComponent },
      { path: 'profile', component: SupplierProfileComponent },
      { path: 'add-site', component: AddMaterial },
      { path: 'materials-map', component: MaterialMap },
      { path: 'support', component: DecisionSupport }
    ]
  },
  { 
    path: 'admin-dashboard', 
    component: AdminDashboard,
    canActivate: [AuthGuard]
    ,
    children: [
      { path: 'users', component: AdminUsersComponent },
      { path: 'contractors', component: AdminContractorsComponent },
      { path: 'suppliers', component: AdminSuppliersComponent },
      { path: 'reports', component: AdminReportsComponent },
      { path: 'settings', component: AdminSettingsComponent },
      { path: 'materials-map', component: MaterialMap },
      { path: 'support', component: DecisionSupport }
    ]
  },
  { 
    path: '**', 
    redirectTo: 'login' 
  }
];
 