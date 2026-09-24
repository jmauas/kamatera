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

/* ---------- Creación de crons ---------- */

const { armarCreacion, crearCrones, sumarMinutos, textoDias, tipoDeUrl } = await import('../src/cronjob.js');
const ORIGEN = { origen: 'https://kamatera.vercel.app', timezone: 'America/Argentina/Buenos_Aires', folderId: 7 };

test('sumarMinutos: 2 minutos después, y corre los días si cruza la medianoche', () => {
    assert.deepEqual(sumarMinutos({ dias: [1, 2], hora: 23, minuto: 0 }, 2), { dias: [1, 2], hora: 23, minuto: 2 });
    assert.deepEqual(sumarMinutos({ dias: [1, 2], hora: 23, minuto: 59 }, 2), { dias: [2, 3], hora: 0, minuto: 1 });
    assert.deepEqual(sumarMinutos({ dias: [6, 0], hora: 23, minuto: 58 }, 2), { dias: [0, 1], hora: 0, minuto: 0 });
});

test('textoDias y tipoDeUrl', () => {
    assert.equal(textoDias([1, 2, 3, 4]), 'Lun a Jue');
    assert.equal(textoDias([5, 6]), 'Vie y Sáb');
    assert.equal(textoDias([-1]), 'Todos los días');
    assert.equal(tipoDeUrl('https://x.com/api/cron/apagado?cpu=8'), 'apagado');
    assert.equal(tipoDeUrl('https://x.com/api/cron/configurar?cpu=8'), 'configurar');
    assert.equal(tipoDeUrl('https://x.com/api/cron/encendido'), 'encendido');
    assert.equal(tipoDeUrl('https://x.com/otra'), 'otro');
});

test('apagado con CPU: crea DOS crons, configurar a la hora y apagar 2 minutos después', () => {
    const [cfg, off] = armarCreacion({ tipo: 'apagado', dias: [1, 2, 3, 4], hora: 23, minuto: 0, cpu: '12' }, ORIGEN);
    assert.equal(cfg.url, 'https://kamatera.vercel.app/api/cron/configurar?cpu=12T');
    assert.deepEqual([cfg.schedule.hours, cfg.schedule.minutes, cfg.schedule.wdays], [[23], [0], [1, 2, 3, 4]]);
    assert.equal(off.url, 'https://kamatera.vercel.app/api/cron/apagado');
    assert.deepEqual([off.schedule.hours, off.schedule.minutes, off.schedule.wdays], [[23], [2], [1, 2, 3, 4]]);
    assert.match(cfg.titulo, /^Apagado Lun a Jue 23:00 - configurar/);
    assert.match(off.titulo, /^Apagado Lun a Jue 23:02 - apagar/);
    assert.equal(cfg.folderId, 7);
    assert.equal(cfg.schedule.timezone, 'America/Argentina/Buenos_Aires');
});

test('apagado a las 23:59: el segundo cron cae a las 00:01 del día siguiente', () => {
    const [, off] = armarCreacion({ tipo: 'apagado', dias: [1, 2, 3, 4], hora: 23, minuto: 59, cpu: '8' }, ORIGEN);
    assert.deepEqual([off.schedule.hours, off.schedule.minutes, off.schedule.wdays], [[0], [1], [2, 3, 4, 5]]);
});

test('apagado sin CPU/RAM: un solo cron; encendido: uno; configurar solo: uno con parámetros', () => {
    assert.equal(armarCreacion({ tipo: 'apagado', dias: [5], hora: 22, minuto: 0 }, ORIGEN).length, 1);
    const [on] = armarCreacion({ tipo: 'encendido', dias: [-1], hora: 9, minuto: 0, cpu: '8' }, ORIGEN);
    assert.equal(on.url, 'https://kamatera.vercel.app/api/cron/encendido'); // sin parámetros
    assert.deepEqual(on.schedule.wdays, [-1]);
    const [cfg] = armarCreacion({ tipo: 'configurar', dias: [1], hora: 8, minuto: 30, cpu: '20', ram: '16384' }, ORIGEN);
    assert.equal(cfg.url, 'https://kamatera.vercel.app/api/cron/configurar?cpu=20T&ram=16384');
    assert.match(cfg.titulo, /^Configurar /);
});

test('creación: valores inválidos dan 400', () => {
    for (const d of [
        { tipo: 'borrar', dias: [1], hora: 1, minuto: 0 },
        { tipo: 'apagado', dias: [], hora: 1, minuto: 0 },
        { tipo: 'apagado', dias: [1], hora: 24, minuto: 0 },
        { tipo: 'apagado', dias: [1], hora: 1, minuto: 60 },
        { tipo: 'apagado', dias: [1], hora: 1, minuto: 0, cpu: '99' },
        { tipo: 'apagado', dias: [1], hora: 1, minuto: 0, ram: '5' },
        { tipo: 'configurar', dias: [1], hora: 1, minuto: 0 },
    ]) {
        assert.throws(() => armarCreacion(d, ORIGEN), (e) => e.status === 400, JSON.stringify(d));
    }
});

