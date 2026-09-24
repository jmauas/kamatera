/* Helpers chicos compartidos por los endpoints. */

/** Texto de usuario: sin caracteres de control, recortado y con largo máximo. */
export const limpiarTexto = (v, max = 60) =>
    String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);

/** Número dentro de [min, max]; si no es válido devuelve 0. */
export const numeroEnRango = (v, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : 0;
};

/** IP del cliente según el servidor (no confiar en la que manda el navegador). */
export const clientIp = (req) => {
    const xf = req.headers?.['x-forwarded-for'];
    const first = (Array.isArray(xf) ? xf[0] : xf || '').split(',')[0].trim();
    const ip = first || req.socket?.remoteAddress || '';
    return ip.replace(/^::ffff:/, '').slice(0, 45);
};

/** Cuerpo JSON de la request (Vercel y express lo dejan en req.body). */
export const bodyDe = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

export const soloMetodo = (req, res, metodo) => {
    if (req.method === metodo) return true;
    res.setHeader('Allow', metodo);
    res.status(405).json({ error: 'Método no permitido.' });
    return false;
};
