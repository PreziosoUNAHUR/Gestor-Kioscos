import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CalendarHeatmap, ColumnChart, HBarChart } from '@/components/estadisticas/Charts';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentOption } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { Stat } from '@/components/ui/Stat';
import { useIsDesktop } from '@/hooks/useAdaptive';
import { useActiveKiosco } from '@/hooks/useKioscoData';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, formatQuantity, metodoPagoUiLabel } from '@/lib/format';
import {
  buildAlerts,
  buildInsights,
  diaLabel,
  formatBucketLabel,
  horaLabel,
  parseEstadisticas,
  percentChange,
  PERIOD_OPTIONS,
  rangeLabel,
  resolvePeriod,
  type CustomRange,
  type Estadisticas,
  type Insight,
  type InsightTone,
  type PeriodKey,
  type ProductoFrio,
  type ProductoStat,
  type RecomendacionStat,
  type StockStat,
} from '@/lib/estadisticas';
import { cn } from '@/lib/cn';
import { pixelPressed, pixelShadow } from '@/lib/retro';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

/* -------------------------------------------------------------------------- */
/*  Helpers de fechas y formato                                               */
/* -------------------------------------------------------------------------- */

type FeatherName = ComponentProps<typeof Feather>['name'];

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultCustomRange(): CustomRange {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - 6);
  return { desde: dateKey(desde), hasta: dateKey(hasta) };
}

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 0, 0, 0, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function validateCustomRange(range: CustomRange): string | null {
  const desde = parseDateKey(range.desde);
  const hasta = parseDateKey(range.hasta);
  if (!desde || !hasta) return 'Usá el formato AAAA-MM-DD en ambas fechas.';
  if (hasta.getTime() < desde.getTime()) return 'La fecha final no puede ser anterior a la inicial.';
  return null;
}

function signedPercent(value: number, suffix = '%'): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${value > 0 ? '+' : ''}${rounded.replace('.', ',')}${suffix}`;
}

function percentLabel(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(1).replace('.', ',')}%`;
}

function granularityLabel(granularity: string): string {
  if (granularity === 'hora') return 'Por hora';
  if (granularity === 'semana') return 'Por semana';
  if (granularity === 'mes') return 'Por mes';
  return 'Por día';
}

/* -------------------------------------------------------------------------- */
/*  Tipos locales                                                              */
/* -------------------------------------------------------------------------- */

type KpiTone = 'default' | 'primary' | 'danger' | 'accent';

const KPI_TONES: Record<KpiTone, string> = {
  default: 'text-fg',
  primary: 'text-success-ink',
  danger: 'text-danger-ink',
  accent: 'text-accent-ink',
};

type KpiProps = {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  deltaSuffix?: string;
  tone?: KpiTone;
};

type SerieMetric = 'total' | 'ganancia' | 'unidades' | 'cantidad';
type RankingKey = 'unidades' | 'facturacion' | 'ganancia' | 'margen';
type StockTab = 'bajo' | 'agotados' | 'sobre';

const SERIE_OPTIONS: SegmentOption<SerieMetric>[] = [
  { value: 'total', label: 'Facturación' },
  { value: 'ganancia', label: 'Ganancia' },
  { value: 'unidades', label: 'Unidades' },
  { value: 'cantidad', label: 'Ventas' },
];

const RANKING_OPTIONS: SegmentOption<RankingKey>[] = [
  { value: 'unidades', label: 'Unidades' },
  { value: 'facturacion', label: 'Facturación' },
  { value: 'ganancia', label: 'Ganancia' },
  { value: 'margen', label: 'Margen' },
];

const INSIGHT_STYLES: Record<
  InsightTone,
  { box: string; text: string; icon: FeatherName; color: string }
> = {
  danger: {
    box: 'border-black bg-[#FEE2E2]',
    text: 'text-[#5B0A0A]',
    icon: 'alert-circle',
    color: palette.dangerInk,
  },
  warning: {
    box: 'border-black bg-[#FEF9C3]',
    text: 'text-[#5B4A00]',
    icon: 'alert-triangle',
    color: palette.accentInk,
  },
  success: {
    box: 'border-black bg-[#DCFCE7]',
    text: 'text-[#14532D]',
    icon: 'check-circle',
    color: palette.successInk,
  },
  info: {
    box: 'border-black bg-surface',
    text: 'text-fg',
    icon: 'info',
    color: palette.primaryInk,
  },
};

/* -------------------------------------------------------------------------- */
/*  Componentes de presentación                                                */
/* -------------------------------------------------------------------------- */

function Kpi({ label, value, hint, delta, deltaSuffix = '%', tone = 'default' }: KpiProps) {
  const deltaTone =
    delta === undefined || delta === null || !Number.isFinite(delta)
      ? 'text-muted'
      : delta > 0
        ? 'text-success-ink'
        : delta < 0
          ? 'text-danger-ink'
          : 'text-muted';

  return (
    <View
      style={pixelShadow(3)}
      className="min-w-[150px] flex-1 basis-[170px] gap-1 rounded-none border-[3px] border-black bg-elevated px-2.5 py-2.5"
    >
      <Text className="font-pixel text-pixel-2xs uppercase tracking-wide text-muted">{label}</Text>
      <Text className={cn('font-pixel text-pixel-sm tabular-nums', KPI_TONES[tone])}>{value}</Text>
      {delta !== undefined ? (
        <Text className={cn('font-body text-2xs', deltaTone)}>
          {delta === null || !Number.isFinite(delta)
            ? 'Sin base de comparación'
            : `${signedPercent(delta, deltaSuffix)} vs. anterior`}
        </Text>
      ) : null}
      {hint ? <Text className="font-body text-2xs leading-4 text-muted">{hint}</Text> : null}
    </View>
  );
}

type SectionCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

