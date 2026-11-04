-- =============================================================================
--  Gestor Kioscos — Cuaderno de clientes, fiados y proveedores
--
--  · cuaderno_contactos: clientes y proveedores del kiosco.
--  · cuaderno_movimientos: libro auditable de cargos y pagos de fiado.
--  · ventas.cliente_id / ventas.es_fiado: trazabilidad de ventas fiadas.
--  · registrar_movimiento_cuaderno(): único punto que mueve saldo_fiado.
--  · registrar_venta() se extiende con p_cliente_id para cobrar con Fiado.
--
--  Re-ejecutable. Correr DESPUÉS de 20261031000000_schema.sql.
-- =============================================================================

create table if not exists public.cuaderno_contactos (
  id           uuid primary key default gen_random_uuid(),
  kiosco_id    uuid not null references public.kioscos (id) on delete cascade,
  tipo         text not null check (tipo in ('cliente', 'proveedor')),
  nombre       text not null check (char_length(btrim(nombre)) between 1 and 120),
  telefono     text check (telefono is null or char_length(btrim(telefono)) between 3 and 40),
  saldo_fiado  numeric(12,2) not null default 0,
  notas        text,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists cuaderno_contactos_kiosco_idx
  on public.cuaderno_contactos (kiosco_id, tipo, activo, nombre);

create table if not exists public.cuaderno_movimientos (
  id           uuid primary key default gen_random_uuid(),
  kiosco_id    uuid not null references public.kioscos (id) on delete cascade,
  contacto_id  uuid not null references public.cuaderno_contactos (id) on delete cascade,
  tipo         text not null check (tipo in ('cargo', 'pago', 'ajuste')),
  monto        numeric(12,2) not null check (monto > 0),
  descripcion  text,
  venta_id     uuid references public.ventas (id) on delete set null,
  usuario_id   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists cuaderno_movimientos_contacto_idx
  on public.cuaderno_movimientos (contacto_id, created_at desc);

drop trigger if exists cuaderno_contactos_updated_at on public.cuaderno_contactos;
create trigger cuaderno_contactos_updated_at before update on public.cuaderno_contactos
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Ventas fiadas
-- ---------------------------------------------------------------------------
alter table public.ventas
  add column if not exists cliente_id uuid references public.cuaderno_contactos (id) on delete set null;
alter table public.ventas
  add column if not exists es_fiado boolean not null default false;

create index if not exists ventas_cliente_idx on public.ventas (cliente_id, fecha desc);
create index if not exists ventas_kiosco_estado_fecha_idx on public.ventas (kiosco_id, estado, fecha);
create index if not exists venta_items_kiosco_producto_idx on public.venta_items (kiosco_id, producto_id);

-- ---------------------------------------------------------------------------
-- RPC: mover el saldo del cuaderno (cargo = debe más, pago = debe menos)
-- ---------------------------------------------------------------------------
create or replace function public.registrar_movimiento_cuaderno(
  p_contacto_id uuid,
  p_tipo        text,
  p_monto       numeric,
  p_descripcion text default null
)
returns public.cuaderno_contactos
language plpgsql security definer set search_path = ''
as $$
declare
  v_contacto public.cuaderno_contactos;
  v_monto    numeric(12,2) := round(coalesce(p_monto, 0), 2);
begin
  if p_tipo not in ('cargo', 'pago', 'ajuste') then
    raise exception 'Tipo de movimiento inválido' using errcode = '22023';
  end if;
  if v_monto <= 0 then
    raise exception 'El monto debe ser mayor a cero' using errcode = '22023';
  end if;

  select * into v_contacto
    from public.cuaderno_contactos
   where id = p_contacto_id
   for update;

  if not found or not public.es_miembro(v_contacto.kiosco_id) then
    raise exception 'Contacto no encontrado' using errcode = 'P0002';
  end if;
  if v_contacto.tipo <> 'cliente' then
    raise exception 'Sólo los clientes manejan saldo de fiado' using errcode = '22023';
  end if;

  insert into public.cuaderno_movimientos
    (kiosco_id, contacto_id, tipo, monto, descripcion, usuario_id)
  values
    (v_contacto.kiosco_id, v_contacto.id, p_tipo, v_monto,
     nullif(btrim(coalesce(p_descripcion, '')), ''), (select auth.uid()));

  update public.cuaderno_contactos
     set saldo_fiado = case
           when p_tipo = 'cargo' then saldo_fiado + v_monto
           when p_tipo = 'pago'  then saldo_fiado - v_monto
           else v_monto
         end
   where id = v_contacto.id
  returning * into v_contacto;

  return v_contacto;
end $$;

-- ---------------------------------------------------------------------------
-- registrar_venta con cliente opcional (Fiado)
-- ---------------------------------------------------------------------------
drop function if exists public.registrar_venta(uuid, jsonb, public.metodo_pago, numeric, numeric, text);

create or replace function public.registrar_venta(
  p_kiosco_id      uuid,
  p_items          jsonb,
  p_metodo_pago    public.metodo_pago default 'efectivo',
  p_descuento      numeric default 0,
  p_monto_recibido numeric default null,
  p_notas          text default null,
  p_cliente_id     uuid default null
) returns public.ventas
language plpgsql security definer set search_path = ''
as $$
declare
  v_caja        public.cajas;
  v_venta       public.ventas;
  v_cliente     public.cuaderno_contactos;
  v_pedidos     integer;
  v_encontrados integer;
  v_subtotal    numeric(12,2);
  v_descuento   numeric(12,2) := round(coalesce(p_descuento, 0), 2);
  v_total       numeric(12,2);
  v_recibido    numeric(12,2);
  v_vuelto      numeric(12,2);
  v_numero      bigint;
begin
  if not public.es_miembro(p_kiosco_id) then
    raise exception 'No tenés acceso a este kiosco' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
              where (e ->> 'producto_id') is null
                 or coalesce((e ->> 'cantidad')::integer, 0) <= 0) then
    raise exception 'Cada ítem necesita producto_id y una cantidad mayor a cero' using errcode = '22023';
  end if;
  if v_descuento < 0 then
    raise exception 'El descuento no puede ser negativo' using errcode = '22023';
  end if;

  if p_cliente_id is not null then
    select * into v_cliente
      from public.cuaderno_contactos
     where id = p_cliente_id and kiosco_id = p_kiosco_id and tipo = 'cliente' and activo;
    if not found then
      raise exception 'El cliente de fiado no existe o está inactivo' using errcode = 'P0002';
    end if;
  end if;

  -- `for share`: un cierre de caja concurrente espera a que esta venta termine.
  select * into v_caja from public.cajas
   where kiosco_id = p_kiosco_id and estado = 'abierta' for share;
  if not found then
    raise exception 'No hay una caja abierta. Abrí la caja para vender.' using errcode = 'P0001';
  end if;

  select count(distinct (e ->> 'producto_id')) into v_pedidos from jsonb_array_elements(p_items) e;
  select count(*), coalesce(sum(round(cantidad * precio_unitario, 2)), 0)
    into v_encontrados, v_subtotal
    from public._items_venta(p_kiosco_id, p_items);
  if v_encontrados <> v_pedidos then
    raise exception 'Algún producto no existe o fue dado de baja' using errcode = 'P0001';
  end if;
  if v_descuento > v_subtotal then
    raise exception 'El descuento supera el subtotal' using errcode = 'P0001';
  end if;

  v_total := v_subtotal - v_descuento;

  if p_metodo_pago = 'efectivo' and p_monto_recibido is not null then
    v_recibido := round(p_monto_recibido, 2);
    if v_recibido < v_total then
      raise exception 'El monto recibido es menor al total' using errcode = 'P0001';
    end if;
    v_vuelto := v_recibido - v_total;
  end if;

  -- Numeración correlativa por kiosco, sin huecos ni carreras.
  perform pg_advisory_xact_lock(hashtextextended(p_kiosco_id::text, 42));
  select coalesce(max(v.numero), 0) + 1 into v_numero
    from public.ventas v where v.kiosco_id = p_kiosco_id;

  insert into public.ventas
    (kiosco_id, caja_id, numero, subtotal, descuento, total, metodo_pago,
     monto_recibido, vuelto, usuario_id, notas, cliente_id, es_fiado)
  values
    (p_kiosco_id, v_caja.id, v_numero, v_subtotal, v_descuento, v_total, p_metodo_pago,
     v_recibido, v_vuelto, (select auth.uid()), nullif(btrim(p_notas), ''),
     p_cliente_id, p_cliente_id is not null)
  returning * into v_venta;

  -- El trigger venta_items_stock descuenta stock y escribe el kardex.
  insert into public.venta_items
    (venta_id, kiosco_id, producto_id, nombre, codigo_barras, cantidad, precio_unitario, costo_unitario)
  select v_venta.id, p_kiosco_id, i.producto_id, i.nombre, i.codigo_barras,
         i.cantidad, i.precio_unitario, i.costo_unitario
    from public._items_venta(p_kiosco_id, p_items) i;

  if p_cliente_id is not null then
    update public.cuaderno_contactos
       set saldo_fiado = saldo_fiado + v_total
     where id = p_cliente_id;

    insert into public.cuaderno_movimientos
      (kiosco_id, contacto_id, tipo, monto, descripcion, venta_id, usuario_id)
    values
      (p_kiosco_id, p_cliente_id, 'cargo', v_total,
       'Venta #' || v_numero, v_venta.id, (select auth.uid()));
  end if;

  return v_venta;
end $$;

-- ---------------------------------------------------------------------------
-- resumen_caja: separar Fiado en el desglose por medio de pago
-- ---------------------------------------------------------------------------
create or replace function public.resumen_caja(p_caja_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_caja public.cajas;
  v_res  jsonb;
begin
  select * into v_caja from public.cajas where id = p_caja_id;
  if not found or not public.es_miembro(v_caja.kiosco_id) then
    raise exception 'Caja no encontrada' using errcode = 'P0002';
  end if;

  with v as (
    select metodo_pago, estado, total, es_fiado from public.ventas where caja_id = p_caja_id
  ), vc as (
    select count(*) filter (where estado = 'completada')                              as cant,
           coalesce(sum(total) filter (where estado = 'completada'), 0)               as total,
           coalesce(sum(total) filter (where estado = 'completada'
                                         and metodo_pago = 'efectivo'
                                         and not es_fiado), 0)                        as efectivo,
           coalesce(sum(total) filter (where estado = 'completada' and es_fiado), 0)  as fiado,
           count(*) filter (where estado = 'anulada')                                 as anul_cant,
           coalesce(sum(total) filter (where estado = 'anulada'), 0)                  as anul_total
      from v
  ), pm as (
    select coalesce(jsonb_object_agg(metodo, t), '{}'::jsonb) as por_metodo
      from (
        select case when es_fiado then 'fiado' else metodo_pago::text end as metodo, sum(total) as t
          from v
         where estado = 'completada'
         group by 1
      ) x
  ), g as (
    select coalesce(sum(monto), 0) as total,
           coalesce(sum(monto) filter (where metodo_pago = 'efectivo'), 0) as efectivo
      from public.gastos where caja_id = p_caja_id
  ), c as (
    select coalesce(sum(total), 0) as total,
           coalesce(sum(total) filter (where metodo_pago = 'efectivo'), 0) as efectivo
      from public.compras where caja_id = p_caja_id
  )
  select jsonb_build_object(
           'ventas_cantidad',   vc.cant,
           'ventas_total',      vc.total,
           'ventas_efectivo',   vc.efectivo,
           'ventas_fiado',      vc.fiado,
           'anuladas_cantidad', vc.anul_cant,
           'anuladas_total',    vc.anul_total,
           'por_metodo',        pm.por_metodo,
           'gastos_total',      g.total,
           'gastos_efectivo',   g.efectivo,
           'compras_total',     c.total,
           'compras_efectivo',  c.efectivo,
           'monto_inicial',     v_caja.monto_inicial,
           'efectivo_esperado', v_caja.monto_inicial + vc.efectivo - g.efectivo - c.efectivo
         )
    into v_res
    from vc, pm, g, c;

  return v_res;
end $$;

-- ---------------------------------------------------------------------------
-- RLS y privilegios
-- ---------------------------------------------------------------------------
alter table public.cuaderno_contactos enable row level security;
alter table public.cuaderno_movimientos enable row level security;

revoke all on table public.cuaderno_contactos, public.cuaderno_movimientos from anon, authenticated;

drop policy if exists cuaderno_contactos_select on public.cuaderno_contactos;
create policy cuaderno_contactos_select on public.cuaderno_contactos for select to authenticated
  using (kiosco_id in (select public.mis_kioscos()));

drop policy if exists cuaderno_contactos_insert on public.cuaderno_contactos;
create policy cuaderno_contactos_insert on public.cuaderno_contactos for insert to authenticated
  with check (kiosco_id in (select public.mis_kioscos()));

drop policy if exists cuaderno_contactos_update on public.cuaderno_contactos;
create policy cuaderno_contactos_update on public.cuaderno_contactos for update to authenticated
  using (kiosco_id in (select public.mis_kioscos()))
  with check (kiosco_id in (select public.mis_kioscos()));

drop policy if exists cuaderno_contactos_delete on public.cuaderno_contactos;
create policy cuaderno_contactos_delete on public.cuaderno_contactos for delete to authenticated
  using (kiosco_id in (select public.mis_kioscos_admin()));

drop policy if exists cuaderno_movimientos_select on public.cuaderno_movimientos;
create policy cuaderno_movimientos_select on public.cuaderno_movimientos for select to authenticated
  using (kiosco_id in (select public.mis_kioscos()));

grant select, insert, update, delete on public.cuaderno_contactos to authenticated;
grant select on public.cuaderno_movimientos to authenticated;

revoke all on function public.registrar_movimiento_cuaderno(uuid, text, numeric, text) from public, anon;
grant execute on function public.registrar_movimiento_cuaderno(uuid, text, numeric, text) to authenticated;

revoke all on function public.registrar_venta(uuid, jsonb, public.metodo_pago, numeric, numeric, text, uuid) from public, anon;
grant execute on function public.registrar_venta(uuid, jsonb, public.metodo_pago, numeric, numeric, text, uuid) to authenticated;

revoke all on function public.resumen_caja(uuid) from public, anon;
grant execute on function public.resumen_caja(uuid) to authenticated;

-- Realtime: el saldo del cuaderno se actualiza entre PC y celular.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cuaderno_contactos'
  ) then
    alter publication supabase_realtime add table public.cuaderno_contactos;
  end if;
end $$;
