/**
 * Variables públicas de Expo (`EXPO_PUBLIC_*` se inlinean en el bundle).
 *
 * La app nunca debe crashear por falta de configuración: si faltan las claves
 * mostramos una pantalla de ayuda en el layout raíz (ver `ConfigNotice`).
 */
const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const rawKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export const SUPABASE_URL = rawUrl;
export const SUPABASE_ANON_KEY = rawKey;

export const isSupabaseConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 40;

/** Host legible para mostrar en Ajustes (sin exponer la key). */
export const supabaseHost = (() => {
  try {
    return new URL(SUPABASE_URL).host;
  } catch {
    return null;
  }
})();
