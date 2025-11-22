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

    const url = 'https://console.kamatera.com/service';
    
    try {
        // Iniciar autenticación
        const authPromise = fetch(`${url}/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId: process.env.CLIENT_ID,
                secret: process.env.API_SECRET
            })
        }).then(res => res.json()).then(async ({ authentication }) => {
            // Encender servidor
            const powerRes = await fetch(`${url}/server/${process.env.SERVER_ID}/power`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authentication}`
                },
                body: JSON.stringify({ power: 'on' })
            });
            const powerData = await powerRes.json();
            
            // Registrar resultado
            if (powerData.errors) {
                await registrar('ENC. AUTO.', 0, 0, powerData.errors[0].info, '', '').catch(console.error);
            } else {
                await registrar('ENC. AUTO.', 0, 0, 'OK', '', '').catch(console.error);
            }
        }).catch(async (error) => {
            console.error('Error en cron encendido:', error);
            await registrar('ENC. AUTO.', 0, 0, `Error: ${error.message}`, '', '').catch(console.error);
        });

        // Esperar 2 segundos para asegurar que la operación se inicie
        await Promise.race([
            authPromise,
            new Promise(resolve => setTimeout(resolve, 2000))
        ]);

    } catch (error) {
        console.error('Error iniciando operación:', error);
    }

    // Responder después de iniciar la operación
    return new Response(JSON.stringify({ 
        ok: true, 
        mensaje: 'Encendido iniciado',
        timestamp: new Date().toISOString()
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
