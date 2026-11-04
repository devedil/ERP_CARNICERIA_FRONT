import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly #http = inject(HttpClient);
  readonly #apiUrl = `${environment.apiUrl}/api/v1`;

  get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.#http.get<T>(`${this.#apiUrl}/${path}`, {
      params,
      withCredentials: true
    });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.#http.post<T>(`${this.#apiUrl}/${path}`, body, {
      withCredentials: true
    });
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.#http.patch<T>(`${this.#apiUrl}/${path}`, body, {
      withCredentials: true
    });
  }

  delete<T>(path: string): Observable<T> {
    return this.#http.delete<T>(`${this.#apiUrl}/${path}`, {
      withCredentials: true
    });
  }
}
