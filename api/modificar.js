import { modificar } from "../src/controllers/kamatera.js";
import { registrar } from "../src/tareas/registro.js";
import { requireAuth } from "../src/auth.js";
import { validarCambio } from "../src/validacion.js";
import { bodyDe, clientIp, soloMetodo } from "../src/util.js";

/* POST /api/modificar   Body: { tipo: "procesador" | "ram" | "disco", valor, nombre }
   Requiere la configuración desbloqueada. */
export default async function handler(req, res) {
    if (!soloMetodo(req, res, 'POST') || !requireAuth(req, res, { config: true })) return;

    const { tipo, valor, nombre } = bodyDe(req);
    const check = validarCambio(tipo, valor);
    if (check.error) return res.status(400).json({ error: check.error });

    const evento = `${tipo} a ${check.valor}`;
    try {
        const data = await modificar(tipo, check.valor);
        const mensaje = data.errors ? data.errors[0].info : 'OK';
        await registrar(evento, 0, 0, mensaje, nombre, clientIp(req));
        res.status(200).json(data.errors ? { ok: false, mensaje } : { ok: true });
    } catch (error) {
        console.error('Error en /api/modificar:', error.message);
        await registrar(evento, 0, 0, `Error: ${error.message}`, nombre, clientIp(req));
        res.status(500).json({ error: error.message });
    }
}
