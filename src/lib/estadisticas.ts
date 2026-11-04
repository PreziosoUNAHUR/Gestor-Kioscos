import type { Json } from './database.types';
import { formatDate, formatMoney, formatQuantity, metodoPagoUiLabel, startOfDay } from './format';

/* -------------------------------------------------------------------------- */
/*  Períodos                                                                   */
/* -------------------------------------------------------------------------- */

export type PeriodKey =
  | 'hoy'
  | 'ayer'
  | '7d'
  | '30d'
  | 'semana'
  | 'semana_pasada'
  | 'mes'
  | 'mes_pasado'
  | 'anio'
  | 'custom';

export type CustomRange = {
  desde: string;
  hasta: string;
};

export type DateRange = {
  desde: Date;
  hasta: Date;
  comparisonDesde: Date;
  comparisonHasta: Date;
  comparisonLabel: string;
};

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'ayer', label: 'Ayer' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'semana', label: 'Semana' },
  { value: 'semana_pasada', label: 'Sem. pasada' },
  { value: 'mes', label: 'Mes' },
  { value: 'mes_pasado', label: 'Mes pasado' },
  { value: 'anio', label: 'Año' },
  { value: 'custom', label: 'Personalizado' },
];

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function shiftMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  const day = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + months);
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(day, lastDay));
  return copy;
}

function startOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  const offset = (copy.getDay() + 6) % 7; // lunes = 0
  copy.setDate(copy.getDate() - offset);
  return copy;
}

function startOfMonth(date: Date): Date {
  const copy = startOfDay(date);
  copy.setDate(1);
  return copy;
}

function startOfYear(date: Date): Date {
  const copy = startOfDay(date);
  copy.setMonth(0, 1);
  return copy;
}

function parseDateKey(value: string, fallback: Date): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 0, 0, 0, 0);
  // `new Date(2026, 1, 31)` se normaliza a marzo: validamos el round-trip.
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return fallback;
  }
  return date;
}

function validRange(desde: Date, hasta: Date): { desde: Date; hasta: Date } {
  if (hasta.getTime() > desde.getTime()) return { desde, hasta };
  return { desde, hasta: new Date(desde.getTime() + 60_000) };
}

