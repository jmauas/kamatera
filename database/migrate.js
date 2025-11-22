import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL y SUPABASE_KEY deben estar configurados en las variables de entorno');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrarDatos() {
    try {
        console.log('Iniciando migración de datos...');
        
        // Leer el archivo registro.json
        const registroPath = path.join(__dirname, '..', 'registro.json');
        const registrosRaw = fs.readFileSync(registroPath, 'utf-8');
        const registros = JSON.parse(registrosRaw);
        
        console.log(`Total de registros a migrar: ${registros.length}`);
        
        // Procesar los registros en lotes para evitar timeouts
        const batchSize = 100;
        let migrados = 0;
        let errores = 0;
        
        for (let i = 0; i < registros.length; i += batchSize) {
            const batch = registros.slice(i, i + batchSize);
            
            // Transformar los datos al formato de la base de datos
            const registrosTransformados = batch.map(registro => ({
                fecha: registro.fecha,
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
            }));
            
            // Insertar el lote en Supabase
            const { data, error } = await supabase
                .from('registros')
                .insert(registrosTransformados);
            
            if (error) {
                console.error(`Error en lote ${Math.floor(i / batchSize) + 1}:`, error);
                errores += batch.length;
            } else {
                migrados += batch.length;
                console.log(`Lote ${Math.floor(i / batchSize) + 1} completado. Migrados: ${migrados}/${registros.length}`);
            }
        }
        
        console.log('\n=== Resumen de migración ===');
        console.log(`Total de registros: ${registros.length}`);
        console.log(`Migrados exitosamente: ${migrados}`);
        console.log(`Errores: ${errores}`);
        
        if (migrados === registros.length) {
            console.log('\n✅ Migración completada exitosamente');
            
            // Crear backup del archivo original
            const backupPath = path.join(__dirname, '..', 'registro.json.backup');
            fs.copyFileSync(registroPath, backupPath);
            console.log(`\n📦 Backup creado en: ${backupPath}`);
        } else {
            console.log('\n⚠️ Migración completada con errores');
        }
        
    } catch (error) {
        console.error('Error durante la migración:', error);
        process.exit(1);
    }
}

// Ejecutar migración
migrarDatos();
