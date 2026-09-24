import { insertarRegistro, obtenerRegistros } from '../db/supabase.js';
import { pedirDir } from '../controllers/localizacion.js';
import { limpiarTexto, numeroEnRango } from '../util.js';

/* Guarda un evento en el registro. Nunca lanza: un fallo al registrar
   no debe convertir en error una operación que sí se ejecutó. */
export const registrar = async (evento, lat, long, res, nombre, ip) => {
    try {
        const ipLimpia = limpiarTexto(ip, 45);
        const domi = await pedirDir(ipLimpia);
        await insertarRegistro({
            evento: limpiarTexto(evento, 100),
            res: limpiarTexto(res, 500),
            nombre: limpiarTexto(nombre, 60),
            ip: ipLimpia,
            ...domi,
            latitude: numeroEnRango(lat, -90, 90) || null,
            longitude: numeroEnRango(long, -180, 180) || null,
        });
    } catch (error) {
        console.error('Error al registrar en Supabase:', error.message);
    }
}

export const pedirRegistro = async (limit = 50) => {
    try {
        return await obtenerRegistros(limit);
    } catch (error) {
        console.error('Error al obtener registros de Supabase:', error.message);
        return [];
    }
}
