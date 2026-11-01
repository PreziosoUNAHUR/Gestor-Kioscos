import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentOption } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { Stat } from '@/components/ui/Stat';
import { useActiveKiosco } from '@/hooks/useKioscoData';
import type { Json, MetodoPago } from '@/lib/database.types';
import { getErrorMessage } from '@/lib/errors';
import { METODOS_PAGO, daysAgo, formatMoney, metodoPagoLabel, startOfDay } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

type Rango = 'hoy' | '7d' | '30d';

type TopProducto = {
  nombre: string;
  cantidad: number;
  total: number;
};

type SeriePunto = {
  bucket: string;
  total: number;
  cantidad: number;
};

type ReporteResumen = {
  ventas_cantidad: number;
  ventas_total: number;
  descuento_total: number;
  ticket_promedio: number;
  anuladas_cantidad: number;
  anuladas_total: number;
  por_metodo: Record<string, number>;
  top_productos: TopProducto[];
  serie: SeriePunto[];
  por_hora: boolean;
};

const RANGOS: SegmentOption<Rango>[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

function parseReporte(value: Json | null): ReporteResumen | null {
  if (!isRecord(value)) return null;

  const porMetodo: Record<string, number> = {};
  if (isRecord(value.por_metodo)) {
    for (const [metodo, total] of Object.entries(value.por_metodo)) {
      porMetodo[metodo] = num(total);
    }
  }

  const topProductos: TopProducto[] = [];
  if (Array.isArray(value.top_productos)) {
    for (const entry of value.top_productos) {
      if (!isRecord(entry)) continue;
      topProductos.push({
        nombre: typeof entry.nombre === 'string' ? entry.nombre : 'Producto',
        cantidad: num(entry.cantidad),
        total: num(entry.total),
      });
    }
  }

  const serie: SeriePunto[] = [];
  if (Array.isArray(value.serie)) {
    for (const entry of value.serie) {
      if (!isRecord(entry)) continue;
      serie.push({
        bucket: typeof entry.bucket === 'string' ? entry.bucket : '',
        total: num(entry.total),
        cantidad: num(entry.cantidad),
      });
    }
  }

  return {
    ventas_cantidad: num(value.ventas_cantidad),
    ventas_total: num(value.ventas_total),
    descuento_total: num(value.descuento_total),
    ticket_promedio: num(value.ticket_promedio),
    anuladas_cantidad: num(value.anuladas_cantidad),
    anuladas_total: num(value.anuladas_total),
    por_metodo: porMetodo,
    top_productos: topProductos,
    serie,
    por_hora: value.por_hora === true,
  };
}

function rangoBounds(rango: Rango): { desde: Date; hasta: Date; label: string } {
  const hasta = new Date();
  if (rango === 'hoy') {
    return { desde: startOfDay(hasta), hasta, label: 'hoy' };
  }

  const dias = rango === '7d' ? 7 : 30;
  return {
    desde: daysAgo(dias - 1),
    hasta,
    label: rango === '7d' ? 'los últimos 7 días' : 'los últimos 30 días',
  };
}

function bucketLabel(bucket: string, porHora: boolean): string {
  const [fecha, hora] = bucket.split(' ');
  if (porHora) return hora ?? bucket;

  const parts = (fecha ?? '').split('-');
  const dia = parts[2];
  const mes = parts[1];
  return dia && mes ? `${dia}/${mes}` : bucket;
}

function metodoLabel(metodo: string): string {
  return METODOS_PAGO.includes(metodo as MetodoPago) ? metodoPagoLabel(metodo as MetodoPago) : metodo;
}

export default function ReportesScreen() {
  const kiosco = useActiveKiosco();
  const kioscoId = kiosco?.id ?? null;
  const currency = kiosco?.moneda ?? 'ARS';

  const [rango, setRango] = useState<Rango>('hoy');
  const [resumen, setResumen] = useState<ReporteResumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!kioscoId) return;

    let cancelled = false;
    const { desde, hasta } = rangoBounds(rango);

    setLoading(true);
    setError(null);

    void supabase
      .rpc('resumen_ventas', {
        p_kiosco_id: kioscoId,
        p_desde: desde.toISOString(),
        p_hasta: hasta.toISOString(),
      })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        setLoading(false);

        if (rpcError) {
          setError(getErrorMessage(rpcError));
          return;
        }

        setResumen(parseReporte(data));
      });

    return () => {
      cancelled = true;
    };
  }, [kioscoId, rango, tick]);

  const porMetodo = useMemo(() => {
    if (!resumen) return [];
    return Object.entries(resumen.por_metodo)
      .map(([metodo, total]) => ({ metodo, total }))
      .sort((a, b) => b.total - a.total);
  }, [resumen]);

  const maxMetodo = Math.max(...porMetodo.map((entry) => entry.total), 1);
  const maxTop = Math.max(...(resumen?.top_productos.map((entry) => entry.total) ?? []), 1);
  const maxSerie = Math.max(...(resumen?.serie.map((entry) => entry.total) ?? []), 1);
  const bounds = rangoBounds(rango);

  if (!kiosco) {
    return (
      <Screen>
        <PageHeader title="Reportes" />
        <EmptyState
          icon={<Feather name="bar-chart-2" size={24} color={palette.muted} />}
          title="Todavía no hay un kiosco"
          description="Creá tu kiosco desde Ajustes para ver las ventas."
          action={<Button label="Ir a Ajustes" onPress={() => router.push('/ajustes')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="Análisis"
        title="Reportes"
        subtitle={`Ventas de ${bounds.label} · ${kiosco.nombre}`}
        actions={
          <Button
            label="Actualizar"
            variant="secondary"
            size="sm"
            onPress={() => setTick((value) => value + 1)}
            icon={<Feather name="refresh-cw" size={14} color={palette.muted} />}
          />
        }
      />

      <Segmented options={RANGOS} value={rango} onChange={setRango} className="mb-4" />

      {error ? (
        <Banner tone="danger" title="No pudimos calcular el reporte" className="mb-3">
          {error}
        </Banner>
      ) : null}

      {loading && !resumen ? (
        <Spinner label="Calculando reporte…" />
      ) : !resumen || resumen.ventas_cantidad === 0 ? (
        <EmptyState
          icon={<Feather name="bar-chart-2" size={24} color={palette.muted} />}
          title="No hay ventas completadas"
          description={
            resumen && resumen.anuladas_cantidad > 0
              ? `Hay ${resumen.anuladas_cantidad} venta${resumen.anuladas_cantidad > 1 ? 's' : ''} anulada${resumen.anuladas_cantidad > 1 ? 's' : ''} en el período.`
              : 'Cuando cobres la primera venta vas a ver los totales acá.'
          }
          action={
            <Button
              label="Ir a la caja"
              onPress={() => router.push('/')}
              icon={<Feather name="shopping-bag" size={15} color={palette.primaryFg} />}
            />
          }
        />
      ) : (
        <View className="gap-4">
          <View className="flex-row flex-wrap gap-2">
            <Stat
              label="Ventas"
              value={String(resumen.ventas_cantidad)}
              hint={`${resumen.ventas_cantidad} ticket${resumen.ventas_cantidad === 1 ? '' : 's'}`}
              className="min-w-[120px]"
            />
            <Stat
              label="Facturado"
              value={formatMoney(resumen.ventas_total, currency)}
              tone="primary"
              className="min-w-[160px]"
            />
            <Stat
              label="Ticket promedio"
              value={formatMoney(resumen.ticket_promedio, currency)}
              className="min-w-[150px]"
            />
            <Stat
              label="Anuladas"
              value={String(resumen.anuladas_cantidad)}
              hint={formatMoney(resumen.anuladas_total, currency)}
              tone={resumen.anuladas_cantidad > 0 ? 'danger' : 'default'}
              className="min-w-[120px]"
            />
            <Stat
              label="Descuentos"
              value={formatMoney(resumen.descuento_total, currency)}
              className="min-w-[140px]"
            />
          </View>

          {loading ? <Spinner compact label="Actualizando…" /> : null}

          <View className="flex-row flex-wrap gap-4">
            <Card className="min-w-[280px] flex-1 gap-3">
              <Text className="font-heading text-base text-fg">Medios de pago</Text>

              {porMetodo.length === 0 ? (
                <Text className="font-body text-xs text-muted">Sin ventas en el período.</Text>
              ) : (
                porMetodo.map(({ metodo, total }) => (
                  <View key={metodo} className="gap-1">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="font-body-medium text-xs text-fg">{metodoLabel(metodo)}</Text>
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

            <Card className="min-w-[280px] flex-1 gap-3">
              <Text className="font-heading text-base text-fg">Top productos</Text>

              {resumen.top_productos.length === 0 ? (
                <Text className="font-body text-xs text-muted">Sin productos vendidos.</Text>
              ) : (
                resumen.top_productos.map((producto, index) => (
                  <View key={`${producto.nombre}-${index}`} className="gap-1">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 font-body-medium text-xs text-fg" numberOfLines={1}>
                        {index + 1}. {producto.nombre}
                      </Text>
                      <Text className="font-mono text-2xs text-muted">{producto.cantidad} u.</Text>
                      <Money value={producto.total} currency={currency} size="sm" />
                    </View>
                    <View className="h-1.5 overflow-hidden rounded-full bg-bg/60">
                      <View
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.round((producto.total / maxTop) * 100)}%` }}
                      />
                    </View>
                  </View>
                ))
              )}
            </Card>
          </View>

          <Card className="gap-3">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="font-heading text-base text-fg">Evolución</Text>
              <Text className="font-body text-2xs text-muted">
                {resumen.por_hora ? 'Por hora' : 'Por día'}
              </Text>
            </View>

            {resumen.serie.length === 0 ? (
              <Text className="font-body text-xs text-muted">Sin ventas en el período.</Text>
            ) : (
              resumen.serie.map((punto) => (
                <View key={punto.bucket} className="flex-row items-center gap-2">
                  <Text className="w-12 font-mono text-2xs text-muted">
                    {bucketLabel(punto.bucket, resumen.por_hora)}
                  </Text>
                  <View className="h-2 flex-1 overflow-hidden rounded-full bg-bg/60">
                    <View
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${Math.round((punto.total / maxSerie) * 100)}%` }}
                    />
                  </View>
                  <Money value={punto.total} currency={currency} size="sm" className="w-24 text-right" />
                </View>
              ))
            )}
          </Card>
        </View>
      )}
    </Screen>
  );
}
