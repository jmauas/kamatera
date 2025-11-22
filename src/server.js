import { config } from 'dotenv';
import serverless from 'serverless-http';
import cors from 'cors';
import express from 'express';
import { join } from 'path';
const root = process.cwd();
import { statusServer, pedirTasks, pwr, modificar } from "./controllers/kamatera.js";
import { agendar } from "./tareas/agendar.js";
import { registrar, pedirRegistro } from "./tareas/registro.js";


export const iniciar = async () => {
    config();

    const app = express();
    const port = 3000;
    app.use(cors());
    app.use(express.json());
    app.use(express.static(join(root, 'public')));

    // Middleware para verificar token (excepto rutas públicas)
    const verificarToken = (req, res, next) => {
        const rutasPublicas = ['/', '/status'];
        if (rutasPublicas.includes(req.path)) {
            return next();
        }
        
        if (req.headers.token === process.env.TOKEN) {
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    };

    app.use(verificarToken);

    app.get('/', (req, res) => {
        res.sendFile(join(root, 'public', 'index.html'));
    });

    app.get('/status', async (req, res) => {
        const status = await statusServer(); 
        console.log(status);
        res.status(200).json(status);
    });

    app.get('/tasks', async (req, res) => {
        const tasks = await pedirTasks();
        const registro = await pedirRegistro();  
        res.status(200).json({tasks, registro});
    });

    app.get('/power', async (req, res) => {
        const tipo = req.query.tipo;
        const lat = req.query.lat;
        const long = req.query.long;
        const nombre = req.query.nombre;
        const ip = req.query.ip;
        const data = await pwr(tipo);
        if (data.errors) {
            await registrar(tipo, lat, long, data.errors[0].info, nombre, ip)
            res.status(200).json({ ok: false, mensaje: data.errors[0].info });
        } else {
            await registrar(tipo, lat, long, 'OK', nombre, ip)
            res.status(200).json({ ok: true});
        }
    });

    app.get('/modificar', async (req, res) => {
        const tipo = req.query.tipo;
        const valor = req.query.valor;
        const nombre = req.query.nombre;
        const ip = req.query.ip;
        const data = await modificar(tipo, valor);
        if (data.errors) {
            await registrar(`${tipo} a ${valor}`, 0, 0, data.errors[0].info, nombre, ip)
            res.status(200).json({ ok: false, mensaje: data.errors[0].info });
        } else {
            await registrar(`${tipo} a ${valor}`, 0, 0, 'OK', nombre, ip)
            res.status(200).json({ ok: true});
        }
    });

    agendar();

    app.listen(port, () => {
         console.log(`Servidor Express escuchando en http://localhost:${port}`);
    });

    //return serverless(app);
}

iniciar();