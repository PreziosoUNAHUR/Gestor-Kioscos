import Feather from '@expo/vector-icons/Feather';
import { Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import type { ScannerStatus } from '@/hooks/useScannerSync';
import { formatDateTime } from '@/lib/format';
import { palette } from '@/lib/theme';
import type { HostSession } from '@/stores/pairing';

type PairingModalProps = {
  visible: boolean;
  onClose: () => void;
  session: HostSession | null;
  hostActive: boolean;
  activating: boolean;
  peerCount: number;
  status: ScannerStatus;
  error: string | null;
  onActivate: () => void;
  onRotate: () => void;
  onDeactivate: () => void;
};

const STATUS_LABEL: Record<ScannerStatus, string> = {
  idle: 'Sin iniciar',
  connecting: 'Conectando…',
  connected: 'Escuchando',
  error: 'Sin conexión',
  disabled: 'Desactivado',
};

const STATUS_TONE: Record<ScannerStatus, 'neutral' | 'primary' | 'accent' | 'danger'> = {
  idle: 'neutral',
  connecting: 'accent',
  connected: 'primary',
  error: 'danger',
  disabled: 'neutral',
};

function splitCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export function PairingModal({
  visible,
  onClose,
  session,
  hostActive,
  activating,
  peerCount,
  status,
  error,
  onActivate,
  onRotate,
  onDeactivate,
}: PairingModalProps) {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Escáner remoto"
      subtitle="El celular agrega productos a esta caja"
      size="sm"
      footer={
        <View className="flex-row gap-2">
          {hostActive ? (
            <>
              <Button label="Nuevo código" variant="secondary" onPress={onRotate} className="flex-1" icon={<Feather name="refresh-cw" size={15} color={palette.fg} />} />
              <Button label="Desconectar" variant="danger" onPress={onDeactivate} className="flex-1" />
            </>
          ) : (
            <Button
              label="Activar vinculación"
              onPress={onActivate}
              loading={activating}
              className="flex-1"
              icon={<Feather name="smartphone" size={15} color={palette.primaryFg} />}
            />
          )}
        </View>
      }
    >
      <View className="flex-row items-center justify-between gap-2">
        <Badge tone={hostActive ? STATUS_TONE[status] : 'neutral'}>
          {hostActive ? STATUS_LABEL[status] : 'Inactivo'}
        </Badge>
        {hostActive ? (
          <Text className="font-body text-xs text-muted">
            {peerCount === 0 ? 'Ningún celular conectado' : `${peerCount} celular${peerCount > 1 ? 'es' : ''} conectado${peerCount > 1 ? 's' : ''}`}
          </Text>
        ) : null}
      </View>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      {activating && !session ? <Spinner compact label="Generando código…" /> : null}

      {session ? (
        <View className="items-center gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-5">
          <Text className="font-body-medium text-2xs uppercase tracking-wide text-muted">Código de vinculación</Text>
          <Text
            selectable
            className="font-mono-bold text-[40px] tracking-[6px] text-primary-ink"
          >
            {splitCode(session.codigo)}
          </Text>
          <Text className="font-body text-2xs text-muted">
            {hostActive
              ? `Vence el ${formatDateTime(session.expiraAt)} · sólo miembros del kiosco`
              : 'Sesión pausada'}
          </Text>
        </View>
      ) : (
        <View className="items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-6">
          <Feather name="wifi-off" size={22} color={palette.muted} />
          <Text className="text-center font-body text-sm text-muted">
            Activá la vinculación para que esta PC escuche los escaneos del celular.
          </Text>
        </View>
      )}

      <View className="gap-2 rounded-xl border border-line bg-bg/40 p-3">
        <Text className="font-body-semibold text-xs text-fg">Cómo conectar el celular</Text>
        <Text className="font-body text-xs leading-5 text-muted">
          1. Abrí Gestor Kioscos en el celular con la misma cuenta.{'\n'}
          2. Entrá a <Text className="text-fg">Escáner</Text> y escribí el código.{'\n'}
          3. La cámara agrega los productos acá, con confirmación en pantalla.
        </Text>
      </View>

      <Banner tone="warning" title="La PC manda">
        Si la PC está apagada o sin internet, el celular sigue funcionando solo: puede vender y consultar stock, pero
        no escanear a distancia.
      </Banner>
    </Modal>
  );
}
