import { pwr } from "../src/controllers/kamatera.js";
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

    const { tipo, lat, long, nombre, ip } = req.query;

    try {
        const data = await pwr(tipo);
        if (data.errors) {
            await registrar(tipo, lat, long, data.errors[0].info, nombre, ip);
            res.status(200).json({ ok: false, mensaje: data.errors[0].info });
        } else {
            await registrar(tipo, lat, long, 'OK', nombre, ip);
            res.status(200).json({ ok: true });
        }
    } catch (error) {
        console.error('Error en /api/power:', error);
        res.status(500).json({ error: error.message });
    }
}
