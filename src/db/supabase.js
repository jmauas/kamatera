import { createClient } from '@supabase/supabase-js';

// Inicializar cliente de Supabase de forma lazy
let supabaseInstance = null;

function getSupabaseClient() {
    if (!supabaseInstance) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Error: SUPABASE_URL y SUPABASE_KEY no están configurados en las variables de entorno');
        }

        supabaseInstance = createClient(supabaseUrl, supabaseKey);
    }
    return supabaseInstance;
}

export const supabase = new Proxy({}, {
    get(target, prop) {
        return getSupabaseClient()[prop];
    }
});

/**
 * Inserta un nuevo registro en la base de datos
 * @param {Object} registro - Objeto con los datos del registro
 * @returns {Promise<Object>} - Resultado de la inserción
 */
export async function insertarRegistro(registro) {
    const { data, error } = await supabase
        .from('registros')
        .insert([{
            fecha: new Date().toISOString(),
            evento: registro.evento,
            res: registro.res,
            nombre: registro.nombre || null,
            ip: registro.ip || null,
            latitude: registro.latitude || null,
            longitude: registro.longitude || null,
            type: registro.type || null,
            distance: registro.distance || null,
            name: registro.name || null,
            number: registro.number || null,
            postal_code: registro.postal_code || null,
            street: registro.street || null,
            confidence: registro.confidence || null,
            region: registro.region || null,
            region_code: registro.region_code || null,
            county: registro.county || null,
            locality: registro.locality || null,
            administrative_area: registro.administrative_area || null,
            neighbourhood: registro.neighbourhood || null,
            country: registro.country || null,
            country_code: registro.country_code || null,
            continent: registro.continent || null,
            label: registro.label || null,
            country_module: registro.country_module || null,
            map_url: registro.map_url || null
        }])
        .select();

    if (error) {
        console.error('Error al insertar registro:', error);
        throw error;
    }

    return data;
}

/**
 * Obtiene todos los registros ordenados por fecha descendente
 * @param {number} limit - Número máximo de registros a obtener
 * @returns {Promise<Array>} - Array de registros
 */
export async function obtenerRegistros(limit = 100) {
    const { data, error } = await supabase
        .from('registros')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error al obtener registros:', error);
        throw error;
    }

    return data;
}

/**
 * Obtiene registros filtrados por evento
 * @param {string} evento - Tipo de evento a filtrar
 * @param {number} limit - Número máximo de registros a obtener
 * @returns {Promise<Array>} - Array de registros
 */
export async function obtenerRegistrosPorEvento(evento, limit = 100) {
    const { data, error } = await supabase
        .from('registros')
        .select('*')
        .eq('evento', evento)
        .order('fecha', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error al obtener registros por evento:', error);
        throw error;
    }

    return data;
}

/**
 * Obtiene registros filtrados por nombre de usuario
 * @param {string} nombre - Nombre del usuario
 * @param {number} limit - Número máximo de registros a obtener
 * @returns {Promise<Array>} - Array de registros
 */
export async function obtenerRegistrosPorUsuario(nombre, limit = 100) {
    const { data, error } = await supabase
        .from('registros')
        .select('*')
        .eq('nombre', nombre)
        .order('fecha', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error al obtener registros por usuario:', error);
        throw error;
    }

    return data;
}
