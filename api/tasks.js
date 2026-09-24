import { pedirTasks } from "../src/controllers/kamatera.js";
import { pedirRegistro } from "../src/tareas/registro.js";
import { getSession, tieneToken } from "../src/auth.js";
import { soloMetodo } from "../src/util.js";

/* GET /api/tasks?limit=50  -> { tasks, registro, hayMas, error? }  (público)
   La cola de Kamatera y el registro se piden en paralelo; si una falla,
   la otra se devuelve igual. */
export default async function handler(req, res) {
    if (!soloMetodo(req, res, 'GET')) return;

    const limit = Math.min(500, Math.max(10, Number(req.query?.limit) || 50));

    const [tasks, registro] = await Promise.allSettled([
        pedirTasks(),
        pedirRegistro(limit + 1),
    ]);

    if (tasks.status === 'rejected') console.error('Error en /api/tasks (cola):', tasks.reason?.message);

    // Público: fecha, acción, quién y resultado. IP y domicilio solo con la configuración desbloqueada.
    const completo = !!getSession(req)?.cfg || tieneToken(req);
    const publico = ({ id, fecha, evento, res: resultado, nombre }) => ({ id, fecha, evento, res: resultado, nombre });
    const crudas = registro.status === 'fulfilled' ? registro.value : [];
    const filas = completo ? crudas : crudas.map(publico);
    res.status(200).json({
        tasks: tasks.status === 'fulfilled' ? tasks.value : [],
        registro: filas.slice(0, limit),
        hayMas: filas.length > limit,
        error: tasks.status === 'rejected' ? 'No se pudo leer la cola de tareas de Kamatera.' : null,
    });
}
