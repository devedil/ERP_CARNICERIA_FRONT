import { INavData } from '@coreui/angular';

export const navItems: INavData[] = [
  {
    name: 'Inicio',
    url: '/dashboard',
    iconComponent: { name: 'cil-speedometer' }
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
  },
  {
    name: 'Ventas',
    url: '/sales',
    iconComponent: { name: 'cil-credit-card' }
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
    name: 'Caja',
    url: '/cash',
    iconComponent: { name: 'cil-dollar' }
  }
];
