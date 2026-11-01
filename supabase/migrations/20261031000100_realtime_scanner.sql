-- =============================================================================
--  Gestor Kioscos · autorización del escáner remoto (Supabase Realtime)
--
--  El celular envía códigos de barras por un canal Broadcast PRIVADO y la PC
--  que tiene la Caja abierta los recibe. Topic:
--
--      kiosco:<kiosco_uuid>:scanner:<CODIGO_DE_VINCULACION>
--
--  Esta política garantiza que sólo los miembros de ese kiosco puedan enviar o
--  recibir en el canal (sin ella, cualquiera que conozca el topic podría
--  inyectar productos en el carrito de una caja ajena).
--
--  IMPORTANTE (una sola vez, en el Dashboard):
--    Realtime → Settings → desactivar "Allow public access".
--    Así sólo funcionan canales privados (`config: { private: true }`, que es
--    lo que usa la app) y estas políticas son obligatorias.
--
--  No se ejecuta `alter table realtime.messages enable row level security`:
--  Supabase ya la tiene activa y ese comando falla por permisos.
-- =============================================================================

create or replace function public.puede_usar_canal_scanner(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- El CASE garantiza que el cast a uuid sólo se evalúa si el topic es válido.
    when p_topic ~ '^kiosco:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:scanner:[A-Z0-9]{4,16}$'
      then public.es_miembro(split_part(p_topic, ':', 2)::uuid)
    else false
  end
$$;

revoke all on function public.puede_usar_canal_scanner(text) from public, anon;
grant execute on function public.puede_usar_canal_scanner(text) to authenticated;

-- Recibir (broadcast) y ver quién está conectado (presence).
drop policy if exists "scanner: miembros reciben" on realtime.messages;
create policy "scanner: miembros reciben"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.puede_usar_canal_scanner((select realtime.topic()))
  );

-- Enviar (broadcast) y anunciar presencia (presence).
drop policy if exists "scanner: miembros envían" on realtime.messages;
create policy "scanner: miembros envían"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.puede_usar_canal_scanner((select realtime.topic()))
  );
