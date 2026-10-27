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
4. Selector en el modal de venta (mismo estilo `payOption` / `payOptionActive`).
5. `insert` en `finalizarVenta`.
6. `select` de `consultarVentasHoy` y su `map` (con valor por defecto, p. ej. `|| false`).
7. Mostrarlo en la lista del día si aplica.

## 3. `app/(tabs)/reporte.tsx` (Reporte)

1. Interfaz `Venta`.
2. `select` de `consultarVentas` y su `map`.
3. Totales/desgloses si el campo afecta dinero (ver `totalEfectivo`, `ventasDomi`).
4. Badge en cada fila de la lista.

## 4. Precio

Si el campo cambia el total (recargo, descuento), el cálculo está en `finalizarVenta` del cliente. Mantén la regla existente: `primer_topping` descuenta el topping más caro excepto "helado".

## 5. Verificar

`npx tsc --noEmit`, y en el teléfono: registrar una venta con y sin la opción, revisar la lista del día y el reporte de hoy. Actualizar "Modelo de datos" en `CLAUDE.md`.
