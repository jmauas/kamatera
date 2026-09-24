import { statusServer } from "../src/controllers/kamatera.js";
import { soloMetodo } from "../src/util.js";

export default async function handler(req, res) {
    if (!soloMetodo(req, res, 'GET')) return;

    try {
        res.status(200).json(await statusServer());
    } catch (error) {
        console.error('Error en /api/status:', error.message);
        res.status(500).json({ error: error.message });
    }
}
