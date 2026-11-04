import Feather from '@expo/vector-icons/Feather';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { palette } from '@/lib/theme';

type FeatherName = ComponentProps<typeof Feather>['name'];

const NAV_ITEMS: Record<string, { label: string; icon: FeatherName }> = {
  index: { label: 'Caja', icon: 'shopping-bag' },
  productos: { label: 'Productos', icon: 'box' },
  cuaderno: { label: 'Cuaderno', icon: 'book-open' },
  estadisticas: { label: 'Stats', icon: 'bar-chart-2' },
  ajustes: { label: 'Ajustes', icon: 'settings' },
};

const ORDER = ['index', 'productos', 'cuaderno', 'estadisticas', 'ajustes'];

/**
 * Barra inferior para celular/tablet (<1024px). En PC la navegación la dibuja
 * `Sidebar`, fuera del navigator, para ocupar toda la altura.
 */
export function AdaptiveTabBar({ state, descriptors, insets, navigateToTab }: BottomTabBarProps) {
  const activeKey = state.routes[state.index]?.key;

  const items = ORDER.flatMap((name) => {
    const route = state.routes.find((entry) => entry.name === name);
    if (!route) return [];
    const options = descriptors[route.key]?.options;
    return [
      {
        route,
        label: options?.title ?? NAV_ITEMS[name]?.label ?? name,
        icon: NAV_ITEMS[name]?.icon ?? ('circle' as FeatherName),
        focused: route.key === activeKey,
      },
    ];
  });

  return (
    <View className="border-t-[3px] border-black bg-bg" style={{ paddingBottom: insets.bottom }}>
      <View className="flex-row items-stretch gap-1 px-1.5 py-1.5">
        {items.map(({ route, label, icon, focused }) => (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => navigateToTab(route.key)}
            className={cn(
              'min-h-touch flex-1 items-center justify-center gap-1 rounded-none border-[3px] py-1',
              focused ? 'border-black bg-accent' : 'border-transparent',
            )}
          >
            <Feather name={icon} size={17} color={focused ? palette.ink : palette.muted} />
            <Text
              className={cn(
                'font-pixel text-pixel-2xs uppercase',
                focused ? 'text-ink' : 'text-muted',
              )}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
