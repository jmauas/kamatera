import { listarCrons, actualizarCron, crearCrones, descripcionCambio } from "../src/cronjob.js";
import { registrar } from "../src/tareas/registro.js";
import { requireAuth } from "../src/auth.js";
import { bodyDe, clientIp, limpiarTexto } from "../src/util.js";

/* Administración de los crons de encendido/apagado (cron-job.org). Requiere la configuración desbloqueada.
   GET   /api/crons                                       -> { crons: [...] }
   POST  /api/crons { nombre, tipo: encendido|apagado|configurar, dias, hora, minuto, cpu?, ram? } -> { crons }
         (un apagado con cpu/ram crea DOS crons: configura y apaga 2 minutos después)
   PATCH /api/crons { id, nombre, habilitado?, url?, schedule?: { hours, minutes, wdays } } -> { cron } */
export default async function handler(req, res) {
    if (!requireAuth(req, res, { config: true })) return;

    try {
        if (req.method === 'GET') {
            return res.status(200).json({ crons: await listarCrons() });
        }

        if (req.method === 'POST') {
            const { nombre, ...datos } = bodyDe(req);
            const quien = limpiarTexto(nombre);
            if (!quien) return res.status(400).json({ error: 'Falta tu nombre.' });

            const crons = await crearCrones(datos);
            await registrar('CRON NUEVO', 0, 0, limpiarTexto(crons.map((c) => c.titulo).join(' + '), 500), quien, clientIp(req));
            return res.status(201).json({ crons });
        }

        if (req.method === 'PATCH') {
            const { id, nombre, ...cambios } = bodyDe(req);
            const quien = limpiarTexto(nombre);
            if (!quien) return res.status(400).json({ error: 'Falta tu nombre.' });

            const { cron, resumen } = await actualizarCron(id, cambios);
            if (resumen.length) {
                await registrar('CRON EDIT', 0, 0, descripcionCambio(cron.titulo, resumen), quien, clientIp(req));
            }
            return res.status(200).json({ cron, cambios: resumen });
        }

        res.setHeader('Allow', 'GET, POST, PATCH');
        return res.status(405).json({ error: 'Método no permitido.' });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Error en /api/crons:', error.message);
        res.status(error.status || 500).json({ error: error.message });
    }
}
