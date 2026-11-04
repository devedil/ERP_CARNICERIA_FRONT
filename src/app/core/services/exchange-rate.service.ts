import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import { ApiItem, ExchangeRate } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  readonly #api = inject(ApiService);

  current(): Observable<ApiItem<ExchangeRate>> {
    return this.#api.get('exchange-rates/current');
  }
}
