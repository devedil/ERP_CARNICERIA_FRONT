import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import { ApiCollection, Unit } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class UnitService {
  readonly #api = inject(ApiService);

  list(isActive?: boolean): Observable<ApiCollection<Unit>> {
    const params = isActive === undefined
      ? undefined
      : new HttpParams().set('is_active', isActive ? '1' : '0');
    return this.#api.get('units', params);
  }
}
