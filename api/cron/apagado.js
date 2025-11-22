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
            
            // Modificar CPU (apagar)
            await fetch(`${url}/server/${process.env.SERVER_ID}/cpu`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authentication}`
                },
                body: JSON.stringify({ cpu: cpuValue })
            });
            
            // Registrar éxito
            await registrar('APAG. AUTO.', 0, 0, 'OK', '', '').catch(console.error);
        } catch (error) {
            console.error('Error en cron apagado:', error);
            await registrar('APAG. AUTO.', 0, 0, `Error: ${error.message}`, '', '').catch(console.error);
        }
    })();

    // Responder INMEDIATAMENTE sin esperar
    return new Response(JSON.stringify({ 
        ok: true, 
        mensaje: `Apagado iniciado (${procesadores} CPU)`,
        timestamp: new Date().toISOString()
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
