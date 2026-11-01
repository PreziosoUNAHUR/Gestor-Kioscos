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
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Screen } from '@/components/ui/Screen';
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

export default function EscanerScreen() {
  useKeepAwake();

  const desktop = useIsDesktop();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const askedRef = useRef(false);

  const remoteCode = usePairingStore((store) => store.remoteCode);
  const remoteKioscoId = usePairingStore((store) => store.remoteKioscoId);
  const pairingLoading = usePairingStore((store) => store.loading);
  const pairingError = usePairingStore((store) => store.error);
  const resolverCodigo = usePairingStore((store) => store.resolverCodigo);
  const clearRemote = usePairingStore((store) => store.clearRemote);

  const paired = Boolean(remoteCode && remoteKioscoId);

  const scanner = useScannerSync({
    role: 'remote',
    kioscoId: remoteKioscoId,
    pairingCode: remoteCode,
    enabled: paired,
  });
  const { sendBarcode } = scanner;

  const [codeInput, setCodeInput] = useState(remoteCode);
  const [manual, setManual] = useState('');
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [inflight, setInflight] = useState(0);
  const gateRef = useRef(createScanGate(SCAN_COOLDOWN_MS));

  useEffect(() => {
    setCodeInput(remoteCode);
  }, [remoteCode]);

  useEffect(() => {
    gateRef.current.reset();
  }, [remoteCode]);

  // Pedimos la cámara una sola vez al vincular. Si el usuario la niega, el botón
  // de la pantalla permite volver a pedirla sin caer en un loop de prompts.
  useEffect(() => {
    if (!paired || !permission || permission.granted || askedRef.current) return;
    askedRef.current = true;
    void requestPermission();
  }, [paired, permission, requestPermission]);

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
        outcome.ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
    },
    [sendBarcode],
  );

  const connect = async () => {
    const kiosco = await resolverCodigo(codeInput);
    if (kiosco) setCodeInput(normalizePairingCode(codeInput));
  };

  const disconnect = () => {
    clearRemote();
    setCodeInput('');
    setFeed([]);
    setManual('');
  };

  const canScan = Boolean(
    paired && focused && permission?.granted && scanner.connected && scanner.hostOnline,
  );

  const statusLabel = !scanner.connected
    ? scanner.status === 'error'
      ? 'Sin conexión'
      : 'Conectando…'
    : scanner.hostOnline
      ? 'Listo para escanear'
      : 'PC sin escáner';

  const statusTone =
    scanner.status === 'error' ? 'danger' : scanner.connected && scanner.hostOnline ? 'primary' : 'accent';

  const placeholder = !scanner.connected
    ? 'Conectando con la PC…'
    : !scanner.hostOnline
      ? 'La PC está conectada pero no tiene el escáner activo.'
      : !permission?.granted
        ? 'Necesitamos permiso para usar la cámara.'
        : 'La cámara se pausa cuando salís de esta pestaña.';

  return (
    <Screen>
      <PageHeader
        eyebrow="Escáner remoto"
        title="Escáner"
        subtitle="La cámara del celular agrega productos al carrito de la PC."
        actions={
          paired ? (
            <Button
              label="Desconectar"
              variant="secondary"
              size="sm"
              onPress={disconnect}
              icon={<Feather name="x" size={14} color={palette.muted} />}
            />
          ) : undefined
        }
      />

      {desktop ? (
        <Banner tone="info" title="Estás en la PC" className="mb-4">
          Esta pantalla está pensada para el celular. En la PC, activá el escáner desde Caja → Escáner.
        </Banner>
      ) : null}

      {!paired ? (
        <Card glass className="mx-auto w-full max-w-[460px] gap-4 p-5">
          <View className="items-center gap-2">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
              <Feather name="camera" size={22} color={palette.primary} />
            </View>
            <Text className="text-center font-heading text-lg text-fg">Vincular con la PC</Text>
            <Text className="text-center font-body text-xs leading-5 text-muted">
              En la PC abrí <Text className="text-fg">Caja → Escáner</Text> y activá la vinculación. Después
              escribí el código de 6 caracteres.
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
            icon={<Feather name="link" size={16} color={palette.primaryFg} />}
          />

          <Text className="text-center font-body text-2xs leading-5 text-muted">
            La PC y el celular usan la misma cuenta. Si la PC se apaga, podés seguir vendiendo desde el
            celular, pero el escaneo remoto queda pausado.
          </Text>
        </Card>
      ) : (
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Badge tone={statusTone}>{statusLabel}</Badge>
            <Text className="font-body text-2xs text-muted">
              {scanner.hostOnline ? 'PC conectada' : 'Esperando a la PC'}
            </Text>
          </View>

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

          <View className="relative overflow-hidden rounded-2xl border border-line bg-black">
            {canScan ? (
              <CameraView
                style={{ height: 300 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                onBarcodeScanned={({ data }) => void handleScan(data)}
              />
            ) : (
              <View className="h-[300px] items-center justify-center gap-3 bg-bg/60 px-6">
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
                <View className="h-[130px] w-[78%] rounded-2xl border-2 border-primary/70" />
                <Text className="mt-3 font-body text-2xs text-fg/80">Apuntá al código de barras</Text>
              </View>
            ) : null}
          </View>

          {inflight > 0 ? (
            <Text className="font-body text-2xs text-muted">
              Enviando {inflight} {inflight === 1 ? 'código' : 'códigos'}…
            </Text>
          ) : null}

          <Card className="gap-3">
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
              icon={<Feather name="send" size={15} color={palette.primaryFg} />}
            />
          </Card>

          <Card className="gap-2">
            <Text className="font-heading text-base text-fg">Últimos escaneos</Text>
            {feed.length === 0 ? (
              <Text className="font-body text-xs text-muted">
                Todavía no escaneaste nada en esta sesión.
              </Text>
            ) : (
              feed.map((entry) => (
                <View
                  key={entry.id}
                  className="flex-row items-start gap-2 rounded-lg border border-line bg-bg/40 px-2.5 py-2"
                >
                  <Feather
                    name={entry.outcome.ok ? 'check-circle' : 'x-circle'}
                    size={15}
                    color={entry.outcome.ok ? palette.primary : palette.dangerInk}
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
          </Card>
        </View>
      )}
    </Screen>
  );
}
