-- =============================================================================
--  Gestor Kioscos — resumen de ventas para la pantalla de Reportes
--
--  Devuelve en una sola llamada todos los agregados que necesita la UI:
--    · totales del período (ventas, facturado, descuentos, anuladas)
--    · desglose por medio de pago
--    · top de productos vendidos
--    · serie temporal (por hora si el rango es de hasta 2 días; si no, por día)
--
--  Se calcula en el servidor para no traer miles de filas al celular y para
--  que la zona horaria del kiosco mande en los agrupamientos.
--
--  Re-ejecutable. Correr DESPUÉS de 20261031000000_schema.sql.
-- =============================================================================

create or replace function public.resumen_ventas(
  p_kiosco_id uuid,
  p_desde     timestamptz,
  p_hasta     timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz       text;
  v_por_hora boolean;
  v_res      jsonb;
begin
  if not public.es_miembro(p_kiosco_id) then
    raise exception 'No tenés acceso a este kiosco' using errcode = '42501';
  end if;

  if p_desde is null or p_hasta is null or p_hasta <= p_desde then
    raise exception 'El rango de fechas no es válido' using errcode = '22023';
  end if;

  select k.zona_horaria into v_tz from public.kioscos k where k.id = p_kiosco_id;
  if v_tz is null then
    raise exception 'Kiosco no encontrado' using errcode = 'P0002';
  end if;

  -- Para "Hoy" conviene ver la evolución hora a hora.
  v_por_hora := (p_hasta - p_desde) <= interval '2 days';

  with v as (
    select *
      from public.ventas
     where kiosco_id = p_kiosco_id
       and fecha >= p_desde
       and fecha < p_hasta
  ),
  totales as (
    select
      count(*) filter (where estado = 'completada')                    as cant,
      coalesce(sum(total) filter (where estado = 'completada'), 0)     as total,
      coalesce(sum(descuento) filter (where estado = 'completada'), 0) as descuento,
      count(*) filter (where estado = 'anulada')                       as anul_cant,
      coalesce(sum(total) filter (where estado = 'anulada'), 0)        as anul_total
      from v
  ),
  por_metodo as (
    select coalesce(jsonb_object_agg(metodo, t), '{}'::jsonb) as data
      from (
        select metodo_pago::text as metodo, sum(total) as t
          from v
         where estado = 'completada'
         group by metodo_pago
      ) x
  ),
  top as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('nombre', nombre, 'cantidad', cantidad, 'total', total)
        order by total desc
      ),
      '[]'::jsonb
    ) as data
      from (
        select vi.nombre,
               sum(vi.cantidad)::integer          as cantidad,
               round(sum(vi.subtotal), 2)         as total
          from public.venta_items vi
          join v on v.id = vi.venta_id
         where v.estado = 'completada'
         group by vi.nombre
         order by sum(vi.subtotal) desc
         limit 8
      ) t
  ),
  serie as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bucket',   to_char(bucket, 'YYYY-MM-DD HH24:MI'),
          'total',    total,
          'cantidad', cantidad
        )
        order by bucket
      ),
      '[]'::jsonb
    ) as data
      from (
        select
          case
            when v_por_hora then date_trunc('hour', v.fecha at time zone v_tz)
            else date_trunc('day', v.fecha at time zone v_tz)
          end                            as bucket,
          round(sum(v.total), 2)         as total,
          count(*)::integer              as cantidad
          from v
         where v.estado = 'completada'
         group by 1
      ) s
  )
  select jsonb_build_object(
           'ventas_cantidad',   totales.cant,
           'ventas_total',      totales.total,
           'descuento_total',   totales.descuento,
           'ticket_promedio',   case
                                  when totales.cant > 0
                                    then round(totales.total / totales.cant, 2)
                                  else 0
                                end,
           'anuladas_cantidad', totales.anul_cant,
           'anuladas_total',    totales.anul_total,
           'por_metodo',        por_metodo.data,
           'top_productos',     top.data,
           'serie',             serie.data,
           'por_hora',          v_por_hora
         )
    into v_res
    from totales, por_metodo, top, serie;

  return v_res;
end $$;

revoke all on function public.resumen_ventas(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.resumen_ventas(uuid, timestamptz, timestamptz) to authenticated;
