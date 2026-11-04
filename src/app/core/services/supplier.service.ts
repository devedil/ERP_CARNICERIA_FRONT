import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import { ApiCollection, Supplier } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  readonly #api = inject(ApiService);

  list(): Observable<ApiCollection<Supplier>> {
    return this.#api.get('suppliers');
  }
}
