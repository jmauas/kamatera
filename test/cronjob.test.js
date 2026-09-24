import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.CRONJOB_API_KEY = 'clave-de-prueba';
const { listarCrons, actualizarCron, armarCambios, esCronDelServidor } = await import('../src/cronjob.js');

const job = (o) => ({
    jobId: 1, enabled: true, title: 'Apagado Lun-Jue 11:00 PM', saveResponses: false,
    url: 'https://kamatera.vercel.app/api/cron/apagado?cpu=12', lastStatus: 1,
    lastExecution: 1700000000, nextExecution: 1700086400,
    schedule: { timezone: 'America/Argentina/Buenos_Aires', expiresAt: 0, hours: [23], minutes: [0], mdays: [-1], months: [-1], wdays: [1, 2, 3, 4] },
    ...o,
});

let jobs;
let llamadas;
beforeEach(() => {
    jobs = [
        job({}),
        job({ jobId: 2, title: 'Encendido Servidor Lun-Jue', url: 'https://kamatera.vercel.app/api/cron/encendido', schedule: { timezone: 'America/Argentina/Buenos_Aires', expiresAt: 0, hours: [9], minutes: [0], mdays: [-1], months: [-1], wdays: [1, 2, 3, 4] } }),
        job({ jobId: 3, title: 'Backup de otra cosa', url: 'https://otro.com/backup' }),
    ];
    llamadas = [];
    globalThis.fetch = async (url, opts = {}) => {
        llamadas.push({ url: String(url), method: opts.method, auth: opts.headers?.Authorization, body: opts.body && JSON.parse(opts.body) });
        if (opts.method === 'PATCH') return new Response('{}', { status: 200 });
        return new Response(JSON.stringify({ jobs, someFailed: false }), { status: 200 });
    };
});

test('solo se listan los crons de encendido y apagado', async () => {
    const crons = await listarCrons();
    assert.deepEqual(crons.map((c) => c.id).sort(), [1, 2]);
    assert.equal(llamadas[0].auth, 'Bearer clave-de-prueba');
    assert.equal(crons[0].ultimoEstado, 'OK');
    assert.equal(crons[0].ultimaEjecucion, 1700000000000);
});

test('esCronDelServidor ignora mayúsculas y espacios', () => {
    assert.equal(esCronDelServidor({ title: '  APAGADO sábado' }), true);
    assert.equal(esCronDelServidor({ title: 'encendido' }), true);
    assert.equal(esCronDelServidor({ title: 'Backup' }), false);
});

test('editar el horario manda el schedule completo y conserva zona horaria, días del mes y meses', async () => {
    const { cron, resumen } = await actualizarCron(1, { schedule: { hours: [22, 23], minutes: [30], wdays: [1, 2, 3, 4, 5] } });
    const patch = llamadas.find((l) => l.method === 'PATCH');
    assert.match(patch.url, /\/jobs\/1$/);
    assert.deepEqual(patch.body, {
        job: { schedule: { timezone: 'America/Argentina/Buenos_Aires', expiresAt: 0, hours: [22, 23], minutes: [30], mdays: [-1], months: [-1], wdays: [1, 2, 3, 4, 5] } },
    });
    assert.deepEqual(resumen, ['horario']);
    assert.deepEqual(cron.schedule.hours, [22, 23]);
});

test('los 7 días se guardan como "todos" ([-1])', async () => {
    await actualizarCron(1, { schedule: { hours: [23], minutes: [0], wdays: [0, 1, 2, 3, 4, 5, 6] } });
    assert.deepEqual(llamadas.find((l) => l.method === 'PATCH').body.job.schedule.wdays, [-1]);
});

test('pausar y cambiar la URL (mismo sitio) van en el mismo pedido', async () => {
    const { resumen } = await actualizarCron(1, { habilitado: false, url: 'https://kamatera.vercel.app/api/cron/apagado?cpu=8&final=1' });
    const body = llamadas.find((l) => l.method === 'PATCH').body;
    assert.equal(body.job.enabled, false);
    assert.equal(body.job.url, 'https://kamatera.vercel.app/api/cron/apagado?cpu=8&final=1');
    assert.equal(resumen.length, 2);
});

test('sin cambios reales no se manda ningún PATCH', async () => {
    const { resumen } = await actualizarCron(1, { habilitado: true, url: jobs[0].url, schedule: { hours: [23], minutes: [0], wdays: [1, 2, 3, 4] } });
    assert.deepEqual(resumen, []);
    assert.equal(llamadas.some((l) => l.method === 'PATCH'), false);
});

test('la URL no puede apuntar a otro sitio (se filtraría el token del header)', async () => {
    await assert.rejects(actualizarCron(1, { url: 'https://malo.com/robar' }), (e) => e.status === 400);
    await assert.rejects(actualizarCron(1, { url: 'http://kamatera.vercel.app/x' }), (e) => e.status === 400);
    assert.equal(llamadas.some((l) => l.method === 'PATCH'), false);
});

test('no se puede editar un job que no es de encendido/apagado', async () => {
    await assert.rejects(actualizarCron(3, { habilitado: false }), (e) => e.status === 404);
    assert.equal(llamadas.some((l) => l.method === 'PATCH'), false);
});

test('valores de horario inválidos: 400', async () => {
    const actual = (await listarCrons())[0];
    for (const s of [
        { hours: [24], minutes: [0], wdays: [1] },
        { hours: [23], minutes: [60], wdays: [1] },
        { hours: [23], minutes: [0], wdays: [7] },
        { hours: [], minutes: [0], wdays: [1] },
        { hours: [23], minutes: [0], wdays: [] },
        { hours: [1.5], minutes: [0], wdays: [1] },
    ]) {
        assert.throws(() => armarCambios(actual, { schedule: s }), (e) => e.status === 400, JSON.stringify(s));
    }
});

test('errores de cron-job.org: clave rechazada y límite de consultas', async () => {
    globalThis.fetch = async () => new Response('{}', { status: 401 });
    await assert.rejects(listarCrons(), (e) => e.status === 502 && /clave/.test(e.message));
    globalThis.fetch = async () => new Response('{}', { status: 429 });
    await assert.rejects(listarCrons(), (e) => e.status === 429);
});

test('sin CRONJOB_API_KEY: 503 con mensaje claro', async () => {
    const guardada = process.env.CRONJOB_API_KEY;
    delete process.env.CRONJOB_API_KEY;
    await assert.rejects(listarCrons(), (e) => e.status === 503 && /CRONJOB_API_KEY/.test(e.message));
    process.env.CRONJOB_API_KEY = guardada;
});
