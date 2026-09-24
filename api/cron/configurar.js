import { modificar } from "../../src/controllers/kamatera.js";
import { registrar } from "../../src/tareas/registro.js";
import { requireAuth } from "../../src/auth.js";
import { normalizarCpu, validarCambio } from "../../src/validacion.js";

/* Cambio de configuración automático (lo llama cron-job.org con el header `token`).
     /api/cron/configurar?cpu=8            -> cambia la CPU
     /api/cron/configurar?ram=16384        -> cambia la RAM (MB)
     /api/cron/configurar?cpu=8&ram=16384  -> ambas
   Se usa antes del apagado (2 minutos antes) o para subir recursos a la mañana.
   Si el servidor ya tenía ese valor ("already exists") se considera correcto.
   Responde 502 si Kamatera falla, así cron-job.org lo marca como fallido. */
export default async function handler(req, res) {
    if (!requireAuth(req, res, { soloToken: true })) return;

    const ahora = () => new Date().toISOString();
    const pedidos = [];

    if (req.query?.cpu) {
        const cpu = normalizarCpu(req.query.cpu);
        if (!cpu) return res.status(400).json({ ok: false, mensaje: 'Parámetro cpu inválido.', timestamp: ahora() });
        pedidos.push({ tipo: 'procesador', valor: cpu, etiqueta: `CPU ${cpu}` });
    }
    if (req.query?.ram) {
        const ram = validarCambio('ram', req.query.ram);
        if (ram.error) return res.status(400).json({ ok: false, mensaje: 'Parámetro ram inválido.', timestamp: ahora() });
        pedidos.push({ tipo: 'ram', valor: ram.valor, etiqueta: `RAM ${ram.valor} MB` });
    }
    if (!pedidos.length) {
        return res.status(400).json({ ok: false, mensaje: 'Indicá cpu y/o ram.', timestamp: ahora() });
    }

    let ok = true;
    const partes = [];
    for (const { tipo, valor, etiqueta } of pedidos) {
        try {
            const data = await modificar(tipo, valor);
            if (!data.errors) partes.push(`${etiqueta}: OK`);
            else if (/already exists/i.test(data.errors[0].info)) partes.push(`${etiqueta}: sin cambios`);
            else { ok = false; partes.push(`${etiqueta}: ${data.errors[0].info}`); }
        } catch (error) {
            ok = false;
            partes.push(`${etiqueta}: ${error.message}`);
        }
    }

    const mensaje = partes.join('; ');
    await registrar('CONFIG AUTO.', 0, 0, mensaje, '', '');
    return res.status(ok ? 200 : 502).json({ ok, mensaje, timestamp: ahora() });
}
