/* Cliente de la API de cron-job.org para administrar los crons del servidor
   (los que empiezan con "encendido" o "apagado").
   Variables: CRONJOB_API_KEY (Settings -> API en cron-job.org),
              CRONJOB_API_URL (opcional, para pruebas; por defecto https://api.cron-job.org). */

import { limpiarTexto } from './util.js';

const error = (status, mensaje) => Object.assign(new Error(mensaje), { status });

const base = () => (process.env.CRONJOB_API_URL || 'https://api.cron-job.org').replace(/\/$/, '');

async function cj(ruta, { method = 'GET', body } = {}) {
    const key = process.env.CRONJOB_API_KEY;
    if (!key) throw error(503, 'Falta configurar CRONJOB_API_KEY (clave de la API de cron-job.org).');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch(`${base()}${ruta}`, {
            method,
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) throw error(502, 'cron-job.org rechazó la clave de la API.');
        if (res.status === 429) throw error(429, 'cron-job.org limitó las consultas (demasiados pedidos). Probá en unos minutos.');
        if (!res.ok) throw error(502, `cron-job.org respondió ${res.status}${data?.error ? `: ${data.error}` : ''}.`);
        return data;
    } catch (e) {
        if (e.name === 'AbortError') throw error(504, 'cron-job.org no respondió a tiempo.');
        throw e;
    } finally {
        clearTimeout(timeoutId);
    }
}

/** ¿Es uno de los crons del servidor? (el título empieza con "encendido" o "apagado") */
export const esCronDelServidor = (job) => /^(encendido|apagado)/i.test(String(job?.title ?? '').trim());

const ms = (segundos) => (segundos ? segundos * 1000 : null);

const ESTADOS = {
    0: 'Sin ejecutar', 1: 'OK', 2: 'Error de DNS', 3: 'Error de conexión', 4: 'Error HTTP',
    5: 'Tiempo agotado', 6: 'Respuesta demasiado grande', 7: 'URL inválida', 8: 'Error interno', 9: 'Error desconocido',
};

const normalizar = (j) => ({
    id: j.jobId,
    titulo: j.title,
    habilitado: !!j.enabled,
    url: j.url,
    schedule: {
        timezone: j.schedule?.timezone || 'UTC',
        expiresAt: j.schedule?.expiresAt || 0,
        hours: j.schedule?.hours ?? [-1],
        minutes: j.schedule?.minutes ?? [-1],
        mdays: j.schedule?.mdays ?? [-1],
        months: j.schedule?.months ?? [-1],
        wdays: j.schedule?.wdays ?? [-1],
    },
    ultimoEstado: ESTADOS[j.lastStatus] ?? 'Desconocido',
    ultimoOk: j.lastStatus === 1,
    ultimaEjecucion: ms(j.lastExecution),
    proximaEjecucion: ms(j.nextExecution),
});

const porTitulo = (a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true });

/** Lista los crons del servidor, ordenados por título. */
export async function listarCrons() {
    const data = await cj('/jobs');
    return (data.jobs || []).filter(esCronDelServidor).map(normalizar).sort(porTitulo);
}

/* ---------- Validación de cambios ---------- */

const enteros = (v, min, max, nombre) => {
    if (!Array.isArray(v) || !v.length) throw error(400, `${nombre}: elegí al menos un valor.`);
    const out = [...new Set(v.map(Number))].sort((a, b) => a - b);
    if (out.some((n) => !Number.isInteger(n) || n < min || n > max)) {
        throw error(400, `${nombre}: valores entre ${min} y ${max}.`);
    }
    return out;
};

/** Normaliza los días: los 7 días equivalen a "todos" ([-1]). */
const normalizarDias = (v) => {
    if (Array.isArray(v) && v.length === 1 && Number(v[0]) === -1) return [-1];
    const dias = enteros(v, 0, 6, 'Días');
    return dias.length === 7 ? [-1] : dias;
};

/** Valida los cambios pedidos contra el cron actual y arma el cuerpo del PATCH.
    Solo se pueden cambiar: habilitado, url (mismo origen) y horario (días/horas/minutos). */
export function armarCambios(actual, cambios = {}) {
    const job = {};
    const resumen = [];

    if (cambios.habilitado !== undefined) {
        if (typeof cambios.habilitado !== 'boolean') throw error(400, 'habilitado debe ser verdadero o falso.');
        if (cambios.habilitado !== actual.habilitado) {
            job.enabled = cambios.habilitado;
            resumen.push(cambios.habilitado ? 'activado' : 'pausado');
        }
    }

    if (cambios.url !== undefined && cambios.url !== actual.url) {
        let nueva;
        let vieja;
        try {
            nueva = new URL(String(cambios.url));
            vieja = new URL(actual.url);
        } catch {
            throw error(400, 'URL inválida.');
        }
        // El cron manda el token de servicio en un header: la URL no puede apuntar a otro sitio.
        if (nueva.protocol !== 'https:' || nueva.origin !== vieja.origin) {
            throw error(400, `La URL debe seguir siendo https y del mismo sitio (${vieja.origin}).`);
        }
        job.url = nueva.toString();
        resumen.push(`URL ${nueva.pathname}${nueva.search}`);
    }

    if (cambios.schedule !== undefined) {
        const s = cambios.schedule || {};
        const nuevo = {
            timezone: actual.schedule.timezone,
            expiresAt: actual.schedule.expiresAt,
            hours: enteros(s.hours, 0, 23, 'Horas'),
            minutes: enteros(s.minutes, 0, 59, 'Minutos'),
            mdays: actual.schedule.mdays,
            months: actual.schedule.months,
            wdays: normalizarDias(s.wdays),
        };
        const igual = ['hours', 'minutes', 'wdays'].every(
            (k) => JSON.stringify(nuevo[k]) === JSON.stringify(actual.schedule[k]),
        );
        if (!igual) {
            job.schedule = nuevo;
            resumen.push('horario');
        }
    }

    return { job, resumen };
}

/** Aplica cambios a un cron del servidor. Devuelve { cron, resumen } (cron: el estado nuevo). */
export async function actualizarCron(id, cambios) {
    const jobId = Number(id);
    if (!Number.isInteger(jobId)) throw error(400, 'ID de cron inválido.');

    // Se busca entre los crons del servidor: así no se puede editar cualquier otro job de la cuenta.
    const actual = (await listarCrons()).find((c) => c.id === jobId);
    if (!actual) throw error(404, 'Ese cron no existe o no es de encendido/apagado.');

    const { job, resumen } = armarCambios(actual, cambios);
    if (!resumen.length) return { cron: actual, resumen };

    await cj(`/jobs/${jobId}`, { method: 'PATCH', body: { job } });

    const cron = {
        ...actual,
        habilitado: job.enabled ?? actual.habilitado,
        url: job.url ?? actual.url,
        schedule: job.schedule ?? actual.schedule,
        proximaEjecucion: null, // lo recalcula cron-job.org; se ve al recargar
    };
    return { cron, resumen };
}

export const descripcionCambio = (titulo, resumen) => limpiarTexto(`${titulo}: ${resumen.join(', ')}`, 500);
