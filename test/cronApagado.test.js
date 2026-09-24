import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.TOKEN = 'token-de-prueba';
process.env.SESSION_SECRET = 'un-secreto-de-prueba-largo';
process.env.CLIENT_ID = 'c';
process.env.API_SECRET = 's';
process.env.SERVER_ID = 'srv1';
delete process.env.SUPABASE_URL; // el registro falla en silencio, no molesta

const { default: handler } = await import('../api/cron/apagado.js');

/* Kamatera simulado: guarda las órdenes PUT que recibe. */
let servidor;
let puts;
beforeEach(() => {
    servidor = { power: 'on', cpu: '12T', errorCpu: null };
    puts = [];
    globalThis.fetch = async (url, opts = {}) => {
        const u = String(url);
        const json = (o, status = 200) => new Response(JSON.stringify(o), { status });
        if (u.endsWith('/authenticate')) return json({ authentication: 'tok' });
        if (opts.method === 'PUT') {
            const body = JSON.parse(opts.body);
            puts.push({ ruta: u.split('/server/srv1/')[1], body });
            if (u.endsWith('/cpu')) {
                if (servidor.errorCpu) return json({ errors: [{ info: servidor.errorCpu }] }, 400);
                servidor.cpu = body.cpu;
            }
            if (u.endsWith('/power')) servidor.power = body.power;
            return json({});
        }
        return json({ power: servidor.power, cpu: servidor.cpu }); // GET del estado
    };
});

const llamar = async (query, headers = { token: 'token-de-prueba' }) => {
    const res = { statusCode: 200, body: null, headers: {} };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    await handler({ headers, query, method: 'GET' }, res);
    return res;
};

test('sin token: 401 y no toca Kamatera', async () => {
    const r = await llamar({ cpu: '8' }, {});
    assert.equal(r.statusCode, 401);
    assert.deepEqual(puts, []);
});

test('cpu inválida: 400 y no toca Kamatera', async () => {
    const r = await llamar({ cpu: '99' });
    assert.equal(r.statusCode, 400);
    assert.deepEqual(puts, []);
});

test('fase 1 (cpu=8 con CPU 12T): solo reduce la CPU', async () => {
    const r = await llamar({ cpu: '8' });
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.accion, 'cpu');
    assert.deepEqual(puts, [{ ruta: 'cpu', body: { cpu: '8T' } }]);
    assert.equal(servidor.power, 'on');
});

test('fase 2 (la CPU ya es 8T): apaga', async () => {
    servidor.cpu = '8T';
    const r = await llamar({ cpu: '8' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(puts, [{ ruta: 'power', body: { power: 'off' } }]);
    assert.equal(servidor.power, 'off');
});

test('dos fases seguidas: primero CPU y después apagado', async () => {
    await llamar({ cpu: '8' });
    await llamar({ cpu: '8' });
    assert.deepEqual(puts.map((p) => p.ruta), ['cpu', 'power']);
});

test('final=1 apaga aunque la CPU no coincida', async () => {
    const r = await llamar({ cpu: '8', final: '1' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(puts, [{ ruta: 'power', body: { power: 'off' } }]);
});

test('si la CPU falla con otro error: 502 y no apaga (espera a la próxima fase)', async () => {
    servidor.errorCpu = 'Error interno de Kamatera';
    const r = await llamar({ cpu: '8' });
    assert.equal(r.statusCode, 502);
    assert.equal(servidor.power, 'on');
});

test('si la CPU falla pero es la fase final: apaga igual', async () => {
    servidor.errorCpu = 'Error interno de Kamatera';
    const r = await llamar({ cpu: '8', final: '1' });
    assert.equal(r.statusCode, 200);
    assert.equal(servidor.power, 'off');
});

test('"already exists" en la CPU pasa directo al apagado', async () => {
    servidor.errorCpu = 'This cpu configuration already exists for this server.';
    const r = await llamar({ cpu: '8' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(puts.map((p) => p.ruta), ['cpu', 'power']);
    assert.equal(servidor.power, 'off');
});

test('sin cpu en la URL: apaga directo (como antes)', async () => {
    const r = await llamar({});
    assert.equal(r.statusCode, 200);
    assert.deepEqual(puts, [{ ruta: 'power', body: { power: 'off' } }]);
});

test('si ya estaba apagado no manda nada', async () => {
    servidor.power = 'off';
    const r = await llamar({ cpu: '8', final: '1' });
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.accion, 'nada');
    assert.deepEqual(puts, []);
});
