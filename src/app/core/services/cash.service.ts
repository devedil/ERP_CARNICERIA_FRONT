import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api.service';
import {
  ApiCollection,
  ApiItem,
  CashExpenseCategory,
  CashMovement,
  CashSession,
  CashSessionSummary,
  PaginatedCollection
} from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class CashService {
  readonly #api = inject(ApiService);

  sessions(page = 1): Observable<PaginatedCollection<CashSession>> {
    return this.#api.get('cash/sessions', new HttpParams().set('per_page', '20').set('page', String(page)));
  }

  open(body: {
    cash_register_id: number;
    currency: string;
    opening_amount: string;
    notes: string | null;
  }): Observable<ApiItem<CashSession>> {
    return this.#api.post('cash/sessions', body);
  }

  movements(sessionId: number, page = 1): Observable<PaginatedCollection<CashMovement>> {
    return this.#api.get(
      `cash/sessions/${sessionId}/movements`,
      new HttpParams().set('per_page', '50').set('page', String(page))
    );
  }

  summary(sessionId: number): Observable<ApiItem<CashSessionSummary>> {
    return this.#api.get(`cash/sessions/${sessionId}/summary`);
  }

  recordMovement(
    sessionId: number,
    body: {
      movement_type: 'income' | 'expense';
      amount: string;
      reason: string;
      expense_category_id?: number;
    }
  ): Observable<ApiItem<CashMovement>> {
    return this.#api.post(`cash/sessions/${sessionId}/movements`, body);
  }

  close(
    sessionId: number,
    body: { closing_amount: string; notes: string | null }
  ): Observable<ApiItem<CashSession>> {
    return this.#api.patch(`cash/sessions/${sessionId}/close`, body);
  }

  expenseCategories(): Observable<ApiCollection<CashExpenseCategory>> {
    return this.#api.get('cash/expense-categories');
  }
}
