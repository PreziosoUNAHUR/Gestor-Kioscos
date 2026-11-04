import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getErrorMessage, isPermissionError, isUniqueViolation } from './errors';

describe('getErrorMessage', () => {
  it('traduce los errores de autenticación conocidos', () => {
    assert.equal(getErrorMessage('Invalid login credentials'), 'Email o contraseña incorrectos.');
    assert.equal(
      getErrorMessage({ message: 'Email not confirmed' }),
      'Confirmá tu email antes de ingresar.',
    );
  });

  it('explica qué migración falta cuando no existe la tabla del cuaderno', () => {
    const message = getErrorMessage({
      code: 'PGRST205',
      message: "Could not find the table 'public.cuaderno_contactos' in the schema cache",
    });

    assert.match(message, /20261104000000_cuaderno\.sql/);
    assert.match(message, /public\.cuaderno_contactos/);
    assert.match(message, /reload schema/);
  });

  it('explica qué migración falta cuando no existe la RPC de estadísticas', () => {
    const message = getErrorMessage({
      code: 'PGRST202',
      message:
        'Could not find the function public.estadisticas_negocio(p_comp_desde, p_comp_hasta, p_desde, p_dias_stock, p_hasta, p_kiosco_id) in the schema cache',
    });

    assert.match(message, /20261104000100_estadisticas\.sql/);
    assert.match(message, /public\.estadisticas_negocio/);
  });

  it('usa un mensaje genérico si el objeto no está mapeado', () => {
    const message = getErrorMessage({
      code: 'PGRST205',
      message: "Could not find the table 'public.otra_tabla' in the schema cache",
    });

    assert.match(message, /Faltan migraciones en Supabase/);
    assert.match(message, /public\.otra_tabla/);
  });

  it('cae al mensaje original si no reconoce el error', () => {
    assert.equal(getErrorMessage({ message: 'algo raro' }), 'algo raro');
    assert.equal(getErrorMessage({}), 'Ocurrió un error inesperado.');
  });
});

describe('clasificación de errores', () => {
  it('detecta permisos y violaciones de unicidad', () => {
    assert.equal(isPermissionError({ code: '42501' }), true);
    assert.equal(isPermissionError({ code: 'PGRST301' }), true);
    assert.equal(isPermissionError({ code: '23505' }), false);
    assert.equal(isUniqueViolation({ code: '23505' }), true);
    assert.equal(isUniqueViolation({ code: '42501' }), false);
  });
});
