import { useSyncExternalStore } from 'react';

import { useCartStore } from '@/stores/cart';

/**
 * Zustand rehidrata de AsyncStorage de forma asíncrona. Hasta que termina, no
 * conviene mostrar totales (parpadearía $0) ni dejar cobrar.
 *
 * `useSyncExternalStore` evita el setState dentro de un efecto y cubre tanto la
 * rehidratación ya terminada como la que termina después del primer render.
 */
export function useCartHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => useCartStore.persist.onFinishHydration(onStoreChange),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}
