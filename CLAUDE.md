# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

ROSE es una app de punto de venta (POS) para un negocio de postres/helados, hecha con Expo (SDK 58, React Native 0.88, TypeScript 6 en modo estricto) + expo-router + Supabase. El código, los nombres de tablas/columnas y la UI están en español; mantener esa convención.

## Comandos

```bash
npm start            # expo start (dev server)
npm run android      # build nativo local Android
npm run web          # app en navegador
npm run build:web    # export estático a dist/ (web)
npx tsc --noEmit     # chequeo de tipos (no hay script propio)
eas build -p android --profile production   # APK (no se usa Play Store; se instala a mano)
eas update --channel production -m "mensaje" # actualización OTA de código JS a los celulares
```

La app móvil se distribuye como APK instalado a mano. Con `expo-updates` (runtimeVersion `fingerprint`) los cambios de solo JS/assets llegan por `eas update`; un cambio nativo (librería nativa nueva, config nativa en `app.json`, subir SDK) cambia el fingerprint y exige un APK nuevo.

No hay tests ni linter configurados.

## Arquitectura

- **Entrada:** `package.json` → `"main": "expo-router/entry"`. Las rutas viven en `app/`.
- **Cliente Supabase:** único, en `supabaseConfig.tsx` (URL + anon key hardcodeadas). Todas las pantallas consultan Supabase directamente; no hay capa de servicios, estado global ni backend propio.
- **Diálogos:** la app corre en PC (web) y móvil. `Alert.alert` no hace nada en react-native-web, así que para avisos y confirmaciones usar `avisar` / `confirmar` de `lib/dialogos.ts`, nunca `Alert` directamente.
- **Fechas:** los filtros "del día" se arman en hora local. No usar `toISOString().split("T")[0]` para obtener la fecha (es UTC y en la noche da el día siguiente); ver `fechaLocalISO` en `reporte.tsx`.
- **Pantallas** (`app/(tabs)/`), cada una autocontenida (estado, lógica, estilos en el mismo archivo):
  - `index.tsx` — **Ventas**. Solo móvil (en web muestra un aviso). Registra ventas sin login. Calcula el total en el cliente: producto + toppings, y si el producto tiene `primer_topping` se regala el topping más barato (excluyendo "helado").
  - `reporte.tsx` — **Reporte** diario por fecha (datetimepicker).
  - `admin.tsx` — **Admin**. Solo visible en web (`href: null` en otras plataformas, ver `app/(tabs)/_layout.tsx`). Login con `supabase.auth.signInWithPassword`; CRUD paginado sobre `productos` y `toppings` usando `activeTab` como nombre de tabla.

## Modelo de datos (Supabase)

- `productos`: `id, nombre, precio, stock, tiene_toppings, primer_topping, esta_activo`
- `toppings`: `id, nombre, precio, esta_activo`
- `ventas`: `id, producto_id, total, metodo_pago ("Efectivo" | "Transferencia"), es_domicilio, created_at`
- `ventas_toppings`: `venta_id, topping_id, precio_al_momento`

Notas:
- `esta_activo` es string `"si"` / `"no"` (no booleano). No se borran productos/toppings, se desactivan.
- Las consultas de ventas usan joins embebidos de PostgREST (`productos ( nombre ), ventas_toppings ( toppings ( nombre ) )`); la relación puede llegar como objeto o array, por eso el código normaliza ambos casos.
- Los filtros "del día" usan hora local del dispositivo convertida a ISO.
- No hay migraciones formales: el SQL se ejecuta a mano en el SQL Editor de Supabase. Los scripts aplicados se guardan en `supabase/`. La seguridad real depende de RLS, ya que la anon key va en el cliente y la pantalla de Ventas no requiere autenticación (`supabase/seguridad-opcion-a.sql`: anon lee y registra/anula ventas; solo `authenticated` edita el catálogo).
- **El total de una venta lo recalcula la base de datos** con triggers (producto + toppings − descuento de `primer_topping`). El cálculo en `finalizarVenta` del cliente es solo informativo: si cambia la regla de precios, hay que cambiarla en los dos lados.

## Web / deploy

Se publica en Netlify. `app.json` usa `web.output: "static"` y `public/_redirects` contiene la regla SPA `/* /index.html 200`.
