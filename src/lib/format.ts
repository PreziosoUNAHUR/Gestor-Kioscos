import type { MetodoPago } from './database.types';

const METHOD_LABELS: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  qr: 'QR',
  otro: 'Otro',
};

export const METODOS_PAGO = Object.keys(METHOD_LABELS) as MetodoPago[];

export function metodoPagoLabel(metodo: MetodoPago): string {
  return METHOD_LABELS[metodo] ?? metodo;
}

/**
 * Formatea dinero con Intl (Hermes incluye ICU). Si falla, cae a un formato
 * manual es-AR para no romper la caja.
 */
export function formatMoney(value: number | string | null | undefined, currency = 'ARS'): string {
  const amount = typeof value === 'string' ? Number(value) : (value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    const fixed = Math.abs(safe).toFixed(2).replace('.', ',');
    const [int = '0', dec = '00'] = fixed.split(',');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${safe < 0 ? '-' : ''}$ ${grouped},${dec}`;
  }
}

/** Convierte "1.234,50", "1234.5" o "$ 1.234,50" a number. */
export function parseMoneyInput(text: string): number {
  const cleaned = text.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;
  if (lastComma > lastDot) {
    // Formato es-AR: puntos de miles, coma decimal.
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato en-US: coma de miles, punto decimal.
    normalized = cleaned.replace(/,/g, '');
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 }).format(value);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function formatPercent(value: number, digits = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(digits)}%`;
}

/** Minúsculas y sin diacríticos, para búsquedas tolerantes. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function startOfDay(date = new Date()): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function daysAgo(days: number): Date {
  const date = startOfDay();
  date.setDate(date.getDate() - days);
  return date;
}

/** "hace 2 h", "recién" — para estados de sincronización. */
export function timeAgo(iso: string | number | null | undefined): string {
  if (!iso) return '—';
  const then = typeof iso === 'number' ? iso : new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 30_000) return 'recién';
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`;
  return `hace ${Math.floor(diff / 86_400_000)} d`;
}