function SectionCard({ title, subtitle, children, className }: SectionCardProps) {
  return (
    <Card className={cn('gap-3', className)}>
      <View className="gap-0.5 border-b-[3px] border-black pb-2">
        <Text className="font-pixel text-pixel-xs uppercase leading-5 text-fg">{title}</Text>
        {subtitle ? <Text className="font-body text-2xs leading-4 text-muted">{subtitle}</Text> : null}
      </View>
      {children}
    </Card>
  );
}

function InsightList({ items, empty }: { items: Insight[]; empty: string }) {
  if (items.length === 0) {
    return <Text className="font-body text-xs leading-5 text-muted">{empty}</Text>;
  }

  return (
    <View className="gap-2">
      {items.map((item) => {
        const style = INSIGHT_STYLES[item.tone];
        return (
          <View
            key={item.id}
            className={cn('flex-row items-start gap-2 border-2 px-2 py-1.5', style.box)}
          >
            <Feather name={style.icon} size={14} color={style.color} style={{ marginTop: 1 }} />
            <View className="flex-1 gap-0.5">
              <Text className={cn('font-pixel text-pixel-2xs uppercase leading-4', style.text)}>
                {item.title}
              </Text>
              <Text className={cn('font-body text-2xs leading-4', style.text)}>{item.detail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (value: PeriodKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 4, paddingBottom: 4 }}
    >
      {PERIOD_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              pixelShadow(active ? 3 : 2),
              pressed ? pixelPressed(2) : undefined,
            ]}
            className={cn(
              'min-h-[36px] justify-center rounded-none border-[3px] border-black px-2.5',
              active ? 'bg-accent' : 'bg-elevated',
            )}
          >
            <Text
              className={cn(
                'font-pixel text-pixel-2xs uppercase tracking-wide',
                active ? 'text-ink' : 'text-muted',
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ProductRankRow({
  index,
  product,
  currency,
  metric,
}: {
  index: number;
  product: ProductoStat;
  currency: string;
  metric: RankingKey;
}) {
  const margin = Number.isFinite(product.margen) ? product.margen : 0;
  const marginTone = margin >= 30 ? 'primary' : margin >= 10 ? 'accent' : margin >= 0 ? 'muted' : 'danger';

  const main =
    metric === 'unidades'
      ? `${formatQuantity(product.unidades)} u.`
      : metric === 'margen'
        ? percentLabel(margin)
        : formatMoney(metric === 'facturacion' ? product.facturacion : product.ganancia, currency);

  const secondary =
    metric === 'unidades'
      ? formatMoney(product.facturacion, currency)
      : metric === 'margen'
        ? formatMoney(product.ganancia, currency)
        : `${formatQuantity(product.unidades)} u.`;

  return (
    <View className="flex-row items-center gap-2 border-2 border-black bg-elevated px-2 py-1.5">
      <View className="h-6 w-6 items-center justify-center border-2 border-black bg-accent">
        <Text className="font-pixel text-pixel-2xs text-ink">{index + 1}</Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-body-semibold text-xs leading-4 text-fg" numberOfLines={1}>
          {product.nombre}
        </Text>
        <Text className="font-body text-2xs text-muted">{secondary}</Text>
      </View>
      <View className="items-end gap-0.5">
        <Text className="font-mono-bold text-xs text-fg">{main}</Text>
        {metric === 'margen' ? null : <Badge tone={marginTone}>{percentLabel(margin)}</Badge>}
      </View>
    </View>
  );
}

function ColdProductRow({ product }: { product: ProductoFrio }) {
  const days = product.dias_sin_venta;
  const lastSale =
    days === null
      ? 'Sin ventas registradas'
      : days <= 0
        ? 'Vendido hoy'
        : `Hace ${formatQuantity(days)} día${days === 1 ? '' : 's'}`;

  return (
    <View className="flex-row items-center gap-2 border-2 border-black bg-elevated px-2 py-1.5">
      <Feather name="package" size={14} color={palette.muted} />
      <View className="flex-1 gap-0.5">
        <Text className="font-body-semibold text-xs leading-4 text-fg" numberOfLines={1}>
          {product.nombre}
        </Text>
        <Text className="font-body text-2xs text-muted" numberOfLines={1}>
          {product.categoria} · {lastSale}
        </Text>
      </View>
      <View className="items-end gap-0.5">
        <Badge tone={product.stock <= 0 ? 'danger' : 'neutral'}>
          {`${formatQuantity(product.stock)} u.`}
        </Badge>
        <Text className="font-mono text-2xs text-muted">
          {formatQuantity(product.unidades)} vendidas
        </Text>
      </View>
    </View>
  );
}

function StockRow({
  product,
  currency,
  mode,
}: {
  product: StockStat | RecomendacionStat;
  currency: string;
  mode: 'bajo' | 'agotados' | 'sobre' | 'prediccion' | 'recomendacion';
}) {
  const recommendation = 'recomendado' in product ? product : null;
  const dias = product.dias_stock;
  const stockTone =
    product.stock <= 0 ? 'danger' : product.stock <= product.stock_minimo ? 'orange' : 'primary';

  const detail =
    mode === 'recomendacion' && recommendation
      ? `Comprar ${formatQuantity(recommendation.recomendado)} u. · stock ${formatQuantity(product.stock)}`
      : mode === 'prediccion'
        ? dias === null
          ? 'Sin ventas recientes'
          : `Se agota en ${formatQuantity(dias)} día${dias === 1 ? '' : 's'}`
        : mode === 'sobre'
          ? dias === null
            ? 'Sin ventas recientes'
            : `${formatQuantity(dias)} días de stock`
          : `${formatQuantity(product.unidades)} u. vendidas en 30 días`;

  const priority = recommendation?.prioridad;
  const priorityTone =
    priority === 'urgente' ? 'danger' : priority === 'proximo' ? 'orange' : 'muted';

  return (
    <View className="flex-row items-center gap-2 border-2 border-black bg-elevated px-2 py-1.5">
      <View className="flex-1 gap-0.5">
        <Text className="font-body-semibold text-xs leading-4 text-fg" numberOfLines={1}>
          {product.nombre}
        </Text>
        <Text className="font-body text-2xs text-muted" numberOfLines={1}>
          {product.categoria} · {detail}
        </Text>
      </View>
      <View className="items-end gap-0.5">
        <Badge tone={stockTone}>{`${formatQuantity(product.stock)} u.`}</Badge>
        {priority ? <Badge tone={priorityTone}>{priority}</Badge> : null}
        {mode === 'sobre' ? (
          <Text className="font-mono text-2xs text-muted">
            {formatMoney(product.stock * product.precio_costo, currency)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pantalla                                                                   */
/* -------------------------------------------------------------------------- */

export default function EstadisticasScreen() {
  const kiosco = useActiveKiosco();
  const kioscoId = kiosco?.id ?? null;
  const currency = kiosco?.moneda ?? 'ARS';
  const desktop = useIsDesktop();

  const [period, setPeriod] = useState<PeriodKey>('hoy');
  const [custom, setCustom] = useState<CustomRange>(() => defaultCustomRange());
  const [appliedCustom, setAppliedCustom] = useState<CustomRange>(custom);
  const [customError, setCustomError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [stats, setStats] = useState<Estadisticas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serieMetric, setSerieMetric] = useState<SerieMetric>('total');
  const [ranking, setRanking] = useState<RankingKey>('unidades');
  const [stockTab, setStockTab] = useState<StockTab>('bajo');

  const range = useMemo(() => resolvePeriod(period, appliedCustom, now), [period, appliedCustom, now]);

  // Al cambiar de kiosco no mostramos métricas del kiosco anterior mientras
  // llega la respuesta nueva.
  useEffect(() => {
    setStats(null);
    setError(null);
  }, [kioscoId]);

  useEffect(() => {
    if (!kioscoId) return;

    if (period === 'custom') {
      const invalid = validateCustomRange(appliedCustom);
      if (invalid) {
        setStats(null);
        setError(invalid);
        return;
      }
    }

    let cancelled = false;
    const bounds = resolvePeriod(period, appliedCustom, now);

    setLoading(true);
    setError(null);

    void supabase
      .rpc('estadisticas_negocio', {
        p_kiosco_id: kioscoId,
        p_desde: bounds.desde.toISOString(),
        p_hasta: bounds.hasta.toISOString(),
        p_comp_desde: bounds.comparisonDesde.toISOString(),
        p_comp_hasta: bounds.comparisonHasta.toISOString(),
        p_dias_stock: 30,
      })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        setLoading(false);

        if (rpcError) {
          setStats(null);
          setError(getErrorMessage(rpcError));
          return;
        }

        const parsed = parseEstadisticas(data);
        if (!parsed) {
          setStats(null);
          setError('La respuesta de estadísticas vino incompleta. Probá de nuevo.');
          return;
        }

        setStats(parsed);
      });

    return () => {
      cancelled = true;
    };
  }, [kioscoId, period, appliedCustom, now]);

  const refresh = useCallback(() => {
    setNow(new Date());
  }, []);

  const selectPeriod = useCallback((value: PeriodKey) => {
    setPeriod(value);
    if (value !== 'custom') setCustomError(null);
  }, []);

  const applyCustom = useCallback(() => {
    const invalid = validateCustomRange(custom);
    if (invalid) {
      setCustomError(invalid);
      return;
    }
    setCustomError(null);
    setPeriod('custom');
    setAppliedCustom({ desde: custom.desde.trim(), hasta: custom.hasta.trim() });
    setNow(new Date());
  }, [custom]);

  const alerts = useMemo(() => (stats ? buildAlerts(stats, currency) : []), [stats, currency]);
  const insights = useMemo(() => (stats ? buildInsights(stats, currency) : []), [stats, currency]);

  const serieData = useMemo(() => {
    if (!stats) return [];
    return stats.serie.map((point) => ({
      label: formatBucketLabel(point.bucket, stats.periodo.granularidad),
      value: point[serieMetric],
    }));
  }, [stats, serieMetric]);

  const serieFormat = useCallback(
    (value: number) =>
      serieMetric === 'unidades' || serieMetric === 'cantidad'
        ? formatQuantity(value)
        : formatMoney(value, currency),
    [currency, serieMetric],
  );

  const serieSummary = useMemo(() => {
    if (!stats || stats.serie.length === 0) return null;
    const values = stats.serie.map((point) => point[serieMetric]);
    const best = [...stats.serie].sort((a, b) => b[serieMetric] - a[serieMetric])[0];
    const sum = values.reduce((acc, value) => acc + value, 0);
    const average = values.length > 0 ? sum / values.length : 0;
    return {
      bestLabel: best ? formatBucketLabel(best.bucket, stats.periodo.granularidad) : '—',
      bestValue: best ? best[serieMetric] : 0,
      average,
    };
  }, [stats, serieMetric]);

  const hoursData = useMemo(() => {
    if (!stats) return [];
    const byHour = new Map(stats.horas.map((entry) => [entry.hora, entry]));
    return Array.from({ length: 24 }, (_, hour) => ({
      label: String(hour).padStart(2, '0'),
      value: byHour.get(hour)?.total ?? 0,
    }));
  }, [stats]);

  const daysData = useMemo(() => {
    if (!stats) return [];
    const byDay = new Map(stats.dias.map((entry) => [entry.dia, entry]));
    return Array.from({ length: 7 }, (_, index) => {
      const dia = index + 1;
      return { label: diaLabel(dia), value: byDay.get(dia)?.total ?? 0 };
    });
  }, [stats]);

  const categoryData = useMemo(
    () =>
      stats
        ? stats.categorias.slice(0, 10).map((category) => ({
            label: category.categoria,
            value: category.facturacion,
          }))
        : [],
    [stats],
  );

  const categoryProfitRows = useMemo(
    () =>
      stats
        ? [...stats.categorias]
            .sort((a, b) => b.ganancia - a.ganancia)
            .slice(0, 6)
            .map((category) => ({
              ...category,
              margen: category.facturacion > 0 ? (category.ganancia / category.facturacion) * 100 : 0,
            }))
        : [],
    [stats],
  );

  const methodData = useMemo(
    () =>
      stats
        ? stats.metodos.map((method) => ({
            label: metodoPagoUiLabel(method.metodo),
            value: method.total,
          }))
        : [],
    [stats],
  );

  const rankingList = useMemo(() => {
    if (!stats) return [];
    if (ranking === 'facturacion') return stats.top_facturacion;
    if (ranking === 'ganancia') return stats.top_ganancia;
    if (ranking === 'margen') return stats.top_margen;
    return stats.top_unidades;
  }, [ranking, stats]);

  const coldProducts = useMemo(() => (stats ? stats.menos_vendidos.slice(0, 10) : []), [stats]);

  const stockRows = useMemo(() => {
    if (!stats) return [];
    if (stockTab === 'agotados') return stats.agotados;
    if (stockTab === 'sobre') return stats.sobre_stock;
    return stats.stock_bajo;
  }, [stats, stockTab]);

  const stockTabOptions: SegmentOption<StockTab>[] = [
    { value: 'bajo', label: 'Stock bajo', count: stats?.stock_bajo.length },
    { value: 'agotados', label: 'Agotados', count: stats?.agotados.length },
    { value: 'sobre', label: 'Sobre stock', count: stats?.sobre_stock.length },
  ];

  const overStockValue = useMemo(
    () =>
      stats
        ? stats.sobre_stock.reduce(
            (total, product) => total + product.stock * product.precio_costo,
            0,
          )
        : 0,
    [stats],
  );

  const customDirty =
    custom.desde.trim() !== appliedCustom.desde.trim() ||
    custom.hasta.trim() !== appliedCustom.hasta.trim();

  if (!kiosco) {
    return (
      <Screen>
        <PageHeader eyebrow="Análisis" title="Estadísticas" />
        <EmptyState
          icon={<Feather name="bar-chart-2" size={24} color={palette.muted} />}
          title="Todavía no hay un kiosco"
          description="Creá tu kiosco desde Ajustes para empezar a medir ventas, márgenes y stock."
          action={<Button label="Ir a Ajustes" onPress={() => router.push('/ajustes')} />}
        />
      </Screen>
    );
  }

  const actual = stats?.actual;
  const previous = stats?.anterior;
  const discountPct =
    actual && actual.subtotal > 0 ? (actual.descuentos / actual.subtotal) * 100 : 0;
  const averageDiscount = actual && actual.ventas > 0 ? actual.descuentos / actual.ventas : 0;
  const unitsPerTicket = actual && actual.ventas > 0 ? actual.unidades / actual.ventas : 0;

  return (
    <Screen>
      <PageHeader
        eyebrow="Análisis"
        title="Estadísticas"
        subtitle={`${kiosco.nombre} · ${rangeLabel(range)}`}
        actions={
          <>
            <Button
              label="Actualizar"
              variant="secondary"
              size="sm"
              onPress={refresh}
              loading={loading}
              icon={<Feather name="refresh-cw" size={14} color={palette.fg} />}
            />
            <Button
              label="Ir a la caja"
              variant="primary"
              size="sm"
              onPress={() => router.push('/')}
              icon={<Feather name="shopping-bag" size={14} color={palette.ink} />}
            />
          </>
        }
      />

      <Card className="mb-4 gap-3">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="font-pixel text-pixel-xs uppercase text-fg">Período</Text>
          <Text className="font-body text-2xs text-muted">
            {rangeLabel(range)} · {range.comparisonLabel}
          </Text>
        </View>

        <PeriodPicker value={period} onChange={selectPeriod} />

        {period === 'custom' ? (
          <View className="gap-2">
            <View className="flex-row flex-wrap items-end gap-2">
              <Input
                label="Desde"
                value={custom.desde}
                onChangeText={(value) => {
                  setCustom((prev) => ({ ...prev, desde: value }));
                  setCustomError(null);
                }}
                placeholder="AAAA-MM-DD"
                maxLength={10}
                autoCorrect={false}
                containerClassName="min-w-[140px] flex-1"
              />
              <Input
                label="Hasta"
                value={custom.hasta}
                onChangeText={(value) => {
                  setCustom((prev) => ({ ...prev, hasta: value }));
                  setCustomError(null);
                }}
                placeholder="AAAA-MM-DD"
                maxLength={10}
                autoCorrect={false}
                containerClassName="min-w-[140px] flex-1"
              />
              <Button
                label="Aplicar"
                variant="accent"
                onPress={applyCustom}
                icon={<Feather name="calendar" size={14} color={palette.ink} />}
              />
            </View>
            {customError ? (
              <Text className="font-body text-2xs text-danger-ink">{customError}</Text>
            ) : customDirty ? (
              <Text className="font-body text-2xs text-muted">
                Hay fechas nuevas sin aplicar. Tocá Aplicar para actualizar el período.
              </Text>
            ) : null}
          </View>
        ) : null}

        {loading ? <Spinner compact label="Actualizando estadísticas…" /> : null}
      </Card>

      {error ? (
        <Banner
          tone="danger"
          title="No pudimos calcular las estadísticas"
          className="mb-4"
          action={<Button label="Reintentar" size="sm" variant="secondary" onPress={refresh} />}
        >
          {error}
        </Banner>
      ) : null}

      {loading && !stats ? (
        <Spinner label="Calculando ventas, márgenes y stock…" />
      ) : !stats ? (
        <EmptyState
          icon={<Feather name="bar-chart-2" size={24} color={palette.muted} />}
          title="Sin datos para mostrar"
          description="Cuando registres ventas vas a ver los indicadores acá."
          action={<Button label="Reintentar" onPress={refresh} />}
        />
      ) : (
        <>
          <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
            <Text className="font-pixel text-pixel-xs uppercase text-fg">Indicadores</Text>
            <Text className="font-body text-2xs text-muted">Comparado {range.comparisonLabel}</Text>
          </View>

          <View className="mb-4 flex-row flex-wrap gap-2.5">
            <Kpi
              label="Facturación"
              value={formatMoney(actual?.facturacion ?? 0, currency)}
              delta={percentChange(actual?.facturacion ?? 0, previous?.facturacion ?? 0)}
              hint={`Antes ${formatMoney(previous?.facturacion ?? 0, currency)}`}
              tone="primary"
            />
            <Kpi
              label="Ganancia"
              value={formatMoney(actual?.ganancia ?? 0, currency)}
              delta={percentChange(actual?.ganancia ?? 0, previous?.ganancia ?? 0)}
              hint={`Costo ${formatMoney(actual?.costo ?? 0, currency)}`}
              tone="primary"
            />
            <Kpi
              label="Ventas"
              value={formatQuantity(actual?.ventas ?? 0)}
              delta={percentChange(actual?.ventas ?? 0, previous?.ventas ?? 0)}
              hint={`${formatQuantity(actual?.unidades ?? 0)} unidades`}
            />
            <Kpi
              label="Ticket promedio"
              value={formatMoney(actual?.ticket_promedio ?? 0, currency)}
              delta={percentChange(actual?.ticket_promedio ?? 0, previous?.ticket_promedio ?? 0)}
              hint={`${formatQuantity(unitsPerTicket)} u. por ticket`}
            />
            <Kpi
              label="Unidades"
              value={formatQuantity(actual?.unidades ?? 0)}
              delta={percentChange(actual?.unidades ?? 0, previous?.unidades ?? 0)}
              hint={`${formatQuantity(actual?.ventas ?? 0)} tickets`}
            />
            <Kpi
              label="Margen"
              value={percentLabel(actual?.margen ?? 0)}
              delta={(actual?.margen ?? 0) - (previous?.margen ?? 0)}
              deltaSuffix=" pp"
              hint="Ganancia sobre facturación"
              tone={(actual?.margen ?? 0) >= 20 ? 'primary' : (actual?.margen ?? 0) >= 0 ? 'default' : 'danger'}
            />
            <Kpi
              label="Descuentos"
              value={formatMoney(actual?.descuentos ?? 0, currency)}
              hint={`${percentLabel(discountPct)} del subtotal`}
              tone={(actual?.descuentos ?? 0) > 0 ? 'accent' : 'default'}
            />
            <Kpi
              label="Fiado pendiente"
              value={formatMoney(stats.fiado.pendiente, currency)}
              hint={`${formatQuantity(stats.fiado.clientes)} cliente${
                stats.fiado.clientes === 1 ? '' : 's'
              } con deuda`}
              tone={stats.fiado.pendiente > 0 ? 'danger' : 'default'}
            />
            {(actual?.anuladas ?? 0) > 0 ? (
              <Kpi
                label="Anuladas"
                value={formatQuantity(actual?.anuladas ?? 0)}
                hint={formatMoney(actual?.anuladas_total ?? 0, currency)}
                tone="danger"
              />
            ) : null}
          </View>

          <View className={desktop ? 'mb-4 flex-row flex-wrap gap-4' : 'mb-4 gap-4'}>
            <SectionCard
              title="Alertas"
              subtitle="Lo que conviene resolver"
              className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
            >
              <InsightList items={alerts} empty="No hay alertas para este período." />
            </SectionCard>

            <SectionCard
              title="Análisis automático"
              subtitle="Patrones detectados con tus datos"
              className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
            >
              <InsightList
                items={insights}
                empty="Todavía no hay suficientes ventas para sacar conclusiones."
              />
            </SectionCard>
          </View>

          {(actual?.ventas ?? 0) === 0 ? (
            <View className="mb-4">
              <EmptyState
                icon={<Feather name="shopping-bag" size={24} color={palette.muted} />}
                title="Sin ventas en el período"
                description="Probá con otro rango o registrá la primera venta desde la caja. El análisis de stock sigue disponible abajo."
                action={
                  <Button
                    label="Ir a la caja"
                    onPress={() => router.push('/')}
                    icon={<Feather name="shopping-bag" size={14} color={palette.ink} />}
                  />
                }
              />
            </View>
          ) : (
            <>
              <SectionCard
                title="Evolución"
                subtitle={`${granularityLabel(stats.periodo.granularidad)} · ${rangeLabel(range)}`}
                className="mb-4"
              >
                <Segmented
                  options={SERIE_OPTIONS}
                  value={serieMetric}
                  onChange={setSerieMetric}
                />
                <ColumnChart
                  data={serieData}
                  formatValue={serieFormat}
                  color={serieMetric === 'ganancia' ? 'success' : 'primary'}
                  height={desktop ? 180 : 140}
                  barWidth={desktop ? 34 : 28}
                  emptyLabel="Sin ventas para graficar en este período."
                />
                {serieSummary ? (
                  <Text className="font-body text-2xs leading-4 text-muted">
                    Mejor {stats.periodo.granularidad}: {serieSummary.bestLabel} ·{' '}
                    {serieFormat(serieSummary.bestValue)} · Promedio:{' '}
                    {serieFormat(serieSummary.average)}
                  </Text>
                ) : null}
              </SectionCard>

              <View className={desktop ? 'mb-4 flex-row flex-wrap gap-4' : 'mb-4 gap-4'}>
                <SectionCard
                  title="Calendario de ventas"
                  subtitle="Intensidad de facturación por día"
                  className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
                >
                  <CalendarHeatmap
                    days={stats.calendario}
                    desde={range.desde}
                    hasta={range.hasta}
                    formatValue={(value) => formatMoney(value, currency)}
                  />
                </SectionCard>

                <View className={desktop ? 'min-w-[320px] flex-1 basis-[420px] gap-4' : 'gap-4'}>
                  <SectionCard title="Horas pico" subtitle="Facturación por hora del día">
                    <ColumnChart
                      data={hoursData}
                      formatValue={(value) => formatMoney(value, currency)}
                      color="orange"
                      height={110}
                      barWidth={16}
                      emptyLabel="Sin ventas para graficar."
                    />
                    {stats.horas.length > 0 ? (
                      <Text className="font-body text-2xs text-muted">
                        La hora más fuerte es{' '}
                        {horaLabel(
                          [...stats.horas].sort((a, b) => b.total - a.total)[0]?.hora ?? 0,
                        )}
                        .
                      </Text>
                    ) : null}
                  </SectionCard>

                  <SectionCard title="Días de la semana" subtitle="Facturación por día">
                    <ColumnChart
                      data={daysData}
                      formatValue={(value) => formatMoney(value, currency)}
                      color="pink"
                      height={110}
                      barWidth={28}
                      emptyLabel="Sin ventas para graficar."
                    />
                  </SectionCard>
                </View>
              </View>

              <View className={desktop ? 'mb-4 flex-row flex-wrap gap-4' : 'mb-4 gap-4'}>
                <SectionCard
                  title="Top productos"
                  subtitle="Ranking del período"
                  className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
                >
                  <Segmented
                    options={RANKING_OPTIONS}
                    value={ranking}
                    onChange={setRanking}
                  />
                  {rankingList.length === 0 ? (
                    <Text className="font-body text-xs text-muted">
                      Sin productos vendidos en el período.
                    </Text>
                  ) : (
                    <View className="gap-1.5">
                      {rankingList.slice(0, 10).map((product, index) => (
                        <ProductRankRow
                          key={`${product.producto_id ?? product.nombre}-${index}`}
                          index={index}
                          product={product}
                          currency={currency}
                          metric={ranking}
                        />
                      ))}
                    </View>
                  )}
                </SectionCard>

                <SectionCard
                  title="Productos fríos"
                  subtitle="Menos vendidos o sin movimiento"
                  className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
                >
                  {coldProducts.length === 0 ? (
                    <Text className="font-body text-xs text-muted">
                      No hay productos activos para analizar.
                    </Text>
                  ) : (
                    <View className="gap-1.5">
                      {coldProducts.map((product) => (
                        <ColdProductRow key={product.id} product={product} />
                      ))}
                    </View>
                  )}
                </SectionCard>
              </View>

              <View className={desktop ? 'mb-4 flex-row flex-wrap gap-4' : 'mb-4 gap-4'}>
                <SectionCard
                  title="Categorías"
                  subtitle="Facturación y margen por categoría"
                  className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
                >
                  <HBarChart
                    data={categoryData}
                    formatValue={(value) => formatMoney(value, currency)}
                    color="primary"
                    labelWidth={100}
                    emptyLabel="Sin categorías vendidas en el período."
                  />

                  {categoryProfitRows.length > 0 ? (
                    <View className="gap-1 border-t-2 border-black/20 pt-2">
                      <Text className="font-pixel text-pixel-2xs uppercase text-fg">
                        Margen por categoría
                      </Text>
                      {categoryProfitRows.map((category) => (
                        <View
                          key={category.categoria}
                          className="flex-row items-center justify-between gap-2 border-b border-black/10 py-0.5"
                        >
                          <Text
                            className="flex-1 font-body text-2xs text-fg"
                            numberOfLines={1}
                          >
                            {category.categoria}
                          </Text>
                          <Text className="font-mono text-2xs text-muted">
                            {formatMoney(category.ganancia, currency)}
                          </Text>
                          <Badge
                            tone={
                              category.margen >= 25
                                ? 'primary'
                                : category.margen >= 10
                                  ? 'accent'
                                  : category.margen >= 0
                                    ? 'muted'
                                    : 'danger'
                            }
                          >
                            {percentLabel(category.margen)}
                          </Badge>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </SectionCard>

                <SectionCard
                  title="Medios de pago"
                  subtitle={`${formatQuantity(actual?.ventas ?? 0)} tickets en el período`}
                  className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
                >
                  <HBarChart
                    data={methodData}
                    formatValue={(value) => formatMoney(value, currency)}
                    color="success"
                    labelWidth={100}
                    emptyLabel="Sin ventas para analizar."
                  />

                  {stats.metodos.length > 0 ? (
                    <View className="gap-1 border-t-2 border-black/20 pt-2">
                      {stats.metodos.map((method) => (
                        <View
                          key={method.metodo}
                          className="flex-row items-center justify-between gap-2 border-b border-black/10 py-0.5"
                        >
                          <Text className="flex-1 font-body text-2xs text-fg">
                            {metodoPagoUiLabel(method.metodo)}
                          </Text>
                          <Text className="font-mono text-2xs text-muted">
                            {formatQuantity(method.cantidad)} ventas
                          </Text>
                          <Badge tone="neutral">{percentLabel(method.porcentaje)}</Badge>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </SectionCard>
              </View>

              <View className={desktop ? 'mb-4 flex-row flex-wrap gap-4' : 'mb-4 gap-4'}>
                <SectionCard
                  title="Rentabilidad"
                  subtitle="Ganancia y costo de lo vendido"
                  className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
                >
                  <View className="flex-row flex-wrap gap-2">
                    <Stat
                      label="Ganancia"
                      value={formatMoney(actual?.ganancia ?? 0, currency)}
                      tone={(actual?.ganancia ?? 0) >= 0 ? 'primary' : 'danger'}
                      className="min-w-[130px]"
                    />
                    <Stat
                      label="Costo"
                      value={formatMoney(actual?.costo ?? 0, currency)}
                      className="min-w-[130px]"
                    />
                    <Stat
                      label="Margen"
                      value={percentLabel(actual?.margen ?? 0)}
                      tone={(actual?.margen ?? 0) >= 20 ? 'primary' : 'default'}
                      className="min-w-[110px]"
                    />
                    <Stat
                      label="Ticket prom."
                      value={formatMoney(actual?.ticket_promedio ?? 0, currency)}
                      className="min-w-[140px]"
                    />
                  </View>
                  <Text className="font-body text-2xs leading-4 text-muted">
                    La ganancia se calcula con el costo unitario guardado en cada venta, no con el
                    costo actual del producto.
                  </Text>
                </SectionCard>

                <SectionCard
                  title="Descuentos y promociones"
                  subtitle="Impacto real en el período"
                  className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
                >
                  <View className="flex-row flex-wrap gap-2">
                    <Stat
                      label="Descuentos"
                      value={formatMoney(actual?.descuentos ?? 0, currency)}
                      tone={(actual?.descuentos ?? 0) > 0 ? 'accent' : 'default'}
                      className="min-w-[130px]"
                    />
                    <Stat
                      label="% subtotal"
                      value={percentLabel(discountPct)}
                      className="min-w-[110px]"
                    />
                    <Stat
                      label="Por venta"
                      value={formatMoney(averageDiscount, currency)}
                      className="min-w-[120px]"
                    />
                    <Stat
                      label="Anuladas"
                      value={formatQuantity(actual?.anuladas ?? 0)}
                      hint={formatMoney(actual?.anuladas_total ?? 0, currency)}
                      tone={(actual?.anuladas ?? 0) > 0 ? 'danger' : 'default'}
                      className="min-w-[120px]"
                    />
                  </View>
                  <Text className="font-body text-2xs leading-4 text-muted">
                    Los descuentos se registran por venta; acá ves cuánto pesaron sobre el subtotal
                    y cuánto dejaron de ingresar por anulaciones.
                  </Text>
                </SectionCard>
              </View>

              <View className={desktop ? 'mb-4 flex-row flex-wrap gap-4' : 'mb-4 gap-4'}>
                <SectionCard
                  title="Se venden juntos"
                  subtitle="Combos detectados en las mismas ventas"
                  className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
                >
                  {stats.pares.length === 0 ? (
                    <Text className="font-body text-xs text-muted">
                      Todavía no hay combinaciones repetidas. Se necesitan ventas con al menos dos
                      productos.
                    </Text>
                  ) : (
                    <View className="gap-1.5">
                      {stats.pares.slice(0, 8).map((pair) => (
                        <View
                          key={`${pair.producto_a}-${pair.producto_b}`}
                          className="flex-row items-center gap-2 border-2 border-black bg-elevated px-2 py-1.5"
                        >
                          <Feather name="link" size={13} color={palette.primaryInk} />
                          <Text
                            className="flex-1 font-body text-xs leading-4 text-fg"
                            numberOfLines={2}
                          >
                            {pair.nombre_a} + {pair.nombre_b}
                          </Text>
                          <Badge tone="pink">{`${formatQuantity(pair.veces)}x`}</Badge>
                        </View>
                      ))}
                    </View>
                  )}
                </SectionCard>

                <SectionCard
                  title="Vendedores"
                  subtitle="Rendimiento por usuario"
                  className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
                >
                  {stats.vendedores.length === 0 ? (
                    <Text className="font-body text-xs text-muted">
                      Sin ventas asociadas a un usuario en el período.
                    </Text>
                  ) : (
                    <View className="gap-2">
                      {stats.vendedores.map((seller) => {
                        const share =
                          (actual?.facturacion ?? 0) > 0
                            ? (seller.total / (actual?.facturacion ?? 1)) * 100
                            : 0;
                        const safeShare = Math.max(0, Math.min(100, share));
                        return (
                          <View
                            key={seller.usuario_id ?? seller.email}
                            className="gap-1 border-2 border-black bg-elevated px-2 py-1.5"
                          >
                            <View className="flex-row items-center justify-between gap-2">
                              <Text
                                className="flex-1 font-body-semibold text-xs text-fg"
                                numberOfLines={1}
                              >
                                {seller.email}
                              </Text>
                              <Text className="font-mono-bold text-xs text-fg">
                                {formatMoney(seller.total, currency)}
                              </Text>
                            </View>
                            <View className="h-2 overflow-hidden border-2 border-black bg-surface">
                              <View
                                className="h-full bg-primary"
                                style={{ width: `${safeShare}%` }}
                              />
                            </View>
                            <Text className="font-body text-2xs text-muted">
                              {formatQuantity(seller.cantidad)} ventas ·{' '}
                              {formatQuantity(seller.unidades)} u. · ticket{' '}
                              {formatMoney(seller.ticket_promedio, currency)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </SectionCard>
              </View>

              <View className={desktop ? 'mb-4 flex-row flex-wrap gap-4' : 'mb-4 gap-4'}>
                <SectionCard
                  title="Pérdidas"
                  subtitle="Ajustes negativos de stock"
                  className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
                >
                  {stats.perdidas_total > 0 ? (
                    <View className="gap-2">
                      <Banner tone="warning" title="Pérdidas registradas">
                        {formatMoney(stats.perdidas_total, currency)} en ajustes negativos de stock.
                      </Banner>
                      <View className="gap-1.5">
                        {stats.perdidas.slice(0, 8).map((loss, index) => (
                          <View
                            key={`${loss.nombre}-${index}`}
                            className="flex-row items-center gap-2 border-2 border-black bg-elevated px-2 py-1.5"
                          >
                            <View className="flex-1 gap-0.5">
                              <Text
                                className="font-body-semibold text-xs text-fg"
                                numberOfLines={1}
                              >
                                {loss.nombre}
                              </Text>
                              <Text className="font-body text-2xs text-muted">
                                {loss.categoria} · {formatQuantity(loss.unidades)} u.
                              </Text>
                            </View>
                            <Text className="font-mono-bold text-xs text-danger-ink">
                              {formatMoney(loss.valor, currency)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <Banner tone="success" title="Sin pérdidas en el período">
                      No se registraron ajustes negativos de stock. Buen control.
                    </Banner>
                  )}
                </SectionCard>

                <SectionCard
                  title="Evolución de precios"
                  subtitle="Precio promedio de venta vs. período anterior"
                  className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
                >
                  {stats.precios.length === 0 ? (
                    <Text className="font-body text-xs leading-5 text-muted">
                      Sin cambios de precio detectados entre este período y el anterior.
                    </Text>
                  ) : (
                    <View className="gap-1.5">
                      {stats.precios.slice(0, 8).map((price) => (
                        <View
                          key={price.producto_id}
                          className="flex-row items-center gap-2 border-2 border-black bg-elevated px-2 py-1.5"
                        >
                          <View className="flex-1 gap-0.5">
                            <Text
                              className="font-body-semibold text-xs text-fg"
                              numberOfLines={1}
                            >
                              {price.nombre}
                            </Text>
                            <Text className="font-mono text-2xs text-muted">
                              {formatMoney(price.precio_anterior, currency)} →{' '}
                              {formatMoney(price.precio_actual, currency)}
                            </Text>
                          </View>
                          <Badge tone={price.variacion > 0 ? 'orange' : 'primary'}>
                            {signedPercent(price.variacion)}
                          </Badge>
                        </View>
                      ))}
                    </View>
                  )}
                </SectionCard>
              </View>
            </>
          )}

          <SectionCard
            title="Salud del stock"
            subtitle="Valor, alertas y productos que necesitan atención"
            className="mb-4"
          >
            <View className="flex-row flex-wrap gap-2">
              <Stat
                label="Stock a costo"
                value={formatMoney(stats.stock_valor.costo, currency)}
                hint="Capital inmovilizado"
                className="min-w-[140px]"
              />
              <Stat
                label="Stock a venta"
                value={formatMoney(stats.stock_valor.venta, currency)}
                hint="Si se vende todo"
                tone="primary"
                className="min-w-[140px]"
              />
              <Stat
                label="Agotados"
                value={formatQuantity(stats.agotados.length)}
                tone={stats.agotados.length > 0 ? 'danger' : 'default'}
                className="min-w-[110px]"
              />
              <Stat
                label="Stock bajo"
                value={formatQuantity(stats.stock_bajo.length)}
                tone={stats.stock_bajo.length > 0 ? 'accent' : 'default'}
                className="min-w-[110px]"
              />
              <Stat
                label="Sobre stock"
                value={formatQuantity(stats.sobre_stock.length)}
                hint={formatMoney(overStockValue, currency)}
                className="min-w-[120px]"
              />
            </View>

            <Segmented options={stockTabOptions} value={stockTab} onChange={setStockTab} />

            {stockRows.length === 0 ? (
              <Text className="font-body text-xs text-muted">
                {stockTab === 'agotados'
                  ? 'No hay productos agotados. Buen trabajo.'
                  : stockTab === 'sobre'
                    ? 'No hay productos con sobre-stock según las ventas recientes.'
                    : 'No hay productos en o por debajo del stock mínimo.'}
              </Text>
            ) : (
              <View className="gap-1.5">
                {stockRows.slice(0, 12).map((product) => (
                  <StockRow
                    key={product.id}
                    product={product}
                    currency={currency}
                    mode={stockTab}
                  />
                ))}
                {stockRows.length > 12 ? (
                  <Text className="font-body text-2xs text-muted">
                    Mostrando 12 de {formatQuantity(stockRows.length)} productos.
                  </Text>
                ) : null}
              </View>
            )}
          </SectionCard>

          <View className={desktop ? 'mb-4 flex-row flex-wrap gap-4' : 'mb-4 gap-4'}>
            <SectionCard
              title="Predicción de agotamiento"
              subtitle="Según las ventas de los 30 días previos"
              className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
            >
              {stats.prediccion.length === 0 ? (
                <Text className="font-body text-xs leading-5 text-muted">
                  No hay productos con stock y ventas recientes suficientes para estimar el
                  agotamiento.
                </Text>
              ) : (
                <View className="gap-1.5">
                  {stats.prediccion.slice(0, 10).map((product) => (
                    <StockRow
                      key={product.id}
                      product={product}
                      currency={currency}
                      mode="prediccion"
                    />
                  ))}
                </View>
              )}
            </SectionCard>

            <SectionCard
              title="Recomendaciones de compra"
              subtitle="Para cubrir 7 días y el stock mínimo"
              className={desktop ? 'min-w-[320px] flex-1 basis-[420px]' : undefined}
            >
              {stats.recomendaciones.length === 0 ? (
                <Text className="font-body text-xs leading-5 text-muted">
                  No hay reposiciones urgentes: el stock alcanza para el ritmo de venta actual.
                </Text>
              ) : (
                <View className="gap-1.5">
                  {stats.recomendaciones.slice(0, 10).map((product) => (
                    <StockRow
                      key={product.id}
                      product={product}
                      currency={currency}
                      mode="recomendacion"
                    />
                  ))}
                </View>
              )}
            </SectionCard>
          </View>
        </>
      )}
    </Screen>
  );
}
