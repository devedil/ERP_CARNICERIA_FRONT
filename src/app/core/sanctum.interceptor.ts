import { DOCUMENT } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

export const sanctumInterceptor: HttpInterceptorFn = (request, next) => {
  const document = inject(DOCUMENT);
  const xsrfCookie = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
    ?.slice('XSRF-TOKEN='.length);
  const method = request.method.toUpperCase();
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const headers = mutating && xsrfCookie
    ? request.headers.set('X-XSRF-TOKEN', decodeURIComponent(xsrfCookie))
    : request.headers;

  return next(request.clone({ headers, withCredentials: true }));
};
