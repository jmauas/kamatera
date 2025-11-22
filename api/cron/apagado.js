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

    const url = new URL(request.url);
    const procesadores = url.searchParams.get('cpu') || '8';
    
    // Responder inmediatamente y ejecutar en background
    setImmediate(async () => {
        try {
            const res = await modificar('procesador', procesadores + 'T');
            
            if (res.errors) {
                await registrar('APAG. AUTO.', 0, 0, res.errors[0].info, '', '').catch(err => 
                    console.error('Error al registrar:', err)
                );
            } else {
                await registrar('APAG. AUTO.', 0, 0, 'OK', '', '').catch(err => 
                    console.error('Error al registrar:', err)
                );
            }
        } catch (error) {
            console.error('Error en cron apagado:', error);
            await registrar('APAG. AUTO.', 0, 0, `Error: ${error.message}`, '', '').catch(err => 
                console.error('Error al registrar:', err)
            );
        }
    });

    return new Response(JSON.stringify({ 
        ok: true, 
        mensaje: `Apagado iniciado (${procesadores} CPU)`,
        timestamp: new Date().toISOString()
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
