import { pwr, modificar } from "../src/controllers/kamatera.js";
import { registrar } from "../src/tareas/registro.js";

// Función auxiliar para verificar el token de seguridad
const verificarToken = (req) => {
    const token = req.headers.token || req.query.token;
    return token === process.env.TOKEN;
};

// Endpoint para encender el servidor (Lun-Vie 9:00)
export async function GET(request) {
    if (!verificarToken(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const res = await pwr('on');
        if (res.errors) {
            await registrar('ENC. AUTO.', 0, 0, res.errors[0].info, '', '');
            return new Response(JSON.stringify({ ok: false, mensaje: res.errors[0].info }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            await registrar('ENC. AUTO.', 0, 0, 'OK', '', '');
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Error en cron encendido:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