/** Rango de fechas + período de comparación inmediatamente anterior. */
export function resolvePeriod(key: PeriodKey, custom: CustomRange, now = new Date()): DateRange {
  const today = startOfDay(now);
  let desde = today;
  let hasta = now;
  let comparisonDesde: Date;
  let comparisonHasta: Date;
  let comparisonLabel = 'vs. período anterior';

  switch (key) {
    case 'hoy': {
      desde = today;
      hasta = now;
      comparisonDesde = addDays(desde, -1);
      comparisonHasta = addDays(hasta, -1);
      comparisonLabel = 'vs. ayer';
      break;
    }
    case 'ayer': {
      desde = addDays(today, -1);
      hasta = today;
      comparisonDesde = addDays(desde, -1);
      comparisonHasta = addDays(hasta, -1);
      comparisonLabel = 'vs. anteayer';
      break;
    }
    case '7d': {
      desde = addDays(today, -6);
      hasta = now;
      comparisonDesde = addDays(desde, -7);
      comparisonHasta = addDays(hasta, -7);
      comparisonLabel = 'vs. 7 días anteriores';
      break;
    }
    case '30d': {
      desde = addDays(today, -29);
      hasta = now;
      comparisonDesde = addDays(desde, -30);
      comparisonHasta = addDays(hasta, -30);
      comparisonLabel = 'vs. 30 días anteriores';
      break;
    }
    case 'semana': {
      desde = startOfWeek(now);
      hasta = now;
      comparisonDesde = addDays(desde, -7);
      comparisonHasta = addDays(hasta, -7);
      comparisonLabel = 'vs. semana anterior';
      break;
    }
    case 'semana_pasada': {
      desde = addDays(startOfWeek(now), -7);
      hasta = startOfWeek(now);
      comparisonDesde = addDays(desde, -7);
      comparisonHasta = addDays(hasta, -7);
      comparisonLabel = 'vs. semana anterior';
      break;
    }
    case 'mes': {
      desde = startOfMonth(now);
      hasta = now;
      comparisonDesde = shiftMonths(desde, -1);
      comparisonHasta = shiftMonths(hasta, -1);
      comparisonLabel = 'vs. mes anterior';
      break;
    }
    case 'mes_pasado': {
      desde = shiftMonths(startOfMonth(now), -1);
      hasta = startOfMonth(now);
      comparisonDesde = shiftMonths(desde, -1);
      comparisonHasta = shiftMonths(hasta, -1);
      comparisonLabel = 'vs. mes anterior';
      break;
    }
    case 'anio': {
      desde = startOfYear(now);
      hasta = now;
      comparisonDesde = new Date(desde);
      comparisonDesde.setFullYear(comparisonDesde.getFullYear() - 1);
      comparisonHasta = new Date(hasta);
      comparisonHasta.setFullYear(comparisonHasta.getFullYear() - 1);
      comparisonLabel = 'vs. año anterior';
      break;
    }
    case 'custom': {
      desde = parseDateKey(custom.desde, addDays(today, -6));
      const end = parseDateKey(custom.hasta, today);
      hasta = addDays(end, 1);
      if (hasta.getTime() <= desde.getTime()) {
        desde = startOfDay(end);
        hasta = addDays(desde, 1);
      }
      const span = hasta.getTime() - desde.getTime();
      comparisonHasta = new Date(desde.getTime());
      comparisonDesde = new Date(desde.getTime() - span);
      comparisonLabel = 'vs. período anterior';
      break;
    }
  }

  const range = validRange(desde, hasta);
  return {
    ...range,
    comparisonDesde,
    comparisonHasta: comparisonHasta.getTime() > comparisonDesde.getTime() ? comparisonHasta : comparisonDesde,
    comparisonLabel,
  };
}

export function rangeLabel(range: DateRange): string {
  const lastDay = new Date(range.hasta.getTime() - 1);
  return `${formatDate(range.desde)} → ${formatDate(lastDay)}`;
}

/* -------------------------------------------------------------------------- */
/*  Tipos del RPC                                                              */
/* -------------------------------------------------------------------------- */

export type Totales = {
  ventas: number;
  facturacion: number;
  unidades: number;
  costo: number;
  ganancia: number;
  margen: number;
  ticket_promedio: number;
};

export type TotalesActuales = Totales & {
  subtotal: number;
  descuentos: number;
  anuladas: number;
  anuladas_total: number;
};

export type ProductoStat = {
  producto_id: string | null;
  nombre: string;
  unidades: number;
  facturacion: number;
  costo: number;
  ganancia: number;
  margen: number;
};

export type ProductoFrio = {
  id: string;
  nombre: string;
  categoria: string;
  stock: number;
  stock_minimo: number;
  unidades: number;
  ultima_venta: string | null;
  dias_sin_venta: number | null;
};

export type CategoriaStat = {
  categoria: string;
  unidades: number;
  facturacion: number;
  costo: number;
  ganancia: number;
};

export type SeriePoint = {
  bucket: string;
  total: number;
  cantidad: number;
  unidades: number;
  ganancia: number;
};

export type HoraStat = {
  hora: number;
  cantidad: number;
  total: number;
  unidades: number;
  ganancia: number;
};

export type DiaStat = {
  dia: number;
  cantidad: number;
  total: number;
  unidades: number;
  ganancia: number;
};

export type CalendarioDia = {
  fecha: string;
  total: number;
  cantidad: number;
  unidades: number;
};

export type MetodoStat = {
  metodo: string;
  cantidad: number;
  total: number;
  porcentaje: number;
};

export type VendedorStat = {
  usuario_id: string | null;
  email: string;
  cantidad: number;
  total: number;
  unidades: number;
  ticket_promedio: number;
};

export type ParStat = {
  producto_a: string;
  nombre_a: string;
  producto_b: string;
  nombre_b: string;
  veces: number;
};

