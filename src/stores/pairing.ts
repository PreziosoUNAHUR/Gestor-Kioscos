import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { getErrorMessage } from '@/lib/errors';
import { isPairingCode, normalizePairingCode } from '@/lib/scanner';
import { STORAGE_KEYS, zustandStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export type HostSession = {
  kioscoId: string;
  codigo: string;
  expiraAt: string;
};

type PairingState = {
  hostSession: HostSession | null;
  hostActive: boolean;
  remoteCode: string;
  remoteKioscoId: string | null;
  loading: boolean;
  error: string | null;

  abrirSesion: (kioscoId: string, force?: boolean) => Promise<HostSession | null>;
  cerrarSesion: (kioscoId: string) => Promise<void>;
  desactivarHost: () => void;
  resolverCodigo: (codigo: string) => Promise<string | null>;
  setRemoteCode: (codigo: string) => void;
  clearRemote: () => void;
  clear: () => void;
};

const empty = {
  hostSession: null as HostSession | null,
  hostActive: false,
  remoteCode: '',
  remoteKioscoId: null as string | null,
};

function isFresh(session: HostSession | null): boolean {
  if (!session) return false;
  const expires = new Date(session.expiraAt).getTime();
  return Number.isFinite(expires) && expires - Date.now() > 60_000;
}

export const usePairingStore = create<PairingState>()(
  persist(
    (set, get) => ({
      ...empty,
      loading: false,
      error: null,

      abrirSesion: async (kioscoId, force = false) => {
        const current = get().hostSession;
        if (!force && current && current.kioscoId === kioscoId && isFresh(current)) {
          set({ hostActive: true, error: null });
          return current;
        }

        set({ loading: true, error: null });
        const { data, error } = await supabase.rpc('abrir_sesion_scanner', { p_kiosco_id: kioscoId });

        if (error || !data) {
          set({ loading: false, error: error ? getErrorMessage(error) : 'No se pudo crear el código.' });
          return null;
        }

        const session: HostSession = {
          kioscoId: data.kiosco_id,
          codigo: data.codigo,
          expiraAt: data.expira_at,
        };

        set({ hostSession: session, hostActive: true, loading: false, error: null });
        return session;
      },

      cerrarSesion: async (kioscoId) => {
        // Cortamos localmente primero: la PC deja de escuchar aunque falle la red.
        set({ hostActive: false, hostSession: null, error: null });
        const { error } = await supabase.rpc('cerrar_sesion_scanner', { p_kiosco_id: kioscoId });
        if (error) set({ error: getErrorMessage(error) });
      },

      desactivarHost: () => set({ hostActive: false }),

      resolverCodigo: async (codigo) => {
        const normalized = normalizePairingCode(codigo);
        if (!isPairingCode(normalized)) {
          set({ error: 'El código debe tener 6 caracteres (letras y números).' });
          return null;
        }

        set({ loading: true, error: null });
        const { data, error } = await supabase.rpc('resolver_sesion_scanner', { p_codigo: normalized });

        if (error) {
          set({ loading: false, error: getErrorMessage(error) });
          return null;
        }
        if (!data) {
          set({ loading: false, error: 'Código inválido o vencido. Pedí uno nuevo en la PC.' });
          return null;
        }

        set({ loading: false, remoteCode: normalized, remoteKioscoId: data, error: null });
        return data;
      },

      setRemoteCode: (codigo) => set({ remoteCode: normalizePairingCode(codigo), error: null }),

      clearRemote: () => set({ remoteCode: '', remoteKioscoId: null, error: null }),

      clear: () => set({ ...empty, loading: false, error: null }),
    }),
    {
      name: STORAGE_KEYS.pairing,
      storage: zustandStorage,
      version: 1,
      partialize: (state) => ({
        hostSession: state.hostSession,
        hostActive: state.hostActive,
        remoteCode: state.remoteCode,
        remoteKioscoId: state.remoteKioscoId,
      }),
    },
  ),
);
