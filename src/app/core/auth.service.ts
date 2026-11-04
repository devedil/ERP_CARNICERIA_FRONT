import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, switchMap, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApiService } from './api.service';

export interface AuthUser {
  id: number;
  name: string;
  username: string;
}

interface ApiEnvelope<T> {
  data: T;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #http = inject(HttpClient);
  readonly #api = inject(ApiService);
  readonly #user = signal<AuthUser | null>(null);

  readonly user = this.#user.asReadonly();

  login(credentials: { username: string; password: string }): Observable<AuthUser> {
    return this.#http
      .get(`${environment.apiUrl}/sanctum/csrf-cookie`, {
        responseType: 'text',
        withCredentials: true
      })
      .pipe(
        switchMap(() => this.#api.post<ApiEnvelope<AuthUser>>('auth/login', credentials)),
        map((response) => response.data),
        tap((user) => this.#user.set(user))
      );
  }

  currentUser(): Observable<AuthUser> {
    return this.#api.get<ApiEnvelope<AuthUser>>('me').pipe(
      map((response) => response.data),
      tap((user) => this.#user.set(user))
    );
  }

  logout(): Observable<void> {
    return this.#api.post<void>('auth/logout', {}).pipe(
      tap(() => this.#user.set(null))
    );
  }
}