test('crearCrones manda PUT /jobs con el token de servicio en el header y la carpeta del modelo', async () => {
    process.env.TOKEN = 'token-de-servicio';
    const puts = [];
    let id = 100;
    const base = globalThis.fetch;
    globalThis.fetch = async (url, opts = {}) => {
        if (opts.method === 'PUT') { puts.push({ url: String(url), body: JSON.parse(opts.body) }); return new Response(JSON.stringify({ jobId: id++ }), { status: 200 }); }
        return base(url, opts);
    };
    jobs[0].folderId = 54531;
    const creados = await crearCrones({ tipo: 'apagado', dias: [5], hora: 23, minuto: 0, cpu: '8' });
    assert.equal(creados.length, 2);
    assert.deepEqual(creados.map((c) => c.id), [100, 101]);
    assert.match(puts[0].url, /\/jobs$/);
    const job = puts[0].body.job;
    assert.equal(job.extendedData.headers.token, 'token-de-servicio');
    assert.equal(job.folderId, 54531);
    assert.equal(job.requestMethod, 0);
    assert.equal(job.enabled, true);
    assert.equal(job.url, 'https://kamatera.vercel.app/api/cron/configurar?cpu=8T');
});

/* ---------- CPU previa a cada apagado ---------- */

const { planificarCpuPrevia } = await import('../src/cronjob.js');

const cron = (o) => ({
    id: 1, tipo: 'apagado', titulo: 'Apagado Lun-Jue 11:00 PM', habilitado: true, folderId: 5,
    url: 'https://kamatera.vercel.app/api/cron/apagado?cpu=8',
    schedule: { timezone: 'America/Argentina/Buenos_Aires', expiresAt: 0, hours: [23], minutes: [0], mdays: [-1], months: [-1], wdays: [1, 2, 3, 4] },
    ...o,
});

test('CPU previa: un cron de configurar 2 minutos antes del apagado, con la CPU pedida', () => {
    const [p] = planificarCpuPrevia([cron({})], { cpu: '12' });
    assert.equal(p.nuevo.url, 'https://kamatera.vercel.app/api/cron/configurar?cpu=12T');
    assert.deepEqual([p.nuevo.schedule.hours, p.nuevo.schedule.minutes, p.nuevo.schedule.wdays], [[22], [58], [1, 2, 3, 4]]);
    assert.equal(p.nuevo.titulo, 'Apagado Lun-Jue 11:00 PM - configurar (CPU 12T)');
    assert.equal(p.nuevo.folderId, 5);
    assert.equal(p.nuevo.habilitado, true);
    assert.equal(p.nuevo.schedule.timezone, 'America/Argentina/Buenos_Aires');
});

test('CPU previa: ignora el cpu de la URL del apagado y no toca el apagado', () => {
    const original = cron({});
    const copia = JSON.stringify(original);
    planificarCpuPrevia([original], { cpu: '12' });
    assert.equal(JSON.stringify(original), copia);
});

test('CPU previa: si cruza hacia atrás la medianoche corre los días (00:01 -> 23:59 del día anterior)', () => {
    const [p] = planificarCpuPrevia([cron({ schedule: { ...cron({}).schedule, hours: [0], minutes: [1], wdays: [2, 3] } })], { cpu: '12' });
    assert.deepEqual([p.nuevo.schedule.hours, p.nuevo.schedule.minutes, p.nuevo.schedule.wdays], [[23], [59], [1, 2]]);
});

test('CPU previa: 23:59 -> 23:57 y 20:00 -> 19:58; los pausados quedan pausados', () => {
    const [a] = planificarCpuPrevia([cron({ schedule: { ...cron({}).schedule, minutes: [59] } })], { cpu: '12' });
    assert.deepEqual([a.nuevo.schedule.hours, a.nuevo.schedule.minutes], [[23], [57]]);
    const [b] = planificarCpuPrevia([cron({ habilitado: false, schedule: { ...cron({}).schedule, hours: [20], wdays: [0] } })], { cpu: '12' });
    assert.deepEqual([b.nuevo.schedule.hours, b.nuevo.schedule.minutes], [[19], [58]]);
    assert.equal(b.nuevo.habilitado, false);
});

test('CPU previa: es idempotente y omite lo que no puede convertir', () => {
    const apagado = cron({});
    const [primero] = planificarCpuPrevia([apagado], { cpu: '12' });
    const yaCreado = cron({ id: 2, tipo: 'configurar', titulo: primero.nuevo.titulo, url: primero.nuevo.url, schedule: primero.nuevo.schedule });
    const plan = planificarCpuPrevia([
        apagado, yaCreado,
        cron({ id: 3, schedule: { ...apagado.schedule, hours: [22, 23] } }),
        cron({ id: 4, tipo: 'encendido', titulo: 'Encendido', url: 'https://kamatera.vercel.app/api/cron/encendido' }),
    ], { cpu: '12' });
    assert.equal(plan.length, 2); // el encendido y el de configurar ni aparecen
    assert.match(plan[0].omitido, /ya tiene/);
    assert.match(plan[1].omitido, /varios horarios/);
});

test('CPU previa: CPU inválida da 400', () => {
    assert.throws(() => planificarCpuPrevia([cron({})], { cpu: '99' }), (e) => e.status === 400);
});

test('editar el título: solo si sigue empezando con encendido/apagado/configurar', () => {
    const actual = { titulo: 'Apagado x', habilitado: true, url: 'https://kamatera.vercel.app/api/cron/apagado', schedule: { timezone: 'x', expiresAt: 0, hours: [1], minutes: [0], mdays: [-1], months: [-1], wdays: [-1] } };
    assert.equal(armarCambios(actual, { titulo: 'Apagado x - apagar' }).job.title, 'Apagado x - apagar');
    assert.throws(() => armarCambios(actual, { titulo: 'Backup' }), (e) => e.status === 400);
});
