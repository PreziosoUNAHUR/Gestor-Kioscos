/**
 * Lógica pura del escáner remoto (sin React ni Supabase) para poder testearla.
 *
 * Flujo:
 *   Celular (remote) --broadcast "barcode"--> PC (host)
 *   PC (host)        --broadcast "scan-ack"--> Celular (remote)
 *
 * Topic privado (la migración de Realtime valida pertenencia + sesión activa):
 *   kiosco:<uuid>:scanner:<CODIGO>
 */

export const SCAN_COOLDOWN_MS = 1200;
export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_TTL_MS = 12 * 60 * 60 * 1000;

/** Sin caracteres ambiguos (0/O, 1/I/L): el código se dicta en voz alta. */
const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOPIC_RE = /^kiosco:([0-9a-f-]{36}):scanner:([A-Z0-9]{4,16})$/i;

export type ScanOutcome =
  | {
      ok: true;
      code: string;
      nombre?: string;
      precio?: number;
      cantidad?: number;
    }
  | {
      ok: false;
      code: string;
      reason: 'not_found' | 'offline' | 'timeout' | 'error' | 'duplicate' | 'inactive';
      message?: string;
    };

export type ScanPayload = {
  code: string;
  ts: number;
  clientId: string;
  requestId: string;
};

export type AckPayload = ScanOutcome & {
  requestId: string;
  clientId: string;
};

export type ScanGate = {
  /** true si el código puede procesarse ahora; registra el intento. */
  shouldAccept: (code: string, now?: number) => boolean;
  reset: () => void;
  size: () => number;
};

/**
 * Ventana anti-doble-escaneo por código. Un mismo código dentro del cooldown
 * se ignora (la cámara suele disparar varias veces el mismo frame); códigos
 * distintos se aceptan de inmediato para no frenar una ráfaga de productos.
 */
export function createScanGate(cooldownMs: number = SCAN_COOLDOWN_MS): ScanGate {
  const lastAccepted = new Map<string, number>();
  const cooldown = Math.max(0, cooldownMs);

  return {
    shouldAccept(code: string, now: number = Date.now()) {
      const key = normalizeBarcode(code);
      if (!key) return false;

      const previous = lastAccepted.get(key);
      if (previous !== undefined && now - previous < cooldown) {
        return false;
      }

      lastAccepted.set(key, now);

      // Evita crecimiento sin límite en sesiones de muchas horas.
      if (lastAccepted.size > 256) {
        for (const [entry, timestamp] of lastAccepted) {
          if (now - timestamp > cooldown * 20) lastAccepted.delete(entry);
        }
      }

      return true;
    },
    reset() {
      lastAccepted.clear();
    },
    size() {
      return lastAccepted.size;
    },
  };
}

/** Normaliza lo que entrega la cámara/lector USB. No cambia mayúsculas: code128 es sensible. */
export function normalizeBarcode(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 64);
}

export function normalizePairingCode(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, PAIRING_CODE_LENGTH);
}

export function isPairingCode(value: string): boolean {
  if (value.length !== PAIRING_CODE_LENGTH) return false;
  for (const char of value) {
    if (!PAIRING_ALPHABET.includes(char)) return false;
  }
  return true;
}

/** Código local (el oficial lo emite la RPC `abrir_sesion_scanner`). */
export function generatePairingCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < PAIRING_CODE_LENGTH; i += 1) {
    const index = Math.floor(random() * PAIRING_ALPHABET.length);
    code += PAIRING_ALPHABET[Math.min(index, PAIRING_ALPHABET.length - 1)];
  }
  return code;
}

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Topic exacto que valida la política de Realtime. null si falta algún dato. */
export function buildScannerTopic(kioscoId: string | null | undefined, code: string | null | undefined): string | null {
  const normalizedCode = normalizePairingCode(code);
  if (!isUuid(kioscoId) || !isPairingCode(normalizedCode)) return null;
  return `kiosco:${kioscoId.toLowerCase()}:scanner:${normalizedCode}`;
}

export function parseScannerTopic(topic: string): { kioscoId: string; code: string } | null {
  const match = TOPIC_RE.exec(topic);
  if (!match) return null;
  const kioscoId = match[1];
  const code = match[2];
  if (!kioscoId || !code) return null;
  return { kioscoId: kioscoId.toLowerCase(), code };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseScanPayload(value: unknown): ScanPayload | null {
  if (!isRecord(value)) return null;
  const { code, ts, clientId, requestId } = value;

  if (typeof code !== 'string' || typeof ts !== 'number' || typeof clientId !== 'string' || typeof requestId !== 'string') {
    return null;
  }

  const normalized = normalizeBarcode(code);
  if (!normalized || !Number.isFinite(ts) || !clientId || !requestId) return null;

  return { code: normalized, ts, clientId, requestId };
}

export function parseAckPayload(value: unknown): AckPayload | null {
  if (!isRecord(value)) return null;
  const { requestId, clientId, code, ok } = value;
  if (typeof requestId !== 'string' || typeof clientId !== 'string' || typeof code !== 'string' || typeof ok !== 'boolean') {
    return null;
  }

  if (ok) {
    return {
      ok: true,
      code,
      requestId,
      clientId,
      nombre: typeof value.nombre === 'string' ? value.nombre : undefined,
      precio: typeof value.precio === 'number' ? value.precio : undefined,
      cantidad: typeof value.cantidad === 'number' ? value.cantidad : undefined,
    };
  }

  const reason = value.reason;
  const allowed = ['not_found', 'offline', 'timeout', 'error', 'duplicate', 'inactive'] as const;
  return {
    ok: false,
    code,
    requestId,
    clientId,
    reason: allowed.includes(reason as (typeof allowed)[number])
      ? (reason as (typeof allowed)[number])
      : 'error',
    message: typeof value.message === 'string' ? value.message : undefined,
  };
}

export function makeRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeClientId(): string {
  return `gk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Los mensajes viejos (replay/red lenta) no deben agregar productos. */
export function isStaleScan(ts: number, now: number = Date.now(), maxAgeMs = 15_000): boolean {
  return !Number.isFinite(ts) || Math.abs(now - ts) > maxAgeMs;
}
