-- =====================================================================
-- ROSEApp · Seguridad opción A (no requiere actualizar la app del celular)
--
-- Qué hace:
--   1. RLS en las 4 tablas:
--        - Sin login (celular): leer menú, registrar ventas, anularlas, ver reportes.
--        - Solo con login (Admin): crear/editar productos y toppings.
--        - Nadie puede editar una venta ya registrada.
--   2. El total de cada venta lo calcula la base de datos con los precios
--      reales, sin importar lo que envíe el celular.
--
-- ANTES DE EJECUTAR:
--   a) Guarda tus políticas actuales (copia el resultado a un archivo):
--        select tablename, policyname, cmd, roles, qual, with_check
--        from pg_policies where schemaname = 'public';
--   b) En Authentication > Sign In / Providers desactiva
--      "Allow new users to sign up". Si está activo, cualquiera puede crearse
--      una cuenta y pasar a ser "authenticated" (= admin).
--
-- Se ejecuta completo en el SQL Editor. Si algo falla, no se aplica nada.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Borrar políticas existentes de estas tablas (las reemplazamos abajo).
--    Las políticas se suman entre sí: una política vieja permisiva
--    anularía las restricciones nuevas.
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('productos', 'toppings', 'ventas', 'ventas_toppings')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.productos       enable row level security;
alter table public.toppings        enable row level security;
alter table public.ventas          enable row level security;
alter table public.ventas_toppings enable row level security;

-- ---------------------------------------------------------------------
-- 2. Catálogo: todos leen, solo Admin (logueado) crea y edita.
--    No hay política de delete: los productos se desactivan, no se borran.
-- ---------------------------------------------------------------------
create policy productos_leer on public.productos
  for select to anon, authenticated using (true);
create policy productos_crear on public.productos
  for insert to authenticated with check (true);
create policy productos_editar on public.productos
  for update to authenticated using (true) with check (true);

create policy toppings_leer on public.toppings
  for select to anon, authenticated using (true);
create policy toppings_crear on public.toppings
  for insert to authenticated with check (true);
create policy toppings_editar on public.toppings
  for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 3. Ventas: el celular (sin login) registra, consulta y anula.
--    No hay política de update: una venta registrada no se puede alterar.
-- ---------------------------------------------------------------------
create policy ventas_leer on public.ventas
  for select to anon, authenticated using (true);
create policy ventas_crear on public.ventas
  for insert to anon, authenticated with check (true);
create policy ventas_anular on public.ventas
  for delete to anon, authenticated using (true);

create policy ventas_toppings_leer on public.ventas_toppings
  for select to anon, authenticated using (true);
create policy ventas_toppings_crear on public.ventas_toppings
  for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------------
-- 4. Total calculado en el servidor.
--    Misma regla que la app: producto + toppings, y si el producto tiene
--    primer_topping se regala el topping más barato (sin contar "helado").
--    (Regla actualizada en regalo-topping-mas-barato.sql.)
--    security definer: las funciones escriben ventas.total aunque el rol
--    anon no tenga permiso de update.
-- ---------------------------------------------------------------------

-- 4a. Al crear la venta: total = precio del producto (los toppings llegan después)
create or replace function public.venta_precio_base()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_precio numeric;
begin
  select precio into v_precio from productos where id = new.producto_id;
  if v_precio is null then
    raise exception 'Producto % no existe', new.producto_id;
  end if;
  new.total := v_precio;
  return new;
end $$;

drop trigger if exists ventas_precio_base on public.ventas;
create trigger ventas_precio_base
  before insert on public.ventas
  for each row execute function public.venta_precio_base();

-- 4b. Cada topping guarda su precio real, no el que envía el celular
create or replace function public.topping_precio_real()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_precio numeric;
begin
  select precio into v_precio from toppings where id = new.topping_id;
  if v_precio is null then
    raise exception 'Topping % no existe', new.topping_id;
  end if;
  new.precio_al_momento := v_precio;
  return new;
end $$;

drop trigger if exists ventas_toppings_precio_real on public.ventas_toppings;
create trigger ventas_toppings_precio_real
  before insert on public.ventas_toppings
  for each row execute function public.topping_precio_real();

-- 4c. Después de insertar toppings: recalcular el total de la venta
create or replace function public.venta_recalcular_total()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update ventas v
  set total = p.precio
            + coalesce((select sum(vt.precio_al_momento)
                        from ventas_toppings vt
                        where vt.venta_id = v.id), 0)
            - case when p.primer_topping then
                coalesce((select min(vt.precio_al_momento)
                          from ventas_toppings vt
                          join toppings tp on tp.id = vt.topping_id
                          where vt.venta_id = v.id
                            and lower(tp.nombre) <> 'helado'), 0)
              else 0 end
  from productos p
  where v.id in (select venta_id from nuevas)
    and p.id = v.producto_id;
  return null;
end $$;

drop trigger if exists ventas_toppings_recalcular on public.ventas_toppings;
create trigger ventas_toppings_recalcular
  after insert on public.ventas_toppings
  referencing new table as nuevas
  for each statement execute function public.venta_recalcular_total();

commit;

-- =====================================================================
-- VERIFICAR (ejecutar después, aparte):
--
--   select tablename, policyname, cmd, roles from pg_policies
--   where schemaname = 'public' order by tablename, policyname;
--
--   -- Haz una venta de prueba desde el celular con toppings y compara:
--   select v.id, v.total, p.nombre, p.precio, p.primer_topping,
--          array_agg(t.nombre || ' ' || vt.precio_al_momento) as toppings
--   from ventas v
--   join productos p on p.id = v.producto_id
--   left join ventas_toppings vt on vt.venta_id = v.id
--   left join toppings t on t.id = vt.topping_id
--   group by v.id, p.nombre, p.precio, p.primer_topping
--   order by v.id desc limit 5;
--
-- DESHACER los triggers si algo sale mal:
--   drop trigger ventas_precio_base on public.ventas;
--   drop trigger ventas_toppings_precio_real on public.ventas_toppings;
--   drop trigger ventas_toppings_recalcular on public.ventas_toppings;
-- =====================================================================
