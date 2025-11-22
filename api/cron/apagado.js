import { modificar } from "../../src/controllers/kamatera.js";
import { registrar } from "../../src/tareas/registro.js";

// Función auxiliar para verificar el token de seguridad
const verificarToken = (req) => {
    const token = req.headers.token || req.query.token;
    return token === process.env.TOKEN;
};

// Endpoint para apagar el servidor
export async function GET(request) {
    if (!verificarToken(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const url = new URL(request.url);
        const procesadores = url.searchParams.get('cpu') || '8';
        
        const res = await modificar('procesador', procesadores + 'T');
        
        if (res.errors) {
            await registrar('APAG. AUTO.', 0, 0, res.errors[0].info, '', '');
            return new Response(JSON.stringify({ ok: false, mensaje: res.errors[0].info }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            await registrar('APAG. AUTO.', 0, 0, 'OK', '', '');
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Error en cron apagado:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
