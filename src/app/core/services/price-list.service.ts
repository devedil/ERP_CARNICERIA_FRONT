import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import { ApiCollection, PriceList } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class PriceListService {
  readonly #api = inject(ApiService);

  list(isActive?: boolean): Observable<ApiCollection<PriceList>> {
    const params = isActive === undefined
      ? undefined
      : new HttpParams().set('is_active', isActive ? '1' : '0');
    return this.#api.get('price-lists', params);
  }
}
