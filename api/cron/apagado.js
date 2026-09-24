import { pwr } from "../../src/controllers/kamatera.js";
import { registrar } from "../../src/tareas/registro.js";
import { requireAuth } from "../../src/auth.js";

/* Apagado automático (lo llama cron-job.org con el header `token`).
   Espera el resultado real de Kamatera: si falla, responde 502 y así
   cron-job.org lo marca como fallido. */
export default async function handler(req, res) {
    if (!requireAuth(req, res, { soloToken: true })) return;

    try {
        const data = await pwr('off');
        const mensaje = data.errors ? data.errors[0].info : 'OK';
        await registrar('APAG. AUTO.', 0, 0, mensaje, '', '');
        return res.status(data.errors ? 502 : 200).json({
            ok: !data.errors,
            mensaje,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error en cron apagado:', error.message);
        await registrar('APAG. AUTO.', 0, 0, `Error: ${error.message}`, '', '');
        return res.status(502).json({ ok: false, mensaje: error.message, timestamp: new Date().toISOString() });
    }
}
