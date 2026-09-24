/* Cliente de la API de cron-job.org para administrar los crons del servidor
   (los que empiezan con "encendido" o "apagado").
   Variables: CRONJOB_API_KEY (Settings -> API en cron-job.org),
              CRONJOB_API_URL (opcional, para pruebas; por defecto https://api.cron-job.org). */

import { limpiarTexto } from './util.js';
import { normalizarCpu, validarCambio } from './validacion.js';

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

/** ¿Es uno de los crons del servidor? (el título empieza con "encendido", "apagado" o "configurar") */
export const esCronDelServidor = (job) => /^(encendido|apagado|configurar)/i.test(String(job?.title ?? '').trim());

/** Tipo de cron según el endpoint al que llama. */
export const tipoDeUrl = (url) => {
    const ruta = String(url || '');
    if (/\/api\/cron\/encendido/i.test(ruta)) return 'encendido';
    if (/\/api\/cron\/apagado/i.test(ruta)) return 'apagado';
    if (/\/api\/cron\/configurar/i.test(ruta)) return 'configurar';
    return 'otro';
};

const ms = (segundos) => (segundos ? segundos * 1000 : null);

const ESTADOS = {
    0: 'Sin ejecutar', 1: 'OK', 2: 'Error de DNS', 3: 'Error de conexión', 4: 'Error HTTP',
    5: 'Tiempo agotado', 6: 'Respuesta demasiado grande', 7: 'URL inválida', 8: 'Error interno', 9: 'Error desconocido',
};

