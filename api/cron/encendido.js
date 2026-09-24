import { pwr } from "../../src/controllers/kamatera.js";
import { registrar } from "../../src/tareas/registro.js";
import { requireAuth } from "../../src/auth.js";

/* Encendido automático (lo llama cron-job.org con el header `token`).
   Responde 502 si Kamatera falla, para que cron-job.org lo marque como fallido. */
export default async function handler(req, res) {
    if (!requireAuth(req, res, { soloToken: true })) return;

    try {
        const data = await pwr('on');
        const mensaje = data.errors ? data.errors[0].info : 'OK';
        await registrar('ENC. AUTO.', 0, 0, mensaje, '', '');
        return res.status(data.errors ? 502 : 200).json({
            ok: !data.errors,
            mensaje,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error en cron encendido:', error.message);
        await registrar('ENC. AUTO.', 0, 0, `Error: ${error.message}`, '', '');
        return res.status(502).json({ ok: false, mensaje: error.message, timestamp: new Date().toISOString() });
    }
}
