import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { getErrorMessage } from '@/lib/errors';
import { isSupabaseConfigured } from '@/lib/env';
import { supabase, syncRealtimeAuth } from '@/lib/supabase';

import { useCajaStore } from './caja';
import { useCartStore } from './cart';
import { useCatalogStore } from './catalog';
import { useKioscoStore } from './kiosco';
import { usePairingStore } from './pairing';

type SignUpResult = { ok: boolean; needsConfirmation: boolean };

type AuthState = {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  initialized: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

let authSubscription: { unsubscribe: () => void } | null = null;

function clearSessionData() {
  useKioscoStore.getState().clear();
  useCatalogStore.getState().clear();
  useCartStore.getState().clear();
  useCajaStore.getState().clear();
  usePairingStore.getState().clear();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  initializing: false,
  initialized: false,
  error: null,

  initialize: async () => {
    if (get().initializing || get().initialized) return;

    set({ initializing: true, error: null });

    if (!isSupabaseConfigured) {
      set({ initializing: false, initialized: true });
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      initializing: false,
      initialized: true,
      error: error ? getErrorMessage(error) : null,
    });

    if (!authSubscription) {
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        // Importante: el callback no debe ser async (Supabase lo documenta).
        set({ session, user: session?.user ?? null });

        if (event === 'SIGNED_OUT') {
          clearSessionData();
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          void syncRealtimeAuth();
        }
      });
      authSubscription = listener.subscription;
    }

    if (data.session) void syncRealtimeAuth();
  },

  signIn: async (email, password) => {
    set({ error: null });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      set({ error: getErrorMessage(error) });
      return false;
    }

    set({ session: data.session, user: data.user, error: null });
    return true;
  },

  signUp: async (email, password) => {
    set({ error: null });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      set({ error: getErrorMessage(error) });
      return { ok: false, needsConfirmation: false };
    }

    if (data.session) {
      set({ session: data.session, user: data.user, error: null });
    }

    return { ok: true, needsConfirmation: !data.session };
  },

  signOut: async () => {
    set({ error: null });
    const { error } = await supabase.auth.signOut();
    if (error) set({ error: getErrorMessage(error) });
    set({ session: null, user: null });
    clearSessionData();
  },

  clearError: () => set({ error: null }),
}));
