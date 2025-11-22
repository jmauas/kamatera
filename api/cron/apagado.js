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

    const urlParams = new URL(request.url);
    const procesadores = urlParams.searchParams.get('cpu') || '8';
    const cpuValue = procesadores + 'T';
    const url = 'https://console.kamatera.com/service';
    
    try {
        // Iniciar autenticación y operación
        const authPromise = fetch(`${url}/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId: process.env.CLIENT_ID,
                secret: process.env.API_SECRET
            })
        }).then(res => res.json()).then(async ({ authentication }) => {
            // Modificar CPU (apagar)
            const cpuRes = await fetch(`${url}/server/${process.env.SERVER_ID}/cpu`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authentication}`
                },
                body: JSON.stringify({ cpu: cpuValue })
            });
            const cpuData = await cpuRes.json();
            
            // Registrar resultado
            if (cpuData.errors) {
                await registrar('APAG. AUTO.', 0, 0, cpuData.errors[0].info, '', '').catch(console.error);
            } else {
                await registrar('APAG. AUTO.', 0, 0, 'OK', '', '').catch(console.error);
            }
        }).catch(async (error) => {
            console.error('Error en cron apagado:', error);
            await registrar('APAG. AUTO.', 0, 0, `Error: ${error.message}`, '', '').catch(console.error);
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
        mensaje: `Apagado iniciado (${procesadores} CPU)`,
        timestamp: new Date().toISOString()
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
