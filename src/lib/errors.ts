const MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos.',
  'Email not confirmed': 'Confirmá tu email antes de ingresar.',
  'User already registered': 'Ese email ya tiene una cuenta.',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
  'Signups not allowed for this instance': 'El registro está deshabilitado en este proyecto.',
  'Email rate limit exceeded': 'Demasiados intentos. Esperá unos minutos.',
  'No hay una caja abierta. Abrí la caja para vender.':
    'No hay una caja abierta. Abrí la caja para vender.',
  'Ya hay una caja abierta en este kiosco': 'Ya hay una caja abierta en este kiosco.',
  'La venta ya está anulada': 'La venta ya está anulada.',
  'JWT expired': 'La sesión venció. Volvé a iniciar sesión.',
};

function readField(error: unknown, field: 'message' | 'code'): string | undefined {
  if (typeof error !== 'object' || error === null || !(field in error)) return undefined;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

/** Objetos que sólo existen si se aplicó una migración puntual. */
const MIGRATION_BY_OBJECT: Record<string, string> = {
  cuaderno_contactos: '20261104000000_cuaderno.sql',
  cuaderno_movimientos: '20261104000000_cuaderno.sql',
  registrar_movimiento_cuaderno: '20261104000000_cuaderno.sql',
  estadisticas_negocio: '20261104000100_estadisticas.sql',
};

const MIGRATION_HINT =
  "Ejecutá las migraciones pendientes de supabase/migrations en el SQL Editor de Supabase. " +
  "Si ya las corriste, recargá la caché de esquema con: notify pgrst, 'reload schema';";

function objectName(raw: string): string {
  const clean = raw.replace(/["']/g, '');
  return clean.split('.').pop() ?? clean;
}

/**
 * PostgREST devuelve `PGRST205`/`PGRST202` cuando la tabla o la función no
 * están en su caché. Casi siempre significa que falta aplicar una migración,
 * así que lo traducimos a una instrucción accionable.
 */
function missingMigrationMessage(message: string): string | null {
  const table = /could not find the table '?([^'"\s]+)'? in the schema cache/i.exec(message);
  const fn = /could not find the function ([\w."]+)/i.exec(message);
  const raw = table?.[1] ?? fn?.[1];
  if (!raw) return null;

  const name = objectName(raw);
  const target = `public.${name}`;
  const what = table ? 'la tabla' : 'la función';
  const file = MIGRATION_BY_OBJECT[name];

  if (file) {
    return `Falta aplicar la migración supabase/migrations/${file}: ${what} ${target} no existe en Supabase. ${MIGRATION_HINT}`;
  }
  return `Faltan migraciones en Supabase: ${what} ${target} no existe. ${MIGRATION_HINT}`;
}

function isMissingSchemaError(code: string | undefined): boolean {
  return code === 'PGRST205' || code === 'PGRST202';
}

/** Mensaje en español listo para mostrar en UI. */
export function getErrorMessage(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado.';
  if (typeof error === 'string') {
    return MESSAGES[error] ?? missingMigrationMessage(error) ?? error;
  }

  const message = readField(error, 'message');
  const code = readField(error, 'code');
  if (!message) {
    return isMissingSchemaError(code)
      ? `Faltan migraciones en Supabase. ${MIGRATION_HINT}`
      : 'Ocurrió un error inesperado.';
  }

  return MESSAGES[message] ?? missingMigrationMessage(message) ?? message;
}

/** Errores de RLS / permisos que conviene mostrar distinto. */
export function isPermissionError(error: unknown): boolean {
  const code = readField(error, 'code');
  return code === '42501' || code === 'PGRST301';
}

export function isUniqueViolation(error: unknown): boolean {
  return readField(error, 'code') === '23505';
}
