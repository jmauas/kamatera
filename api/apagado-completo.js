import { apagadoPasoCpu, apagadoPasoPower } from "../src/controllers/kamatera.js";
import { registrar } from "../src/tareas/registro.js";
import { normalizarCpu } from "../src/validacion.js";
import { bodyDe, clientIp, limpiarTexto, soloMetodo } from "../src/util.js";

/* Apagado completo en dos pasos (Vercel corta a los 60 s, no se puede esperar adentro).
   POST /api/apagado-completo
     { paso: "cpu",   cpu: "12T" }                       -> reduce la CPU y responde enseguida.
     { paso: "power", cpuMsg, nombre, lat?, long? }      -> apaga el servidor y registra el evento.
   El panel espera 2 minutos entre ambos pasos. */
export default async function handler(req, res) {
    if (!soloMetodo(req, res, 'POST')) return;

    const { paso, cpu, cpuMsg, lat, long, nombre } = bodyDe(req);

    try {
        if (paso === 'cpu') {
            const cpuValue = normalizarCpu(cpu);
            if (!cpuValue) return res.status(400).json({ error: 'Cantidad de procesadores no permitida.' });
            return res.status(200).json(await apagadoPasoCpu(cpuValue));
        }

        if (paso === 'power') {
            if (!limpiarTexto(nombre)) return res.status(400).json({ error: 'Falta tu nombre.' });
            const r = await apagadoPasoPower();
            const mensajeFinal = `CPU: ${limpiarTexto(cpuMsg, 200) || 'sin datos'}, Power: ${r.mensaje}`;
            await registrar('off', lat, long, mensajeFinal, nombre, clientIp(req));
            return res.status(200).json({ ok: r.ok, mensaje: mensajeFinal });
        }

        return res.status(400).json({ error: 'Falta el parámetro paso (cpu | power).' });
    } catch (error) {
        console.error('Error en /api/apagado-completo:', error.message);
        res.status(500).json({ error: error.message });
    }
}
