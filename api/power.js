import { pwr } from "../src/controllers/kamatera.js";
import { registrar } from "../src/tareas/registro.js";
import { POWER_TIPOS } from "../src/validacion.js";
import { bodyDe, clientIp, limpiarTexto, soloMetodo } from "../src/util.js";

/* POST /api/power   Body: { tipo: "on" | "off" | "restart", nombre, lat?, long? } */
export default async function handler(req, res) {
    if (!soloMetodo(req, res, 'POST')) return;

    const { tipo, lat, long } = bodyDe(req);
    const nombre = limpiarTexto(bodyDe(req).nombre);
    if (!nombre) return res.status(400).json({ error: 'Falta tu nombre.' });
    if (!POWER_TIPOS.includes(tipo)) {
        return res.status(400).json({ error: `Tipo inválido. Usá: ${POWER_TIPOS.join(', ')}.` });
    }

    try {
        const data = await pwr(tipo);
        const mensaje = data.errors ? data.errors[0].info : 'OK';
        await registrar(tipo, lat, long, mensaje, nombre, clientIp(req));
        res.status(200).json(data.errors ? { ok: false, mensaje } : { ok: true });
    } catch (error) {
        console.error('Error en /api/power:', error.message);
        await registrar(tipo, lat, long, `Error: ${error.message}`, nombre, clientIp(req));
        res.status(500).json({ error: error.message });
    }
}
