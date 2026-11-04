import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import { environment } from '../../../environments/environment';
import {
  ApiItem,
  PaginatedCollection,
  Sale,
  SalePayment
} from '../models/catalog.models';

export interface SalePaymentInput {
  cash_session_id: number;
  payment_method: string;
  amount: string;
  exchange_rate?: string;
}

@Injectable({ providedIn: 'root' })
export class SaleService {
  readonly #api = inject(ApiService);

  list(page = 1): Observable<PaginatedCollection<Sale>> {
    const params = new HttpParams().set('per_page', '20').set('page', String(page));
    return this.#api.get('sales', params);
  }

  create(body: {
    customer_id: number | null;
    payment_mode: 'immediate' | 'credit';
    price_list_id: number;
    inventory_location_id: number;
    notes: string | null;
    lines: Array<{ product_id: number; unit_id: number | null; quantity: string }>;
    payments?: SalePaymentInput[];
  }): Observable<ApiItem<Sale>> {
    return this.#api.post('sales', body);
  }

  pay(id: number, body: SalePaymentInput): Observable<ApiItem<SalePayment>> {
    return this.#api.post(`sales/${id}/payments`, body);
  }

  receiptUrl(id: number): string {
    return `${environment.apiUrl}/api/v1/sales/${id}/receipt`;
  }
}
