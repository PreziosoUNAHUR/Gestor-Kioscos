import Feather from '@expo/vector-icons/Feather';
import { ScrollView, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { palette } from '@/lib/theme';
import { SUPABASE_URL, supabaseHost } from '@/lib/env';

/**
 * Pantalla de ayuda cuando faltan las variables `EXPO_PUBLIC_SUPABASE_*`.
 * Evita el crash de `createClient` y explica exactamente qué hacer.
 */
export function ConfigNotice() {
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
      <View className="mx-auto w-full max-w-[640px] flex-1 justify-center gap-5 py-10">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary">
            <Feather name="shopping-bag" size={20} color={palette.primaryFg} />
          </View>
          <View>
            <Text className="font-heading text-xl text-fg">Gestor Kioscos</Text>
            <Text className="font-body text-xs text-muted">Falta configurar Supabase</Text>
          </View>
        </View>

        <Card glass className="gap-3">
          <Text className="font-heading text-lg text-fg">Conectá tu proyecto</Text>
          <Text className="font-body text-sm leading-6 text-muted">
            Creá un archivo <Text className="font-mono text-primary-ink">.env</Text> en la raíz del proyecto (copiá
            <Text className="font-mono text-primary-ink"> .env.example</Text>) con estas variables:
          </Text>

          <View className="gap-2 rounded-xl border border-line bg-bg/70 p-3">
            <Text className="font-mono text-xs text-fg">EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co</Text>
            <Text className="font-mono text-xs text-fg">EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...</Text>
          </View>

          <Text className="font-body text-xs leading-5 text-muted">
            Reiniciá el servidor de Expo después de guardar el archivo (`npx expo start --clear`). Las variables
            `EXPO_PUBLIC_*` se inlinean en el bundle, así que un simple refresh no alcanza.
          </Text>

          <View className="gap-1 border-t border-line pt-3">
            <Text className="font-body-medium text-2xs uppercase tracking-wide text-muted">Detectado</Text>
            <Text className="font-mono text-xs text-muted">
              {supabaseHost ?? 'URL vacía o inválida'}
              {SUPABASE_URL ? '' : ' · sin EXPO_PUBLIC_SUPABASE_URL'}
            </Text>
          </View>
        </Card>

        <Card className="gap-2">
          <Text className="font-body-semibold text-sm text-fg">Después corré las migraciones</Text>
          <Text className="font-body text-xs leading-5 text-muted">
            En el SQL Editor de Supabase, en orden: `20261031000000_schema.sql`,
            `20261031000100_realtime_scanner.sql`, `20261031000200_scanner_sesiones.sql` y
            `20261031000300_reportes.sql`. También desactivá “Allow public access” en Realtime → Settings
            para que los canales privados usen RLS.
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}