const normalizar = (j) => ({
    id: j.jobId,
    tipo: tipoDeUrl(j.url),
    folderId: j.folderId || 0,
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

    if (cambios.titulo !== undefined && cambios.titulo !== actual.titulo) {
        const titulo = limpiarTexto(cambios.titulo, 120);
        if (!esCronDelServidor({ title: titulo })) {
            throw error(400, 'El título debe empezar con "Encendido", "Apagado" o "Configurar".');
        }
        job.title = titulo;
        resumen.push('título');
    }

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

/* ---------- Crear crons ---------- */

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];
const pad = (n) => String(n).padStart(2, '0');

/** Días como texto: "Lun a Jue", "Sáb", "Vie y Sáb", "Todos los días". */
export function textoDias(wdays) {
    if (wdays.length === 1 && wdays[0] === -1) return 'Todos los días';
    const idx = wdays.map((d) => ORDEN_SEMANA.indexOf(d)).sort((a, b) => a - b);
    const grupos = [];
    for (const i of idx) {
        const ultimo = grupos[grupos.length - 1];
        if (ultimo && i === ultimo[ultimo.length - 1] + 1) ultimo.push(i);
        else grupos.push([i]);
    }
    return grupos.map((g) => {
        const nombres = g.map((i) => DIAS_CORTO[ORDEN_SEMANA[i]]);
        return nombres.length >= 3 ? `${nombres[0]} a ${nombres[nombres.length - 1]}` : nombres.join(' y ');
    }).join(', ');
}

/** Suma minutos a un horario { dias, hora, minuto }; si cruza la medianoche, corre los días. */
export function sumarMinutos({ dias, hora, minuto }, minutos) {
    const total = hora * 60 + minuto + minutos;
    const salto = Math.floor(total / 1440);
    const resto = ((total % 1440) + 1440) % 1440;
    return {
        dias: dias.map((d) => (((d + salto) % 7) + 7) % 7),
        hora: Math.floor(resto / 60),
        minuto: resto % 60,
    };
}

const parametros = ({ cpu, ram }) => {
    const q = new URLSearchParams();
    if (cpu) q.set('cpu', cpu);
    if (ram) q.set('ram', ram);
    return q.toString();
};

/** Valida el pedido de creación y arma la lista de crons a crear (1 o 2).
    datos: { tipo: 'encendido'|'apagado'|'configurar', dias: [0-6], hora, minuto, cpu?, ram? }
    Un apagado con cpu/ram genera DOS crons: uno que cambia la configuración a la hora indicada
    y otro que apaga 2 minutos después. */
export function armarCreacion(datos, { origen, timezone = 'America/Argentina/Buenos_Aires', folderId = 0 }) {
    const tipo = datos.tipo;
    if (!['encendido', 'apagado', 'configurar'].includes(tipo)) {
        throw error(400, 'Tipo inválido (encendido, apagado o configurar).');
    }

    const dias = normalizarDias(datos.dias);
    const diasLista = dias.length === 1 && dias[0] === -1 ? [0, 1, 2, 3, 4, 5, 6] : dias;
    const hora = Number(datos.hora);
    const minuto = Number(datos.minuto);
    if (!Number.isInteger(hora) || hora < 0 || hora > 23) throw error(400, 'Hora inválida (0 a 23).');
    if (!Number.isInteger(minuto) || minuto < 0 || minuto > 59) throw error(400, 'Minuto inválido (0 a 59).');

    let cpu = null;
    let ram = null;
    if (datos.cpu) {
        cpu = normalizarCpu(datos.cpu);
        if (!cpu) throw error(400, 'Cantidad de procesadores no permitida.');
    }
    if (datos.ram) {
        const v = validarCambio('ram', datos.ram);
        if (v.error) throw error(400, v.error);
        ram = v.valor;
    }
    if (tipo === 'configurar' && !cpu && !ram) throw error(400, 'Elegí la CPU y/o la RAM a configurar.');
    if (tipo === 'encendido') { cpu = null; ram = null; }

    const hhmm = (h, m) => `${pad(h)}:${pad(m)}`;
    const etiquetaCfg = [cpu && `CPU ${cpu}`, ram && `RAM ${ram} MB`].filter(Boolean).join(', ');
    const base = { hora, minuto, dias: diasLista };
    const crear = (titulo, ruta, h, conParametros = false) => ({
        titulo,
        url: `${origen}/api/cron/${ruta}${conParametros ? `?${parametros({ cpu, ram })}` : ''}`,
        schedule: {
            timezone, expiresAt: 0, mdays: [-1], months: [-1],
            hours: [h.hora], minutes: [h.minuto],
            wdays: normalizarDias(h.dias),
        },
        folderId,
    });
    const nombreDias = textoDias(normalizarDias(diasLista));

    if (tipo === 'encendido') {
        return [crear(`Encendido ${nombreDias} ${hhmm(hora, minuto)}`, 'encendido', base)];
    }
    if (tipo === 'configurar') {
        return [crear(`Configurar ${nombreDias} ${hhmm(hora, minuto)} (${etiquetaCfg})`, 'configurar', base, true)];
    }
    if (!cpu && !ram) {
        return [crear(`Apagado ${nombreDias} ${hhmm(hora, minuto)}`, 'apagado', base)];
    }
    const despues = sumarMinutos(base, 2);
    return [
        crear(`Apagado ${nombreDias} ${hhmm(hora, minuto)} - configurar (${etiquetaCfg})`, 'configurar', base, true),
        crear(`Apagado ${textoDias(normalizarDias(despues.dias))} ${hhmm(despues.hora, despues.minuto)} - apagar`, 'apagado', despues),
    ];
}

const cuerpoCreacion = (spec) => ({
    job: {
        url: spec.url,
        title: spec.titulo,
        enabled: spec.habilitado !== false,
        saveResponses: false,
        requestTimeout: 30,
        requestMethod: 0,
        redirectSuccess: false,
        ...(spec.folderId ? { folderId: spec.folderId } : {}),
        schedule: spec.schedule,
        notification: { onFailure: false, onSuccess: false, onDisable: true },
        // El cron manda el token de servicio al llamar a la API del panel.
        extendedData: { headers: { token: process.env.TOKEN || '' }, body: '' },
    },
});

/** Crea un cron en cron-job.org a partir de una spec ({ titulo, url, schedule, folderId, habilitado? }). */
export const crearJob = (spec) => cj('/jobs', { method: 'PUT', body: cuerpoCreacion(spec) });

/** Aplica un PATCH crudo a un job (el cuerpo ya debe estar validado). */
export const editarJob = (jobId, job) => cj(`/jobs/${jobId}`, { method: 'PATCH', body: { job } });

/* ---------- Conversión de los apagados existentes ---------- */

/** Plan para convertir cada cron de apagado que trae `?cpu=N` en dos crons separados:
    uno que cambia la CPU a la hora original y el propio apagado 2 minutos después.
    Es una función pura: solo arma el plan, no toca nada. */
export function planificarConversion(crons) {
    const plan = [];
    for (const c of crons) {
        if (c.tipo !== 'apagado' || !/^apagado/i.test(c.titulo.trim())) continue;

        let cpu = null;
        try { cpu = new URL(c.url).searchParams.get('cpu'); } catch { /* URL rara */ }
        if (!cpu) { plan.push({ original: c, omitido: 'la URL no trae cpu (apaga directo): se deja igual' }); continue; }
        cpu = normalizarCpu(cpu);
        if (!cpu) { plan.push({ original: c, omitido: 'el valor de cpu de la URL no es válido' }); continue; }
        const { hours, minutes, wdays } = c.schedule;
        if (hours.length !== 1 || minutes.length !== 1 || hours[0] === -1 || minutes[0] === -1) {
            plan.push({ original: c, omitido: 'tiene varios horarios: hay que convertirlo a mano' });
            continue;
        }

        const dias = wdays.length === 1 && wdays[0] === -1 ? [0, 1, 2, 3, 4, 5, 6] : wdays;
        const despues = sumarMinutos({ dias, hora: hours[0], minuto: minutes[0] }, 2);
        const origen = new URL(c.url).origin;
        const base = c.titulo.trim();

        plan.push({
            original: c,
            configurar: {
                titulo: `${base} - configurar (CPU ${cpu})`,
                url: `${origen}/api/cron/configurar?cpu=${cpu}`,
                schedule: { ...c.schedule },
                folderId: c.folderId,
                habilitado: c.habilitado,
            },
            apagar: {
                titulo: `${base} - apagar`,
                url: `${origen}/api/cron/apagado`,
                schedule: { ...c.schedule, hours: [despues.hora], minutes: [despues.minuto], wdays: normalizarDias(despues.dias) },
            },
        });
    }
    return plan;
}

/** Crea en cron-job.org los crons de `datos` (ver armarCreacion). Devuelve los crons creados. */
export async function crearCrones(datos) {
    if (!process.env.TOKEN) throw error(500, 'Falta TOKEN en el servidor: los crons nuevos no podrían autenticarse.');
    const modelo = (await listarCrons())[0];
    if (!modelo) throw error(409, 'No hay crons existentes de los que tomar el sitio y la zona horaria.');

    const specs = armarCreacion(datos, {
        origen: new URL(modelo.url).origin,
        timezone: modelo.schedule.timezone,
        folderId: modelo.folderId,
    });

    const creados = [];
    for (const spec of specs) {
        const r = await cj('/jobs', { method: 'PUT', body: cuerpoCreacion(spec) });
        creados.push({
            id: r.jobId, tipo: tipoDeUrl(spec.url), folderId: spec.folderId, titulo: spec.titulo, habilitado: true,
            url: spec.url, schedule: spec.schedule, ultimoEstado: 'Sin ejecutar', ultimoOk: false,
            ultimaEjecucion: null, proximaEjecucion: null,
        });
    }
    return creados;
}

export const descripcionCambio = (titulo, resumen) => limpiarTexto(`${titulo}: ${resumen.join(', ')}`, 500);
