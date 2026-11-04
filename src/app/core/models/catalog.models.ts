export interface Category {
  id: number;
  name: string;
  is_active: boolean;
}

export interface Unit {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
}

export interface PriceList {
  id: number;
  code: string;
  name: string;
  currency: string;
  is_active: boolean;
}

export interface ExchangeRate {
  id: number;
  base_currency: string;
  quote_currency: string;
  rate: string;
  source: string;
  source_updated_at: string | null;
  effective_at: string;
}

export interface Product {
  id: number;
  category: Category | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  base_unit: string;
  minimum_stock: string;
  is_active: boolean;
}

export interface ProductUnitConversion {
  id: number;
  product_id: number;
  unit: Pick<Unit, 'id' | 'code' | 'name'>;
  factor_to_base: string;
  is_active: boolean;
}

export interface ProductPrice {
  id: number;
  product_id: number;
  price_list: Pick<PriceList, 'id' | 'code' | 'name' | 'currency'>;
  unit: Pick<Unit, 'id' | 'code' | 'name'> | null;
  amount: string;
  is_active: boolean;
}

export interface InventoryLocation {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
}

export interface InventoryStock {
  id: number;
  product_id: number;
  product: Pick<Product, 'id' | 'name' | 'base_unit'>;
  location: Pick<InventoryLocation, 'id' | 'code' | 'name'>;
  quantity: string;
  average_cost: string;
  cost_currency: string | null;
  inventory_value: string;
}

export interface InventoryMovement {
  id: number;
  product_id: number;
  location_id: number;
  movement_type: string;
  quantity: string;
  quantity_before: string;
  quantity_after: string;
  unit_cost: string | null;
  total_cost: string | null;
  cost_currency: string | null;
  reason: string;
  user_id: number;
  created_at: string;
}

export interface InventoryTransfer {
  id: number;
  product_id: number;
  source_location_id: number;
  destination_location_id: number;
  quantity: string;
  status: string;
  reason: string;
  created_at: string;
}

export interface InventoryProcessingOutput {
  id: number;
  product_id: number;
  quantity: string;
  cost_share: string;
  allocated_cost: string;
  unit_cost: string;
}

export interface InventoryProcessing {
  id: number;
  source_product_id: number;
  inventory_location_id: number;
  source_quantity: string;
  waste_quantity: string;
  waste_cost_share: string;
  total_cost: string;
  cost_currency: string | null;
  reason: string;
  status: string;
  outputs: InventoryProcessingOutput[];
  created_at: string;
}

export interface InventoryValuation {
  currency: string;
  value: string;
}

export interface SaleLine {
  id: number;
  product: Pick<Product, 'id' | 'name' | 'base_unit'>;
  unit: Pick<Unit, 'id' | 'code' | 'name'> | null;
  quantity: string;
  base_quantity: string;
  unit_price: string;
  unit_price_usd: string | null;
  line_total: string;
}

export interface SalePayment {
  id: number;
  cash_session_id: number;
  payment_method: string;
  amount: string;
  currency: string;
  exchange_rate: string;
  applied_amount: string;
}

export interface Sale {
  id: number;
  customer: Pick<Customer, 'id' | 'name'> | null;
  price_list: Pick<PriceList, 'id' | 'code' | 'currency'>;
  location: Pick<InventoryLocation, 'id' | 'code' | 'name'>;
  document_number: string | null;
  currency: string;
  exchange_rate: string | null;
  total: string;
  status: string;
  is_offline: boolean;
  inventory_conflict: boolean;
  inventory_conflicts: unknown[];
  sold_at: string;
  notes: string | null;
  lines: SaleLine[];
  payments: SalePayment[];
}

export interface PurchaseLine {
  id: number;
  product: Pick<Product, 'id' | 'name' | 'base_unit'>;
  quantity: string;
  unit_cost: string;
  line_total: string;
}

export interface PurchasePayment {
  id: number;
  cash_session_id: number;
  payment_method: string;
  amount: string;
  currency: string;
  exchange_rate: string;
  applied_amount: string;
}

export interface Purchase {
  id: number;
  supplier: Pick<Supplier, 'id' | 'name'>;
  location: Pick<InventoryLocation, 'id' | 'code' | 'name'>;
  document_number: string | null;
  currency: string;
  total: string;
  status: string;
  received_at: string;
  notes: string | null;
  lines: PurchaseLine[];
  payments: PurchasePayment[];
  paid_amount: string;
  balance: string;
}

export interface CashRegister {
  id: number;
  code: string;
  name: string;
}

export interface CashSession {
  id: number;
  register: CashRegister | null;
  currency: string;
  opening_amount: string;
  closing_amount: string | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
}

export interface CashMovement {
  id: number;
  movement_type: 'income' | 'expense';
  amount: string;
  expense_category: { id: number; code: string; name: string } | null;
  reference_type: string | null;
  reference_id: number | null;
  reason: string;
  created_at: string;
}

export interface CashSessionSummary {
  cash_session_id: number;
  currency: string;
  opening_amount: string;
  income: string;
  expense: string;
  expected_amount: string;
  status: string;
}

export interface CashExpenseCategory {
  id: number;
  code: string;
  name: string;
}

export interface Customer {
  id: number;
  name: string;
  customer_type?: string;
  is_active?: boolean;
}

export interface Supplier {
  id: number;
  name: string;
  is_active?: boolean;
}

export interface ProductPriceOption {
  id: number;
  product_id: number;
  price_list_id: number;
  unit: Pick<Unit, 'id' | 'code' | 'name'> | null;
  amount: string;
  is_active: boolean;
}

export interface OfflineCatalogProduct {
  id: number;
  name: string;
  base_unit: string;
  available_quantity: string;
  price_list_id: number;
  currency: string;
  prices: Array<{
    unit_id: number | null;
    unit: Pick<Unit, 'id' | 'code' | 'name'> | null;
    unit_price: string;
    factor_to_base: string;
    quote_token: string;
  }>;
}

export interface OfflineCatalog {
  data: OfflineCatalogProduct[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    currency: string;
    price_list_id: number;
    inventory_location_id: number;
    exchange_rate: string;
  };
}

export interface PaginatedCollection<T> extends ApiCollection<T> {
  meta: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

export interface ApiCollection<T> {
  data: T[];
}

export interface ApiItem<T> {
  data: T;
}
