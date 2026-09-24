import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarCpu, validarCambio } from '../src/validacion.js';

test('normalizarCpu acepta "12" y "12T" y rechaza el resto', () => {
    assert.equal(normalizarCpu('12'), '12T');
    assert.equal(normalizarCpu('12T'), '12T');
    assert.equal(normalizarCpu('12TT'), null);
    assert.equal(normalizarCpu('13'), null);
    assert.equal(normalizarCpu('../x'), null);
    assert.equal(normalizarCpu(undefined), null);
});

test('validarCambio valida procesador, ram y disco', () => {
    assert.deepEqual(validarCambio('procesador', '8'), { valor: '8T' });
    assert.deepEqual(validarCambio('ram', '16384'), { valor: 16384 });
    assert.deepEqual(validarCambio('disco', 500), { valor: 500 });
    assert.ok(validarCambio('ram', '999').error);
    assert.ok(validarCambio('disco', '10').error);
    assert.ok(validarCambio('ssd', '500').error);
});
