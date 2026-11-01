import Feather from '@expo/vector-icons/Feather';
import { router, usePathname } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { palette } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';
import { useKioscoStore } from '@/stores/kiosco';

type FeatherName = ComponentProps<typeof Feather>['name'];

const NAV_ITEMS = [
  { name: 'index', href: '/', label: 'Caja', icon: 'shopping-bag' },
  { name: 'productos', href: '/productos', label: 'Productos', icon: 'box' },
  { name: 'escaner', href: '/escaner', label: 'Escáner', icon: 'camera' },
  { name: 'reportes', href: '/reportes', label: 'Reportes', icon: 'bar-chart-2' },
  { name: 'ajustes', href: '/ajustes', label: 'Ajustes', icon: 'settings' },
] as const satisfies readonly {
  name: string;
  href: string;
  label: string;
  icon: FeatherName;
}[];

function isActive(href: string, pathname: string): boolean {
  // `/caja` es el detalle del turno: sigue perteneciendo a la sección Caja.
  if (href === '/') return pathname === '/' || pathname === '/caja';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Navegación lateral para PC (≥1024px). Vive fuera del navigator para poder
 * ocupar toda la altura de la pantalla; las tabs siguen siendo un único
 * navigator y no se remontan al cambiar de breakpoint.
 */
export function Sidebar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const kioscos = useKioscoStore((store) => store.kioscos);
  const activeId = useKioscoStore((store) => store.activeId);
  const email = useAuthStore((store) => store.user?.email ?? '');
  const signOut = useAuthStore((store) => store.signOut);

  const kiosco = kioscos.find((entry) => entry.id === activeId) ?? null;

  return (
    <View
      className="h-full w-[248px] shrink-0 flex-col border-r border-line bg-surface/40 px-4"
      style={{ paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) }}
    >
      <View className="mb-7 flex-row items-center gap-2.5 px-1">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <Feather name="shopping-bag" size={18} color={palette.primaryFg} />
        </View>
        <View className="flex-1">
          <Text className="font-heading text-base text-fg">Gestor Kioscos</Text>
          <Text className="font-body text-2xs text-muted">POS · {kiosco?.moneda ?? 'ARS'}</Text>
        </View>
      </View>

      <View className="flex-1 gap-1">
        {NAV_ITEMS.map((item) => {
          const focused = isActive(item.href, pathname);

          return (
            <Pressable
              key={item.name}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={item.label}
              onPress={() => router.navigate(item.href)}
              className={cn(
                'min-h-touch flex-row items-center gap-3 rounded-xl border px-3',
                focused ? 'border-primary/30 bg-primary/10' : 'border-transparent',
              )}
            >
              <Feather name={item.icon} size={18} color={focused ? palette.primary : palette.muted} />
              <Text className={cn('font-body-medium text-sm', focused ? 'text-fg' : 'text-muted')}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="gap-2 border-t border-line pt-3">
        <View className="rounded-xl border border-line bg-bg/40 px-3 py-2.5">
          <Text className="font-body-medium text-2xs uppercase tracking-wide text-muted">Kiosco activo</Text>
          <Text className="font-body-semibold text-sm text-fg" numberOfLines={1}>
            {kiosco?.nombre ?? 'Sin kiosco'}
          </Text>
          <Text className="font-body text-2xs text-muted" numberOfLines={1}>
            {email}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          onPress={() => void signOut()}
          className="min-h-touch flex-row items-center gap-3 rounded-xl px-3"
        >
          <Feather name="log-out" size={17} color={palette.muted} />
          <Text className="font-body-medium text-sm text-muted">Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}
