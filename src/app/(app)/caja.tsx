import Feather from '@expo/vector-icons/Feather';
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { OpenCajaModal } from '@/components/pos/OpenCajaModal';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Screen } from '@/components/ui/Screen';
import { Spinner } from '@/components/ui/Spinner';
import { Stat } from '@/components/ui/Stat';
import { useActiveKiosco } from '@/hooks/useKioscoData';
import type { CajaRow } from '@/lib/database.types';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime, formatMoney, metodoPagoUiLabel, parseMoneyInput } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import { useCajaStore } from '@/stores/caja';
import { useKioscoStore } from '@/stores/kiosco';

function differenceTone(value: number | null): 'primary' | 'accent' | 'danger' | 'neutral' {
  if (value === null) return 'neutral';
  if (Math.abs(value) < 0.005) return 'primary';
  return value > 0 ? 'accent' : 'danger';
}

function differenceLabel(value: number | null): string {
  if (value === null) return 'Sin cierre';
  if (Math.abs(value) < 0.005) return 'Sin diferencia';
  return value > 0 ? 'Sobrante' : 'Faltante';
}

function differenceClass(value: number | null): string {
  if (value === null || Math.abs(value) < 0.005) return 'text-primary-ink';
  return value > 0 ? 'text-accent-ink' : 'text-danger-ink';
}

