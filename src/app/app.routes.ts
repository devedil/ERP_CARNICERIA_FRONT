import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { erpModules } from './features/erp-module.config';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '',
    loadComponent: () => import('./layout').then(m => m.DefaultLayoutComponent),
    canActivateChild: [authGuard],
    data: {
      title: 'Inicio'
    },
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./views/dashboard/routes').then((m) => m.routes)
      },
      {
        path: 'products/:productId/configuration',
        loadComponent: () => import('./features/product-configuration.component').then((m) => m.ProductConfigurationComponent),
        data: { title: 'Conversiones y precios' }
      },
      {
        path: 'inventory',
        loadComponent: () => import('./features/inventory.component').then((m) => m.InventoryComponent),
        data: { title: 'Inventario' }
      },
      {
        path: 'cattle-control',
        loadComponent: () => import('./features/cattle-control.component').then((m) => m.CattleControlComponent),
        data: { title: 'Control de reses' }
      },
      {
        path: 'sales',
        loadComponent: () => import('./features/sales.component').then((m) => m.SalesComponent),
        data: { title: 'Ventas' }
      },
      {
        path: 'customer-accounts',
        loadComponent: () => import('./features/customer-account.component').then((m) => m.CustomerAccountComponent),
        data: { title: 'Estado de cuenta de clientes' }
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports.component').then((m) => m.ReportsComponent),
        data: { title: 'Reportes' }
      },
      {
        path: 'purchases',
        loadComponent: () => import('./features/purchases.component').then((m) => m.PurchasesComponent),
        data: { title: 'Compras' }
      },
      {
        path: 'cash',
        loadComponent: () => import('./features/cash.component').then((m) => m.CashComponent),
        data: { title: 'Caja' }
      },
      ...Object.entries(erpModules).map(([path, module]) => ({
        path,
        loadComponent: () => import('./features/erp-module.component').then((m) => m.ErpModuleComponent),
        data: { title: module.title, module }
      }))
    ]
  },
  {
    path: 'authentication',
    loadChildren: () => import('./views/authentication/routes').then((m) => m.routes)
  },
  {
    path: 'error-pages',
    loadChildren: () => import('./views/error-pages/routes').then((m) => m.routes)
  },
  { path: '**', redirectTo: 'dashboard' }
];
