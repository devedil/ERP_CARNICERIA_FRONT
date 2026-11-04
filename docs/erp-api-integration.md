# Integración con la API del ERP

El frontend conserva el layout, la navegación y los componentes CoreUI del template. Las llamadas utilizan la API versionada de Laravel bajo `/api/v1`.

## Configuración

- Desarrollo: `src/environments/environment.ts` apunta a `http://localhost:8000`.
- Producción: `src/environments/environment.production.ts` usa rutas del mismo origen; configura el proxy o el origen de API de tu despliegue según corresponda.
- La API debe permitir el origen del frontend en CORS y aceptar credenciales, como se indica en el `.env.example` del backend.

La autenticación usa la sesión SPA de Sanctum: primero se solicita `/sanctum/csrf-cookie`, luego se envía el usuario y contraseña a `/api/v1/auth/login`. Las solicitudes incluyen cookies y el encabezado CSRF; no se guardan tokens en el navegador. Las rutas del ERP validan la sesión mediante `/api/v1/me`.

## Módulos conectados

- Inicio: indicadores y gráfica desde `/api/v1/reports/summary`.
- Productos, clientes y proveedores: listados paginados con búsqueda; altas, edición y activación/desactivación usan los endpoints Laravel. Al crear productos se exigen los precios USD Detal y Mayorista en la misma operación.
- Categorías: colección activa/inactiva, alta, edición y activación/desactivación; se reutilizan como opciones al asignar productos.
- Unidades y listas de precios: listados, creación y desactivación según las operaciones disponibles en el backend. Las listas de precios no ofrecen edición ni reactivación en la API.
- Configuración de productos: gestión de conversiones de unidad y sustitución de precios inactivos, mostrando los importes en USD.
- Inventario: existencias con filtros por producto, almacén y bajo stock; valorización agrupada por moneda; historial paginado de movimientos y procesos; ajustes, transferencias y desposte con confirmación previa. El formulario de desposte verifica que la distribución de costos entre subproductos y merma sume exactamente 100%.
- Ventas: listado paginado; POS online con precios base USD, conversión al total VES usando la tasa oficial vigente, conversiones/unidades configuradas, cliente opcional, selección de almacén y pago inmediato o crédito; abonos y comprobante con tasa aplicada.
- Compras: recepción de productos y actualización de inventario, seguida del registro de pagos parciales o completos a proveedores.
- Caja: apertura y cierre de sesiones, resumen de saldo esperado, movimientos manuales y consulta de ingresos/egresos. El backend no ofrece un endpoint para listar cajas registradoras, por lo que la apertura solicita su ID existente.

Los formularios usan los componentes, tablas, modales y estilos CoreUI ya incluidos en el template. La captura y sincronización offline del POS pertenece a la fase dedicada posterior; los reportes administrativos restantes también quedan pendientes.
