import { pwr, statusServer, apagadoPasoCpu } from "../../src/controllers/kamatera.js";
import { registrar } from "../../src/tareas/registro.js";
import { decidirApagado, esFinal } from "../../src/tareas/apagadoAuto.js";
import { requireAuth } from "../../src/auth.js";
import { normalizarCpu } from "../../src/validacion.js";

/* Apagado automático por fases (lo llama cron-job.org con el header `token`).
     /api/cron/apagado?cpu=8            -> si la CPU es otra, la reduce; si ya es 8T, apaga.
     /api/cron/apagado?cpu=8&final=1    -> última fase: apaga siempre.
     /api/cron/apagado                  -> apaga directo.
   Espera el resultado real de Kamatera y responde 502 si falla,
   así cron-job.org lo marca como fallido. */
export default async function handler(req, res) {
    if (!requireAuth(req, res, { soloToken: true })) return;

    const ahora = () => new Date().toISOString();
    const cpuObjetivo = req.query?.cpu ? normalizarCpu(req.query.cpu) : null;
    if (req.query?.cpu && !cpuObjetivo) {
        return res.status(400).json({ ok: false, mensaje: 'Parámetro cpu inválido.', timestamp: ahora() });
    }

    try {
        // Si no se puede leer el estado, se sigue igual: apagar es lo más seguro.
        const srv = await statusServer().catch((e) => {
            console.error('Cron apagado: no se pudo leer el estado:', e.message);
            return null;
        });

        const accion = decidirApagado({
            power: srv?.power,
            cpuActual: srv?.cpu,
            cpuObjetivo,
            final: esFinal(req.query?.final),
        });

        if (accion === 'nada') {
            return res.status(200).json({ ok: true, accion, mensaje: 'El servidor ya estaba apagado.', timestamp: ahora() });
        }

        if (accion === 'cpu') {
            const r = await apagadoPasoCpu(cpuObjetivo);
            // "already exists" = ya tenía esa CPU: se pasa directo al apagado.
            if (r.ok || !/already exists/i.test(r.mensaje)) {
                await registrar('CPU AUTO.', 0, 0, r.ok ? `CPU a ${cpuObjetivo}: OK` : r.mensaje, '', '');
                return res.status(r.ok ? 200 : 502).json({ ok: r.ok, accion, mensaje: r.mensaje, timestamp: ahora() });
            }
        }

        const data = await pwr('off');
        const mensaje = data.errors ? data.errors[0].info : 'OK';
        await registrar('APAG. AUTO.', 0, 0, mensaje, '', '');
        return res.status(data.errors ? 502 : 200).json({
            ok: !data.errors, accion: 'apagar', mensaje, timestamp: ahora(),
        });
    } catch (error) {
        console.error('Error en cron apagado:', error.message);
        await registrar('APAG. AUTO.', 0, 0, `Error: ${error.message}`, '', '');
        return res.status(502).json({ ok: false, mensaje: error.message, timestamp: ahora() });
    }
}
