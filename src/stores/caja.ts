import { create } from 'zustand';

import type { CajaRow, Json } from '@/lib/database.types';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type CajaResumen = {
  ventas_cantidad: number;
  ventas_total: number;
  ventas_efectivo: number;
  ventas_fiado: number;
  anuladas_cantidad: number;
  anuladas_total: number;
  por_metodo: Record<string, number>;
  gastos_total: number;
  gastos_efectivo: number;
  compras_total: number;
  compras_efectivo: number;
  monto_inicial: number;
  efectivo_esperado: number;
};

function parseResumen(value: Json | null): CajaResumen | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, Json | undefined>;
  const num = (key: string): number => {
    const entry = raw[key];
    return typeof entry === 'number' ? entry : Number(entry ?? 0) || 0;
  };
  const porMetodoRaw = raw.por_metodo;
  const por_metodo: Record<string, number> = {};
  if (porMetodoRaw && typeof porMetodoRaw === 'object' && !Array.isArray(porMetodoRaw)) {
    for (const [key, entry] of Object.entries(porMetodoRaw)) {
      por_metodo[key] = typeof entry === 'number' ? entry : Number(entry ?? 0) || 0;
    }
  }

  return {
    ventas_cantidad: num('ventas_cantidad'),
    ventas_total: num('ventas_total'),
    ventas_efectivo: num('ventas_efectivo'),
    ventas_fiado: num('ventas_fiado'),
    anuladas_cantidad: num('anuladas_cantidad'),
    anuladas_total: num('anuladas_total'),
    por_metodo,
    gastos_total: num('gastos_total'),
    gastos_efectivo: num('gastos_efectivo'),
    compras_total: num('compras_total'),
    compras_efectivo: num('compras_efectivo'),
    monto_inicial: num('monto_inicial'),
    efectivo_esperado: num('efectivo_esperado'),
  };
}

type CajaState = {
  caja: CajaRow | null;
  resumen: CajaResumen | null;
  loading: boolean;
  error: string | null;

  load: (kioscoId: string) => Promise<void>;
  abrir: (kioscoId: string, montoInicial: number) => Promise<boolean>;
  cerrar: (cajaId: string, efectivoContado: number, notas?: string) => Promise<CajaRow | null>;
  cargarResumen: (cajaId: string) => Promise<void>;
  clear: () => void;
};

export const useCajaStore = create<CajaState>((set, get) => ({
  caja: null,
  resumen: null,
  loading: false,
  error: null,

  load: async (kioscoId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('cajas')
      .select('*')
      .eq('kiosco_id', kioscoId)
      .eq('estado', 'abierta')
      .maybeSingle();

    if (error) {
      set({ loading: false, error: getErrorMessage(error) });
      return;
    }

    set({ caja: data ?? null, loading: false, resumen: data ? get().resumen : null, error: null });
    if (data) void get().cargarResumen(data.id);
  },

  abrir: async (kioscoId, montoInicial) => {
    set({ error: null, loading: true });
    const { data, error } = await supabase.rpc('abrir_caja', {
      p_kiosco_id: kioscoId,
      p_monto_inicial: Math.max(0, montoInicial),
    });

    if (error) {
      set({ loading: false, error: getErrorMessage(error) });
      return false;
    }

    set({ caja: data, loading: false, resumen: null, error: null });
    if (data) void get().cargarResumen(data.id);
    return true;
  },

  cerrar: async (cajaId, efectivoContado, notas) => {
    set({ error: null, loading: true });
    const { data, error } = await supabase.rpc('cerrar_caja', {
      p_caja_id: cajaId,
      p_efectivo_contado: Math.max(0, efectivoContado),
      p_notas: notas?.trim() || null,
    });

    if (error) {
      set({ loading: false, error: getErrorMessage(error) });
      return null;
    }

    set({ caja: null, resumen: null, loading: false, error: null });
    return data;
  },

  cargarResumen: async (cajaId) => {
    const { data, error } = await supabase.rpc('resumen_caja', { p_caja_id: cajaId });
    if (error) {
      set({ error: getErrorMessage(error) });
      return;
    }
    set({ resumen: parseResumen(data) });
  },

  clear: () => set({ caja: null, resumen: null, loading: false, error: null }),
}));
