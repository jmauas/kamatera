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

    // Ejecutar la operación SIN AWAIT para no esperar
    const url = 'https://console.kamatera.com/service';
    
    // Iniciar el proceso pero NO esperar
    (async () => {
        try {
            // Autenticación
            const authRes = await fetch(`${url}/authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: process.env.CLIENT_ID,
                    secret: process.env.API_SECRET
                })
            });
            const { authentication } = await authRes.json();
            
            // Encender servidor
            await fetch(`${url}/server/${process.env.SERVER_ID}/power`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authentication}`
                },
                body: JSON.stringify({ power: 'on' })
            });
            
            // Registrar éxito
            await registrar('ENC. AUTO.', 0, 0, 'OK', '', '').catch(console.error);
        } catch (error) {
            console.error('Error en cron encendido:', error);
            await registrar('ENC. AUTO.', 0, 0, `Error: ${error.message}`, '', '').catch(console.error);
        }
    })();

    // Responder INMEDIATAMENTE sin esperar
    return new Response(JSON.stringify({ 
        ok: true, 
        mensaje: 'Encendido iniciado',
        timestamp: new Date().toISOString()
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
