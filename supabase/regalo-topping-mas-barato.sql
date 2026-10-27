-- =====================================================================
-- ROSEApp · Productos con primer_topping: se regala el topping MÁS BARATO
-- (antes se regalaba el más caro). "helado" sigue sin contar para el regalo.
--
-- Solo reemplaza la función que recalcula el total. No toca datos:
-- las ventas ya registradas conservan su total; aplica a ventas nuevas.
-- Requiere haber ejecutado antes seguridad-opcion-a.sql.
-- =====================================================================

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

-- Volver a la regla anterior: ejecutar lo mismo cambiando min( por max(
