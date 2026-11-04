import Feather from '@expo/vector-icons/Feather';
import { ScrollView, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { pixelShadow } from '@/lib/retro';
import { palette } from '@/lib/theme';
import { SUPABASE_URL, supabaseHost } from '@/lib/env';

const MIGRATIONS = [
  '20261031000000_schema.sql',
  '20261031000100_realtime_scanner.sql',
  '20261031000200_scanner_sesiones.sql',
  '20261031000300_reportes.sql',
  '20261104000000_cuaderno.sql',
  '20261104000100_estadisticas.sql',
];

/**
 * Pantalla de ayuda cuando faltan las variables `EXPO_PUBLIC_SUPABASE_*`.
 * Evita el crash de `createClient` y explica exactamente qué hacer.
 */
export function ConfigNotice() {
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
      <View className="mx-auto w-full max-w-[640px] flex-1 justify-center gap-5 py-10">
        <View className="flex-row items-center gap-3">
          <View
            className="h-12 w-12 items-center justify-center border-[3px] border-black bg-accent"
            style={pixelShadow(4)}
          >
            <Feather name="shopping-bag" size={22} color={palette.ink} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-pixel text-pixel-sm uppercase text-fg">Gestor Kioscos</Text>
            <Text className="font-body text-xs text-muted">Falta configurar Supabase</Text>
          </View>
        </View>

        <Card className="gap-3">
          <Text className="font-pixel text-pixel-xs uppercase text-fg">Conectá tu proyecto</Text>
          <Text className="font-body text-sm leading-6 text-muted">
            Creá un archivo <Text className="font-mono text-primary-ink">.env</Text> en la raíz del
            proyecto (copiá <Text className="font-mono text-primary-ink">.env.example</Text>) con
            estas variables:
          </Text>

          <View className="gap-2 border-[3px] border-black bg-elevated p-3">
            <Text className="font-mono text-xs text-fg">
              EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
            </Text>
            <Text className="font-mono text-xs text-fg">
              EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
            </Text>
          </View>

          <Text className="font-body text-xs leading-5 text-muted">
            Reiniciá el servidor de Expo después de guardar el archivo (
            <Text className="font-mono text-primary-ink">npx expo start --clear</Text>). Las
            variables <Text className="font-mono text-primary-ink">EXPO_PUBLIC_*</Text> se inlinean
            en el bundle, así que un simple refresh no alcanza.
          </Text>

          <View className="gap-1 border-t-[3px] border-black pt-3">
            <Text className="font-pixel text-pixel-2xs uppercase text-muted">Detectado</Text>
            <Text className="font-mono text-xs text-muted">
              {supabaseHost ?? 'URL vacía o inválida'}
              {SUPABASE_URL ? '' : ' · sin EXPO_PUBLIC_SUPABASE_URL'}
            </Text>
          </View>
        </Card>

        <Card className="gap-2">
          <Text className="font-pixel text-pixel-xs uppercase text-fg">
            Después corré las migraciones
          </Text>
          <Text className="font-body text-xs leading-5 text-muted">
            En el SQL Editor de Supabase, en orden:
          </Text>
          <View className="gap-1 border-[3px] border-black bg-elevated p-3">
            {MIGRATIONS.map((file) => (
              <Text key={file} className="font-mono text-2xs text-muted">
                {file}
              </Text>
            ))}
          </View>
          <Text className="font-body text-xs leading-5 text-muted">
            También desactivá “Allow public access” en Realtime → Settings para que los canales
            privados usen RLS.
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}
