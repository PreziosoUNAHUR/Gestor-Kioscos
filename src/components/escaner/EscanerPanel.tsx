import Feather from '@expo/vector-icons/Feather';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useIsDesktop } from '@/hooks/useAdaptive';
import { useScannerSync } from '@/hooks/useScannerSync';
import { formatTime } from '@/lib/format';
import {
  SCAN_COOLDOWN_MS,
  createScanGate,
  isPairingCode,
  normalizeBarcode,
  normalizePairingCode,
  type ScanOutcome,
} from '@/lib/scanner';
import { palette } from '@/lib/theme';
import { usePairingStore } from '@/stores/pairing';

type FeedEntry = {
  id: string;
  code: string;
  outcome: ScanOutcome;
  at: number;
};

const BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
  'qr',
] as const;

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'not_found':
      return 'No está en el catálogo.';
    case 'offline':
      return 'Sin conexión con la PC.';
    case 'timeout':
      return 'La PC no respondió.';
    case 'duplicate':
      return 'Escaneo repetido (anti doble lectura).';
    case 'inactive':
      return 'La sesión de la PC está inactiva.';
    default:
      return 'No se pudo enviar el código.';
  }
}

/**
 * Escáner remoto dentro de Ajustes: vincular este dispositivo con la PC y usar
 * la cámara para mandar códigos de barras al carrito de la caja.
 */
export function EscanerPanel() {
  const desktop = useIsDesktop();

  const remoteCode = usePairingStore((store) => store.remoteCode);
  const remoteKioscoId = usePairingStore((store) => store.remoteKioscoId);
  const pairingLoading = usePairingStore((store) => store.loading);
  const pairingError = usePairingStore((store) => store.error);
  const resolverCodigo = usePairingStore((store) => store.resolverCodigo);

  const [codeInput, setCodeInput] = useState(remoteCode);

  useEffect(() => {
    setCodeInput(remoteCode);
  }, [remoteCode]);

  const connect = async () => {
    const kiosco = await resolverCodigo(codeInput);
    if (kiosco) setCodeInput(normalizePairingCode(codeInput));
  };

  if (remoteCode && remoteKioscoId) {
    return (
      <ScannerSession
        key={`${remoteKioscoId}:${remoteCode}`}
        kioscoId={remoteKioscoId}
        pairingCode={remoteCode}
        desktop={desktop}
      />
    );
  }

  return (
    <View className="gap-3">
      {desktop ? (
        <Banner tone="info" title="Estás en la PC">
          Esta parte está pensada para el celular. En la PC, activá la sesión desde Caja → Escáner.
        </Banner>
      ) : null}

      <View className="items-center gap-1">
        <View className="mb-1 h-11 w-11 items-center justify-center border-[3px] border-black bg-accent">
          <Feather name="camera" size={20} color={palette.ink} />
        </View>
        <Text className="text-center font-pixel text-pixel-xs uppercase text-fg">Vincular con la PC</Text>
        <Text className="text-center font-body text-xs leading-5 text-muted">
          En la PC abrí Caja → Escáner y activá la vinculación. Después escribí el código de 6
          caracteres.
        </Text>
      </View>

      {pairingError ? <Banner tone="danger">{pairingError}</Banner> : null}

      <Input
        label="Código de la PC"
        value={codeInput}
        onChangeText={(text) => setCodeInput(normalizePairingCode(text))}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        returnKeyType="go"
        onSubmitEditing={() => void connect()}
        inputClassName="font-mono-bold"
        style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
      />

      <Button
        label="Conectar"
        onPress={() => void connect()}
        loading={pairingLoading}
        disabled={!isPairingCode(codeInput)}
        fullWidth
        size="lg"
        icon={<Feather name="link" size={16} color={palette.ink} />}
      />

      <Text className="text-center font-body text-2xs leading-5 text-muted">
        La PC y el celular usan la misma cuenta. Si la PC se apaga, podés seguir vendiendo desde el
        celular, pero el escaneo remoto queda pausado.
      </Text>
    </View>
  );
}

type ScannerSessionProps = {
  kioscoId: string;
  pairingCode: string;
  desktop: boolean;
};

