import { pwr } from "../../src/controllers/kamatera.js";
import { registrar } from "../../src/tareas/registro.js";

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

    // Responder inmediatamente y ejecutar en background
    setImmediate(async () => {
        try {
            const res = await pwr('on');
            if (res.errors) {
                await registrar('ENC. AUTO.', 0, 0, res.errors[0].info, '', '').catch(err => 
                    console.error('Error al registrar:', err)
                );
            } else {
                await registrar('ENC. AUTO.', 0, 0, 'OK', '', '').catch(err => 
                    console.error('Error al registrar:', err)
                );
            }
        } catch (error) {
            console.error('Error en cron encendido:', error);
            await registrar('ENC. AUTO.', 0, 0, `Error: ${error.message}`, '', '').catch(err => 
                console.error('Error al registrar:', err)
            );
        }
    });

    return new Response(JSON.stringify({ 
        ok: true, 
        mensaje: 'Encendido iniciado',
        timestamp: new Date().toISOString()
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
