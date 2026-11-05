import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import {
  ApiCollection,
  ApiItem,
  InventoryLocation,
  InventoryItem,
  InventoryMovement,
  InventoryProcessing,
  InventoryStock,
  InventoryTransfer,
  InventoryValuation,
  PaginatedCollection
} from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  readonly #api = inject(ApiService);

  stocks(filters: {
    productId?: number;
    locationId?: number;
    lowStock?: boolean;
    page?: number;
  } = {}): Observable<PaginatedCollection<InventoryStock>> {
    return this.#api.get('inventory/stocks', this.params(filters));
  }

  movements(filters: {
    productId?: number;
    locationId?: number;
    page?: number;
  } = {}): Observable<PaginatedCollection<InventoryMovement>> {
    return this.#api.get('inventory/movements', this.params(filters));
  }

  valuation(locationId?: number): Observable<ApiCollection<InventoryValuation>> {
    let params = new HttpParams();
    if (locationId) {
      params = params.set('inventory_location_id', String(locationId));
    }
    return this.#api.get('inventory/valuation', params);
  }

  locations(): Observable<ApiCollection<InventoryLocation>> {
    return this.#api.get('inventory/locations');
  }

  items(productId?: number, locationId?: number): Observable<PaginatedCollection<InventoryItem>> {
    let params = new HttpParams().set('per_page', '100');
    if (productId) params = params.set('product_id', String(productId));
    if (locationId) params = params.set('inventory_location_id', String(locationId));
    return this.#api.get('inventory/items', params);
  }

  transfers(): Observable<PaginatedCollection<InventoryTransfer>> {
    return this.#api.get('inventory/transfers');
  }

  processings(): Observable<PaginatedCollection<InventoryProcessing>> {
    return this.#api.get('inventory/processings');
  }

  process(body: {
    source_product_id: number;
    source_inventory_item_id?: number;
    inventory_location_id: number;
    source_quantity: string;
    waste_quantity: string;
    reason: string;
    outputs: Array<{ product_id: number; quantity: string }>;
  }): Observable<ApiItem<InventoryProcessing>> {
    return this.#api.post('inventory/processings', body);
  }

  adjust(
    productId: number,
    body: {
      inventory_location_id: number;
      quantity: string;
      reason: string;
      unit_cost?: string;
      cost_currency?: string;
    }
  ): Observable<ApiItem<InventoryMovement>> {
    return this.#api.post(`products/${productId}/inventory/adjustments`, body);
  }

  transfer(
    productId: number,
    body: {
      source_location_id: number;
      destination_location_id: number;
      quantity: string;
      reason: string;
    }
  ): Observable<ApiItem<InventoryTransfer>> {
    return this.#api.post(`products/${productId}/inventory/transfers`, body);
  }

  private params(filters: {
    productId?: number;
    locationId?: number;
    lowStock?: boolean;
    page?: number;
  }): HttpParams {
    let params = new HttpParams().set('per_page', '20');
    if (filters.productId) {
      params = params.set('product_id', String(filters.productId));
    }
    if (filters.locationId) {
      params = params.set('inventory_location_id', String(filters.locationId));
    }
    if (filters.lowStock) {
      params = params.set('low_stock', 'true');
    }
    if (filters.page) {
      params = params.set('page', String(filters.page));
    }
    return params;
  }
}
