export interface ErpColumn {
  key: string;
  label: string;
}

export interface ErpOption {
  label: string;
  value: string;
}

export interface ErpField {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'select' | 'textarea';
  required?: boolean;
  maxLength?: number;
  min?: number;
  step?: string;
  pattern?: string;
  priceListId?: number;
  options?: ErpOption[];
}

export interface ErpModuleConfig {
  title: string;
  singular?: string;
  description: string;
  endpoint: string;
  supportsSearch: boolean;
  paginated?: boolean;
  canActivate?: boolean;
  canEdit?: boolean;
  columns: ErpColumn[];
  fields?: ErpField[];
}

export const erpModules: Record<string, ErpModuleConfig> = {
  products: {
    title: 'Productos',
    singular: 'producto',
    description: 'Consulta el catálogo y el estado de los productos.',
    endpoint: 'products',
    supportsSearch: true,
    fields: [
      { key: 'name', label: 'Nombre del producto', required: true, maxLength: 255 },
      { key: 'sku', label: 'SKU', maxLength: 64 },
      { key: 'barcode', label: 'Código de barras', maxLength: 64 },
      { key: 'category_id', label: 'Categoría', type: 'select', options: [] },
      {
        key: 'base_unit',
        label: 'Unidad base',
        type: 'select',
        required: true,
        options: [
          { value: 'kg', label: 'Kilogramo (kg)' },
          { value: 'g', label: 'Gramo (g)' },
          { value: 'unit', label: 'Unidad' },
          { value: 'package', label: 'Paquete' },
          { value: 'l', label: 'Litro (l)' }
        ]
      },
      { key: 'minimum_stock', label: 'Stock mínimo', type: 'number', min: 0, step: '0.001' }
    ],
    columns: [
      { key: 'name', label: 'Producto' },
      { key: 'sku', label: 'SKU' },
      { key: 'category.name', label: 'Categoría' },
      { key: 'base_unit', label: 'Unidad' },
      { key: 'minimum_stock', label: 'Stock mínimo' },
      { key: 'is_active', label: 'Estado' }
    ]
  },
  categories: {
    title: 'Categorías',
    singular: 'categoría',
    description: 'Categorías disponibles en el catálogo.',
    endpoint: 'categories',
    supportsSearch: false,
    paginated: false,
    fields: [
      { key: 'name', label: 'Nombre de la categoría', required: true, maxLength: 255 }
    ],
    columns: [
      { key: 'name', label: 'Categoría' },
      { key: 'is_active', label: 'Estado' }
    ]
  },
  customers: {
    title: 'Clientes',
    singular: 'cliente',
    description: 'Consulta los clientes registrados en el sistema.',
    endpoint: 'customers',
    supportsSearch: true,
    fields: [
      { key: 'name', label: 'Nombre del cliente', required: true, maxLength: 255 },
      {
        key: 'document_type',
        label: 'Tipo de documento',
        type: 'select',
        options: [
          { value: '', label: 'Sin especificar' },
          { value: 'cedula', label: 'Cédula' },
          { value: 'rif', label: 'RIF' },
          { value: 'passport', label: 'Pasaporte' },
          { value: 'other', label: 'Otro' }
        ]
      },
      { key: 'document_number', label: 'Número de documento', maxLength: 32 },
      { key: 'phone', label: 'Teléfono', maxLength: 32 },
      { key: 'email', label: 'Correo electrónico', type: 'email', maxLength: 255 },
      { key: 'address', label: 'Dirección', type: 'textarea', maxLength: 500 },
      {
        key: 'customer_type',
        label: 'Tipo de cliente',
        type: 'select',
        required: true,
        options: [
          { value: 'retail', label: 'Minorista' },
          { value: 'wholesale', label: 'Mayorista' },
          { value: 'frequent', label: 'Frecuente' }
        ]
      }
    ],
    columns: [
      { key: 'name', label: 'Cliente' },
      { key: 'document_number', label: 'Documento' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'customer_type', label: 'Tipo' },
      { key: 'is_active', label: 'Estado' }
    ]
  },
  suppliers: {
    title: 'Proveedores',
    singular: 'proveedor',
    description: 'Consulta los proveedores registrados en el sistema.',
    endpoint: 'suppliers',
    supportsSearch: true,
    fields: [
      { key: 'name', label: 'Nombre del proveedor', required: true, maxLength: 255 },
      {
        key: 'document_type',
        label: 'Tipo de documento',
        type: 'select',
        options: [
          { value: '', label: 'Sin especificar' },
          { value: 'cedula', label: 'Cédula' },
          { value: 'rif', label: 'RIF' },
          { value: 'passport', label: 'Pasaporte' },
          { value: 'other', label: 'Otro' }
        ]
      },
      { key: 'document_number', label: 'Número de documento', maxLength: 32 },
      { key: 'phone', label: 'Teléfono', maxLength: 32 },
      { key: 'email', label: 'Correo electrónico', type: 'email', maxLength: 255 },
      { key: 'address', label: 'Dirección', type: 'textarea', maxLength: 500 }
    ],
    columns: [
      { key: 'name', label: 'Proveedor' },
      { key: 'document_number', label: 'Documento' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'email', label: 'Correo' },
      { key: 'is_active', label: 'Estado' }
    ]
  },
  units: {
    title: 'Unidades',
    singular: 'unidad',
    description: 'Unidades disponibles para expresar cantidades y conversiones.',
    endpoint: 'units',
    supportsSearch: false,
    paginated: false,
    fields: [
      {
        key: 'code',
        label: 'Código',
        required: true,
        maxLength: 16,
        pattern: '^[a-z0-9_-]+$'
      },
      { key: 'name', label: 'Nombre', required: true, maxLength: 64 }
    ],
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Unidad' },
      { key: 'is_active', label: 'Estado' }
    ]
  },
  'price-lists': {
    title: 'Listas de precios',
    singular: 'lista de precios',
    description: 'Listas que definen moneda y precios vigentes para productos.',
    endpoint: 'price-lists',
    supportsSearch: false,
    paginated: false,
    canActivate: false,
    canEdit: false,
    fields: [
      {
        key: 'code',
        label: 'Código',
        required: true,
        maxLength: 32,
        pattern: '^[a-z0-9_-]+$'
      },
      { key: 'name', label: 'Nombre', required: true, maxLength: 100 },
      {
        key: 'currency',
        label: 'Moneda',
        required: true,
        maxLength: 3,
        pattern: '^[A-Z]{3}$'
      }
    ],
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Lista de precios' },
      { key: 'currency', label: 'Moneda' },
      { key: 'is_active', label: 'Estado' }
    ]
  },
  sales: {
    title: 'Ventas',
    description: 'Ventas registradas y su estado de pago.',
    endpoint: 'sales',
    supportsSearch: false,
    columns: [
      { key: 'document_number', label: 'Comprobante' },
      { key: 'customer.name', label: 'Cliente' },
      { key: 'sold_at', label: 'Fecha' },
      { key: 'currency', label: 'Moneda' },
      { key: 'total', label: 'Total' },
      { key: 'status', label: 'Estado' }
    ]
  },
  purchases: {
    title: 'Compras',
    description: 'Compras y recepciones registradas.',
    endpoint: 'purchases',
    supportsSearch: false,
    columns: [
      { key: 'document_number', label: 'Comprobante' },
      { key: 'supplier.name', label: 'Proveedor' },
      { key: 'received_at', label: 'Fecha' },
      { key: 'currency', label: 'Moneda' },
      { key: 'total', label: 'Total' },
      { key: 'status', label: 'Estado' }
    ]
  },
  inventory: {
    title: 'Inventario',
    description: 'Existencias actuales por producto y almacén.',
    endpoint: 'inventory/stocks',
    supportsSearch: false,
    columns: [
      { key: 'product.name', label: 'Producto' },
      { key: 'location.name', label: 'Almacén' },
      { key: 'quantity', label: 'Existencia' },
      { key: 'product.base_unit', label: 'Unidad' },
      { key: 'average_cost', label: 'Costo promedio' },
      { key: 'cost_currency', label: 'Moneda' }
    ]
  },
  cash: {
    title: 'Caja',
    description: 'Sesiones de caja y su estado.',
    endpoint: 'cash/sessions',
    supportsSearch: false,
    columns: [
      { key: 'id', label: 'Sesión' },
      { key: 'register.name', label: 'Caja' },
      { key: 'currency', label: 'Moneda' },
      { key: 'status', label: 'Estado' },
      { key: 'opened_at', label: 'Apertura' },
      { key: 'closed_at', label: 'Cierre' }
    ]
  }
};
