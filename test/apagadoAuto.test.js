import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirApagado, esFinal } from '../src/tareas/apagadoAuto.js';

const on12 = { power: 'on', cpuActual: '12T' };

test('primera fase: con otra CPU solo la reduce', () => {
    assert.equal(decidirApagado({ ...on12, cpuObjetivo: '8T' }), 'cpu');
});

test('segunda fase: con la CPU ya reducida apaga', () => {
    assert.equal(decidirApagado({ power: 'on', cpuActual: '8T', cpuObjetivo: '8T' }), 'apagar');
});

test('fase final apaga siempre, aunque la CPU no coincida', () => {
    assert.equal(decidirApagado({ ...on12, cpuObjetivo: '8T', final: true }), 'apagar');
});

test('sin cpu en la URL apaga directo', () => {
    assert.equal(decidirApagado({ ...on12, cpuObjetivo: null }), 'apagar');
});

test('si ya está apagado no hace nada, ni siquiera en la fase final', () => {
    assert.equal(decidirApagado({ power: 'off', cpuActual: '8T', cpuObjetivo: '8T', final: true }), 'nada');
});

test('si no se pudo leer el estado, apaga', () => {
    assert.equal(decidirApagado({ power: undefined, cpuActual: undefined, cpuObjetivo: '8T' }), 'apagar');
});

test('esFinal acepta 1 y true', () => {
    assert.equal(esFinal('1'), true);
    assert.equal(esFinal('true'), true);
    assert.equal(esFinal('0'), false);
    assert.equal(esFinal(undefined), false);
});
