import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import {
  ApiCollection,
  ApiItem,
  PaginatedCollection,
  Product,
  ProductPrice,
  ProductUnitConversion
} from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class ProductService {
  readonly #api = inject(ApiService);

  list(): Observable<PaginatedCollection<Product>> {
    return this.#api.get('products', new HttpParams().set('per_page', '100'));
  }

  get(id: number): Observable<ApiItem<Product>> {
    return this.#api.get(`products/${id}`);
  }

  conversions(id: number): Observable<ApiCollection<ProductUnitConversion>> {
    return this.#api.get(`products/${id}/conversions`);
  }

  addConversion(
    id: number,
    body: { unit_id: number; factor_to_base: string }
  ): Observable<ApiItem<ProductUnitConversion>> {
    return this.#api.post(`products/${id}/conversions`, body);
  }

  updateConversion(
    id: number,
    body: { unit_id: number; factor_to_base: string }
  ): Observable<ApiItem<ProductUnitConversion>> {
    return this.#api.patch(`conversions/${id}`, body);
  }

  deactivateConversion(id: number): Observable<{ message: string }> {
    return this.#api.delete(`conversions/${id}`);
  }

  prices(id: number): Observable<ApiCollection<ProductPrice>> {
    return this.#api.get(`products/${id}/prices`);
  }

  addPrice(
    id: number,
    body: { price_list_id: number; unit_id: number | null; amount: string }
  ): Observable<ApiItem<ProductPrice>> {
    return this.#api.post(`products/${id}/prices`, body);
  }
}
