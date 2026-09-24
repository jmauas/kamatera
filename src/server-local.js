/* Servidor de desarrollo local: monta los mismos handlers de /api que corren en Vercel,
   así el panel se prueba igual que en producción. No agenda tareas: el encendido y
   apagado automáticos los dispara cron-job.org (ver CRON_SETUP.md). */

import { config } from 'dotenv';
import express from 'express';
import { join } from 'node:path';

config();

const root = process.cwd();
const app = express();

app.disable('x-powered-by');
app.use(express.json());
app.use(express.static(join(root, 'public')));

const rutas = {
    '/api/session': 'session.js',
    '/api/status': 'status.js',
    '/api/tasks': 'tasks.js',
    '/api/power': 'power.js',
    '/api/modificar': 'modificar.js',
    '/api/apagado-completo': 'apagado-completo.js',
    '/api/crons': 'crons.js',
    '/api/cron/encendido': 'cron/encendido.js',
    '/api/cron/apagado': 'cron/apagado.js',
};

for (const [ruta, archivo] of Object.entries(rutas)) {
    const { default: handler } = await import(`../api/${archivo}`);
    app.all(ruta, (req, res) => handler(req, res));
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor local en http://localhost:${port}`);
});
