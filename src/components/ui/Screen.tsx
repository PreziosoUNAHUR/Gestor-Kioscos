import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { useIsDesktop } from '@/hooks/useAdaptive';

type ScreenProps = {
  children: ReactNode;
  /** Desactivar para pantallas con scroll propio (POS de escritorio). */
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
  /** Padding inferior extra (p. ej. barra flotante del carrito). */
  bottomInset?: number;
};

export function Screen({ children, scroll = true, className, contentClassName, bottomInset = 0 }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();

  const inner = (
    <View
      className={cn(
        'w-full flex-1 self-center',
        desktop ? 'max-w-[1500px] px-6 py-6' : 'px-3 py-4',
        contentClassName,
      )}
    >
      {children}
    </View>
  );

  if (!scroll) {
    return (
      <View className={cn('flex-1 bg-bg', className)} style={{ paddingTop: insets.top }}>
        {inner}
      </View>
    );
  }

  return (
    <ScrollView
      className={cn('flex-1 bg-bg', className)}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + (desktop ? 24 : 20) + bottomInset,
        flexGrow: 1,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {inner}
    </ScrollView>
  );
}
