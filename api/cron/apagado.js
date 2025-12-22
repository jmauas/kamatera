import { registrar } from "../../src/tareas/registro.js";

// Función auxiliar para verificar el token de seguridad
const verificarToken = (req) => {
    const token = req.headers?.token || req.headers?.get?.('token') || req.query?.token;
    return token === process.env.TOKEN;
};

// Endpoint para apagar el servidor
export default async function handler(req, res) {
    if (!verificarToken(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // const procesadores = req.query.cpu || '8';
    // const cpuValue = procesadores + 'T';
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
            let cpuModificado = false;
            let errorCpu = null;
            
            console.log(authentication);
            // console.log(`Iniciando proceso de apagado con CPU: ${cpuValue}`);
            // // Modificar CPU (reducir recursos)
            // try {
            //     const cpuRes = await fetch(`${url}/server/${process.env.SERVER_ID}/cpu`, {
            //         method: 'PUT',
            //         headers: {
            //             'Content-Type': 'application/json',
            //             'Authorization': `Bearer ${authentication}`
            //         },
            //         body: JSON.stringify({ cpu: cpuValue })
            //     });
            //     const cpuData = await cpuRes.json();
            //     console.log(cpuData);

            //     if (cpuData.errors) {
            //         errorCpu = cpuData.errors[0].info;
            //     } else {
            //         cpuModificado = true;
            //     }
            // } catch (error) {
            //     errorCpu = error.message;
            // }
            
            // console.log(`Inicio espera 2 minutos antes de apagar...`);
            // // Esperar 2 minutos antes de enviar el apagado
            // await new Promise(resolve => setTimeout(resolve, 120000));
            
            console.log(`Enviando comando de apagado...`);
            // SIEMPRE ejecutar apagado, independientemente del resultado de CPU
            try {
                const powerRes = await fetch(`${url}/server/${process.env.SERVER_ID}/power`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authentication}`
                    },
                    body: JSON.stringify({ power: 'off' })
                });
                const powerData = await powerRes.json();
                
                console.log(powerData);

                // Registrar resultado final
                if (powerData.errors) {
                    await registrar('APAG. AUTO.', 0, 0, `CPU: ${errorCpu || 'OK'}, Power: ${powerData.errors[0].info}`, '', '').catch(console.error);
                } else {
                    await registrar('APAG. AUTO.', 0, 0, `CPU: ${errorCpu || 'OK'}, Power: OK`, '', '').catch(console.error);
                }
            } catch (powerError) {
                await registrar('APAG. AUTO.', 0, 0, `CPU: ${errorCpu || 'OK'}, Power Error: ${powerError.message}`, '', '').catch(console.error);
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
    return res.status(200).json({ 
        ok: true, 
        mensaje: `Apagado iniciado (${procesadores} CPU)`,
        timestamp: new Date().toISOString()
    });
}
