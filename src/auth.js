/* Autenticación.
   - El panel es público; solo la Configuración (CPU/RAM/disco) pide contraseña,
     validada en el servidor -> cookie de sesión firmada (HttpOnly).
   - Crons y pruebas: header `token` con el valor de TOKEN (nunca por query string).
   Variables: CONFIG_PASSWORD, SESSION_SECRET, TOKEN. */

import crypto from 'node:crypto';

const COOKIE = 'kmt_session';
const TTL_SEG = 12 * 60 * 60;

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest();

/** Comparación en tiempo constante. */
export const iguales = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

const secreto = () => {
    const s = process.env.SESSION_SECRET;
    if (!s || s.length < 16) {
        const err = new Error('Falta configurar SESSION_SECRET (mínimo 16 caracteres).');
        err.status = 500;
        throw err;
    }
    return s;
};

const firmar = (data) => crypto.createHmac('sha256', secreto()).update(data).digest('base64url');

const crearCookie = (session) => {
    const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
    return `${payload}.${firmar(payload)}`;
};

const leerCookie = (req) => {
    const raw = req.headers?.cookie || '';
    const par = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
    return par ? decodeURIComponent(par.slice(COOKIE.length + 1)) : '';
};

/** Devuelve { exp, cfg } si hay una sesión válida, o null. */
export const getSession = (req) => {
    try {
        const [payload, firma] = leerCookie(req).split('.');
        if (!payload || !firma || !iguales(firma, firmar(payload))) return null;
        const s = JSON.parse(Buffer.from(payload, 'base64url').toString());
        return s.exp > Date.now() / 1000 ? { exp: s.exp, cfg: !!s.cfg } : null;
    } catch {
        return null;
    }
};

const flagsCookie = (req) => {
    const https = req.headers?.['x-forwarded-proto'] === 'https' || process.env.VERCEL === '1';
    return `Path=/; HttpOnly; SameSite=Strict${https ? '; Secure' : ''}`;
};

export const abrirSesion = (req, res, { cfg = false, exp } = {}) => {
    const expira = exp || Math.floor(Date.now() / 1000) + TTL_SEG;
    const valor = crearCookie({ exp: expira, cfg });
    const resto = Math.max(1, expira - Math.floor(Date.now() / 1000));
    res.setHeader('Set-Cookie', `${COOKIE}=${valor}; Max-Age=${resto}; ${flagsCookie(req)}`);
};

export const cerrarSesion = (req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; ${flagsCookie(req)}`);
};

/** ¿Trae el token de servicio (crons / pruebas) en el header? */
export const tieneToken = (req) => {
    const esperado = process.env.TOKEN;
    const recibido = req.headers?.token;
    return !!esperado && typeof recibido === 'string' && iguales(recibido, esperado);
};

/* Única contraseña: protege la Configuración. PANEL_PASSWORD se acepta como nombre alternativo. */
export const passwordConfig = () => process.env.CONFIG_PASSWORD || process.env.PANEL_PASSWORD || '';

/** Exige autenticación. Responde 401/403 y devuelve false si no corresponde seguir.
    opciones: { config: true } -> además exige el desbloqueo de configuración;
              { soloToken: true } -> solo el header token (crons). */
export const requireAuth = (req, res, { config = false, soloToken = false } = {}) => {
    if (tieneToken(req)) return true;
    if (!soloToken) {
        const s = getSession(req);
        if (s && (!config || s.cfg)) return true;
        if (s && config) {
            res.status(403).json({ error: 'Necesitás desbloquear la configuración.', needsConfig: true });
            return false;
        }
    }
    res.status(401).json({ error: 'No autorizado.' });
    return false;
};
