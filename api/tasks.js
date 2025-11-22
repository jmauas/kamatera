import { pedirTasks } from "../src/controllers/kamatera.js";
import { pedirRegistro } from "../src/tareas/registro.js";

export default async function handler(req, res) {
    try {
        const tasks = await pedirTasks();
        const registro = await pedirRegistro();  
        res.status(200).json({ tasks, registro });
    } catch (error) {
        console.error('Error en /api/tasks:', error);
        res.status(500).json({ error: error.message });
    }
}
