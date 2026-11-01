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

/** Mensaje en español listo para mostrar en UI. */
export function getErrorMessage(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado.';
  if (typeof error === 'string') return MESSAGES[error] ?? error;

  const message = readField(error, 'message');
  if (!message) return 'Ocurrió un error inesperado.';
  return MESSAGES[message] ?? message;
}

/** Errores de RLS / permisos que conviene mostrar distinto. */
export function isPermissionError(error: unknown): boolean {
  const code = readField(error, 'code');
  return code === '42501' || code === 'PGRST301';
}

export function isUniqueViolation(error: unknown): boolean {
  return readField(error, 'code') === '23505';
}
