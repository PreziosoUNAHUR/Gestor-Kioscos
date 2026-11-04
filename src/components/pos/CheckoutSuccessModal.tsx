import Feather from '@expo/vector-icons/Feather';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { VentaRow } from '@/lib/database.types';
import { formatDateTime, formatMoney, metodoPagoLabel } from '@/lib/format';
import { palette } from '@/lib/theme';

type CheckoutSuccessModalProps = {
  ticket: VentaRow | null;
  onClose: () => void;
  currency?: string;
};

export function CheckoutSuccessModal({ ticket, onClose, currency = 'ARS' }: CheckoutSuccessModalProps) {
  return (
    <Modal
      visible={Boolean(ticket)}
      onClose={onClose}
      title="Venta registrada"
      subtitle={ticket ? `Ticket #${ticket.numero} · ${formatDateTime(ticket.fecha)}` : undefined}
      size="sm"
      footer={<Button label="Nueva venta" onPress={onClose} fullWidth size="lg" />}
    >
      {ticket ? (
        <>
          <View className="items-center gap-1 border-[3px] border-black bg-[#DCFCE7] px-4 py-5">
            <View className="mb-1 h-10 w-10 items-center justify-center border-[3px] border-black bg-success">
              <Feather name="check" size={22} color={palette.ink} />
            </View>
            <Text className="font-pixel text-pixel-2xs uppercase text-[#14532D]">Total cobrado</Text>
            <Text className="font-pixel text-pixel-lg text-[#14532D]">
              {formatMoney(ticket.total, currency)}
            </Text>
            {ticket.es_fiado ? (
              <Text className="font-body text-2xs text-[#14532D]">
                Quedó anotado en el cuaderno del cliente.
              </Text>
            ) : null}
          </View>

          <View className="gap-2 border-[3px] border-black bg-elevated p-3">
            <Row
              label="Medio de pago"
              value={ticket.es_fiado ? 'Fiado' : metodoPagoLabel(ticket.metodo_pago)}
            />
            <Row label="Subtotal" value={formatMoney(ticket.subtotal, currency)} mono />
            {Number(ticket.descuento) > 0 ? (
              <Row label="Descuento" value={`- ${formatMoney(ticket.descuento, currency)}`} mono />
            ) : null}
            {ticket.monto_recibido !== null ? (
              <Row label="Recibido" value={formatMoney(ticket.monto_recibido, currency)} mono />
            ) : null}
            {ticket.vuelto !== null ? (
              <Row label="Vuelto" value={formatMoney(ticket.vuelto, currency)} mono />
            ) : null}
          </View>

          <Text className="text-center font-body text-2xs text-muted">
            El stock ya quedó descontado y la caja actualizada.
          </Text>
        </>
      ) : null}
    </Modal>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-body text-xs text-muted">{label}</Text>
      <Text className={mono ? 'font-mono text-xs text-fg' : 'font-body-medium text-xs text-fg'}>{value}</Text>
    </View>
  );
}
