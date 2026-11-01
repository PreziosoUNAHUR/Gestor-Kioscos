import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveTabBar } from '@/components/layout/AdaptiveTabBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { useIsDesktop } from '@/hooks/useAdaptive';
import { useEnsureKioscos } from '@/hooks/useKioscoData';
import { palette } from '@/lib/theme';

export default function AppLayout() {
  const desktop = useIsDesktop();
  const insets = useSafeAreaInsets();
  useEnsureKioscos();

  return (
    <View className="flex-1 flex-row bg-bg">
      {desktop ? <Sidebar /> : null}

      <View className="flex-1">
        <Tabs
          tabBar={desktop ? () => null : (props) => <AdaptiveTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: palette.bg },
            tabBarStyle: desktop
              ? { display: 'none' }
              : { height: 58 + insets.bottom, backgroundColor: 'transparent', borderTopWidth: 0 },
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Caja' }} />
          <Tabs.Screen name="productos" options={{ title: 'Productos' }} />
          <Tabs.Screen name="escaner" options={{ title: 'Escáner' }} />
          <Tabs.Screen name="reportes" options={{ title: 'Reportes' }} />
          <Tabs.Screen name="ajustes" options={{ title: 'Ajustes' }} />
          <Tabs.Screen name="caja" options={{ title: 'Turno', href: null }} />
        </Tabs>
      </View>
    </View>
  );
}
