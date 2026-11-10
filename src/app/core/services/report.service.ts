import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import { ApiItem } from '../models/catalog.models';

export interface ReportCurrencyAmount {
  currency: string;
  amount: string;
}

export interface ReportSummary {
  filters: {
    from: string | null;
    to: string | null;
    currency: string | null;
    inventory_location_id: number | null;
  };
  sales: {
    count: number;
    total_by_currency: ReportCurrencyAmount[];
    by_product: Array<{
      product_id: number;
      product: string | null;
      currency: string;
      quantity: string;
      total: string;
    }>;
  };
  purchases: {
    count: number;
    total_by_currency: ReportCurrencyAmount[];
  };
  cash: Array<{
    currency: string;
    income: string;
    expense: string;
    net: string;
  }>;
  inventory: {
    stock_lines: number;
    value_by_currency: ReportCurrencyAmount[];
  };
  accounts_receivable: {
    count: number;
    balance_by_currency: ReportCurrencyAmount[];
  };
  accounts_payable: {
    count: number;
    balance_by_currency: ReportCurrencyAmount[];
  };
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  readonly #api = inject(ApiService);

  summary(filters: {
    from?: string;
    to?: string;
    currency?: string;
    inventoryLocationId?: number;
  } = {}): Observable<ApiItem<ReportSummary>> {
    let params = new HttpParams();
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.currency) params = params.set('currency', filters.currency);
    if (filters.inventoryLocationId) {
      params = params.set('inventory_location_id', String(filters.inventoryLocationId));
    }

    return this.#api.get('reports/summary', params);
  }
}
