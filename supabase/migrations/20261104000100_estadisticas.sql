-- =============================================================================
--  Gestor Kioscos — motor de Estadísticas
--
--  Una sola RPC devuelve todos los agregados del período y del período anterior.
--  El frontend nunca descarga ventas: recibe JSON ya agrupado.
--
--  Secciones:
--    totales, comparación, serie temporal, top/menos vendidos, categorías,
--    horas, días, calendario, medios de pago, vendedores, combos, stock,
--    predicción, recomendaciones de compra, pérdidas y fiado pendiente.
--
--  Re-ejecutable. Correr DESPUÉS de 20261104000000_cuaderno.sql.
-- =============================================================================

create index if not exists movimientos_stock_kiosco_tipo_idx
  on public.movimientos_stock (kiosco_id, tipo, created_at desc);

create or replace function public.estadisticas_negocio(
  p_kiosco_id    uuid,
  p_desde        timestamptz,
  p_hasta        timestamptz,
  p_comp_desde   timestamptz default null,
  p_comp_hasta   timestamptz default null,
  p_dias_stock   integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz         text;
  v_span       interval;
  v_gran       text;
  v_comp_desde timestamptz;
  v_comp_hasta timestamptz;
  v_dias       integer := greatest(1, least(coalesce(p_dias_stock, 30), 365));
  v_res        jsonb;
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

  v_span := p_hasta - p_desde;
  v_comp_desde := coalesce(p_comp_desde, p_desde - v_span);
  v_comp_hasta := coalesce(p_comp_hasta, p_desde);

  v_gran := case
    when v_span <= interval '2 days'  then 'hora'
    when v_span <= interval '62 days' then 'dia'
    when v_span <= interval '400 days' then 'semana'
    else 'mes'
  end;

  with v_act as (
    select v.*,
           coalesce(i.unidades, 0)::int as unidades,
           coalesce(i.costo, 0)        as costo
      from public.ventas v
      left join (
        select venta_id,
               sum(cantidad)::int                    as unidades,
               sum(cantidad * costo_unitario)        as costo
          from public.venta_items
         where kiosco_id = p_kiosco_id
         group by venta_id
      ) i on i.venta_id = v.id
     where v.kiosco_id = p_kiosco_id
       and v.fecha >= p_desde and v.fecha < p_hasta
  ),
  v_comp as (
    select v.*,
           coalesce(i.unidades, 0)::int as unidades,
           coalesce(i.costo, 0)        as costo
      from public.ventas v
      left join (
        select venta_id,
               sum(cantidad)::int             as unidades,
               sum(cantidad * costo_unitario) as costo
          from public.venta_items
         where kiosco_id = p_kiosco_id
         group by venta_id
      ) i on i.venta_id = v.id
     where v.kiosco_id = p_kiosco_id
       and v.fecha >= v_comp_desde and v.fecha < v_comp_hasta
  ),
  a as (select * from v_act where estado = 'completada'),
  b as (select * from v_comp where estado = 'completada'),
  ta as (
    select count(*)::int                              as cantidad,
           coalesce(sum(total), 0)                    as total,
           coalesce(sum(subtotal), 0)                 as subtotal,
           coalesce(sum(descuento), 0)                as descuento,
           coalesce(sum(unidades), 0)::int            as unidades,
           coalesce(sum(costo), 0)                    as costo
      from a
  ),
  tb as (
    select count(*)::int                              as cantidad,
           coalesce(sum(total), 0)                    as total,
           coalesce(sum(unidades), 0)::int            as unidades,
           coalesce(sum(costo), 0)                    as costo
      from b
  ),
  anul as (
    select count(*)::int as cantidad, coalesce(sum(total), 0) as total
      from v_act where estado = 'anulada'
  ),
  prod as (
    select vi.producto_id,
           max(vi.nombre) as nombre,
           sum(vi.cantidad)::int as unidades,
           sum(vi.subtotal * case when v.subtotal > 0 then v.total / v.subtotal else 0 end) as facturacion,
           sum(vi.cantidad * vi.costo_unitario) as costo
      from public.venta_items vi
      join a v on v.id = vi.venta_id
     where vi.producto_id is not null
     group by vi.producto_id
  ),
  prod_calc as (
    select p.*,
           p.facturacion - p.costo as ganancia,
           case when p.facturacion > 0
                then round(100 * (p.facturacion - p.costo) / p.facturacion, 1)
                else 0 end as margen
      from prod p
  ),
  ultima_venta as (
    select vi.producto_id, max(v.fecha) as ultima
      from public.venta_items vi
      join public.ventas v on v.id = vi.venta_id
     where v.kiosco_id = p_kiosco_id and v.estado = 'completada'
     group by vi.producto_id
  ),
  bottom as (
    select p.id,
           p.nombre,
           coalesce(nullif(btrim(p.categoria), ''), 'Sin categoría') as categoria,
           p.stock,
           p.stock_minimo,
           coalesce(pc.unidades, 0)::int as unidades,
           uv.ultima as ultima_venta,
           case when uv.ultima is null then null
                else floor(extract(epoch from (now() - uv.ultima)) / 86400)::int
           end as dias_sin_venta
      from public.productos p
      left join prod_calc pc on pc.producto_id = p.id
      left join ultima_venta uv on uv.producto_id = p.id
     where p.kiosco_id = p_kiosco_id and p.activo
     order by coalesce(pc.unidades, 0) asc, uv.ultima asc nulls first
     limit 500
  ),
  categorias as (
    select coalesce(nullif(btrim(p.categoria), ''), 'Sin categoría') as categoria,
           sum(pc.unidades)::int as unidades,
           sum(pc.facturacion) as facturacion,
           sum(pc.costo) as costo,
           sum(pc.ganancia) as ganancia
      from prod_calc pc
      left join public.productos p on p.id = pc.producto_id
     group by 1
  ),
  serie as (
    select to_char(bucket, 'YYYY-MM-DD HH24:MI') as bucket,
           round(sum(total), 2) as total,
           count(*)::int as cantidad,
           coalesce(sum(unidades), 0)::int as unidades,
           round(sum(total - costo), 2) as ganancia
      from (
        select case v_gran
                 when 'hora'   then date_trunc('hour',  fecha at time zone v_tz)
                 when 'dia'    then date_trunc('day',   fecha at time zone v_tz)
                 when 'semana' then date_trunc('week',  fecha at time zone v_tz)
                 else               date_trunc('month', fecha at time zone v_tz)
               end as bucket,
               total, unidades, costo
          from a
      ) s
     group by 1
     order by 1
  ),
  horas as (
    select extract(hour from fecha at time zone v_tz)::int as hora,
           count(*)::int as cantidad,
           round(sum(total), 2) as total,
           coalesce(sum(unidades), 0)::int as unidades,
           round(sum(total - costo), 2) as ganancia
      from a
     group by 1
     order by 1
  ),
  dias as (
    select extract(isodow from fecha at time zone v_tz)::int as dia,
           count(*)::int as cantidad,
           round(sum(total), 2) as total,
           coalesce(sum(unidades), 0)::int as unidades,
           round(sum(total - costo), 2) as ganancia
      from a
     group by 1
     order by 1
  ),
  calendario as (
    select to_char(fecha at time zone v_tz, 'YYYY-MM-DD') as fecha,
           round(sum(total), 2) as total,
           count(*)::int as cantidad,
           coalesce(sum(unidades), 0)::int as unidades
      from a
     group by 1
     order by 1
  ),
  metodos as (
    select case when es_fiado then 'fiado' else metodo_pago::text end as metodo,
           count(*)::int as cantidad,
           round(sum(total), 2) as total,
           case when ta.total > 0 then round(100 * sum(total) / ta.total, 1) else 0 end as porcentaje
      from a, ta
     group by 1, ta.total
     order by total desc
  ),
  vendedores as (
    select a.usuario_id,
           coalesce(u.email, 'Sin usuario') as email,
           count(*)::int as cantidad,
           round(sum(a.total), 2) as total,
           coalesce(sum(a.unidades), 0)::int as unidades,
           case when count(*) > 0 then round(sum(a.total) / count(*), 2) else 0 end as ticket_promedio
      from a
      left join auth.users u on u.id = a.usuario_id
     group by a.usuario_id, u.email
     order by total desc
  ),
  pares as (
    select vi1.producto_id as producto_a,
           max(vi1.nombre) as nombre_a,
           vi2.producto_id as producto_b,
           max(vi2.nombre) as nombre_b,
           count(distinct vi1.venta_id)::int as veces
      from public.venta_items vi1
      join public.venta_items vi2
        on vi2.venta_id = vi1.venta_id
       and vi2.kiosco_id = vi1.kiosco_id
       and vi2.producto_id > vi1.producto_id
      join a v on v.id = vi1.venta_id
     where vi1.kiosco_id = p_kiosco_id
       and vi1.producto_id is not null
       and vi2.producto_id is not null
     group by vi1.producto_id, vi2.producto_id
     order by veces desc
     limit 12
  ),
  precios_act as (
    select vi.producto_id,
           max(vi.nombre) as nombre,
           sum(vi.subtotal) / nullif(sum(vi.cantidad), 0) as precio
      from public.venta_items vi
      join a v on v.id = vi.venta_id
     where vi.producto_id is not null
     group by vi.producto_id
  ),
  precios_comp as (
    select vi.producto_id,
           sum(vi.subtotal) / nullif(sum(vi.cantidad), 0) as precio
      from public.venta_items vi
      join b v on v.id = vi.venta_id
     where vi.producto_id is not null
     group by vi.producto_id
  ),
  precios as (
    select pa.producto_id,
           pa.nombre,
           round(pa.precio, 2) as precio_actual,
           round(pcb.precio, 2) as precio_anterior,
           round(100 * (pa.precio - pcb.precio) / pcb.precio, 1) as variacion
      from precios_act pa
      join precios_comp pcb on pcb.producto_id = pa.producto_id
     where pcb.precio > 0
       and pa.precio <> pcb.precio
     order by abs(pa.precio - pcb.precio) / pcb.precio desc
     limit 50
  ),
  stock_ventas as (
    -- Velocidad reciente independiente del período elegido: así la predicción
    -- de agotamiento no cambia de escala al mirar "hoy" o "mes pasado".
    select vi.producto_id,
           sum(vi.cantidad)::int as unidades
      from public.venta_items vi
      join public.ventas v on v.id = vi.venta_id
     where v.kiosco_id = p_kiosco_id
       and v.estado = 'completada'
       and v.fecha >= p_hasta - make_interval(days => v_dias)
       and v.fecha < p_hasta
     group by vi.producto_id
  ),
  stock_base as (
    select p.id,
           p.nombre,
           coalesce(nullif(btrim(p.categoria), ''), 'Sin categoría') as categoria,
           p.stock,
           p.stock_minimo,
           p.precio_costo,
           p.precio_venta,
           coalesce(sv.unidades, 0)::int as unidades,
           (coalesce(sv.unidades, 0)::numeric / v_dias) as promedio_diario,
           case when coalesce(sv.unidades, 0) > 0
                then round(p.stock / (coalesce(sv.unidades, 0)::numeric / v_dias), 1)
                else null end as dias_stock
      from public.productos p
      left join stock_ventas sv on sv.producto_id = p.id
     where p.kiosco_id = p_kiosco_id and p.activo
  ),
  stock_bajo as (
    select * from stock_base
     where stock > 0 and stock <= stock_minimo
     order by stock asc, nombre asc
     limit 100
  ),
  agotados as (
    select * from stock_base
     where stock <= 0
     order by nombre asc
     limit 100
  ),
  sobre_stock as (
    select * from stock_base
     where promedio_diario > 0
       and stock > promedio_diario * 45
       and stock > stock_minimo * 3
     order by (stock / greatest(promedio_diario, 0.01)) desc
     limit 50
  ),
  prediccion as (
    select * from stock_base
     where stock > 0 and promedio_diario > 0
     order by dias_stock asc
     limit 30
  ),
  recomendaciones as (
    select *,
           greatest(0, ceil(promedio_diario * 7 + greatest(promedio_diario * 3, stock_minimo) - stock))::int as recomendado,
           case
             when stock <= 0 or (dias_stock is not null and dias_stock <= 3) then 'urgente'
             when stock <= stock_minimo or (dias_stock is not null and dias_stock <= 7) then 'proximo'
             else 'considerar'
           end as prioridad
      from stock_base
     where stock <= stock_minimo
        or (promedio_diario > 0 and dias_stock is not null and dias_stock <= 14)
     order by
       case
         when stock <= 0 or (dias_stock is not null and dias_stock <= 3) then 1
         when stock <= stock_minimo or (dias_stock is not null and dias_stock <= 7) then 2
         else 3
       end,
       dias_stock asc nulls last
     limit 50
  ),
  perdidas as (
    select p.nombre,
           coalesce(nullif(btrim(p.categoria), ''), 'Sin categoría') as categoria,
           sum(abs(m.cantidad))::int as unidades,
           round(sum(abs(m.cantidad) * p.precio_costo), 2) as valor
      from public.movimientos_stock m
      join public.productos p on p.id = m.producto_id
     where m.kiosco_id = p_kiosco_id
       and m.tipo = 'ajuste'
       and m.cantidad < 0
       and m.created_at >= p_desde and m.created_at < p_hasta
     group by 1, 2
     order by valor desc
     limit 50
  ),
  fiado as (
    select count(*) filter (where saldo_fiado > 0)::int as clientes,
           coalesce(sum(saldo_fiado) filter (where saldo_fiado > 0), 0) as pendiente
      from public.cuaderno_contactos
     where kiosco_id = p_kiosco_id and tipo = 'cliente' and activo
  ),
  stock_valor as (
    select coalesce(sum(stock * precio_costo), 0) as costo,
           coalesce(sum(stock * precio_venta), 0) as venta
      from public.productos
     where kiosco_id = p_kiosco_id and activo
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object(
      'desde', p_desde, 'hasta', p_hasta,
      'comparacion_desde', v_comp_desde, 'comparacion_hasta', v_comp_hasta,
      'granularidad', v_gran, 'dias_stock', v_dias, 'zona_horaria', v_tz
    ),
    'actual', jsonb_build_object(
      'ventas', ta.cantidad,
      'facturacion', ta.total,
      'subtotal', ta.subtotal,
      'descuentos', ta.descuento,
      'unidades', ta.unidades,
      'costo', ta.costo,
      'ganancia', ta.total - ta.costo,
      'margen', case when ta.total > 0 then round(100 * (ta.total - ta.costo) / ta.total, 1) else 0 end,
      'ticket_promedio', case when ta.cantidad > 0 then round(ta.total / ta.cantidad, 2) else 0 end,
      'anuladas', (select cantidad from anul),
      'anuladas_total', (select total from anul)
    ),
    'anterior', jsonb_build_object(
      'ventas', tb.cantidad,
      'facturacion', tb.total,
      'unidades', tb.unidades,
      'costo', tb.costo,
      'ganancia', tb.total - tb.costo,
      'margen', case when tb.total > 0 then round(100 * (tb.total - tb.costo) / tb.total, 1) else 0 end,
      'ticket_promedio', case when tb.cantidad > 0 then round(tb.total / tb.cantidad, 2) else 0 end
    ),
    'productos_vendidos', coalesce((select jsonb_agg(to_jsonb(pc) order by pc.unidades desc) from prod_calc pc), '[]'::jsonb),
    'top_unidades', coalesce((select jsonb_agg(to_jsonb(x) order by x.unidades desc) from (select * from prod_calc order by unidades desc limit 200) x), '[]'::jsonb),
    'top_facturacion', coalesce((select jsonb_agg(to_jsonb(x) order by x.facturacion desc) from (select * from prod_calc order by facturacion desc limit 50) x), '[]'::jsonb),
    'top_ganancia', coalesce((select jsonb_agg(to_jsonb(x) order by x.ganancia desc) from (select * from prod_calc order by ganancia desc limit 50) x), '[]'::jsonb),
    'top_margen', coalesce((select jsonb_agg(to_jsonb(x) order by x.margen desc) from (select * from prod_calc where unidades >= 2 and facturacion > 0 order by margen desc limit 30) x), '[]'::jsonb),
    'menos_vendidos', coalesce((select jsonb_agg(to_jsonb(x)) from bottom x), '[]'::jsonb),
    'categorias', coalesce((select jsonb_agg(to_jsonb(x) order by x.facturacion desc) from (select * from categorias order by facturacion desc) x), '[]'::jsonb),
    'serie', coalesce((select jsonb_agg(to_jsonb(x) order by x.bucket) from serie x), '[]'::jsonb),
    'horas', coalesce((select jsonb_agg(to_jsonb(x) order by x.hora) from horas x), '[]'::jsonb),
    'dias', coalesce((select jsonb_agg(to_jsonb(x) order by x.dia) from dias x), '[]'::jsonb),
    'calendario', coalesce((select jsonb_agg(to_jsonb(x) order by x.fecha) from calendario x), '[]'::jsonb),
    'metodos', coalesce((select jsonb_agg(to_jsonb(x) order by x.total desc) from metodos x), '[]'::jsonb),
    'vendedores', coalesce((select jsonb_agg(to_jsonb(x) order by x.total desc) from vendedores x), '[]'::jsonb),
    'pares', coalesce((select jsonb_agg(to_jsonb(x) order by x.veces desc) from pares x), '[]'::jsonb),
    'precios', coalesce((select jsonb_agg(to_jsonb(x) order by abs(x.variacion) desc) from precios x), '[]'::jsonb),
    'stock_bajo', coalesce((select jsonb_agg(to_jsonb(x)) from stock_bajo x), '[]'::jsonb),
    'agotados', coalesce((select jsonb_agg(to_jsonb(x)) from agotados x), '[]'::jsonb),
    'sobre_stock', coalesce((select jsonb_agg(to_jsonb(x)) from sobre_stock x), '[]'::jsonb),
    'prediccion', coalesce((select jsonb_agg(to_jsonb(x)) from prediccion x), '[]'::jsonb),
    'recomendaciones', coalesce((select jsonb_agg(to_jsonb(x)) from recomendaciones x), '[]'::jsonb),
    'perdidas', coalesce((select jsonb_agg(to_jsonb(x) order by x.valor desc) from perdidas x), '[]'::jsonb),
    'perdidas_total', coalesce((select sum(valor) from perdidas), 0),
    'fiado', (select to_jsonb(f) from fiado f),
    'stock_valor', (select to_jsonb(s) from stock_valor s)
  )
    into v_res
    from ta, tb;

  return v_res;
end $$;

revoke all on function public.estadisticas_negocio(uuid, timestamptz, timestamptz, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.estadisticas_negocio(uuid, timestamptz, timestamptz, timestamptz, timestamptz, integer) to authenticated;