export type StockStat = {
  id: string;
  nombre: string;
  categoria: string;
  stock: number;
  stock_minimo: number;
  precio_costo: number;
  precio_venta: number;
  unidades: number;
  promedio_diario: number;
  dias_stock: number | null;
};

export type RecomendacionStat = StockStat & {
  recomendado: number;
  prioridad: 'urgente' | 'proximo' | 'considerar';
};

export type PerdidaStat = {
  nombre: string;
  categoria: string;
  unidades: number;
  valor: number;
};

export type PrecioStat = {
  producto_id: string;
  nombre: string;
  precio_actual: number;
  precio_anterior: number;
  variacion: number;
};

export type Estadisticas = {
  periodo: {
    desde: string;
    hasta: string;
    comparacion_desde: string;
    comparacion_hasta: string;
    granularidad: string;
    dias_stock: number;
    zona_horaria: string;
  };
  actual: TotalesActuales;
  anterior: Totales;
  productos_vendidos: ProductoStat[];
  top_unidades: ProductoStat[];
  top_facturacion: ProductoStat[];
  top_ganancia: ProductoStat[];
  top_margen: ProductoStat[];
  menos_vendidos: ProductoFrio[];
  categorias: CategoriaStat[];
  serie: SeriePoint[];
  horas: HoraStat[];
  dias: DiaStat[];
  calendario: CalendarioDia[];
  metodos: MetodoStat[];
  vendedores: VendedorStat[];
  pares: ParStat[];
  precios: PrecioStat[];
  stock_bajo: StockStat[];
  agotados: StockStat[];
  sobre_stock: StockStat[];
  prediccion: StockStat[];
  recomendaciones: RecomendacionStat[];
  perdidas: PerdidaStat[];
  perdidas_total: number;
  fiado: { clientes: number; pendiente: number };
  stock_valor: { costo: number; venta: number };
};

/* -------------------------------------------------------------------------- */
/*  Parseo defensivo                                                           */
/* -------------------------------------------------------------------------- */

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTotales(value: unknown): Totales {
  const raw = record(value);
  return {
    ventas: num(raw.ventas),
    facturacion: num(raw.facturacion),
    unidades: num(raw.unidades),
    costo: num(raw.costo),
    ganancia: num(raw.ganancia),
    margen: num(raw.margen),
    ticket_promedio: num(raw.ticket_promedio),
  };
}

function parseProducto(value: unknown): ProductoStat {
  const raw = record(value);
  return {
    producto_id: textOrNull(raw.producto_id),
    nombre: text(raw.nombre, 'Producto'),
    unidades: num(raw.unidades),
    facturacion: num(raw.facturacion),
    costo: num(raw.costo),
    ganancia: num(raw.ganancia),
    margen: num(raw.margen),
  };
}

function parseStock(value: unknown): StockStat {
  const raw = record(value);
  return {
    id: text(raw.id),
    nombre: text(raw.nombre, 'Producto'),
    categoria: text(raw.categoria, 'Sin categoría'),
    stock: num(raw.stock),
    stock_minimo: num(raw.stock_minimo),
    precio_costo: num(raw.precio_costo),
    precio_venta: num(raw.precio_venta),
    unidades: num(raw.unidades),
    promedio_diario: num(raw.promedio_diario),
    dias_stock: numOrNull(raw.dias_stock),
  };
}

