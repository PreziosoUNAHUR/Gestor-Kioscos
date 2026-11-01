import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { KioscoRow } from '@/lib/database.types';
import { getErrorMessage } from '@/lib/errors';
import { STORAGE_KEYS, zustandStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

type KioscoState = {
  kioscos: KioscoRow[];
  activeId: string | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;

  load: (force?: boolean) => Promise<void>;
  setActive: (id: string) => void;
  create: (nombre: string) => Promise<KioscoRow | null>;
  clear: () => void;
  active: () => KioscoRow | null;
};

export const useKioscoStore = create<KioscoState>()(
  persist(
    (set, get) => ({
      kioscos: [],
      activeId: null,
      loading: false,
      loaded: false,
      error: null,

      load: async (force = false) => {
        if (get().loading) return;
        if (!force && get().loaded) return;

        set({ loading: true, error: null });
        const { data, error } = await supabase.from('kioscos').select('*').order('nombre', { ascending: true });

        if (error) {
          set({ loading: false, error: getErrorMessage(error) });
          return;
        }

        const kioscos = data ?? [];
        const current = get().activeId;
        const stillExists = current ? kioscos.some((kiosco) => kiosco.id === current) : false;
        const activeId = stillExists ? current : (kioscos[0]?.id ?? null);

        set({ kioscos, activeId, loading: false, loaded: true, error: null });
      },

      setActive: (id) => {
        if (!get().kioscos.some((kiosco) => kiosco.id === id)) return;
        set({ activeId: id });
      },

      create: async (nombre) => {
        set({ error: null });
        const { data, error } = await supabase.rpc('crear_kiosco', { p_nombre: nombre.trim() });

        if (error) {
          set({ error: getErrorMessage(error) });
          return null;
        }
        if (!data) {
          set({ error: 'No se pudo crear el kiosco.' });
          return null;
        }

        const kioscos = [...get().kioscos.filter((kiosco) => kiosco.id !== data.id), data].sort((a, b) =>
          a.nombre.localeCompare(b.nombre, 'es'),
        );

        set({ kioscos, activeId: data.id, loaded: true, error: null });
        return data;
      },

      clear: () => set({ kioscos: [], activeId: null, loaded: false, loading: false, error: null }),

      active: () => {
        const { kioscos, activeId } = get();
        return kioscos.find((kiosco) => kiosco.id === activeId) ?? null;
      },
    }),
    {
      name: STORAGE_KEYS.kiosco,
      storage: zustandStorage,
      partialize: (state) => ({ activeId: state.activeId }),
    },
  ),
);
