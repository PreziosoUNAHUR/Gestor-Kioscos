import { ScrollView, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import type { CalendarioDia } from '@/lib/estadisticas';

type Color = 'primary' | 'success' | 'accent' | 'orange' | 'pink' | 'danger';

const BAR_COLORS: Record<Color, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  accent: 'bg-accent',
  orange: 'bg-orange',
  pink: 'bg-pink',
  danger: 'bg-danger',
};

const TEXT_COLORS: Record<Color, string> = {
  primary: 'text-primary-ink',
  success: 'text-success-ink',
  accent: 'text-accent-ink',
  orange: 'text-[#9A4A00]',
  pink: 'text-[#9D174D]',
  danger: 'text-danger-ink',
};

export type HBarDatum = {
  label: string;
  value: number;
  hint?: string;
};

type HBarChartProps = {
  data: HBarDatum[];
  formatValue: (value: number) => string;
  color?: Color;
  emptyLabel?: string;
  maxRows?: number;
  labelWidth?: number;
};

/** Barras horizontales: ideal para categorías, medios de pago y rankings. */
export function HBarChart({
  data,
  formatValue,
  color = 'primary',
  emptyLabel = 'Sin datos en el período.',
  maxRows = 10,
  labelWidth = 92,
}: HBarChartProps) {
  if (data.length === 0) {
    return <Text className="font-body text-xs text-muted">{emptyLabel}</Text>;
  }

  const rows = data.slice(0, maxRows);
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0.01);

  return (
    <View className="gap-2">
      {rows.map((row, index) => {
        const pct = Math.max(0, Math.min(100, (Math.abs(row.value) / max) * 100));
        return (
          <View key={`${row.label}-${index}`} className="flex-row items-center gap-2">
            <Text
              className="font-body text-2xs leading-4 text-fg"
              style={{ width: labelWidth }}
              numberOfLines={2}
            >
              {row.label}
            </Text>
            <View className="h-4 flex-1 overflow-hidden border-2 border-black bg-elevated">
              <View
                className={cn('h-full', BAR_COLORS[color])}
                style={{ width: `${Math.max(row.value > 0 ? 3 : 0, pct)}%` }}
              />
            </View>
            <Text
              className={cn('font-mono-bold text-2xs', TEXT_COLORS[color])}
              style={{ minWidth: 58, textAlign: 'right' }}
              numberOfLines={1}
            >
              {formatValue(row.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export type ColumnDatum = {
  label: string;
  value: number;
  hint?: string;
};

type ColumnChartProps = {
  data: ColumnDatum[];
  formatValue: (value: number) => string;
  color?: Color;
  height?: number;
  emptyLabel?: string;
  barWidth?: number;
};

/** Barras verticales con scroll horizontal: evolución temporal y horas. */
export function ColumnChart({
  data,
  formatValue,
  color = 'primary',
  height = 132,
  emptyLabel = 'Sin datos en el período.',
  barWidth = 28,
}: ColumnChartProps) {
  if (data.length === 0) {
    return <Text className="font-body text-xs text-muted">{emptyLabel}</Text>;
  }

  const max = Math.max(...data.map((point) => Math.max(0, point.value)), 0.01);
  const step = data.length <= 16 ? 1 : Math.ceil(data.length / 12);

  return (
    <View className="gap-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row items-end gap-1.5 pr-1">
          {data.map((point, index) => {
            const pct = Math.max(0, Math.min(100, (Math.max(0, point.value) / max) * 100));
            const showLabel = index % step === 0 || index === data.length - 1;
            return (
              <View key={`${point.label}-${index}`} style={{ width: barWidth }} className="items-center gap-1">
                <View
                  className="w-full justify-end border-2 border-black bg-elevated"
                  style={{ height }}
                >
                  <View
                    className={cn('w-full border-t-2 border-black', BAR_COLORS[color])}
                    style={{ height: `${point.value > 0 ? Math.max(2, pct) : 0}%` }}
                  />
                </View>
                <Text
                  className="font-mono text-[8px] text-muted"
                  style={{ opacity: showLabel ? 1 : 0 }}
                  numberOfLines={1}
                >
                  {point.label}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Text className="font-body text-2xs text-muted">
        Máximo: {formatValue(max)} · desplazá para ver todo el período.
      </Text>
    </View>
  );
}

type CalendarHeatmapProps = {
  days: CalendarioDia[];
  desde: Date;
  hasta: Date;
  formatValue: (value: number) => string;
};

const MAX_HEATMAP_DAYS = 63;

/**
 * Mapa de calor de ventas por día. Para períodos largos mostramos los últimos
 * 63 días: es suficiente para ver patrones sin convertir la pantalla en un muro.
 */
export function CalendarHeatmap({ days, desde, hasta, formatValue }: CalendarHeatmapProps) {
  const end = new Date(hasta.getTime() - 1);
  const startLimit = new Date(end);
  startLimit.setDate(startLimit.getDate() - (MAX_HEATMAP_DAYS - 1));
  const clipped = desde.getTime() < startLimit.getTime();
  const start = clipped ? startLimit : desde;

  const dayKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const byDate = new Map(days.map((day) => [day.fecha, day]));
  const startKey = dayKey(start);
  const endKey = dayKey(end);
  const max = Math.max(
    ...days
      .filter((day) => day.fecha >= startKey && day.fecha <= endKey)
      .map((day) => day.total),
    0.01,
  );

  const first = new Date(start);
  first.setHours(0, 0, 0, 0);
  const offset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - offset);

  const cells: { key: string; date: Date | null; inRange: boolean }[] = [];
  const cursor = new Date(first);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= last.getTime()) {
    const inRange = cursor.getTime() >= new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    cells.push({
      key: cursor.toISOString().slice(0, 10),
      date: inRange ? new Date(cursor) : null,
      inRange,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `pad-${cells.length}`, date: null, inRange: false });
  }

  const weeks: (typeof cells)[] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  const toneFor = (total: number): string => {
    if (total <= 0) return 'bg-elevated';
    const ratio = total / max;
    if (ratio <= 0.25) return 'bg-[#DCFCE7]';
    if (ratio <= 0.5) return 'bg-[#86EFAC]';
    if (ratio <= 0.75) return 'bg-[#4ADE80]';
    return 'bg-[#22C55E]';
  };

  return (
    <View className="gap-2">
      <View className="flex-row gap-1">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, index) => (
          <Text
            key={`${label}-${index}`}
            className="flex-1 text-center font-pixel text-pixel-2xs text-muted"
          >
            {label}
          </Text>
        ))}
      </View>

      <View className="max-w-[440px] gap-1">
        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} className="flex-row gap-1">
            {week.map((cell) => {
              if (!cell.date || !cell.inRange) {
                return <View key={cell.key} className="aspect-square flex-1" />;
              }
              const day = byDate.get(dayKey(cell.date));
              const total = day?.total ?? 0;
              return (
                <View
                  key={cell.key}
                  accessibilityLabel={`${dayKey(cell.date)}: ${formatValue(total)}`}
                  className={cn(
                    'aspect-square flex-1 items-center justify-center border-2 border-black',
                    toneFor(total),
                  )}
                >
                  <Text className="font-mono text-[8px] text-ink">{cell.date.getDate()}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="font-body text-2xs text-muted">Menos</Text>
        {['bg-elevated', 'bg-[#DCFCE7]', 'bg-[#86EFAC]', 'bg-[#4ADE80]', 'bg-[#22C55E]'].map((tone) => (
          <View key={tone} className={cn('h-3 w-3 border-2 border-black', tone)} />
        ))}
        <Text className="font-body text-2xs text-muted">
          Más · máximo {formatValue(max)}
        </Text>
      </View>

      {clipped ? (
        <Text className="font-body text-2xs text-muted">
          Mostrando los últimos {MAX_HEATMAP_DAYS} días del período para mantener el calendario
          legible.
        </Text>
      ) : null}
    </View>
  );
}
