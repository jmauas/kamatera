import { validarCambio } from '../validacion.js';

const url = 'https://console.kamatera.com/service';

/* El token de Kamatera se reutiliza unos minutos en vez de pedir uno por request. */
const TOKEN_TTL_MS = 5 * 60 * 1000;
let tokenCache = { valor: null, expira: 0 };

const pedirToken = async (forzar = false) => {
  if (!forzar && tokenCache.valor && Date.now() < tokenCache.expira) return tokenCache.valor;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${url}/authenticate`, {
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: process.env.CLIENT_ID, secret: process.env.API_SECRET }),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.authentication) {
      throw new Error(data?.errors?.[0]?.info || `No se pudo autenticar en Kamatera (HTTP ${res.status}).`);
    }
    tokenCache = { valor: data.authentication, expira: Date.now() + TOKEN_TTL_MS };
    return data.authentication;
  } finally {
    clearTimeout(timeoutId);
  }
}

/* Llamada a Kamatera con token, timeout y un reintento si el token venció.
   Si la respuesta no es exitosa y no trae `errors`, se devuelve { errors: [...] }
   para que los llamadores traten todos los fallos igual. */
const kfetch = async (path, { method = 'GET', body, timeoutMs = 30000 } = {}) => {
  for (let intento = 0; intento < 2; intento++) {
    const token = await pedirToken(intento > 0);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${url}${path}`, {
        method,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      if (res.status === 401 && intento === 0) continue;
      const data = await res.json().catch(() => null);
      if (!res.ok && !(data && data.errors)) {
        return { errors: [{ info: `Kamatera respondió HTTP ${res.status}.` }] };
      }
      return data ?? {};
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

const server = () => `/server/${process.env.SERVER_ID}`;

export const statusServer = async () => {
  const srv = await kfetch(server());
  if (srv.errors) throw new Error(srv.errors[0].info);
  return srv;
}

export const pedirTasks = async () => {
  const tasks = await kfetch('/queue');
  if (!Array.isArray(tasks)) throw new Error(tasks?.errors?.[0]?.info || 'Respuesta inesperada de la cola de tareas.');
  return tasks;
}

/** Encender / apagar / reiniciar. `tipo` ya validado (on | off | restart). */
export const pwr = (tipo) =>
  kfetch(`${server()}/power`, { method: 'PUT', body: { power: tipo } });

/* El apagado completo se hace en dos pasos porque Vercel corta las funciones
   a los 60 s y entre la modificación de CPU y el apagado hay que esperar 2 minutos.
   El panel llama a cada paso por separado y espera entre ambos. */

/** Paso 1: reduce la CPU. `cpuValue` ya validado (ej. "8T"). Devuelve { ok, mensaje }. */
export const apagadoPasoCpu = async (cpuValue) => {
  try {
    const data = await kfetch(`${server()}/cpu`, { method: 'PUT', body: { cpu: cpuValue } });
    return data.errors ? { ok: false, mensaje: data.errors[0].info } : { ok: true, mensaje: 'OK' };
  } catch (error) {
    return { ok: false, mensaje: error.message };
  }
}

/** Paso 2: apaga el servidor (se ejecuta siempre, haya salido bien o no la CPU). */
export const apagadoPasoPower = async () => {
  try {
    const data = await pwr('off');
    return data.errors ? { ok: false, mensaje: data.errors[0].info } : { ok: true, mensaje: 'OK' };
  } catch (error) {
    return { ok: false, mensaje: error.message };
  }
}

/** Cambia CPU, RAM o disco. El valor se valida acá también (defensa en profundidad). */
export const modificar = async (tipo, valor) => {
  const check = validarCambio(tipo, valor);
  if (check.error) return { errors: [{ info: check.error }] };

  switch (tipo) {
    case 'procesador':
      return kfetch(`${server()}/cpu`, { method: 'PUT', body: { cpu: check.valor } });
    case 'ram':
      return kfetch(`${server()}/ram`, { method: 'PUT', body: { ram: check.valor } });
    case 'disco': {
      // El disco no se puede reducir: se bloquea antes de pedirlo.
      const srv = await statusServer();
      const actual = Number(srv.diskSizes?.[0]);
      if (Number.isFinite(actual) && check.valor < actual) {
        return { errors: [{ info: `El disco no se puede reducir (actual: ${actual} GB).` }] };
      }
      return kfetch(`${server()}/disk`, { method: 'PUT', body: { size: check.valor, index: 0, provision: 0 } });
    }
  }
}
