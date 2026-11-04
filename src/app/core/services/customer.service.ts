import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import { ApiCollection, Customer } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  readonly #api = inject(ApiService);

  list(): Observable<ApiCollection<Customer>> {
    return this.#api.get('customers');
  }
}
