import { useEffect } from 'react';

import { useCajaStore } from '@/stores/caja';
import { useCatalogStore } from '@/stores/catalog';
import { useCuadernoStore } from '@/stores/cuaderno';
import { useKioscoStore } from '@/stores/kiosco';
import { supabase } from '@/lib/supabase';
import type { KioscoRow, ProductoRow } from '@/lib/database.types';

/** Kiosco activo resuelto contra la lista cargada. */
export function useActiveKiosco(): KioscoRow | null {
  const kioscos = useKioscoStore((state) => state.kioscos);
  const activeId = useKioscoStore((state) => state.activeId);
  return kioscos.find((kiosco) => kiosco.id === activeId) ?? null;
}

/** Carga el catálogo paginado cuando cambia el kiosco activo. */
export function useEnsureCatalog(kioscoId: string | null | undefined): void {
  const load = useCatalogStore((state) => state.load);

  useEffect(() => {
    if (kioscoId) void load(kioscoId);
  }, [kioscoId, load]);
}

/** Carga clientes y proveedores del cuaderno. */
export function useEnsureCuaderno(kioscoId: string | null | undefined): void {
  const load = useCuadernoStore((state) => state.load);

  useEffect(() => {
    if (kioscoId) void load(kioscoId);
  }, [kioscoId, load]);
}

/** Carga la caja abierta del kiosco activo. */
export function useEnsureCaja(kioscoId: string | null | undefined): void {
  const load = useCajaStore((state) => state.load);

  useEffect(() => {
    if (kioscoId) void load(kioscoId);
  }, [kioscoId, load]);
}

/**
 * Cambios en vivo:
 * - `productos`: stock/precio actualizado por otra caja o por la compra.
 * - `cajas`: apertura/cierre del turno desde otro dispositivo.
 */
export function useRealtimeKiosco(kioscoId: string | null | undefined): void {
  useEffect(() => {
    if (!kioscoId) return;

    const upsert = useCatalogStore.getState().upsert;
    const remove = useCatalogStore.getState().remove;

    const channel = supabase
      .channel(`kiosco:${kioscoId}:db`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'productos', filter: `kiosco_id=eq.${kioscoId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<ProductoRow>;
            if (old.id) remove(old.id);
            return;
          }
          const row = payload.new as ProductoRow;
          if (row?.id) upsert(row);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cajas', filter: `kiosco_id=eq.${kioscoId}` },
        () => {
          void useCajaStore.getState().load(kioscoId);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cuaderno_contactos', filter: `kiosco_id=eq.${kioscoId}` },
        () => {
          void useCuadernoStore.getState().load(kioscoId, { force: true });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [kioscoId]);
}

/** Carga kioscos una vez por sesión. */
export function useEnsureKioscos(): void {
  const load = useKioscoStore((state) => state.load);
  const loaded = useKioscoStore((state) => state.loaded);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
}
