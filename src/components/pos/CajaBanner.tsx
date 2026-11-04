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
      <View className="flex-row flex-wrap items-center justify-between gap-2 border-[3px] border-black bg-[#DCFCE7] px-3 py-2">
        <View className="flex-row items-center gap-2">
          <View className="h-2.5 w-2.5 border border-black bg-success" />
          <Text className="font-body text-xs text-[#14532D]">
            Turno abierto · {formatDateTime(caja.fecha_apertura)}
          </Text>
        </View>
        <Button
          label="Ver turno"
          variant="secondary"
          size="sm"
          onPress={onVerTurno}
          icon={<Feather name="clock" size={14} color={palette.fg} />}
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
