import { getSession, abrirSesion, cerrarSesion, iguales, passwordConfig } from "../src/auth.js";
import { bodyDe } from "../src/util.js";

/* La contraseña protege solo la Configuración (CPU / RAM / disco); el resto del panel es público.
   GET    /api/session               -> { cfg }   ¿está desbloqueada la configuración?
   POST   /api/session { password }  -> desbloquea la configuración
   DELETE /api/session               -> la vuelve a bloquear */

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            return res.status(200).json({ cfg: !!getSession(req)?.cfg });
        }

        if (req.method === 'DELETE') {
            cerrarSesion(req, res);
            return res.status(200).json({ cfg: false });
        }

        if (req.method === 'POST') {
            const { password } = bodyDe(req);
            const esperada = passwordConfig();
            if (!esperada) {
                return res.status(500).json({ error: 'Falta configurar CONFIG_PASSWORD en el servidor.' });
            }
            if (typeof password !== 'string' || !iguales(password, esperada)) {
                await pausa(800); // frena la fuerza bruta
                return res.status(401).json({ error: 'Contraseña incorrecta.' });
            }
            abrirSesion(req, res, { cfg: true });
            return res.status(200).json({ cfg: true });
        }

        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: 'Método no permitido.' });
    } catch (error) {
        console.error('Error en /api/session:', error.message);
        res.status(error.status || 500).json({ error: error.message });
    }
}
