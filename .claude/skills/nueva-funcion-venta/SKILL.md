---
name: nueva-funcion-venta
description: Usar cuando se agregue un dato o una opción nueva a las ventas de ROSEApp (como fue método de pago o domicilio), o se cambie cómo se registra o reporta una venta.
---

# Agregar un campo a las ventas

Una venta toca dos pantallas que **no comparten código**: cada una tiene su propia interfaz, consulta y mapeo. Hay que cambiar ambas. Usa `es_domicilio` como modelo: busca `es_domicilio` / `esDomicilio` y replica cada aparición.

## 1. Base de datos

Columna en `ventas` con `default` (ver skill `nueva-tabla` para SQL y RLS).

## 2. `app/(tabs)/index.tsx` (Ventas)

1. Interfaz `VentaFormateada`: agregar el campo.
2. Estado del formulario (`useState`, junto a `metodoPago` / `esDomicilio`).
3. Resetearlo en `seleccionarProducto` para que no se arrastre de la venta anterior.
4. Selector en la hoja de cobro con el componente `Segmentado` (como Local/Domicilio y Efectivo/Transferencia); colores y tamaños de `lib/tema.ts`.
5. `insert` en `finalizarVenta`.
6. `select` de `consultarVentasHoy` y su `map` (con valor por defecto, p. ej. `|| false`).
7. Mostrarlo en la lista del día si aplica.

## 3. `app/(tabs)/reporte.tsx` (Reporte)

1. Interfaz `Venta`.
2. `select` de `consultarVentas` y su `map`.
3. Totales/desgloses si el campo afecta dinero (ver `totalEfectivo`, `ventasDomi`).
4. Badge en cada fila de la lista.

## 4. Precio

El total vive en **dos lugares que deben coincidir**:

- Cliente: `calcularTotal` en `index.tsx` (solo informativo: el botón "Cobrar $X").
- Base de datos: la función `venta_recalcular_total` (y `venta_precio_base`), que es la que guarda el total real. Se cambia con un script nuevo en `supabase/` que haga `create or replace function`, y se actualiza también `supabase/seguridad-opcion-a.sql` para que una re-ejecución no revierta la regla.

Regla vigente: `primer_topping` regala el topping más barato, sin contar "helado".

Un cambio solo en la base de datos aplica de inmediato a todos los celulares, incluso con el APK viejo; el cliente llega con `eas update`.

## 5. Avisos y fechas

Usar `avisar` / `confirmar` de `lib/dialogos.ts` (nunca `Alert`, no funciona en web) y fechas locales (`fechaLocalISO`, nunca `toISOString().split("T")[0]`).

## 6. Verificar

`npx tsc --noEmit`, y en el teléfono: registrar una venta con y sin la opción, revisar la lista del día y el reporte de hoy. Actualizar "Modelo de datos" en `CLAUDE.md`.
