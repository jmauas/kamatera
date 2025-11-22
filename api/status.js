import { statusServer } from "../src/controllers/kamatera.js";

export default async function handler(req, res) {
    try {
        const status = await statusServer(); 
        res.status(200).json(status);
    } catch (error) {
        console.error('Error en /api/status:', error);
        res.status(500).json({ error: error.message });
    }
}