function ScannerSession({ kioscoId, pairingCode, desktop }: ScannerSessionProps) {
  useKeepAwake();

  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const askedRef = useRef(false);

  const clearRemote = usePairingStore((store) => store.clearRemote);

  const scanner = useScannerSync({
    role: 'remote',
    kioscoId,
    pairingCode,
    enabled: true,
  });
  const { sendBarcode } = scanner;

  const [manual, setManual] = useState('');
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [inflight, setInflight] = useState(0);
  const gateRef = useRef(createScanGate(SCAN_COOLDOWN_MS));

  useEffect(() => {
    gateRef.current.reset();
  }, [pairingCode]);

  // Pedimos la cámara una sola vez al vincular. Si el usuario la niega, el botón
  // permite volver a pedirla sin caer en un loop de prompts.
  useEffect(() => {
    if (!permission || permission.granted || askedRef.current) return;
    askedRef.current = true;
    void requestPermission();
  }, [permission, requestPermission]);

  const handleScan = useCallback(
    async (raw: string) => {
      const code = normalizeBarcode(raw);
      if (!code) return;

      // La cámara dispara el mismo frame varias veces: este gate es local y el
      // hook vuelve a validar del lado de la PC.
      if (!gateRef.current.shouldAccept(code)) return;

      setInflight((value) => value + 1);
      const outcome = await sendBarcode(code);
      setInflight((value) => Math.max(0, value - 1));

      setFeed((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            code,
            outcome,
            at: Date.now(),
          },
          ...prev,
        ].slice(0, 12),
      );
      setManual('');

      void Haptics.notificationAsync(
        outcome.ok
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    },
    [sendBarcode],
  );

  const disconnect = () => {
    clearRemote();
    setFeed([]);
    setManual('');
  };

  const canScan = Boolean(focused && permission?.granted && scanner.connected && scanner.hostOnline);

  const statusLabel = !scanner.connected
    ? scanner.status === 'error'
      ? 'Sin conexión'
      : 'Conectando…'
    : scanner.hostOnline
      ? 'Listo para escanear'
      : 'PC sin escáner';

  const statusTone =
    scanner.status === 'error'
      ? 'danger'
      : scanner.connected && scanner.hostOnline
        ? 'primary'
        : 'accent';

  const placeholder = !scanner.connected
    ? 'Conectando con la PC…'
    : !scanner.hostOnline
      ? 'La PC está conectada pero no tiene el escáner activo.'
      : !permission?.granted
        ? 'Necesitamos permiso para usar la cámara.'
        : 'La cámara se pausa cuando salís de esta pestaña.';

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Badge tone={statusTone}>{statusLabel}</Badge>
        <View className="flex-row items-center gap-2">
          <Text className="font-body text-2xs text-muted">
            {scanner.hostOnline ? 'PC conectada' : 'Esperando a la PC'}
          </Text>
          <Button
            label="Desconectar"
            variant="secondary"
            size="sm"
            onPress={disconnect}
            icon={<Feather name="x" size={13} color={palette.fg} />}
          />
        </View>
      </View>

      {desktop ? (
        <Banner tone="info" title="Estás en la PC">
          Para escanear con el celular, abrí Ajustes en el teléfono y vinculalo con el código de
          Caja → Escáner.
        </Banner>
      ) : null}

      {scanner.status === 'error' ? (
        <Banner
          tone="danger"
          title="No pudimos conectar el escáner"
          action={<Button label="Reintentar" size="sm" variant="secondary" onPress={scanner.retry} />}
        >
          {scanner.error ?? 'Revisá Realtime y las políticas del proyecto.'}
        </Banner>
      ) : null}

      {scanner.connected && !scanner.hostOnline ? (
        <Banner tone="warning" title="La PC no está escuchando">
          Activá la vinculación en la PC (Caja → Escáner) y verificá que el código siga vigente.
        </Banner>
      ) : null}

      <View className="relative overflow-hidden rounded-none border-[3px] border-black bg-black">
        {canScan ? (
          <CameraView
            style={{ height: 280 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={({ data }) => void handleScan(data)}
          />
        ) : (
          <View className="h-[280px] items-center justify-center gap-3 bg-elevated px-6">
            <Feather
              name={permission?.granted ? 'camera-off' : 'camera'}
              size={30}
              color={palette.muted}
            />
            <Text className="text-center font-body text-sm text-muted">{placeholder}</Text>
            {permission && !permission.granted ? (
              <Button label="Permitir cámara" onPress={() => void requestPermission()} />
            ) : null}
          </View>
        )}

        {canScan ? (
          <View className="absolute inset-0 items-center justify-center">
            <View className="h-[120px] w-[78%] border-[3px] border-accent" />
            <Text className="mt-3 font-body text-2xs text-white">Apuntá al código de barras</Text>
          </View>
        ) : null}
      </View>

      {inflight > 0 ? (
        <Text className="font-body text-2xs text-muted">
          Enviando {inflight} {inflight === 1 ? 'código' : 'códigos'}…
        </Text>
      ) : null}

      <View className="gap-2 border-[3px] border-black bg-elevated p-2.5">
        <Input
          label="Código manual"
          value={manual}
          onChangeText={setManual}
          placeholder="Escribí o pegá un código"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={() => void handleScan(manual)}
          inputClassName="font-mono"
        />
        <Button
          label="Enviar a la PC"
          onPress={() => void handleScan(manual)}
          disabled={!manual.trim() || !scanner.connected || !scanner.hostOnline}
          icon={<Feather name="send" size={15} color={palette.ink} />}
        />
      </View>

      <View className="gap-2 border-[3px] border-black bg-elevated p-2.5">
        <Text className="font-pixel text-pixel-2xs uppercase text-fg">Últimos escaneos</Text>
        {feed.length === 0 ? (
          <Text className="font-body text-xs text-muted">
            Todavía no escaneaste nada en esta sesión.
          </Text>
        ) : (
          feed.map((entry) => (
            <View
              key={entry.id}
              className="flex-row items-start gap-2 border-2 border-black bg-bg px-2 py-1.5"
            >
              <Feather
                name={entry.outcome.ok ? 'check-circle' : 'x-circle'}
                size={14}
                color={entry.outcome.ok ? palette.successInk : palette.dangerInk}
                style={{ marginTop: 1 }}
              />
              <View className="flex-1 gap-0.5">
                <Text className="font-mono text-xs text-fg" numberOfLines={1}>
                  {entry.code}
                </Text>
                <Text className="font-body text-2xs text-muted">
                  {entry.outcome.ok
                    ? `${entry.outcome.nombre ?? 'Producto'} · ${entry.outcome.cantidad ?? 1} u.`
                    : (entry.outcome.message ?? reasonLabel(entry.outcome.reason))}
                </Text>
              </View>
              <Text className="font-mono text-2xs text-muted">{formatTime(new Date(entry.at))}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
