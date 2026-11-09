import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import {
  ApiCollection,
  ApiItem,
  Customer,
  CustomerAccountStatement,
  CustomerCreditAccount
} from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  readonly #api = inject(ApiService);

  list(perPage = 100): Observable<ApiCollection<Customer>> {
    const params = new HttpParams().set('per_page', String(perPage));
    return this.#api.get('customers', params);
  }

  creditAccounts(): Observable<ApiCollection<CustomerCreditAccount>> {
    return this.#api.get('customers/credit-accounts');
  }

  accountStatement(customerId: number, currency?: string): Observable<ApiItem<CustomerAccountStatement>> {
    let params = new HttpParams();
    if (currency) {
      params = params.set('currency', currency);
    }

    return this.#api.get(`customers/${customerId}/account-statement`, params);
  }
}