export default function TurnoScreen() {
  const kiosco = useActiveKiosco();
  const kioscoId = kiosco?.id ?? null;
  const currency = kiosco?.moneda ?? 'ARS';

  const kioscosLoaded = useKioscoStore((store) => store.loaded);
  const kioscoError = useKioscoStore((store) => store.error);
  const loadKioscos = useKioscoStore((store) => store.load);
  const focused = useIsFocused();

  const caja = useCajaStore((store) => store.caja);
  const resumen = useCajaStore((store) => store.resumen);
  const loading = useCajaStore((store) => store.loading);
  const error = useCajaStore((store) => store.error);
  const load = useCajaStore((store) => store.load);
  const abrir = useCajaStore((store) => store.abrir);
  const cerrar = useCajaStore((store) => store.cerrar);

  const [openOpen, setOpenOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [contado, setContado] = useState('');
  const [notas, setNotas] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [lastClosed, setLastClosed] = useState<CajaRow | null>(null);

  const [history, setHistory] = useState<CajaRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!focused || !kioscoId) return;
    void load(kioscoId);
  }, [focused, kioscoId, load]);

  // Al cambiar de kiosco, el cierre anterior y el historial dejan de aplicar.
  useEffect(() => {
    setLastClosed(null);
    setHistory([]);
  }, [kioscoId]);

  const loadHistory = useCallback(async () => {
    if (!kioscoId) return;

    setHistoryLoading(true);
    const { data, error: queryError } = await supabase
      .from('cajas')
      .select('*')
      .eq('kiosco_id', kioscoId)
      .eq('estado', 'cerrada')
      .order('fecha_cierre', { ascending: false })
      .limit(20);

    setHistoryLoading(false);

    if (queryError) {
      setHistoryError(getErrorMessage(queryError));
      return;
    }

    setHistoryError(null);
    setHistory(data ?? []);
  }, [kioscoId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, tick]);

  const porMetodo = useMemo(() => {
    if (!resumen) return [];
    return Object.entries(resumen.por_metodo)
      .map(([metodo, total]) => ({ metodo, total }))
      .sort((a, b) => b.total - a.total);
  }, [resumen]);

  const maxMetodo = Math.max(...porMetodo.map((entry) => entry.total), 1);
  const esperado = resumen?.efectivo_esperado ?? caja?.efectivo_esperado ?? 0;
  const contadoNum = parseMoneyInput(contado);
  const diferencia = contadoNum - esperado;

  const handleOpen = async (monto: number) => {
    if (!kioscoId) return;
    const ok = await abrir(kioscoId, monto);
    if (ok) {
      setOpenOpen(false);
      setLastClosed(null);
    }
  };

  const openCloseModal = () => {
    setContado(esperado ? String(esperado) : '');
    setNotas('');
    setCloseError(null);
    setCloseOpen(true);
  };

  const submitClose = async () => {
    if (!caja) return;

    setCloseError(null);
    setClosing(true);
    const closed = await cerrar(caja.id, contadoNum, notas);
    setClosing(false);

    if (!closed) {
      setCloseError(useCajaStore.getState().error ?? 'No se pudo cerrar la caja.');
      return;
    }

    setCloseOpen(false);
    setContado('');
    setNotas('');
    setLastClosed(closed);
    setTick((value) => value + 1);
  };

  if (!kiosco) {
    if (!kioscosLoaded) {
      return (
        <Screen>
          <PageHeader title="Turno" />
          {kioscoError ? (
            <Banner
              tone="danger"
              title="No pudimos cargar tus kioscos"
              action={
                <Button
                  label="Reintentar"
                  size="sm"
                  variant="secondary"
                  onPress={() => void loadKioscos(true)}
                />
              }
            >
              {kioscoError}
            </Banner>
          ) : (
            <Spinner label="Cargando kioscos…" />
          )}
        </Screen>
      );
    }

    return (
      <Screen>
        <PageHeader title="Turno" subtitle="Necesitás un kiosco para abrir la caja." />
        <EmptyState
          icon={<Feather name="shopping-bag" size={24} color={palette.muted} />}
          title="Todavía no hay un kiosco"
          description="Creá tu kiosco desde Ajustes y volvé para abrir el primer turno."
          action={<Button label="Ir a Ajustes" onPress={() => router.push('/ajustes')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="Turno"
        title="Caja del turno"
        subtitle={`${kiosco.nombre} · ${kiosco.moneda}`}
        actions={
          <Button
            label="Actualizar"
            variant="secondary"
            size="sm"
            loading={loading}
            onPress={() => {
              if (kioscoId) void load(kioscoId);
              setTick((value) => value + 1);
            }}
            icon={<Feather name="refresh-cw" size={14} color={palette.muted} />}
          />
        }
      />

      <View className="gap-4">
        {error && !openOpen && !closeOpen ? <Banner tone="danger">{error}</Banner> : null}

        {lastClosed ? (
          <Banner
            tone="success"
            title="Caja cerrada correctamente"
            action={
              <Button label="Ocultar" size="sm" variant="ghost" onPress={() => setLastClosed(null)} />
            }
          >
            {`Esperado ${formatMoney(lastClosed.efectivo_esperado ?? 0, currency)} · contado ${formatMoney(lastClosed.efectivo_contado ?? 0, currency)} · ${differenceLabel(lastClosed.diferencia)} ${formatMoney(lastClosed.diferencia ?? 0, currency)}.`}
          </Banner>
        ) : null}

        {caja ? (
          <>
            <Card className="gap-3">
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <View className="gap-0.5">
                  <View className="flex-row items-center gap-2">
                    <View className="h-2 w-2 rounded-full bg-primary" />
                    <Text className="font-heading text-base text-fg">Turno abierto</Text>
                    <Badge tone="primary">En curso</Badge>
                  </View>
                  <Text className="font-body text-xs text-muted">
                    Abierto el {formatDateTime(caja.fecha_apertura)}
                  </Text>
                </View>

                <Button
                  label="Cerrar turno"
                  variant="danger"
                  size="sm"
                  onPress={openCloseModal}
                  icon={<Feather name="lock" size={14} color={palette.primaryFg} />}
                />
              </View>

              <View className="flex-row flex-wrap gap-2">
                <Stat
                  label="Ventas"
                  value={String(resumen?.ventas_cantidad ?? 0)}
                  hint={`${resumen?.ventas_cantidad ?? 0} ticket${resumen?.ventas_cantidad === 1 ? '' : 's'}`}
                  className="min-w-[120px]"
                />
                <Stat
                  label="Facturado"
                  value={formatMoney(resumen?.ventas_total ?? 0, currency)}
                  tone="primary"
                  className="min-w-[160px]"
                />
                <Stat
                  label="Efectivo esperado"
                  value={formatMoney(esperado, currency)}
                  hint="Inicial + ventas − gastos − compras"
                  className="min-w-[170px]"
                />
                <Stat
                  label="Monto inicial"
                  value={formatMoney(resumen?.monto_inicial ?? caja.monto_inicial, currency)}
                  className="min-w-[140px]"
                />
              </View>

              <View className="flex-row flex-wrap gap-2">
                <Stat
                  label="Ventas en efectivo"
                  value={formatMoney(resumen?.ventas_efectivo ?? 0, currency)}
                  className="min-w-[150px]"
                />
                <Stat
                  label="Gastos"
                  value={formatMoney(resumen?.gastos_total ?? 0, currency)}
                  hint={`${formatMoney(resumen?.gastos_efectivo ?? 0, currency)} en efectivo`}
                  className="min-w-[130px]"
                />
                <Stat
                  label="Compras"
                  value={formatMoney(resumen?.compras_total ?? 0, currency)}
                  hint={`${formatMoney(resumen?.compras_efectivo ?? 0, currency)} en efectivo`}
                  className="min-w-[130px]"
                />
                <Stat
                  label="Anuladas"
                  value={String(resumen?.anuladas_cantidad ?? 0)}
                  hint={formatMoney(resumen?.anuladas_total ?? 0, currency)}
                  tone={(resumen?.anuladas_cantidad ?? 0) > 0 ? 'danger' : 'default'}
                  className="min-w-[130px]"
                />
              </View>

              {loading && !resumen ? <Spinner compact label="Calculando el turno…" /> : null}
            </Card>

            <Card className="gap-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="font-heading text-base text-fg">Medios de pago</Text>
                <Text className="font-body text-2xs text-muted">Sólo ventas completadas</Text>
              </View>

              {porMetodo.length === 0 ? (
                <Text className="font-body text-xs text-muted">Todavía no hay ventas en este turno.</Text>
              ) : (
                porMetodo.map(({ metodo, total }) => (
                  <View key={metodo} className="gap-1">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="font-body-medium text-xs text-fg">{metodoPagoUiLabel(metodo)}</Text>
                      <Money value={total} currency={currency} size="sm" />
                    </View>
                    <View className="h-1.5 overflow-hidden rounded-full bg-bg/60">
                      <View
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((total / maxMetodo) * 100)}%` }}
                      />
                    </View>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : (
          <Card className="gap-3">
            <EmptyState
              icon={<Feather name="lock" size={24} color={palette.muted} />}
              title="La caja está cerrada"
              description="Abrí un turno para cobrar. El stock, el catálogo y el carrito quedan intactos."
              action={
                <Button
                  label="Abrir caja"
                  onPress={() => setOpenOpen(true)}
                  loading={loading}
                  icon={<Feather name="unlock" size={15} color={palette.primaryFg} />}
                />
              }
            />
          </Card>
        )}

        <Card className="gap-3">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1 gap-0.5">
              <Text className="font-heading text-base text-fg">Últimos cierres</Text>
              <Text className="font-body text-2xs text-muted">Los 20 turnos cerrados más recientes.</Text>
            </View>
            <Button
              label="Refrescar"
              variant="ghost"
              size="sm"
              loading={historyLoading}
              onPress={() => setTick((value) => value + 1)}
              icon={<Feather name="refresh-cw" size={14} color={palette.muted} />}
            />
          </View>

          {historyError ? (
            <Banner tone="danger" title="No pudimos cargar el historial">
              {historyError}
            </Banner>
          ) : null}

          {historyLoading && history.length === 0 ? (
            <Spinner compact label="Cargando cierres…" />
          ) : history.length === 0 ? (
            <Text className="font-body text-xs text-muted">
              Todavía no cerraste ningún turno en este kiosco.
            </Text>
          ) : (
            <View className="gap-2">
              {history.map((entry) => (
                <View key={entry.id} className="gap-1 rounded-xl border border-line bg-bg/40 px-3 py-2.5">
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <Text className="font-body-medium text-xs text-fg">
                      {formatDateTime(entry.fecha_cierre ?? entry.fecha_apertura)}
                    </Text>
                    <Badge tone={differenceTone(entry.diferencia)}>
                      {differenceLabel(entry.diferencia)}
                    </Badge>
                  </View>

                  <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                    <Text className="font-body text-2xs text-muted">
                      Esperado{' '}
                      <Text className="font-mono text-fg">
                        {formatMoney(entry.efectivo_esperado ?? 0, currency)}
                      </Text>
                    </Text>
                    <Text className="font-body text-2xs text-muted">
                      Contado{' '}
                      <Text className="font-mono text-fg">
                        {formatMoney(entry.efectivo_contado ?? 0, currency)}
                      </Text>
                    </Text>
                    <Text className={differenceClass(entry.diferencia)}>
                      <Text className="font-mono text-2xs">
                        {formatMoney(entry.diferencia ?? 0, currency)}
                      </Text>
                    </Text>
                  </View>

                  {entry.notas_cierre ? (
                    <Text className="font-body text-2xs italic text-muted">{entry.notas_cierre}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>

      <OpenCajaModal
        visible={openOpen}
        onClose={() => setOpenOpen(false)}
        onConfirm={(monto) => void handleOpen(monto)}
        loading={loading}
        error={openOpen ? error : null}
        currency={currency}
      />

      <Modal
        visible={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Cerrar turno"
        subtitle="Contá el efectivo de la caja y confirmá el cierre"
        size="sm"
        dismissable={!closing}
        footer={
          <View className="flex-row gap-2">
            <Button
              label="Cancelar"
              variant="secondary"
              className="flex-1"
              disabled={closing}
              onPress={() => setCloseOpen(false)}
            />
            <Button
              label="Cerrar caja"
              variant="danger"
              className="flex-1"
              loading={closing}
              disabled={!contado.trim()}
              onPress={() => void submitClose()}
            />
          </View>
        }
      >
        {closeError ? <Banner tone="danger">{closeError}</Banner> : null}

        <View className="flex-row flex-wrap gap-2">
          <Stat
            label="Esperado"
            value={formatMoney(esperado, currency)}
            className="min-w-[140px]"
          />
          <Stat
            label="Diferencia"
            value={formatMoney(diferencia, currency)}
            tone={diferencia > 0 ? 'accent' : diferencia < 0 ? 'danger' : 'primary'}
            hint={differenceLabel(diferencia)}
            className="min-w-[140px]"
          />
        </View>

        <Input
          label="Efectivo contado"
          value={contado}
          onChangeText={setContado}
          placeholder="0,00"
          keyboardType="decimal-pad"
          hint="Podés escribir el total contado o usar el botón para copiar el esperado."
          autoFocus
        />

        <Button
          label="Usar el efectivo esperado"
          variant="secondary"
          size="sm"
          onPress={() => setContado(String(esperado))}
        />

        <Input
          label="Notas del cierre (opcional)"
          value={notas}
          onChangeText={setNotas}
          placeholder="Ej.: faltante por vuelto, retiro para proveedor…"
          multiline
        />

        <Banner tone="warning" title="Después del cierre">
          No se pueden registrar ventas hasta abrir un nuevo turno. El resumen queda guardado con la
          diferencia calculada.
        </Banner>
      </Modal>
    </Screen>
  );
}
