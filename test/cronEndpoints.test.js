import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.TOKEN = 'token-de-prueba';
process.env.SESSION_SECRET = 'un-secreto-de-prueba-largo';
process.env.CLIENT_ID = 'c';
process.env.API_SECRET = 's';
process.env.SERVER_ID = 'srv1';
delete process.env.SUPABASE_URL; // el registro falla en silencio, no molesta

const { default: apagado } = await import('../api/cron/apagado.js');
const { default: configurar } = await import('../api/cron/configurar.js');

/* Kamatera simulado: guarda las órdenes PUT que recibe. */
let servidor;
let puts;
beforeEach(() => {
    servidor = { power: 'on', cpu: '12T', ram: 16384, errores: {} };
    puts = [];
    globalThis.fetch = async (url, opts = {}) => {
        const u = String(url);
        const json = (o, status = 200) => new Response(JSON.stringify(o), { status });
        if (u.endsWith('/authenticate')) return json({ authentication: 'tok' });
        if (opts.method === 'PUT') {
            const body = JSON.parse(opts.body);
            const ruta = u.split('/server/srv1/')[1];
            puts.push({ ruta, body });
            if (servidor.errores[ruta]) return json({ errors: [{ info: servidor.errores[ruta] }] }, 400);
            if (ruta === 'cpu') servidor.cpu = body.cpu;
            if (ruta === 'ram') servidor.ram = body.ram;
            if (ruta === 'power') servidor.power = body.power;
            return json({});
        }
        return json({ power: servidor.power, cpu: servidor.cpu, ram: servidor.ram }); // GET del estado
    };
});

const llamar = async (handler, query, headers = { token: 'token-de-prueba' }) => {
    const res = { statusCode: 200, body: null, headers: {} };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    await handler({ headers, query, method: 'GET' }, res);
    return res;
};

/* ---------- /api/cron/apagado ---------- */

test('apagado sin token: 401 y no toca Kamatera', async () => {
    const r = await llamar(apagado, {}, {});
    assert.equal(r.statusCode, 401);
    assert.deepEqual(puts, []);
});

test('apagado: apaga directo e ignora cualquier parámetro (crons viejos con ?cpu=8)', async () => {
    const r = await llamar(apagado, { cpu: '8' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(puts, [{ ruta: 'power', body: { power: 'off' } }]);
    assert.equal(servidor.cpu, '12T'); // no toca la CPU
});

test('apagado: si ya estaba apagado no manda nada', async () => {
    servidor.power = 'off';
    const r = await llamar(apagado, {});
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.accion, 'nada');
    assert.deepEqual(puts, []);
});

test('apagado: si Kamatera falla responde 502', async () => {
    servidor.errores.power = 'Error interno';
    const r = await llamar(apagado, {});
    assert.equal(r.statusCode, 502);
    assert.equal(r.body.ok, false);
});

/* ---------- /api/cron/configurar ---------- */

test('configurar sin token: 401 y no toca Kamatera', async () => {
    const r = await llamar(configurar, { cpu: '8' }, {});
    assert.equal(r.statusCode, 401);
    assert.deepEqual(puts, []);
});

test('configurar: cambia la CPU sin apagar', async () => {
    const r = await llamar(configurar, { cpu: '8' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(puts, [{ ruta: 'cpu', body: { cpu: '8T' } }]);
    assert.equal(servidor.power, 'on');
    assert.match(r.body.mensaje, /CPU 8T: OK/);
});

test('configurar: CPU y RAM juntas', async () => {
    const r = await llamar(configurar, { cpu: '4T', ram: '8192' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(puts.map((p) => p.ruta), ['cpu', 'ram']);
    assert.equal(servidor.ram, 8192);
});

test('configurar: "already exists" cuenta como correcto', async () => {
    servidor.errores.cpu = 'This cpu configuration already exists for this server.';
    const r = await llamar(configurar, { cpu: '12' });
    assert.equal(r.statusCode, 200);
    assert.match(r.body.mensaje, /sin cambios/);
});

test('configurar: otro error de Kamatera responde 502', async () => {
    servidor.errores.cpu = 'Error interno de Kamatera';
    const r = await llamar(configurar, { cpu: '8' });
    assert.equal(r.statusCode, 502);
    assert.equal(r.body.ok, false);
});

test('configurar: parámetros inválidos o ausentes dan 400 y no tocan Kamatera', async () => {
    for (const q of [{}, { cpu: '99' }, { cpu: '8', ram: '999' }, { ram: 'abc' }]) {
        const r = await llamar(configurar, q);
        assert.equal(r.statusCode, 400, JSON.stringify(q));
    }
    assert.deepEqual(puts, []);
});
