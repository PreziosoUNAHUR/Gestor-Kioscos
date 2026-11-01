-- =============================================================================
--  Gestor Kioscos — sesiones de vinculación del escáner remoto
--
--  El celular NO necesita conocer el UUID del kiosco: ingresa un código de 6
--  caracteres, la RPC lo resuelve y devuelve el kiosco (sólo si el usuario es
--  miembro). El topic de Realtime sigue siendo:
--
--      kiosco:<kiosco_uuid>:scanner:<CODIGO>
--
--  Además se refuerza `puede_usar_canal_scanner`: ya no alcanza con ser
--  miembro, el código debe existir, estar activo y no vencido.
--
--  Re-ejecutable. Correr DESPUÉS de 20261031000100_realtime_scanner.sql.
-- =============================================================================

create table if not exists public.scanner_sesiones (
  id          uuid primary key default gen_random_uuid(),
  kiosco_id   uuid not null references public.kioscos (id) on delete cascade,
  codigo      text not null check (codigo ~ '^[A-Z0-9]{6}$'),
  activa      boolean not null default true,
  expira_at   timestamptz not null default (now() + interval '12 hours'),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

-- Un código activo a la vez en todo el sistema (evita colisiones entre kioscos).
create unique index if not exists scanner_sesiones_codigo_uq
  on public.scanner_sesiones (codigo) where activa;
create index if not exists scanner_sesiones_kiosco_idx
  on public.scanner_sesiones (kiosco_id, created_at desc);

alter table public.scanner_sesiones enable row level security;
revoke all on table public.scanner_sesiones from anon, authenticated;
grant select on table public.scanner_sesiones to authenticated;

drop policy if exists scanner_sesiones_select on public.scanner_sesiones;
create policy scanner_sesiones_select on public.scanner_sesiones
  for select to authenticated
  using (kiosco_id in (select public.mis_kioscos()));

-- ---------------------------------------------------------------------------
--  RPC: abrir / cerrar / resolver
-- ---------------------------------------------------------------------------

-- Genera un código nuevo y revoca el anterior del mismo kiosco.
create or replace function public.abrir_sesion_scanner(p_kiosco_id uuid)
returns public.scanner_sesiones
language plpgsql security definer set search_path = ''
as $$
declare
  v_codigo  text;
  v_sesion  public.scanner_sesiones;
  v_intento integer := 0;
  v_i       integer;
begin
  if not public.es_miembro(p_kiosco_id) then
    raise exception 'No tenés acceso a este kiosco' using errcode = '42501';
  end if;

  -- Sólo una sesión activa por kiosco (la PC muestra un único código).
  update public.scanner_sesiones
     set activa = false, revoked_at = now()
   where kiosco_id = p_kiosco_id and activa;

  -- Limpieza global de vencidas: libera códigos para el índice único.
  update public.scanner_sesiones
     set activa = false, revoked_at = now()
   where activa and expira_at <= now();

  loop
    v_intento := v_intento + 1;
    v_codigo := '';

    for v_i in 1..6 loop
      -- Alfabeto sin 0/O/1/I/L: se dicta por teléfono sin ambigüedad.
      v_codigo := v_codigo
        || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1);
    end loop;

    exit when not exists (
      select 1 from public.scanner_sesiones s where s.codigo = v_codigo and s.activa
    );

    if v_intento >= 20 then
      raise exception 'No se pudo generar un código único. Intentá de nuevo.' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.scanner_sesiones (kiosco_id, codigo, activa, expira_at, created_by)
  values (p_kiosco_id, v_codigo, true, now() + interval '12 hours', (select auth.uid()))
  returning * into v_sesion;

  return v_sesion;
end $$;

-- Devuelve el kiosco del código activo, o null si no existe / venció / no es miembro.
create or replace function public.resolver_sesion_scanner(p_codigo text)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_kiosco uuid;
begin
  select s.kiosco_id into v_kiosco
    from public.scanner_sesiones s
   where s.codigo = upper(btrim(p_codigo))
     and s.activa
     and s.expira_at > now()
   limit 1;

  if v_kiosco is null then
    return null;
  end if;

  if not public.es_miembro(v_kiosco) then
    return null;
  end if;

  return v_kiosco;
end $$;

create or replace function public.cerrar_sesion_scanner(p_kiosco_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_miembro(p_kiosco_id) then
    raise exception 'No tenés acceso a este kiosco' using errcode = '42501';
  end if;

  update public.scanner_sesiones
     set activa = false, revoked_at = now()
   where kiosco_id = p_kiosco_id and activa;
end $$;

revoke all on function
  public.abrir_sesion_scanner(uuid),
  public.resolver_sesion_scanner(text),
  public.cerrar_sesion_scanner(uuid)
from public, anon;

grant execute on function
  public.abrir_sesion_scanner(uuid),
  public.resolver_sesion_scanner(text),
  public.cerrar_sesion_scanner(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
--  Endurecer la autorización de Realtime
-- ---------------------------------------------------------------------------

-- Reemplaza la versión de 20261031000100: además de pertenecer al kiosco, el
-- código del topic debe corresponder a una sesión activa y vigente.
create or replace function public.puede_usar_canal_scanner(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_topic ~ '^kiosco:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:scanner:[A-Z0-9]{4,16}$'
      then public.es_miembro(split_part(p_topic, ':', 2)::uuid)
       and exists (
         select 1
           from public.scanner_sesiones s
          where s.codigo = split_part(p_topic, ':', 4)
            and s.kiosco_id = split_part(p_topic, ':', 2)::uuid
            and s.activa
            and s.expira_at > now()
       )
    else false
  end
$$;

revoke all on function public.puede_usar_canal_scanner(text) from public, anon;
grant execute on function public.puede_usar_canal_scanner(text) to authenticated;
