import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SCAN_COOLDOWN_MS,
  buildScannerTopic,
  createScanGate,
  generatePairingCode,
  isPairingCode,
  isStaleScan,
  isUuid,
  makeClientId,
  makeRequestId,
  normalizeBarcode,
  normalizePairingCode,
  parseAckPayload,
  parseScanPayload,
  parseScannerTopic,
} from './scanner';

const KIOSCO_ID = '3f1a2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b';

describe('createScanGate', () => {
  it('acepta el primer escaneo y bloquea el duplicado dentro del cooldown', () => {
    const gate = createScanGate(SCAN_COOLDOWN_MS);
    assert.equal(gate.shouldAccept('7791234567890', 1_000), true);
    assert.equal(gate.shouldAccept('7791234567890', 1_500), false);
    assert.equal(gate.shouldAccept('7791234567890', 1_000 + SCAN_COOLDOWN_MS), true);
  });

  it('permite códigos distintos en rápida sucesión', () => {
    const gate = createScanGate(1200);
    assert.equal(gate.shouldAccept('111', 0), true);
    assert.equal(gate.shouldAccept('222', 10), true);
    assert.equal(gate.shouldAccept('333', 20), true);
  });

  it('ignora códigos vacíos o de sólo espacios', () => {
    const gate = createScanGate();
    assert.equal(gate.shouldAccept('   '), false);
    assert.equal(gate.shouldAccept(''), false);
  });

  it('normaliza espacios accidentales del lector USB', () => {
    const gate = createScanGate(1000);
    assert.equal(gate.shouldAccept(' 779123 ', 0), true);
    assert.equal(gate.shouldAccept('779123', 500), false);
  });

  it('se puede reiniciar (p. ej. al cambiar de kiosco)', () => {
    const gate = createScanGate(1000);
    gate.shouldAccept('abc', 0);
    gate.reset();
    assert.equal(gate.shouldAccept('abc', 1), true);
  });
});

describe('normalizeBarcode', () => {
  it('quita controles y recorta extremos sin cambiar mayúsculas', () => {
    assert.equal(normalizeBarcode('  Code128AbC\u0000\n '), 'Code128AbC');
    assert.equal(normalizeBarcode(null), '');
  });
});

describe('códigos de vinculación', () => {
  it('normaliza a mayúsculas y sin símbolos', () => {
    assert.equal(normalizePairingCode('ab-12 cd'), 'AB12CD');
    assert.equal(normalizePairingCode('abc'), 'ABC');
  });

  it('sólo acepta el alfabeto sin ambigüedades y longitud exacta', () => {
    assert.equal(isPairingCode('AB23CD'), true);
    assert.equal(isPairingCode('AB23C'), false);
    assert.equal(isPairingCode('AB23C0'), false); // 0 prohibido
    assert.equal(isPairingCode('AB23CI'), false); // I prohibida
  });

  it('genera códigos válidos y deterministas con un random inyectado', () => {
    const code = generatePairingCode(() => 0);
    assert.equal(code, 'AAAAAA');
    assert.equal(isPairingCode(code), true);
  });
});

describe('topics de Realtime', () => {
  it('construye el topic que exige la política SQL', () => {
    assert.equal(buildScannerTopic(KIOSCO_ID, 'ab23cd'), `kiosco:${KIOSCO_ID}:scanner:AB23CD`);
  });

  it('devuelve null con uuid o código inválidos', () => {
    assert.equal(buildScannerTopic('no-es-uuid', 'AB23CD'), null);
    assert.equal(buildScannerTopic(KIOSCO_ID, 'ABC'), null);
    assert.equal(buildScannerTopic(null, 'AB23CD'), null);
  });

  it('parsea el topic de vuelta', () => {
    assert.deepEqual(parseScannerTopic(`kiosco:${KIOSCO_ID}:scanner:AB23CD`), {
      kioscoId: KIOSCO_ID,
      code: 'AB23CD',
    });
    assert.equal(parseScannerTopic('otro:canal'), null);
  });

  it('valida uuids', () => {
    assert.equal(isUuid(KIOSCO_ID), true);
    assert.equal(isUuid('123'), false);
  });
});

describe('payloads de broadcast', () => {
  it('acepta un scan válido y normaliza el código', () => {
    const payload = parseScanPayload({
      code: ' 779123 ',
      ts: 1_700_000_000_000,
      clientId: 'gk-1',
      requestId: 'req-1',
    });
    assert.deepEqual(payload, {
      code: '779123',
      ts: 1_700_000_000_000,
      clientId: 'gk-1',
      requestId: 'req-1',
    });
  });

  it('rechaza payloads incompletos o con tipos incorrectos', () => {
    assert.equal(parseScanPayload(null), null);
    assert.equal(parseScanPayload({ code: '1' }), null);
    assert.equal(parseScanPayload({ code: '1', ts: 'hoy', clientId: 'a', requestId: 'b' }), null);
  });

  it('parsea un ack exitoso y uno fallido', () => {
    const ok = parseAckPayload({
      requestId: 'r1',
      clientId: 'gk-1',
      code: '779',
      ok: true,
      nombre: 'Alfajor',
      precio: 1200,
      cantidad: 2,
    });
    assert.ok(ok && ok.ok);
    assert.equal(ok.nombre, 'Alfajor');

    const fail = parseAckPayload({
      requestId: 'r2',
      clientId: 'gk-1',
      code: '000',
      ok: false,
      reason: 'not_found',
    });
    assert.ok(fail && !fail.ok);
    assert.equal(fail.reason, 'not_found');
  });

  it('normaliza un motivo desconocido a error', () => {
    const fail = parseAckPayload({
      requestId: 'r3',
      clientId: 'gk-1',
      code: '000',
      ok: false,
      reason: 'exploto',
    });
    assert.ok(fail && !fail.ok);
    assert.equal(fail.reason, 'error');
  });

  it('detecta scans viejos', () => {
    assert.equal(isStaleScan(Date.now()), false);
    assert.equal(isStaleScan(Date.now() - 60_000), true);
    assert.equal(isStaleScan(Number.NaN), true);
  });

  it('genera ids únicos', () => {
    assert.notEqual(makeRequestId(), makeRequestId());
    assert.match(makeClientId(), /^gk-/);
  });
});
