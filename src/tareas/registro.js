import { insertarRegistro, obtenerRegistros } from '../db/supabase.js';
import { pedirDir } from '../controllers/localizacion.js';

export const registrar = async (evento, lat, long, res, nombre, ip) => {
    try {
        const domi = await pedirDir(lat, long, ip);
        const data = {
            evento,
            res,
            nombre,
            ip,
            ...domi
        };
        
        await insertarRegistro(data);
        console.log('Registro guardado en Supabase:', evento);
    } catch (error) {
        console.error('Error al registrar en Supabase:', error);
        throw error;
    }
}

export const pedirRegistro = async () => {
    try {
        const registros = await obtenerRegistros(200);
        return registros;
    } catch (error) {
        console.error('Error al obtener registros de Supabase:', error);
        return [];
    }
}