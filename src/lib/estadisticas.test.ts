import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Json } from './database.types';
import {
  formatBucketLabel,
  horaLabel,
  parseEstadisticas,
  percentChange,
  resolvePeriod,
} from './estadisticas';

const NOW = new Date(2026, 10, 4, 15, 30, 0, 0); // miércoles 4/11/2026, 15:30 local

function assertLocal(date: Date, year: number, month: number, day: number, hour = 0): void {
  assert.equal(date.getFullYear(), year);
  assert.equal(date.getMonth(), month - 1);
  assert.equal(date.getDate(), day);
  assert.equal(date.getHours(), hour);
}

describe('resolvePeriod', () => {
  it('hoy va de la medianoche local hasta ahora y compara con ayer', () => {
    const range = resolvePeriod('hoy', { desde: '', hasta: '' }, NOW);
    assertLocal(range.desde, 2026, 11, 4);
    assert.equal(range.hasta.getTime(), NOW.getTime());
    assertLocal(range.comparisonDesde, 2026, 11, 3);
    assertLocal(range.comparisonHasta, 2026, 11, 3, 15);
    assert.equal(range.comparisonLabel, 'vs. ayer');
  });

  it('ayer cubre el día completo y compara con anteayer', () => {
    const range = resolvePeriod('ayer', { desde: '', hasta: '' }, NOW);
    assertLocal(range.desde, 2026, 11, 3);
    assertLocal(range.hasta, 2026, 11, 4);
    assertLocal(range.comparisonDesde, 2026, 11, 2);
    assertLocal(range.comparisonHasta, 2026, 11, 3);
    assert.equal(range.comparisonLabel, 'vs. anteayer');
  });

  it('7 días usa una ventana móvil y la compara con los 7 anteriores', () => {
    const range = resolvePeriod('7d', { desde: '', hasta: '' }, NOW);
    assertLocal(range.desde, 2026, 10, 29);
    assertLocal(range.comparisonDesde, 2026, 10, 22);
    assertLocal(range.comparisonHasta, 2026, 10, 28, 15);
    assert.equal(
      range.hasta.getTime() - range.desde.getTime(),
      range.comparisonHasta.getTime() - range.comparisonDesde.getTime(),
    );
  });

  it('semana arranca el lunes y compara con la semana anterior', () => {
    const range = resolvePeriod('semana', { desde: '', hasta: '' }, NOW);
    assertLocal(range.desde, 2026, 11, 2); // lunes
    assertLocal(range.comparisonDesde, 2026, 10, 26);
    assert.equal(range.comparisonLabel, 'vs. semana anterior');
  });

  it('mes pasado cubre el mes calendario completo', () => {
    const range = resolvePeriod('mes_pasado', { desde: '', hasta: '' }, new Date(2026, 10, 15));
    assertLocal(range.desde, 2026, 10, 1);
    assertLocal(range.hasta, 2026, 11, 1);
    assertLocal(range.comparisonDesde, 2026, 9, 1);
    assertLocal(range.comparisonHasta, 2026, 10, 1);
  });

  it('personalizado usa días completos y la ventana anterior equivalente', () => {
    const range = resolvePeriod(
      'custom',
      { desde: '2026-02-10', hasta: '2026-02-20' },
      NOW,
    );
    assertLocal(range.desde, 2026, 2, 10);
    assertLocal(range.hasta, 2026, 2, 21);
    assertLocal(range.comparisonDesde, 2026, 1, 30);
    assertLocal(range.comparisonHasta, 2026, 2, 10);
    assert.equal(range.comparisonLabel, 'vs. período anterior');
  });

  it('rechaza fechas imposibles en personalizado', () => {
    const range = resolvePeriod(
      'custom',
      { desde: '2026-02-31', hasta: '2026-02-20' },
      NOW,
    );
    // El `desde` inválido no se normaliza a marzo: cae al día válido de `hasta`.
    assertLocal(range.desde, 2026, 2, 20);
    assertLocal(range.hasta, 2026, 2, 21);

    const range2 = resolvePeriod(
      'custom',
      { desde: '2026-02-10', hasta: '2026-02-31' },
      NOW,
    );
    assertLocal(range2.desde, 2026, 2, 10);
    // El `hasta` inválido cae a hoy, no al 3 de marzo.
    assertLocal(range2.hasta, 2026, 11, 5);
  });
});

describe('percentChange', () => {
  it('devuelve null cuando no hay base de comparación', () => {
    assert.equal(percentChange(10, 0), null);
    assert.equal(percentChange(0, 0), null);
    assert.equal(percentChange(Number.NaN, 10), null);
  });

  it('calcula variaciones positivas y negativas', () => {
    assert.equal(percentChange(150, 100), 50);
    assert.equal(percentChange(50, 100), -50);
  });
});

describe('parseEstadisticas', () => {
  it('rechaza respuestas vacías o incompletas', () => {
    assert.equal(parseEstadisticas(null), null);
    assert.equal(parseEstadisticas({} as Json), null);
    assert.equal(parseEstadisticas({ actual: {} } as Json), null);
    assert.equal(parseEstadisticas({ periodo: {} } as Json), null);
  });

  it('normaliza números inválidos y listas faltantes', () => {
    const parsed = parseEstadisticas({
      periodo: { granularidad: 'dia' },
      actual: { ventas: '3', facturacion: 'x', margen: null },
    } as unknown as Json);

    assert.ok(parsed);
    assert.equal(parsed.actual.ventas, 3);
    assert.equal(parsed.actual.facturacion, 0);
    assert.equal(parsed.actual.margen, 0);
    assert.equal(parsed.periodo.dias_stock, 30);
    assert.deepEqual(parsed.stock_bajo, []);
    assert.deepEqual(parsed.recomendaciones, []);
  });
});

describe('etiquetas de series', () => {
  it('formatea buckets por día, mes y hora', () => {
    assert.equal(formatBucketLabel('2026-11-04 00:00', 'dia'), '04/11');
    assert.equal(formatBucketLabel('2026-11-01 00:00', 'mes'), 'nov 26');
    assert.equal(formatBucketLabel('2026-11-04 15:00', 'hora'), '15:00');
  });

  it('limita las horas a un rango válido', () => {
    assert.equal(horaLabel(-3), '00:00');
    assert.equal(horaLabel(99), '23:00');
  });
});
