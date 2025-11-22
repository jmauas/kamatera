import { apagadoCompleto } from "../src/controllers/kamatera.js";
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

    const { cpu, lat, long, nombre, ip } = req.query;
    const cpuValue = (cpu || '8') + 'T';

    try {
        const data = await apagadoCompleto(cpuValue);
        const mensajeFinal = `CPU: ${data.resultados.cpu.mensaje}, Power: ${data.resultados.power.mensaje}`;
        
        if (data.errors) {
            await registrar('off', lat, long, mensajeFinal, nombre, ip);
            res.status(200).json({ ok: false, mensaje: mensajeFinal });
        } else {
            await registrar('off', lat, long, mensajeFinal, nombre, ip);
            res.status(200).json({ ok: true, mensaje: mensajeFinal });
        }
    } catch (error) {
        console.error('Error en /api/apagado-completo:', error);
        const mensajeError = `Error: ${error.message}`;
        await registrar('off', lat, long, mensajeError, nombre, ip);
        res.status(500).json({ error: mensajeError });
    }
}
