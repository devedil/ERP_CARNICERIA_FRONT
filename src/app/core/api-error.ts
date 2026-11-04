import { HttpErrorResponse } from '@angular/common/http';

export function getApiErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Ocurrió un error inesperado. Inténtalo nuevamente.';
  }

  const response = error.error as {
    message?: string;
    errors?: Record<string, string[]>;
  } | null;
  const validationMessage = response?.errors
    ? Object.values(response.errors).flat()[0]
    : undefined;

  return validationMessage
    ?? response?.message
    ?? (error.status === 0
      ? 'No fue posible conectar con el servidor.'
      : 'No se pudo completar la solicitud.');
}
