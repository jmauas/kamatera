import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = 'un-secreto-de-prueba-largo';
process.env.TOKEN = 'token-de-prueba';

const { abrirSesion, getSession, tieneToken, requireAuth } = await import('../src/auth.js');

const respuesta = () => {
    const r = { headers: {}, statusCode: 200, body: null };
    r.setHeader = (k, v) => { r.headers[k] = v; };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
};

const cookieDe = (res) => res.headers['Set-Cookie'].split(';')[0];

test('una sesión firmada se puede leer y una alterada no', () => {
    const res = respuesta();
    abrirSesion({ headers: {} }, res, { cfg: true });
    const cookie = cookieDe(res);
    assert.deepEqual({ cfg: getSession({ headers: { cookie } }).cfg }, { cfg: true });

    const alterada = cookie.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
    assert.equal(getSession({ headers: { cookie: alterada } }), null);
    assert.equal(getSession({ headers: {} }), null);
});

test('el token solo vale por header, no por query', () => {
    assert.equal(tieneToken({ headers: { token: 'token-de-prueba' } }), true);
    assert.equal(tieneToken({ headers: { token: 'otro' } }), false);
    assert.equal(tieneToken({ headers: {}, query: { token: 'token-de-prueba' } }), false);
});

test('requireAuth: sin credenciales 401; sesión sin config en ruta de config 403', () => {
    let res = respuesta();
    assert.equal(requireAuth({ headers: {} }, res), false);
    assert.equal(res.statusCode, 401);

    const login = respuesta();
    abrirSesion({ headers: {} }, login, { cfg: false });
    const req = { headers: { cookie: cookieDe(login) } };
    assert.equal(requireAuth(req, respuesta()), true);

    res = respuesta();
    assert.equal(requireAuth(req, res, { config: true }), false);
    assert.equal(res.statusCode, 403);

    res = respuesta();
    assert.equal(requireAuth(req, res, { soloToken: true }), false);
    assert.equal(res.statusCode, 401);
});
