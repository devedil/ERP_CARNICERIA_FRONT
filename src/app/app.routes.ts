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
      title: 'Home'
    },
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./views/dashboard/routes').then((m) => m.routes)
      },
      {
        path: 'components',
        loadChildren: () => import('./views/components/routes').then((m) => m.routes)
      },
      {
        path: 'forms',
        loadChildren: () => import('./views/forms/routes').then((m) => m.routes)
      },
      {
        path: 'icons',
        loadChildren: () => import('./views/icons/routes').then((m) => m.routes)
      },
      {
        path: 'widgets',
        loadChildren: () => import('./views/widgets/routes').then((m) => m.routes)
      },
      {
        path: 'charts',
        loadChildren: () => import('./views/charts/routes').then((m) => m.routes)
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
        path: 'sales',
        loadComponent: () => import('./features/sales.component').then((m) => m.SalesComponent),
        data: { title: 'Ventas' }
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
