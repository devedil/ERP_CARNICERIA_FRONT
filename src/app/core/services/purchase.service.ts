import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import { environment } from '../../../environments/environment';
import {
  ApiItem,
  PaginatedCollection,
  Purchase,
  PurchasePayment
} from '../models/catalog.models';
import { SalePaymentInput } from './sale.service';

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  readonly #api = inject(ApiService);

  list(page = 1): Observable<PaginatedCollection<Purchase>> {
    const params = new HttpParams().set('per_page', '20').set('page', String(page));
    return this.#api.get('purchases', params);
  }

  create(body: {
    supplier_id: number;
    inventory_location_id: number;
    document_number: string | null;
    currency: 'USD';
    notes: string | null;
    lines: Array<{
      product_id: number;
      quantity: string;
      unit_cost: string;
      conversion_id?: number;
      units?: Array<{ weight: string }>;
    }>;
  }): Observable<ApiItem<Purchase>> {
    return this.#api.post('purchases', body);
  }

  pay(id: number, body: SalePaymentInput): Observable<ApiItem<PurchasePayment>> {
    return this.#api.post(`purchases/${id}/payments`, body);
  }

  paymentReceiptUrl(purchaseId: number, paymentId: number): string {
    return `${environment.apiUrl}/api/v1/purchases/${purchaseId}/payments/${paymentId}/receipt`;
  }
}
