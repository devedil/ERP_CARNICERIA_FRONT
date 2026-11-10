import { INavData } from '@coreui/angular';

export const navItems: INavData[] = [
  {
    name: 'Inicio',
    url: '/dashboard',
    iconComponent: { name: 'cil-speedometer' }
  },
  {
    name: 'Ventas',
    url: '/sales',
    iconComponent: { name: 'cil-credit-card' }
  },
  {
    name: 'Caja',
    url: '/cash',
    iconComponent: { name: 'cil-dollar' }
  },
  {
    name: 'Compras',
    url: '/purchases',
    iconComponent: { name: 'cil-notes' }
  },
  {
    name: 'Inventario',
    url: '/inventory',
    iconComponent: { name: 'cil-layers' }
  },
  {
    name: 'Control de reses',
    url: '/cattle-control',
    iconComponent: { name: 'cil-notes' }
  },
  {
    name: 'Créditos de clientes',
    url: '/customer-accounts',
    iconComponent: { name: 'cil-wallet' }
  },
  {
    name: 'Reportes',
    url: '/reports',
    iconComponent: { name: 'cil-chart' }
  },
  {
    title: true,
    name: 'Gestión'
  },
  {
    name: 'Productos',
    url: '/products',
    iconComponent: { name: 'cil-basket' }
  },
  {
    name: 'Categorías',
    url: '/categories',
    iconComponent: { name: 'cil-tags' }
  },
  {
    name: 'Clientes',
    url: '/customers',
    iconComponent: { name: 'cil-people' }
  },
  {
    name: 'Proveedores',
    url: '/suppliers',
    iconComponent: { name: 'cil-user-follow' }
  },
  {
    name: 'Unidades',
    url: '/units',
    iconComponent: { name: 'cil-calculator' }
  },
  {
    name: 'Listas de precios',
    url: '/price-lists',
    iconComponent: { name: 'cil-tags' }
  }
];
