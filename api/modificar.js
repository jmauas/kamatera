import { modificar } from "../src/controllers/kamatera.js";
import { registrar } from "../src/tareas/registro.js";

// Middleware para verificar token
const verificarToken = (req) => {
    const token = req.headers.token || req.query.token;
    return token === process.env.TOKEN;
};

export default async function handler(req, res) {
    if (!verificarToken(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tipo, valor, nombre, ip } = req.query;

    try {
        const data = await modificar(tipo, valor);
        if (data.errors) {
            await registrar(`${tipo} a ${valor}`, 0, 0, data.errors[0].info, nombre, ip);
            res.status(200).json({ ok: false, mensaje: data.errors[0].info });
        } else {
            await registrar(`${tipo} a ${valor}`, 0, 0, 'OK', nombre, ip);
            res.status(200).json({ ok: true });
        }
    } catch (error) {
        console.error('Error en /api/modificar:', error);
        res.status(500).json({ error: error.message });
    }
}
