import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatMoney, parseMoneyInput } from '@/lib/format';

type OpenCajaModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (montoInicial: number) => void;
  loading: boolean;
  error: string | null;
  currency?: string;
};

const QUICK_AMOUNTS = [0, 5000, 10000, 20000];

export function OpenCajaModal({ visible, onClose, onConfirm, loading, error, currency = 'ARS' }: OpenCajaModalProps) {
  const [monto, setMonto] = useState('');

  useEffect(() => {
    if (visible) setMonto('');
  }, [visible]);

  const montoNum = parseMoneyInput(monto);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Abrir caja"
      subtitle="Registrá el efectivo inicial del turno"
      size="sm"
      footer={
        <View className="flex-row gap-2">
          <Button label="Cancelar" variant="secondary" onPress={onClose} className="flex-1" />
          <Button
            label="Abrir caja"
            onPress={() => onConfirm(montoNum)}
            loading={loading}
            className="flex-1"
          />
        </View>
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Input
        label="Monto inicial"
        value={monto}
        onChangeText={setMonto}
        placeholder="0,00"
        keyboardType="decimal-pad"
        hint="Podés dejarlo en 0 si no cargás cambio."
        autoFocus
      />

      <View className="flex-row flex-wrap gap-2">
        {QUICK_AMOUNTS.map((amount) => (
          <Button
            key={amount}
            label={amount === 0 ? 'Sin cambio' : formatMoney(amount, currency)}
            variant="secondary"
            size="sm"
            onPress={() => setMonto(amount === 0 ? '' : String(amount))}
            className="flex-1"
          />
        ))}
      </View>

      <Text className="font-body text-2xs leading-5 text-muted">
        Una sola caja abierta por kiosco. La PC y el celular comparten el mismo turno.
      </Text>
    </Modal>
  );
}
