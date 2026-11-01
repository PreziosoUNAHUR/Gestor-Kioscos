-- =============================================================================
--  Gestor Kioscos · esquema inicial (Postgres / Supabase)
--
--  Cómo correrlo: Supabase Dashboard → SQL Editor → pegar y ejecutar
--  (o `supabase db push`). Es re-ejecutable. Después correr
--  20261031000100_realtime_scanner.sql (autorización del escáner remoto).
--
--  Modelo multi-kiosco:
--    kioscos ─┬─ kiosco_miembros (usuarios del kiosco)
--             ├─ productos ── movimientos_stock (kardex)
--             ├─ cajas (turnos) ─┬─ ventas ── venta_items
--             │                  ├─ gastos
--             │                  └─ compras ── compra_items
--
--  Seguridad:
--    · RLS en todas las tablas: sólo ven/tocan filas de SUS kioscos.
--    · Las operaciones críticas (vender, anular, abrir/cerrar caja, comprar,
--      ajustar stock) son RPC atómicas: el servidor calcula precios y totales,
--      el cliente nunca los dicta.
--    · `productos.stock` NO es editable desde el cliente (permiso por columna):
--      sólo cambia vía ventas/compras/ajustes, y todo queda en movimientos_stock.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------------
do $$ begin create type public.rol_miembro    as enum ('owner', 'admin', 'cajero');
exception when duplicate_object then null; end $$;
do $$ begin create type public.metodo_pago    as enum ('efectivo', 'debito', 'credito', 'transferencia', 'qr', 'otro');
exception when duplicate_object then null; end $$;
do $$ begin create type public.estado_venta   as enum ('completada', 'anulada');
exception when duplicate_object then null; end $$;
do $$ begin create type public.estado_caja    as enum ('abierta', 'cerrada');
exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_mov_stock as enum ('inicial', 'venta', 'anulacion', 'compra', 'ajuste');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------------
create table if not exists public.kioscos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (char_length(btrim(nombre)) between 1 and 80),
  moneda        text not null default 'ARS' check (moneda ~ '^[A-Z]{3}$'),
  zona_horaria  text not null default 'America/Argentina/Buenos_Aires',
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.kiosco_miembros (
  kiosco_id   uuid not null references public.kioscos (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  rol         public.rol_miembro not null default 'cajero',
  created_at  timestamptz not null default now(),
  primary key (kiosco_id, user_id)
);
create index if not exists kiosco_miembros_user_idx on public.kiosco_miembros (user_id);

create table if not exists public.productos (
  id             uuid primary key default gen_random_uuid(),
  kiosco_id      uuid not null references public.kioscos (id) on delete cascade,
  codigo_barras  text check (codigo_barras is null or char_length(btrim(codigo_barras)) > 0),
  sku            text,
  nombre         text not null check (char_length(btrim(nombre)) between 1 and 120),
  categoria      text,
  precio_costo   numeric(12,2) not null default 0 check (precio_costo >= 0),
  precio_venta   numeric(12,2) not null check (precio_venta >= 0),
  -- Puede quedar negativo: en un kiosco el stock cargado casi nunca es exacto y
  -- bloquear una venta por eso es peor que registrar el "quiebre" (alerta roja).
  stock          integer not null default 0,
  stock_minimo   integer not null default 5 check (stock_minimo >= 0),
  activo         boolean not null default true,  -- baja lógica: conserva historial
  imagen_url     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Un código de barras activo por kiosco (permite recrearlo tras una baja).
create unique index if not exists productos_barcode_uq
  on public.productos (kiosco_id, codigo_barras) where codigo_barras is not null and activo;
create index if not exists productos_nombre_idx on public.productos (kiosco_id, lower(nombre));

-- Turnos de caja. Una sola caja abierta por kiosco (PC y celular comparten cajón).
create table if not exists public.cajas (
  id                 uuid primary key default gen_random_uuid(),
  kiosco_id          uuid not null references public.kioscos (id) on delete cascade,
  estado             public.estado_caja not null default 'abierta',
  fecha_apertura     timestamptz not null default now(),
  fecha_cierre       timestamptz,
  monto_inicial      numeric(12,2) not null default 0 check (monto_inicial >= 0),
  -- Foto del cierre (se completa en cerrar_caja):
  efectivo_esperado  numeric(12,2),
  efectivo_contado   numeric(12,2) check (efectivo_contado is null or efectivo_contado >= 0),
  diferencia         numeric(12,2),
  resumen            jsonb,
  notas_cierre       text,
  abierta_por        uuid default auth.uid() references auth.users (id) on delete set null,
  cerrada_por        uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint cajas_cierre_coherente check (
    (estado = 'abierta' and fecha_cierre is null) or (estado = 'cerrada' and fecha_cierre is not null)
  )
);
create unique index if not exists cajas_una_abierta_por_kiosco
  on public.cajas (kiosco_id) where estado = 'abierta';
create index if not exists cajas_kiosco_apertura_idx on public.cajas (kiosco_id, fecha_apertura desc);

create table if not exists public.ventas (
  id               uuid primary key default gen_random_uuid(),
  kiosco_id        uuid not null references public.kioscos (id) on delete cascade,
  caja_id          uuid not null references public.cajas (id),
  numero           bigint not null,                       -- N° de ticket por kiosco
  fecha            timestamptz not null default now(),
  subtotal         numeric(12,2) not null check (subtotal >= 0),
  descuento        numeric(12,2) not null default 0 check (descuento >= 0),
  total            numeric(12,2) not null check (total >= 0),
  metodo_pago      public.metodo_pago not null default 'efectivo',
  monto_recibido   numeric(12,2) check (monto_recibido is null or monto_recibido >= 0),
  vuelto           numeric(12,2) check (vuelto is null or vuelto >= 0),
  estado           public.estado_venta not null default 'completada',
  anulada_at       timestamptz,
  anulada_por      uuid references auth.users (id) on delete set null,
  motivo_anulacion text,
  usuario_id       uuid default auth.uid() references auth.users (id) on delete set null,
  notas            text,
  created_at       timestamptz not null default now(),
  constraint ventas_total_coherente check (total = subtotal - descuento),
  constraint ventas_numero_uq unique (kiosco_id, numero)
);
create index if not exists ventas_kiosco_fecha_idx on public.ventas (kiosco_id, fecha desc);
create index if not exists ventas_caja_idx on public.ventas (caja_id);

create table if not exists public.venta_items (
  id               uuid primary key default gen_random_uuid(),
  venta_id         uuid not null references public.ventas (id) on delete cascade,
  kiosco_id        uuid not null references public.kioscos (id) on delete cascade,
  producto_id      uuid references public.productos (id) on delete set null,
  -- Snapshot: el ticket no cambia si después se edita el producto.
  nombre           text not null,
  codigo_barras    text,
  cantidad         integer not null check (cantidad > 0),
  precio_unitario  numeric(12,2) not null check (precio_unitario >= 0),
  costo_unitario   numeric(12,2) not null default 0 check (costo_unitario >= 0),
  subtotal         numeric(12,2) generated always as (cantidad * precio_unitario) stored
);
create index if not exists venta_items_venta_idx on public.venta_items (venta_id);
create index if not exists venta_items_producto_idx on public.venta_items (producto_id);

create table if not exists public.compras (
  id           uuid primary key default gen_random_uuid(),
  kiosco_id    uuid not null references public.kioscos (id) on delete cascade,
  caja_id      uuid references public.cajas (id),         -- turno abierto al registrarla
  fecha        timestamptz not null default now(),
  proveedor    text,
  comprobante  text,
  metodo_pago  public.metodo_pago not null default 'efectivo',
  total        numeric(12,2) not null check (total >= 0),
  notas        text,
  usuario_id   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists compras_kiosco_fecha_idx on public.compras (kiosco_id, fecha desc);
create index if not exists compras_caja_idx on public.compras (caja_id);

create table if not exists public.compra_items (
  id              uuid primary key default gen_random_uuid(),
  compra_id       uuid not null references public.compras (id) on delete cascade,
  kiosco_id       uuid not null references public.kioscos (id) on delete cascade,
  producto_id     uuid references public.productos (id) on delete set null,
  nombre          text not null,
  cantidad        integer not null check (cantidad > 0),
  costo_unitario  numeric(12,2) not null check (costo_unitario >= 0),
  subtotal        numeric(12,2) generated always as (cantidad * costo_unitario) stored
);
create index if not exists compra_items_compra_idx on public.compra_items (compra_id);

create table if not exists public.gastos (
  id           uuid primary key default gen_random_uuid(),
  kiosco_id    uuid not null references public.kioscos (id) on delete cascade,
  caja_id      uuid references public.cajas (id),         -- lo asigna el servidor
  fecha        timestamptz not null default now(),
  categoria    text not null default 'otros',
  concepto     text not null check (char_length(btrim(concepto)) > 0),
  monto        numeric(12,2) not null check (monto > 0),
  metodo_pago  public.metodo_pago not null default 'efectivo',
  comprobante  text,
  notas        text,
  usuario_id   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists gastos_kiosco_fecha_idx on public.gastos (kiosco_id, fecha desc);
create index if not exists gastos_caja_idx on public.gastos (caja_id);

-- Kardex: toda variación de stock deja rastro (altas, ventas, anulaciones, ajustes).
create table if not exists public.movimientos_stock (
  id                uuid primary key default gen_random_uuid(),
  kiosco_id         uuid not null references public.kioscos (id) on delete cascade,
  producto_id       uuid not null references public.productos (id) on delete cascade,
  tipo              public.tipo_mov_stock not null,
  cantidad          integer not null,              -- + entra / − sale
  stock_resultante  integer not null,
  referencia_id     uuid,                          -- venta_id o compra_id
  motivo            text,
  usuario_id        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists movimientos_stock_producto_idx
  on public.movimientos_stock (producto_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Helpers de pertenencia (SECURITY DEFINER para evitar recursión de RLS)
-- ---------------------------------------------------------------------------
create or replace function public.mis_kioscos()
returns setof uuid language sql stable security definer set search_path = ''
as $$ select m.kiosco_id from public.kiosco_miembros m where m.user_id = (select auth.uid()) $$;

create or replace function public.mis_kioscos_admin()
returns setof uuid language sql stable security definer set search_path = ''
as $$ select m.kiosco_id from public.kiosco_miembros m
      where m.user_id = (select auth.uid()) and m.rol in ('owner', 'admin') $$;

create or replace function public.mis_kioscos_owner()
returns setof uuid language sql stable security definer set search_path = ''
as $$ select m.kiosco_id from public.kiosco_miembros m
      where m.user_id = (select auth.uid()) and m.rol = 'owner' $$;

create or replace function public.es_miembro(p_kiosco_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.kiosco_miembros m
                     where m.kiosco_id = p_kiosco_id and m.user_id = (select auth.uid())) $$;

create or replace function public.es_admin(p_kiosco_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.kiosco_miembros m
                     where m.kiosco_id = p_kiosco_id and m.user_id = (select auth.uid())
                       and m.rol in ('owner', 'admin')) $$;

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists kioscos_updated_at on public.kioscos;
create trigger kioscos_updated_at before update on public.kioscos
  for each row execute function public.tg_set_updated_at();

drop trigger if exists productos_updated_at on public.productos;
create trigger productos_updated_at before update on public.productos
  for each row execute function public.tg_set_updated_at();

-- Único punto por el que cambia el stock: aplica el delta y deja el kardex.
create or replace function public._aplicar_stock(
  p_producto_id uuid, p_delta integer, p_tipo public.tipo_mov_stock,
  p_referencia uuid, p_motivo text
) returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_kiosco uuid;
  v_stock  integer;
begin
  update public.productos set stock = stock + p_delta
   where id = p_producto_id
  returning kiosco_id, stock into v_kiosco, v_stock;

  if not found then
    return null;
  end if;

  insert into public.movimientos_stock
    (kiosco_id, producto_id, tipo, cantidad, stock_resultante, referencia_id, motivo)
  values (v_kiosco, p_producto_id, p_tipo, p_delta, v_stock, p_referencia, p_motivo);

  return v_stock;
end $$;

create or replace function public.tg_producto_stock_inicial()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.stock <> 0 then
    insert into public.movimientos_stock
      (kiosco_id, producto_id, tipo, cantidad, stock_resultante, motivo)
    values (new.kiosco_id, new.id, 'inicial', new.stock, new.stock, 'Alta de producto');
  end if;
  return new;
end $$;

drop trigger if exists productos_stock_inicial on public.productos;
create trigger productos_stock_inicial after insert on public.productos
  for each row execute function public.tg_producto_stock_inicial();

create or replace function public.tg_venta_item_stock()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.producto_id is not null then
    perform public._aplicar_stock(new.producto_id, -new.cantidad, 'venta', new.venta_id, null);
  end if;
  return new;
end $$;

drop trigger if exists venta_items_stock on public.venta_items;
create trigger venta_items_stock after insert on public.venta_items
  for each row execute function public.tg_venta_item_stock();

create or replace function public.tg_compra_item_stock()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.producto_id is not null then
    perform public._aplicar_stock(new.producto_id, new.cantidad, 'compra', new.compra_id, null);
    -- El último costo de compra pasa a ser el costo vigente del producto.
    if new.costo_unitario > 0 then
      update public.productos set precio_costo = new.costo_unitario where id = new.producto_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists compra_items_stock on public.compra_items;
create trigger compra_items_stock after insert on public.compra_items
  for each row execute function public.tg_compra_item_stock();

-- Gastos y compras se vinculan SIEMPRE al turno abierto (el cliente no lo dicta).
create or replace function public.tg_asignar_caja_abierta()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select c.id into new.caja_id
    from public.cajas c
   where c.kiosco_id = new.kiosco_id and c.estado = 'abierta';
  return new;
end $$;

drop trigger if exists gastos_asignar_caja on public.gastos;
create trigger gastos_asignar_caja before insert on public.gastos
  for each row execute function public.tg_asignar_caja_abierta();

drop trigger if exists compras_asignar_caja on public.compras;
create trigger compras_asignar_caja before insert on public.compras
  for each row execute function public.tg_asignar_caja_abierta();

-- ---------------------------------------------------------------------------
-- 5. RPC (operaciones atómicas)
-- ---------------------------------------------------------------------------

-- Crea el kiosco y deja al usuario actual como owner.
create or replace function public.crear_kiosco(
  p_nombre text,
  p_moneda text default 'ARS',
  p_zona_horaria text default 'America/Argentina/Buenos_Aires'
) returns public.kioscos
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_kiosco public.kioscos;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '28000';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_zona_horaria) then
    raise exception 'Zona horaria inválida: %', p_zona_horaria using errcode = '22023';
  end if;

  insert into public.kioscos (nombre, moneda, zona_horaria, created_by)
  values (btrim(p_nombre), upper(p_moneda), p_zona_horaria, v_uid)
  returning * into v_kiosco;

  insert into public.kiosco_miembros (kiosco_id, user_id, rol)
  values (v_kiosco.id, v_uid, 'owner');

  return v_kiosco;
end $$;

create or replace function public.abrir_caja(p_kiosco_id uuid, p_monto_inicial numeric default 0)
returns public.cajas
language plpgsql security definer set search_path = ''
as $$
declare
  v_caja public.cajas;
begin
  if not public.es_miembro(p_kiosco_id) then
    raise exception 'No tenés acceso a este kiosco' using errcode = '42501';
  end if;
  if coalesce(p_monto_inicial, 0) < 0 then
    raise exception 'El monto inicial no puede ser negativo' using errcode = '22023';
  end if;

  insert into public.cajas (kiosco_id, monto_inicial, abierta_por)
  values (p_kiosco_id, round(coalesce(p_monto_inicial, 0), 2), (select auth.uid()))
  returning * into v_caja;

  return v_caja;
exception
  when unique_violation then
    raise exception 'Ya hay una caja abierta en este kiosco' using errcode = '23505';
end $$;

-- Ítems de venta normalizados contra el catálogo: agrupa repetidos y toma
-- precio/costo/nombre de la base (nunca del cliente).
create or replace function public._items_venta(p_kiosco_id uuid, p_items jsonb)
returns table (
  producto_id uuid, cantidad integer, nombre text, codigo_barras text,
  precio_unitario numeric, costo_unitario numeric
)
language sql stable security definer set search_path = ''
as $$
  select p.id, i.cantidad::integer, p.nombre, p.codigo_barras, p.precio_venta, p.precio_costo
    from (
      select (e ->> 'producto_id')::uuid as producto_id,
             sum((e ->> 'cantidad')::integer) as cantidad
        from jsonb_array_elements(p_items) as e
       group by 1
    ) i
    join public.productos p
      on p.id = i.producto_id and p.kiosco_id = p_kiosco_id and p.activo
$$;

-- p_items: [{ "producto_id": "<uuid>", "cantidad": 2 }, ...]
create or replace function public.registrar_venta(
  p_kiosco_id      uuid,
  p_items          jsonb,
  p_metodo_pago    public.metodo_pago default 'efectivo',
  p_descuento      numeric default 0,
  p_monto_recibido numeric default null,
  p_notas          text default null
) returns public.ventas
language plpgsql security definer set search_path = ''
as $$
declare
  v_caja        public.cajas;
  v_venta       public.ventas;
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
     monto_recibido, vuelto, usuario_id, notas)
  values
    (p_kiosco_id, v_caja.id, v_numero, v_subtotal, v_descuento, v_total, p_metodo_pago,
     v_recibido, v_vuelto, (select auth.uid()), nullif(btrim(p_notas), ''))
  returning * into v_venta;

  -- El trigger venta_items_stock descuenta stock y escribe el kardex.
  insert into public.venta_items
    (venta_id, kiosco_id, producto_id, nombre, codigo_barras, cantidad, precio_unitario, costo_unitario)
  select v_venta.id, p_kiosco_id, i.producto_id, i.nombre, i.codigo_barras,
         i.cantidad, i.precio_unitario, i.costo_unitario
    from public._items_venta(p_kiosco_id, p_items) i;

  return v_venta;
end $$;

create or replace function public.anular_venta(p_venta_id uuid, p_motivo text)
returns public.ventas
language plpgsql security definer set search_path = ''
as $$
declare
  v_venta  public.ventas;
  v_estado public.estado_caja;
  v_item   record;
begin
  select * into v_venta from public.ventas where id = p_venta_id for update;
  if not found or not public.es_miembro(v_venta.kiosco_id) then
    raise exception 'Venta no encontrada' using errcode = 'P0002';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta ya está anulada' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Indicá el motivo de la anulación' using errcode = '22023';
  end if;

  select estado into v_estado from public.cajas where id = v_venta.caja_id for share;
  if v_estado <> 'abierta' then
    raise exception 'No se puede anular una venta de una caja ya cerrada' using errcode = 'P0001';
  end if;

  update public.ventas
     set estado = 'anulada', anulada_at = now(), anulada_por = (select auth.uid()),
         motivo_anulacion = btrim(p_motivo)
   where id = p_venta_id
  returning * into v_venta;

  for v_item in
    select producto_id, cantidad from public.venta_items
     where venta_id = p_venta_id and producto_id is not null
  loop
    perform public._aplicar_stock(v_item.producto_id, v_item.cantidad, 'anulacion', p_venta_id, btrim(p_motivo));
  end loop;

  return v_venta;
end $$;

-- p_items: [{ "producto_id": "<uuid>", "cantidad": 12, "costo_unitario": 850.5 }, ...]
create or replace function public.registrar_compra(
  p_kiosco_id   uuid,
  p_items       jsonb,
  p_proveedor   text default null,
  p_metodo_pago public.metodo_pago default 'efectivo',
  p_comprobante text default null,
  p_notas       text default null
) returns public.compras
language plpgsql security definer set search_path = ''
as $$
declare
  v_compra      public.compras;
  v_pedidos     integer;
  v_encontrados integer;
  v_total       numeric(12,2);
begin
  if not public.es_miembro(p_kiosco_id) then
    raise exception 'No tenés acceso a este kiosco' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La compra no tiene productos' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
              where (e ->> 'producto_id') is null
                 or coalesce((e ->> 'cantidad')::integer, 0) <= 0
                 or coalesce((e ->> 'costo_unitario')::numeric, -1) < 0) then
    raise exception 'Cada ítem necesita producto_id, cantidad > 0 y costo_unitario >= 0' using errcode = '22023';
  end if;

  select count(*) into v_pedidos from jsonb_array_elements(p_items);
  select count(*), coalesce(sum(round((e ->> 'cantidad')::integer * (e ->> 'costo_unitario')::numeric, 2)), 0)
    into v_encontrados, v_total
    from jsonb_array_elements(p_items) e
    join public.productos p
      on p.id = (e ->> 'producto_id')::uuid and p.kiosco_id = p_kiosco_id and p.activo;
  if v_encontrados <> v_pedidos then
    raise exception 'Algún producto no existe o fue dado de baja' using errcode = 'P0001';
  end if;

  insert into public.compras (kiosco_id, proveedor, comprobante, metodo_pago, total, notas, usuario_id)
  values (p_kiosco_id, nullif(btrim(p_proveedor), ''), nullif(btrim(p_comprobante), ''),
          p_metodo_pago, v_total, nullif(btrim(p_notas), ''), (select auth.uid()))
  returning * into v_compra;

  -- El trigger compra_items_stock suma stock y actualiza el costo vigente.
  insert into public.compra_items (compra_id, kiosco_id, producto_id, nombre, cantidad, costo_unitario)
  select v_compra.id, p_kiosco_id, p.id, p.nombre,
         (e ->> 'cantidad')::integer, round((e ->> 'costo_unitario')::numeric, 2)
    from jsonb_array_elements(p_items) e
    join public.productos p
      on p.id = (e ->> 'producto_id')::uuid and p.kiosco_id = p_kiosco_id and p.activo;

  return v_compra;
end $$;

create or replace function public.ajustar_stock(
  p_producto_id uuid, p_stock_nuevo integer, p_motivo text default null
) returns public.productos
language plpgsql security definer set search_path = ''
as $$
declare
  v_prod public.productos;
begin
  select * into v_prod from public.productos where id = p_producto_id for update;
  if not found or not public.es_miembro(v_prod.kiosco_id) then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;
  if p_stock_nuevo is null then
    raise exception 'Indicá el stock nuevo' using errcode = '22023';
  end if;

  if p_stock_nuevo <> v_prod.stock then
    perform public._aplicar_stock(
      p_producto_id, p_stock_nuevo - v_prod.stock, 'ajuste', null, nullif(btrim(p_motivo), '')
    );
  end if;

  select * into v_prod from public.productos where id = p_producto_id;
  return v_prod;
end $$;

-- Resumen de un turno (en vivo para la pantalla de cierre y foto al cerrar).
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
    select metodo_pago, estado, total from public.ventas where caja_id = p_caja_id
  ), vc as (
    select count(*) filter (where estado = 'completada')                              as cant,
           coalesce(sum(total) filter (where estado = 'completada'), 0)               as total,
           coalesce(sum(total) filter (where estado = 'completada'
                                         and metodo_pago = 'efectivo'), 0)            as efectivo,
           count(*) filter (where estado = 'anulada')                                 as anul_cant,
           coalesce(sum(total) filter (where estado = 'anulada'), 0)                  as anul_total
      from v
  ), pm as (
    select coalesce(jsonb_object_agg(metodo_pago, t), '{}'::jsonb) as por_metodo
      from (select metodo_pago, sum(total) as t from v
             where estado = 'completada' group by metodo_pago) x
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

create or replace function public.cerrar_caja(
  p_caja_id uuid, p_efectivo_contado numeric, p_notas text default null
) returns public.cajas
language plpgsql security definer set search_path = ''
as $$
declare
  v_caja     public.cajas;
  v_res      jsonb;
  v_esperado numeric(12,2);
  v_contado  numeric(12,2) := round(p_efectivo_contado, 2);
begin
  select * into v_caja from public.cajas where id = p_caja_id for update;
  if not found or not public.es_miembro(v_caja.kiosco_id) then
    raise exception 'Caja no encontrada' using errcode = 'P0002';
  end if;
  if v_caja.estado <> 'abierta' then
    raise exception 'La caja ya está cerrada' using errcode = 'P0001';
  end if;
  if v_contado is null or v_contado < 0 then
    raise exception 'Indicá el efectivo contado' using errcode = '22023';
  end if;

  v_res      := public.resumen_caja(p_caja_id);
  v_esperado := (v_res ->> 'efectivo_esperado')::numeric;

  update public.cajas
     set estado = 'cerrada', fecha_cierre = now(),
         efectivo_esperado = v_esperado, efectivo_contado = v_contado,
         diferencia = v_contado - v_esperado, resumen = v_res,
         notas_cierre = nullif(btrim(p_notas), ''), cerrada_por = (select auth.uid())
   where id = p_caja_id
  returning * into v_caja;

  return v_caja;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'kioscos', 'kiosco_miembros', 'productos', 'cajas', 'ventas', 'venta_items',
    'compras', 'compra_items', 'gastos', 'movimientos_stock'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Se parte de cero: nada para anon, y sólo lo necesario para authenticated.
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- kioscos
drop policy if exists kioscos_select on public.kioscos;
create policy kioscos_select on public.kioscos for select to authenticated
  using (id in (select public.mis_kioscos()));
drop policy if exists kioscos_update on public.kioscos;
create policy kioscos_update on public.kioscos for update to authenticated
  using (id in (select public.mis_kioscos_admin()))
  with check (id in (select public.mis_kioscos_admin()));

-- kiosco_miembros (sólo el owner gestiona el equipo)
drop policy if exists miembros_select on public.kiosco_miembros;
create policy miembros_select on public.kiosco_miembros for select to authenticated
  using (kiosco_id in (select public.mis_kioscos()));
drop policy if exists miembros_insert on public.kiosco_miembros;
create policy miembros_insert on public.kiosco_miembros for insert to authenticated
  with check (kiosco_id in (select public.mis_kioscos_owner()));
drop policy if exists miembros_update on public.kiosco_miembros;
create policy miembros_update on public.kiosco_miembros for update to authenticated
  using (kiosco_id in (select public.mis_kioscos_owner()))
  with check (kiosco_id in (select public.mis_kioscos_owner()));
drop policy if exists miembros_delete on public.kiosco_miembros;
create policy miembros_delete on public.kiosco_miembros for delete to authenticated
  using (kiosco_id in (select public.mis_kioscos_owner()));

-- productos
drop policy if exists productos_select on public.productos;
create policy productos_select on public.productos for select to authenticated
  using (kiosco_id in (select public.mis_kioscos()));
drop policy if exists productos_insert on public.productos;
create policy productos_insert on public.productos for insert to authenticated
  with check (kiosco_id in (select public.mis_kioscos()));
drop policy if exists productos_update on public.productos;
create policy productos_update on public.productos for update to authenticated
  using (kiosco_id in (select public.mis_kioscos()))
  with check (kiosco_id in (select public.mis_kioscos()));
drop policy if exists productos_delete on public.productos;
create policy productos_delete on public.productos for delete to authenticated
  using (kiosco_id in (select public.mis_kioscos_admin()));

-- gastos
drop policy if exists gastos_select on public.gastos;
create policy gastos_select on public.gastos for select to authenticated
  using (kiosco_id in (select public.mis_kioscos()));
drop policy if exists gastos_insert on public.gastos;
create policy gastos_insert on public.gastos for insert to authenticated
  with check (kiosco_id in (select public.mis_kioscos()));
drop policy if exists gastos_update on public.gastos;
create policy gastos_update on public.gastos for update to authenticated
  using (kiosco_id in (select public.mis_kioscos_admin()))
  with check (kiosco_id in (select public.mis_kioscos_admin()));
drop policy if exists gastos_delete on public.gastos;
create policy gastos_delete on public.gastos for delete to authenticated
  using (kiosco_id in (select public.mis_kioscos_admin()));

-- Sólo lectura desde el cliente (se escriben vía RPC / triggers):
do $$
declare t text;
begin
  foreach t in array array[
    'cajas', 'ventas', 'venta_items', 'compras', 'compra_items', 'movimientos_stock'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (kiosco_id in (select public.mis_kioscos()))',
      t || '_select', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Privilegios (explícitos, por si el proyecto no concede grants por defecto)
-- ---------------------------------------------------------------------------
grant select on
  public.kioscos, public.kiosco_miembros, public.productos, public.cajas,
  public.ventas, public.venta_items, public.compras, public.compra_items,
  public.gastos, public.movimientos_stock
to authenticated;

grant update (nombre, moneda, zona_horaria) on public.kioscos to authenticated;
grant insert, update, delete on public.kiosco_miembros to authenticated;

grant insert, delete on public.productos to authenticated;
-- `stock` queda fuera a propósito: sólo cambia vía ventas, compras y ajustar_stock().
grant update (codigo_barras, sku, nombre, categoria, precio_costo, precio_venta,
              stock_minimo, activo, imagen_url)
  on public.productos to authenticated;

grant insert (kiosco_id, fecha, categoria, concepto, monto, metodo_pago, comprobante, notas)
  on public.gastos to authenticated;
grant update (fecha, categoria, concepto, monto, metodo_pago, comprobante, notas)
  on public.gastos to authenticated;
grant delete on public.gastos to authenticated;

-- Helpers de RLS: los usan las políticas, así que authenticated debe poder ejecutarlos.
revoke all on function public.mis_kioscos(), public.mis_kioscos_admin(), public.mis_kioscos_owner(),
  public.es_miembro(uuid), public.es_admin(uuid) from public, anon;
grant execute on function public.mis_kioscos(), public.mis_kioscos_admin(), public.mis_kioscos_owner(),
  public.es_miembro(uuid), public.es_admin(uuid) to authenticated;

-- RPC expuestas a la app.
revoke all on function
  public.crear_kiosco(text, text, text),
  public.abrir_caja(uuid, numeric),
  public.cerrar_caja(uuid, numeric, text),
  public.resumen_caja(uuid),
  public.registrar_venta(uuid, jsonb, public.metodo_pago, numeric, numeric, text),
  public.anular_venta(uuid, text),
  public.registrar_compra(uuid, jsonb, text, public.metodo_pago, text, text),
  public.ajustar_stock(uuid, integer, text)
from public, anon;
grant execute on function
  public.crear_kiosco(text, text, text),
  public.abrir_caja(uuid, numeric),
  public.cerrar_caja(uuid, numeric, text),
  public.resumen_caja(uuid),
  public.registrar_venta(uuid, jsonb, public.metodo_pago, numeric, numeric, text),
  public.anular_venta(uuid, text),
  public.registrar_compra(uuid, jsonb, text, public.metodo_pago, text, text),
  public.ajustar_stock(uuid, integer, text)
to authenticated;

-- Internas: ni siquiera usuarios autenticados pueden invocarlas directamente.
revoke all on function
  public._aplicar_stock(uuid, integer, public.tipo_mov_stock, uuid, text),
  public._items_venta(uuid, jsonb)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Realtime (Postgres Changes): stock y estado de caja en vivo entre dispositivos
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['productos', 'cajas'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
