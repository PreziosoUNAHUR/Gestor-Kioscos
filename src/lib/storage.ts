import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/**
 * Storage único para Zustand (web: localStorage; nativo: AsyncStorage).
 * La sesión de Supabase usa AsyncStorage directamente en `lib/supabase.ts`.
 */
export const zustandStorage = createJSONStorage(() => AsyncStorage);

export const STORAGE_KEYS = {
  cart: 'gk-cart-v1',
  kiosco: 'gk-kiosco-v1',
  pairing: 'gk-pairing-v1',
} as const;
