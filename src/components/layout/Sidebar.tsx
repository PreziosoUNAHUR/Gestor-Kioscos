import Feather from '@expo/vector-icons/Feather';
import { router, usePathname } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { pixelPressed, pixelShadow } from '@/lib/retro';
import { palette } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';
import { useKioscoStore } from '@/stores/kiosco';

type FeatherName = ComponentProps<typeof Feather>['name'];

const NAV_ITEMS = [
  { name: 'index', href: '/', label: 'Caja', icon: 'shopping-bag' },
  { name: 'productos', href: '/productos', label: 'Productos', icon: 'box' },
  { name: 'cuaderno', href: '/cuaderno', label: 'Cuaderno', icon: 'book-open' },
  { name: 'estadisticas', href: '/estadisticas', label: 'Estadísticas', icon: 'bar-chart-2' },
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
      className="h-full w-[264px] shrink-0 flex-col border-r-[3px] border-black bg-bg px-3"
      style={{ paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }}
    >
      <View className="mb-5 border-[3px] border-black bg-surface" style={pixelShadow(5)}>
        <View className="flex-row items-center gap-2 border-b-[3px] border-black bg-primary px-2.5 py-2">
          <View className="h-3 w-3 border-2 border-black bg-accent" />
          <Text className="flex-1 font-pixel text-pixel-2xs uppercase text-white">Gestor Kioscos</Text>
          <Feather name="shopping-bag" size={13} color="#FFFFFF" />
        </View>
        <View className="gap-1 px-2.5 py-2">
          <Text className="font-pixel text-pixel-2xs uppercase text-primary-ink">POS · {kiosco?.moneda ?? 'ARS'}</Text>
          <Text className="font-body text-2xs text-muted" numberOfLines={1}>
            {kiosco?.nombre ?? 'Sin kiosco activo'}
          </Text>
        </View>
      </View>

      <View className="flex-1 gap-2">
        {NAV_ITEMS.map((item) => {
          const focused = isActive(item.href, pathname);

          return (
            <Pressable
              key={item.name}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={item.label}
              onPress={() => router.navigate(item.href)}
              style={({ pressed }) => [
                focused ? pixelShadow(3) : undefined,
                pressed ? pixelPressed(3) : undefined,
              ]}
              className={cn(
                'min-h-touch flex-row items-center gap-2.5 rounded-none border-[3px] px-2.5 py-2',
                focused ? 'border-black bg-accent' : 'border-transparent bg-transparent',
              )}
            >
              <Feather name={item.icon} size={16} color={focused ? palette.ink : palette.muted} />
              <Text
                className={cn(
                  'font-pixel text-pixel-2xs uppercase tracking-wide',
                  focused ? 'text-ink' : 'text-muted',
                )}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="gap-2 border-t-[3px] border-black pt-3">
        <View className="border-[3px] border-black bg-elevated px-2.5 py-2">
          <Text className="font-pixel text-pixel-2xs uppercase text-muted">Cuenta</Text>
          <Text className="font-body-semibold text-xs text-fg" numberOfLines={1}>
            {email || 'Sin sesión'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          onPress={() => void signOut()}
          className="min-h-touch flex-row items-center gap-2.5 rounded-none border-[3px] border-transparent px-2.5 active:border-black active:bg-[#FEE2E2]"
        >
          <Feather name="log-out" size={16} color={palette.muted} />
          <Text className="font-pixel text-pixel-2xs uppercase text-muted">Salir</Text>
        </Pressable>
      </View>
    </View>
  );
}
