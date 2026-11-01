import Feather from '@expo/vector-icons/Feather';
import { Text, View } from 'react-native';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import type { CajaRow } from '@/lib/database.types';
import { formatDateTime } from '@/lib/format';
import { palette } from '@/lib/theme';

type CajaBannerProps = {
  caja: CajaRow | null;
  loading: boolean;
  onAbrir: () => void;
  onVerTurno: () => void;
};

export function CajaBanner({ caja, loading, onAbrir, onVerTurno }: CajaBannerProps) {
  if (caja) {
    return (
      <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
        <View className="flex-row items-center gap-2">
          <View className="h-2 w-2 rounded-full bg-primary" />
          <Text className="font-body text-xs text-fg">
            Turno abierto · {formatDateTime(caja.fecha_apertura)}
          </Text>
        </View>
        <Button
          label="Ver turno"
          variant="ghost"
          size="sm"
          onPress={onVerTurno}
          icon={<Feather name="clock" size={14} color={palette.muted} />}
          className="px-2"
        />
      </View>
    );
  }

  return (
    <Banner
      tone="warning"
      title="Caja cerrada"
      action={
        <Button label="Abrir caja" size="sm" variant="accent" onPress={onAbrir} loading={loading} />
      }
    >
      Abrí un turno para poder cobrar. El stock y el carrito quedan intactos.
    </Banner>
  );
}
