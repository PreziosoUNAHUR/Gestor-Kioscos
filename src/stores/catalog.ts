import { create } from 'zustand';

import type { ProductoRow } from '@/lib/database.types';
import { getErrorMessage } from '@/lib/errors';
import { normalizeBarcode } from '@/lib/scanner';
import { supabase } from '@/lib/supabase';

/** Tamaño de página: suficiente para no fragmentar y no saturar memoria. */
export const CATALOG_PAGE_SIZE = 1000;
/** Tope de seguridad (100k productos). */
const MAX_PAGES = 100;

const PRODUCT_COLUMNS =
  'id,kiosco_id,codigo_barras,sku,nombre,categoria,precio_costo,precio_venta,stock,stock_minimo,activo,imagen_url,created_at,updated_at';

type CatalogState = {
  kioscoId: string | null;
  items: ProductoRow[];
  byId: Record<string, ProductoRow>;
  byBarcode: Record<string, ProductoRow>;
  loading: boolean;
  loaded: boolean;
  progress: number;
  error: string | null;
  lastLoadedAt: number | null;

  load: (kioscoId: string, options?: { force?: boolean }) => Promise<void>;
  upsert: (producto: ProductoRow) => void;
  remove: (productoId: string) => void;
  applyStock: (productoId: string, stock: number) => void;
  findByBarcode: (code: string) => ProductoRow | undefined;
  findById: (id: string) => ProductoRow | undefined;
  clear: () => void;
};

let loadToken = 0;

function buildIndexes(items: ProductoRow[]) {
  const byId: Record<string, ProductoRow> = {};
  const byBarcode: Record<string, ProductoRow> = {};

  for (const item of items) {
    byId[item.id] = item;
    if (item.codigo_barras) {
      const code = normalizeBarcode(item.codigo_barras);
      if (code) byBarcode[code] = item;
    }
  }

  return { byId, byBarcode };
}

const emptyCatalog = {
  items: [] as ProductoRow[],
  byId: {} as Record<string, ProductoRow>,
  byBarcode: {} as Record<string, ProductoRow>,
  loaded: false,
  progress: 0,
  lastLoadedAt: null as number | null,
};

export const useCatalogStore = create<CatalogState>((set, get) => ({
  kioscoId: null,
  ...emptyCatalog,
  loading: false,
  error: null,

  load: async (kioscoId, options) => {
    const state = get();
    if (!options?.force && state.loaded && state.kioscoId === kioscoId) return;
    if (state.loading && state.kioscoId === kioscoId) return;

    const token = ++loadToken;
    const switchingKiosco = state.kioscoId !== kioscoId;

    set({
      kioscoId,
      loading: true,
      error: null,
      ...(switchingKiosco ? { ...emptyCatalog, progress: 0 } : {}),
    });

    const accumulated: ProductoRow[] = [];

    try {
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const from = page * CATALOG_PAGE_SIZE;
        const { data, error } = await supabase
          .from('productos')
          .select(PRODUCT_COLUMNS)
          .eq('kiosco_id', kioscoId)
          .eq('activo', true)
          .order('nombre', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + CATALOG_PAGE_SIZE - 1);

        if (token !== loadToken) return;
        if (error) throw error;

        const rows = data ?? [];
        accumulated.push(...rows);

        // Publicamos página a página: la caja ya puede vender mientras carga.
        set({
          items: accumulated.slice(),
          ...buildIndexes(accumulated),
          progress: accumulated.length,
          loading: rows.length === CATALOG_PAGE_SIZE,
        });

        if (rows.length < CATALOG_PAGE_SIZE) break;
      }

      if (token !== loadToken) return;
      set({
        items: accumulated,
        ...buildIndexes(accumulated),
        loading: false,
        loaded: true,
        progress: accumulated.length,
        lastLoadedAt: Date.now(),
        error: null,
      });
    } catch (error) {
      if (token !== loadToken) return;
      set({
        loading: false,
        loaded: accumulated.length > 0,
        error: getErrorMessage(error),
      });
    }
  },

  upsert: (producto) => {
    const state = get();
    if (state.kioscoId && producto.kiosco_id !== state.kioscoId) return;

    if (!producto.activo) {
      get().remove(producto.id);
      return;
    }

    const exists = Boolean(state.byId[producto.id]);
    const items = exists
      ? state.items.map((item) => (item.id === producto.id ? producto : item))
      : [...state.items, producto].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    set({ items, ...buildIndexes(items), loaded: true });
  },

  remove: (productoId) => {
    const items = get().items.filter((item) => item.id !== productoId);
    set({ items, ...buildIndexes(items) });
  },

  applyStock: (productoId, stock) => {
    const state = get();
    const current = state.byId[productoId];
    if (!current) return;

    const updated = { ...current, stock };
    const items = state.items.map((item) => (item.id === productoId ? updated : item));
    set({ items, ...buildIndexes(items) });
  },

  findByBarcode: (code) => {
    const normalized = normalizeBarcode(code);
    if (!normalized) return undefined;
    return get().byBarcode[normalized];
  },

  findById: (id) => get().byId[id],

  clear: () => {
    loadToken += 1;
    set({ kioscoId: null, ...emptyCatalog, loading: false, error: null });
  },
}));
