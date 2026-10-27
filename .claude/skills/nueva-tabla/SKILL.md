---
name: nueva-tabla
description: Usar cuando se agregue una tabla nueva o una columna nueva en la base de datos Supabase de ROSEApp (productos, toppings, ventas, ventas_toppings u otra).
---

# Agregar tabla o columna en Supabase

El esquema no vive en el repo: se aplica en el SQL Editor del dashboard de Supabase. Entrega siempre el SQL listo para pegar y no asumas que ya existe.

## 1. SQL

- Nombres en español y snake_case, como el resto (`precio_al_momento`, `es_domicilio`).
- Tabla nueva: `id bigint generated always as identity primary key` y `created_at timestamptz default now()`.
- Catálogos que se activan/desactivan usan `esta_activo text default 'si'` con valores `'si'` / `'no'` (convención existente; no se borran filas).
- Columna nueva en tabla con datos: dar `default` para no romper filas viejas.
- Llaves foráneas con `references <tabla>(id)`.

## 2. RLS (obligatorio)

La anon key va en el cliente, así que sin RLS la tabla queda abierta a cualquiera.

```sql
alter table public.<tabla> enable row level security;

-- lectura para la app (sección Ventas no tiene login)
create policy "<tabla>_select" on public.<tabla>
  for select to anon, authenticated using (true);

-- escritura solo usuarios logueados (Admin)
create policy "<tabla>_write" on public.<tabla>
  for all to authenticated using (true) with check (true);
```

Ajusta según quién debe escribir: tablas de ventas las inserta la pantalla de Ventas (rol `anon` hoy). Pregunta al usuario antes de abrir escritura a `anon`.

## 3. Código

- Actualiza las interfaces TypeScript de las pantallas que la lean (`app/(tabs)/index.tsx`, `reporte.tsx`, `admin.tsx` definen sus propias interfaces).
- Si es un catálogo editable desde Admin: `admin.tsx` usa `activeTab` como nombre de tabla; agrega la pestaña junto a `productos`/`toppings` y su rama en `crearItem`.
- Si es un campo de venta, sigue la skill `nueva-funcion-venta`.

## 4. Documentación

Actualiza la sección "Modelo de datos" de `CLAUDE.md`.