export function parseEstadisticas(value: Json | null | undefined): Estadisticas | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = record(value);
  const actualRaw = record(raw.actual);
  if (!raw.actual || typeof raw.actual !== 'object' || Array.isArray(raw.actual)) return null;
  if (!raw.periodo || typeof raw.periodo !== 'object' || Array.isArray(raw.periodo)) return null;
  const periodo = record(raw.periodo);
  const fiadoRaw = record(raw.fiado);
  const stockValorRaw = record(raw.stock_valor);

  return {
    periodo: {
      desde: text(periodo.desde),
      hasta: text(periodo.hasta),
      comparacion_desde: text(periodo.comparacion_desde),
      comparacion_hasta: text(periodo.comparacion_hasta),
      granularidad: text(periodo.granularidad, 'dia'),
      dias_stock: num(periodo.dias_stock) || 30,
      zona_horaria: text(periodo.zona_horaria, 'America/Argentina/Buenos_Aires'),
    },
    actual: {
      ...parseTotales(actualRaw),
      subtotal: num(actualRaw.subtotal),
      descuentos: num(actualRaw.descuentos),
      anuladas: num(actualRaw.anuladas),
      anuladas_total: num(actualRaw.anuladas_total),
    },
    anterior: parseTotales(raw.anterior),
    productos_vendidos: list(raw.productos_vendidos).map(parseProducto),
    top_unidades: list(raw.top_unidades).map(parseProducto),
    top_facturacion: list(raw.top_facturacion).map(parseProducto),
    top_ganancia: list(raw.top_ganancia).map(parseProducto),
    top_margen: list(raw.top_margen).map(parseProducto),
    menos_vendidos: list(raw.menos_vendidos).map((value) => {
      const item = record(value);
      return {
        id: text(item.id),
        nombre: text(item.nombre, 'Producto'),
        categoria: text(item.categoria, 'Sin categoría'),
        stock: num(item.stock),
        stock_minimo: num(item.stock_minimo),
        unidades: num(item.unidades),
        ultima_venta: textOrNull(item.ultima_venta),
        dias_sin_venta: numOrNull(item.dias_sin_venta),
      };
    }),
    categorias: list(raw.categorias).map((value) => {
      const item = record(value);
      return {
        categoria: text(item.categoria, 'Sin categoría'),
        unidades: num(item.unidades),
        facturacion: num(item.facturacion),
        costo: num(item.costo),
        ganancia: num(item.ganancia),
      };
    }),
    serie: list(raw.serie).map((value) => {
      const item = record(value);
      return {
        bucket: text(item.bucket),
        total: num(item.total),
        cantidad: num(item.cantidad),
        unidades: num(item.unidades),
        ganancia: num(item.ganancia),
      };
    }),
    horas: list(raw.horas).map((value) => {
      const item = record(value);
      return {
        hora: num(item.hora),
        cantidad: num(item.cantidad),
        total: num(item.total),
        unidades: num(item.unidades),
        ganancia: num(item.ganancia),
      };
    }),
    dias: list(raw.dias).map((value) => {
      const item = record(value);
      return {
        dia: num(item.dia),
        cantidad: num(item.cantidad),
        total: num(item.total),
        unidades: num(item.unidades),
        ganancia: num(item.ganancia),
      };
    }),
    calendario: list(raw.calendario).map((value) => {
      const item = record(value);
      return {
        fecha: text(item.fecha),
        total: num(item.total),
        cantidad: num(item.cantidad),
        unidades: num(item.unidades),
      };
    }),
    metodos: list(raw.metodos).map((value) => {
      const item = record(value);
      return {
        metodo: text(item.metodo, 'otro'),
        cantidad: num(item.cantidad),
        total: num(item.total),
        porcentaje: num(item.porcentaje),
      };
    }),
    vendedores: list(raw.vendedores).map((value) => {
      const item = record(value);
      return {
        usuario_id: textOrNull(item.usuario_id),
        email: text(item.email, 'Sin usuario'),
        cantidad: num(item.cantidad),
        total: num(item.total),
        unidades: num(item.unidades),
        ticket_promedio: num(item.ticket_promedio),
      };
    }),
    pares: list(raw.pares).map((value) => {
      const item = record(value);
      return {
        producto_a: text(item.producto_a),
        nombre_a: text(item.nombre_a, 'Producto'),
        producto_b: text(item.producto_b),
        nombre_b: text(item.nombre_b, 'Producto'),
        veces: num(item.veces),
      };
    }),
    precios: list(raw.precios).map((value) => {
      const item = record(value);
      return {
        producto_id: text(item.producto_id),
        nombre: text(item.nombre, 'Producto'),
        precio_actual: num(item.precio_actual),
        precio_anterior: num(item.precio_anterior),
        variacion: num(item.variacion),
      };
    }),
    stock_bajo: list(raw.stock_bajo).map(parseStock),
    agotados: list(raw.agotados).map(parseStock),
    sobre_stock: list(raw.sobre_stock).map(parseStock),
    prediccion: list(raw.prediccion).map(parseStock),
    recomendaciones: list(raw.recomendaciones).map((value) => {
      const base = parseStock(value);
      const item = record(value);
      const prioridad = text(item.prioridad, 'considerar');
      return {
        ...base,
        recomendado: num(item.recomendado),
        prioridad:
          prioridad === 'urgente' || prioridad === 'proximo' ? prioridad : 'considerar',
      };
    }),
    perdidas: list(raw.perdidas).map((value) => {
      const item = record(value);
      return {
        nombre: text(item.nombre, 'Producto'),
        categoria: text(item.categoria, 'Sin categoría'),
        unidades: num(item.unidades),
        valor: num(item.valor),
      };
    }),
    perdidas_total: num(raw.perdidas_total),
    fiado: {
      clientes: num(fiadoRaw.clientes),
      pendiente: num(fiadoRaw.pendiente),
    },
    stock_valor: {
      costo: num(stockValorRaw.costo),
      venta: num(stockValorRaw.venta),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Cálculos y textos                                                          */
/* -------------------------------------------------------------------------- */

export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatDelta(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'sin base';
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${value > 0 ? '+' : ''}${rounded.replace('.', ',')}%`;
}

export function formatCompactMoney(value: number, currency = 'ARS'): string {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const symbol = currency === 'ARS' ? '$' : currency;
  if (abs >= 1_000_000) return `${symbol} ${(safe / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 10_000) return `${symbol} ${Math.round(safe / 1000)}k`;
  if (abs >= 1000) return `${symbol} ${(safe / 1000).toFixed(1).replace('.', ',')}k`;
  return `${symbol} ${Math.round(safe)}`;
}

export function formatBucketLabel(bucket: string, granularity: string): string {
  // El RPC devuelve "YYYY-MM-DD HH24:MI" en la zona del kiosco.
  const [datePart = '', timePart = ''] = bucket.split(' ');
  const [year = '', month = '', day = ''] = datePart.split('-');

  if (granularity === 'hora') return `${timePart || '00:00'}`;
  if (granularity === 'mes') {
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${months[Number(month) - 1] ?? month} ${year.slice(2)}`;
  }
  if (granularity === 'semana') return `${day}/${month}`;
  return `${day}/${month}`;
}

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function diaLabel(dia: number): string {
  return DIAS_SEMANA[Math.max(0, Math.min(6, dia - 1))] ?? '—';
}

export function horaLabel(hora: number): string {
  return `${String(Math.max(0, Math.min(23, hora))).padStart(2, '0')}:00`;
}

/* -------------------------------------------------------------------------- */
/*  Alertas e insights                                                         */
/* -------------------------------------------------------------------------- */

export type InsightTone = 'info' | 'success' | 'warning' | 'danger';

export type Insight = {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
};

const TONE_PRIORITY: Record<InsightTone, number> = {
  danger: 0,
  warning: 1,
  success: 2,
  info: 3,
};

function sortInsights(insights: Insight[]): Insight[] {
  return [...insights].sort((a, b) => TONE_PRIORITY[a.tone] - TONE_PRIORITY[b.tone]);
}

/** Alertas operativas: cosas que conviene resolver hoy. */
export function buildAlerts(stats: Estadisticas, currency = 'ARS'): Insight[] {
  const alerts: Insight[] = [];
  const { actual, anterior } = stats;

  if (actual.ventas === 0) {
    alerts.push({
      id: 'sin-ventas',
      tone: 'info',
      title: 'Sin ventas en el período',
      detail: 'Probá con otro rango o registrá la primera venta desde la caja.',
    });
  } else {
    const change = percentChange(actual.facturacion, anterior.facturacion);
    if (change !== null && change <= -20) {
      alerts.push({
        id: 'caida-ventas',
        tone: 'warning',
        title: `La facturación bajó ${Math.abs(change).toFixed(0)}%`,
        detail: `Este período vendiste ${formatMoney(actual.facturacion, currency)} contra ${formatMoney(anterior.facturacion, currency)} del anterior.`,
      });
    }

    if (actual.margen > 0 && actual.margen < 15) {
      alerts.push({
        id: 'margen-bajo',
        tone: 'warning',
        title: 'Margen bajo',
        detail: `El margen del período es ${actual.margen.toFixed(1).replace('.', ',')}%. Revisá costos y descuentos.`,
      });
    }

    const anuladasPct = actual.ventas > 0 ? (actual.anuladas / (actual.ventas + actual.anuladas)) * 100 : 0;
    if (actual.anuladas >= 2 && anuladasPct >= 5) {
      alerts.push({
        id: 'anuladas',
        tone: 'danger',
        title: 'Muchas ventas anuladas',
        detail: `${actual.anuladas} ventas anuladas por ${formatMoney(actual.anuladas_total, currency)}. Revisá el proceso de cobro.`,
      });
    }
  }

  if (stats.agotados.length > 0) {
    alerts.push({
      id: 'agotados',
      tone: 'warning',
      title: `${stats.agotados.length} producto${stats.agotados.length === 1 ? '' : 's'} agotado${stats.agotados.length === 1 ? '' : 's'}`,
      detail: 'No tienen stock y pueden estar frenando ventas.',
    });
  }

  const urgentes = stats.recomendaciones.filter((item) => item.prioridad === 'urgente');
  if (urgentes.length > 0) {
    alerts.push({
      id: 'reposicion-urgente',
      tone: 'danger',
      title: `${urgentes.length} reposición${urgentes.length === 1 ? '' : 'es'} urgente${urgentes.length === 1 ? '' : 's'}`,
      detail: 'Hay productos que se agotan en 3 días o menos según su ritmo de venta.',
    });
  } else if (stats.stock_bajo.length > 0) {
    alerts.push({
      id: 'stock-bajo',
      tone: 'warning',
      title: `${stats.stock_bajo.length} producto${stats.stock_bajo.length === 1 ? '' : 's'} con stock bajo`,
      detail: 'Están en o por debajo del stock mínimo configurado.',
    });
  }

  if (stats.fiado.pendiente > 0) {
    const ratio = actual.facturacion > 0 ? stats.fiado.pendiente / actual.facturacion : 0;
    if (stats.fiado.clientes >= 3 || ratio >= 0.25) {
      alerts.push({
        id: 'fiado',
        tone: 'warning',
        title: 'Fiado pendiente alto',
        detail: `${stats.fiado.clientes} cliente${stats.fiado.clientes === 1 ? '' : 's'} deben ${formatMoney(stats.fiado.pendiente, currency)} en total.`,
      });
    }
  }

  if (stats.perdidas_total > 0) {
    alerts.push({
      id: 'perdidas',
      tone: 'warning',
      title: 'Pérdidas por ajustes de stock',
      detail: `Se registraron ${formatMoney(stats.perdidas_total, currency)} en ajustes negativos.`,
    });
  }

  if (stats.sobre_stock.length > 0) {
    alerts.push({
      id: 'sobre-stock',
      tone: 'info',
      title: `${stats.sobre_stock.length} producto${stats.sobre_stock.length === 1 ? '' : 's'} con sobre-stock`,
      detail: 'Tienen stock para más de 45 días según las ventas de los últimos 30 días.',
    });
  }

  return sortInsights(alerts).slice(0, 8);
}

/** Insights automáticos: patrones y oportunidades del negocio. */
export function buildInsights(stats: Estadisticas, currency = 'ARS'): Insight[] {
  const insights: Insight[] = [];
  const { actual, anterior } = stats;

  const facturacionChange = percentChange(actual.facturacion, anterior.facturacion);
  if (facturacionChange !== null && Math.abs(facturacionChange) >= 5) {
    insights.push({
      id: 'facturacion-trend',
      tone: facturacionChange > 0 ? 'success' : 'warning',
      title: `Facturación ${formatDelta(facturacionChange)} vs. período anterior`,
      detail: `${formatMoney(actual.facturacion, currency)} contra ${formatMoney(anterior.facturacion, currency)}.`,
    });
  }

  const ticketChange = percentChange(actual.ticket_promedio, anterior.ticket_promedio);
  if (ticketChange !== null && Math.abs(ticketChange) >= 5) {
    insights.push({
      id: 'ticket-trend',
      tone: ticketChange > 0 ? 'success' : 'info',
      title: `Ticket promedio ${formatDelta(ticketChange)}`,
      detail: `Ahora es ${formatMoney(actual.ticket_promedio, currency)} por venta.`,
    });
  }

  const bestDay = [...stats.dias].sort((a, b) => b.total - a.total)[0];
  if (bestDay && bestDay.total > 0) {
    insights.push({
      id: 'mejor-dia',
      tone: 'info',
      title: `${diaLabel(bestDay.dia)} es el día más fuerte`,
      detail: `${formatMoney(bestDay.total, currency)} en ${bestDay.cantidad} venta${bestDay.cantidad === 1 ? '' : 's'}.`,
    });
  }

  const bestHour = [...stats.horas].sort((a, b) => b.total - a.total)[0];
  if (bestHour && bestHour.total > 0) {
    insights.push({
      id: 'mejor-hora',
      tone: 'info',
      title: `La hora pico es ${horaLabel(bestHour.hora)}`,
      detail: `${formatMoney(bestHour.total, currency)} facturados en esa franja.`,
    });
  }

  const topProduct = stats.top_unidades[0];
  if (topProduct && topProduct.unidades > 0) {
    insights.push({
      id: 'producto-estrella',
      tone: 'success',
      title: `${topProduct.nombre} es el más vendido`,
      detail: `${formatQuantity(topProduct.unidades)} unidades y ${formatMoney(topProduct.facturacion, currency)} facturados.`,
    });
  }

  const topCategory = stats.categorias[0];
  if (topCategory && topCategory.facturacion > 0) {
    const share = actual.facturacion > 0 ? (topCategory.facturacion / actual.facturacion) * 100 : 0;
    insights.push({
      id: 'categoria-top',
      tone: 'info',
      title: `${topCategory.categoria} lidera las ventas`,
      detail: `Representa ${share.toFixed(0)}% de la facturación del período.`,
    });
  }

  const topMethod = stats.metodos[0];
  if (topMethod && topMethod.total > 0) {
    insights.push({
      id: 'metodo-top',
      tone: 'info',
      title: `El medio de pago más usado es ${metodoPagoUiLabel(topMethod.metodo)}`,
      detail: `${formatMoney(topMethod.total, currency)} (${topMethod.porcentaje.toFixed(1).replace('.', ',')}% del total).`,
    });
  }

  const topPair = stats.pares[0];
  if (topPair && topPair.veces >= 2) {
    insights.push({
      id: 'combo',
      tone: 'success',
      title: 'Combo natural',
      detail: `${topPair.nombre_a} + ${topPair.nombre_b} se vendieron juntos ${topPair.veces} veces.`,
    });
  }

  const priceMove = [...stats.precios].sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion))[0];
  if (priceMove && Math.abs(priceMove.variacion) >= 5) {
    insights.push({
      id: 'precio',
      tone: priceMove.variacion > 0 ? 'info' : 'warning',
      title: `${priceMove.nombre}: precio ${formatDelta(priceMove.variacion)}`,
      detail: `Pasó de ${formatMoney(priceMove.precio_anterior, currency)} a ${formatMoney(priceMove.precio_actual, currency)} en promedio.`,
    });
  }

  if (stats.fiado.pendiente > 0 && stats.fiado.clientes > 0) {
    insights.push({
      id: 'fiado-total',
      tone: 'info',
      title: 'Fiado en la calle',
      detail: `${stats.fiado.clientes} cliente${stats.fiado.clientes === 1 ? '' : 's'} deben ${formatMoney(stats.fiado.pendiente, currency)}.`,
    });
  }

  return sortInsights(insights).slice(0, 8);
}
