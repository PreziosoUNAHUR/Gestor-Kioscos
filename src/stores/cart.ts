import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { MetodoPago, ProductoRow } from '@/lib/database.types';
import { STORAGE_KEYS, zustandStorage } from '@/lib/storage';

export type CartItem = {
  productoId: string;
  nombre: string;
  codigoBarras: string | null;
  precioUnitario: number;
  cantidad: number;
  stock: number;
};

/** "Fiado" no es un valor del enum de Postgres: se guarda como `otro` + cliente. */
export type MetodoPagoUI = MetodoPago | 'fiado';

export type AddResult = { ok: boolean; cantidad: number; message?: string };

type CartState = {
  kioscoId: string | null;
  items: CartItem[];
  descuento: number;
  metodoPago: MetodoPagoUI;
  clienteId: string | null;
  notas: string;

  addProducto: (producto: ProductoRow, cantidad?: number) => AddResult;
  setCantidad: (productoId: string, cantidad: number) => void;
  incrementar: (productoId: string) => void;
  decrementar: (productoId: string) => void;
  removeItem: (productoId: string) => void;
  setDescuento: (value: number) => void;
  setMetodoPago: (metodo: MetodoPagoUI) => void;
  setClienteId: (clienteId: string | null) => void;
  setNotas: (notas: string) => void;
  clear: () => void;
};

const MAX_QTY = 999;

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function cartSubtotal(items: CartItem[]): number {
  return roundMoney(items.reduce((acc, item) => acc + item.precioUnitario * item.cantidad, 0));
}

export function cartTotal(items: CartItem[], descuento: number): number {
  return Math.max(0, roundMoney(cartSubtotal(items) - descuento));
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.cantidad, 0);
}

const emptyCart = {
  kioscoId: null as string | null,
  items: [] as CartItem[],
  descuento: 0,
  metodoPago: 'efectivo' as MetodoPagoUI,
  clienteId: null as string | null,
  notas: '',
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ...emptyCart,

      addProducto: (producto, cantidad = 1) => {
        const state = get();
        const qty = Math.max(1, Math.floor(cantidad));
        const baseItems = state.kioscoId && state.kioscoId !== producto.kiosco_id ? [] : state.items;
        const existing = baseItems.find((item) => item.productoId === producto.id);
        const nuevaCantidad = Math.min(MAX_QTY, (existing?.cantidad ?? 0) + qty);

        const items = existing
          ? baseItems.map((item) =>
              item.productoId === producto.id
                ? {
                    ...item,
                    cantidad: nuevaCantidad,
                    precioUnitario: Number(producto.precio_venta),
                    stock: producto.stock,
                    nombre: producto.nombre,
                  }
                : item,
            )
          : [
              ...baseItems,
              {
                productoId: producto.id,
                nombre: producto.nombre,
                codigoBarras: producto.codigo_barras,
                precioUnitario: Number(producto.precio_venta),
                cantidad: nuevaCantidad,
                stock: producto.stock,
              },
            ];

        set({
          kioscoId: producto.kiosco_id,
          items,
          // Si cambiamos de kiosco, el descuento y el cliente anterior no aplican.
          descuento: state.kioscoId && state.kioscoId !== producto.kiosco_id ? 0 : state.descuento,
          clienteId: state.kioscoId && state.kioscoId !== producto.kiosco_id ? null : state.clienteId,
        });

        if (producto.stock <= 0) {
          return { ok: true, cantidad: nuevaCantidad, message: 'Sin stock registrado' };
        }
        if (nuevaCantidad > producto.stock) {
          return { ok: true, cantidad: nuevaCantidad, message: `Stock disponible: ${producto.stock}` };
        }
        return { ok: true, cantidad: nuevaCantidad };
      },

      setCantidad: (productoId, cantidad) => {
        const qty = Math.floor(cantidad);
        if (qty <= 0) {
          get().removeItem(productoId);
          return;
        }
        set({
          items: get().items.map((item) =>
            item.productoId === productoId ? { ...item, cantidad: Math.min(MAX_QTY, qty) } : item,
          ),
        });
      },

      incrementar: (productoId) => {
        const item = get().items.find((entry) => entry.productoId === productoId);
        if (item) get().setCantidad(productoId, item.cantidad + 1);
      },

      decrementar: (productoId) => {
        const item = get().items.find((entry) => entry.productoId === productoId);
        if (item) get().setCantidad(productoId, item.cantidad - 1);
      },

      removeItem: (productoId) => {
        set({ items: get().items.filter((item) => item.productoId !== productoId) });
      },

      setDescuento: (value) => {
        const subtotal = cartSubtotal(get().items);
        const descuento = Math.min(Math.max(0, roundMoney(value)), subtotal);
        set({ descuento });
      },

      setMetodoPago: (metodoPago) =>
        set({ metodoPago, clienteId: metodoPago === 'fiado' ? get().clienteId : null }),

      setClienteId: (clienteId) => set({ clienteId }),

      setNotas: (notas) => set({ notas: notas.slice(0, 280) }),

      clear: () => set({ ...emptyCart }),
    }),
    {
      name: STORAGE_KEYS.cart,
      storage: zustandStorage,
      version: 1,
      partialize: (state) => ({
        kioscoId: state.kioscoId,
        items: state.items,
        descuento: state.descuento,
        metodoPago: state.metodoPago,
        clienteId: state.clienteId,
        notas: state.notas,
      }),
    },
  ),
);
