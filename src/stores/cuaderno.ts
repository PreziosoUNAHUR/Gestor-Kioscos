import { create } from 'zustand';

import type { CuadernoContactoRow, TipoCuaderno, TipoMovCuaderno } from '@/lib/database.types';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const CONTACTO_COLUMNS =
  'id,kiosco_id,tipo,nombre,telefono,saldo_fiado,notas,activo,created_at,updated_at';

type NuevoContacto = {
  tipo: TipoCuaderno;
  nombre: string;
  telefono?: string | null;
  notas?: string | null;
};

type CuadernoState = {
  kioscoId: string | null;
  items: CuadernoContactoRow[];
  loading: boolean;
  loaded: boolean;
  error: string | null;

  load: (kioscoId: string, options?: { force?: boolean }) => Promise<void>;
  create: (kioscoId: string, data: NuevoContacto) => Promise<CuadernoContactoRow | null>;
  update: (id: string, data: Partial<NuevoContacto>) => Promise<CuadernoContactoRow | null>;
  remove: (id: string) => Promise<boolean>;
  registrarMovimiento: (
    contactoId: string,
    tipo: TipoMovCuaderno,
    monto: number,
    descripcion?: string | null,
  ) => Promise<boolean>;
  clear: () => void;
};

let loadToken = 0;

export const useCuadernoStore = create<CuadernoState>((set, get) => ({
  kioscoId: null,
  items: [],
  loading: false,
  loaded: false,
  error: null,

  load: async (kioscoId, options) => {
    const state = get();
    if (!options?.force && state.loaded && state.kioscoId === kioscoId) return;
    if (state.loading && state.kioscoId === kioscoId) return;

    const token = ++loadToken;
    set({
      kioscoId,
      loading: true,
      error: null,
      ...(state.kioscoId !== kioscoId ? { items: [], loaded: false } : {}),
    });

    const { data, error } = await supabase
      .from('cuaderno_contactos')
      .select(CONTACTO_COLUMNS)
      .eq('kiosco_id', kioscoId)
      .eq('activo', true)
      .order('nombre', { ascending: true })
      .limit(2000);

    if (token !== loadToken) return;
    if (error) {
      set({ loading: false, error: getErrorMessage(error) });
      return;
    }

    set({
      items: data ?? [],
      loading: false,
      loaded: true,
      error: null,
    });
  },

  create: async (kioscoId, data) => {
    set({ error: null });
    const { data: created, error } = await supabase
      .from('cuaderno_contactos')
      .insert({
        kiosco_id: kioscoId,
        tipo: data.tipo,
        nombre: data.nombre.trim(),
        telefono: data.telefono?.trim() || null,
        notas: data.notas?.trim() || null,
      })
      .select(CONTACTO_COLUMNS)
      .single();

    if (error || !created) {
      set({ error: error ? getErrorMessage(error) : 'No se pudo guardar el contacto.' });
      return null;
    }

    set({
      items: [...get().items, created].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      loaded: true,
    });
    return created;
  },

  update: async (id, data) => {
    set({ error: null });
    const patch: { nombre?: string; telefono?: string | null; notas?: string | null } = {};
    if (data.nombre !== undefined) patch.nombre = data.nombre.trim();
    if (data.telefono !== undefined) patch.telefono = data.telefono?.trim() || null;
    if (data.notas !== undefined) patch.notas = data.notas?.trim() || null;

    const { data: updated, error } = await supabase
      .from('cuaderno_contactos')
      .update(patch)
      .eq('id', id)
      .select(CONTACTO_COLUMNS)
      .single();

    if (error || !updated) {
      set({ error: error ? getErrorMessage(error) : 'No se pudo actualizar el contacto.' });
      return null;
    }

    set({
      items: get()
        .items.map((item) => (item.id === id ? updated : item))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    });
    return updated;
  },

  remove: async (id) => {
    set({ error: null });
    // Baja lógica: conserva el historial de fiado y las ventas asociadas.
    const { error } = await supabase.from('cuaderno_contactos').update({ activo: false }).eq('id', id);

    if (error) {
      set({ error: getErrorMessage(error) });
      return false;
    }

    set({ items: get().items.filter((item) => item.id !== id) });
    return true;
  },

  registrarMovimiento: async (contactoId, tipo, monto, descripcion) => {
    set({ error: null });
    const { data, error } = await supabase.rpc('registrar_movimiento_cuaderno', {
      p_contacto_id: contactoId,
      p_tipo: tipo,
      p_monto: Math.abs(monto),
      p_descripcion: descripcion?.trim() || null,
    });

    if (error || !data) {
      set({ error: error ? getErrorMessage(error) : 'No se pudo registrar el movimiento.' });
      return false;
    }

    set({ items: get().items.map((item) => (item.id === contactoId ? data : item)) });
    return true;
  },

  clear: () => {
    loadToken += 1;
    set({ kioscoId: null, items: [], loading: false, loaded: false, error: null });
  },
}));
