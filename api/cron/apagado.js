import { pwr, statusServer } from "../../src/controllers/kamatera.js";
import { registrar } from "../../src/tareas/registro.js";
import { requireAuth } from "../../src/auth.js";

/* Apagado automático (lo llama cron-job.org con el header `token`).
   Apaga el servidor y espera el resultado real de Kamatera: si falla responde 502 y así
   cron-job.org lo marca como fallido. Si ya estaba apagado no hace nada.
   El cambio de CPU/RAM previo va en un cron aparte: /api/cron/configurar. */
export default async function handler(req, res) {
    if (!requireAuth(req, res, { soloToken: true })) return;

    const ahora = () => new Date().toISOString();
    try {
        // Si no se puede leer el estado se apaga igual: es lo más seguro.
        const srv = await statusServer().catch(() => null);
        if (srv?.power === 'off') {
            return res.status(200).json({ ok: true, accion: 'nada', mensaje: 'El servidor ya estaba apagado.', timestamp: ahora() });
        }

        const data = await pwr('off');
        const mensaje = data.errors ? data.errors[0].info : 'OK';
        await registrar('APAG. AUTO.', 0, 0, mensaje, '', '');
        return res.status(data.errors ? 502 : 200).json({ ok: !data.errors, accion: 'apagar', mensaje, timestamp: ahora() });
    } catch (error) {
        console.error('Error en cron apagado:', error.message);
        await registrar('APAG. AUTO.', 0, 0, `Error: ${error.message}`, '', '');
        return res.status(502).json({ ok: false, mensaje: error.message, timestamp: ahora() });
    }
}
