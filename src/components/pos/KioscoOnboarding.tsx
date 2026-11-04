import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { palette } from '@/lib/theme';
import { useKioscoStore } from '@/stores/kiosco';

/** Primer arranque: sin kiosco no hay caja. */
export function KioscoOnboarding() {
  const create = useKioscoStore((store) => store.create);
  const error = useKioscoStore((store) => store.error);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!nombre.trim()) return;
    setLoading(true);
    await create(nombre);
    setLoading(false);
  };

  return (
    <Card className="mx-auto w-full max-w-[520px] gap-4 p-5">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center border-[3px] border-black bg-accent">
          <Feather name="shopping-bag" size={20} color={palette.ink} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-pixel text-pixel-xs uppercase text-fg">Creá tu kiosco</Text>
          <Text className="font-body text-xs text-muted">
            Es el espacio donde viven caja, stock, cuaderno y ventas.
          </Text>
        </View>
      </View>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Input
        label="Nombre del kiosco"
        value={nombre}
        onChangeText={setNombre}
        placeholder="Kiosco El Sol"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        autoFocus
      />

      <Button
        label="Crear kiosco"
        onPress={() => void submit()}
        loading={loading}
        disabled={!nombre.trim()}
        fullWidth
        size="lg"
      />
    </Card>
  );
}
