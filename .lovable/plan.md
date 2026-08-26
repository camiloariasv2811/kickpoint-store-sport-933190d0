# Plan de estabilidad y datos confiables

## Objetivo
Evitar que una falla temporal de red se presente como un catálogo vacío o incompleto, y lograr que tanto la tienda como el panel se recuperen solos sin refrescar la página.

## Cambios
1. **Catálogo confiable**
   - Diferenciar una respuesta válida de un error de carga; una falla ya no se convertirá en `[]` ni reemplazará productos que ya estaban visibles.
   - Mantener el último catálogo confirmado mientras se reintenta en segundo plano.
   - Unificar la consulta usada por inicio, catálogo, categorías y mayorista para evitar que una vista contamine la caché de otra con datos parciales.
   - Conservar el orden definido en el panel y mostrar estados claros de “actualizando” o “no se pudo sincronizar”, nunca información falsa.

2. **Recuperación automática en móvil**
   - Reintentar consultas fallidas con pausas cortas y volver a sincronizar al recuperar internet o regresar a la pestaña.
   - Evitar loaders que terminan guardando un resultado vacío por timeout.
   - Mantener la interfaz utilizable con los últimos datos buenos durante una interrupción.

3. **Panel administrativo**
   - Aplicar el mismo principio en Productos, Pedidos, Pagos y Reportes: un error conserva los datos anteriores y muestra una alerta con reintento, en vez de aparentar que no hay registros.
   - Revisar paginación y cachés para que los cambios se reflejen sin recargar manualmente.

4. **Verificación**
   - Probar tienda y panel en vista móvil, navegación entre rutas, pérdida/recuperación de conexión y retorno desde segundo plano.
   - Confirmar que el catálogo completo mantiene cantidad y orden, y que ninguna respuesta fallida sustituye datos válidos.

## Detalles técnicos
- TanStack Query conservará `previousData` y recibirá errores reales en lugar de arreglos vacíos.
- Las claves de caché distinguirán catálogo público, categorías y vistas administrativas.
- Se centralizará la política de reintentos, reconexión y refresco por foco, sin aumentar consultas innecesarias.
