import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL y SUPABASE_KEY deben estar configurados en las variables de entorno');
    process.exit(1);
}

console.log('🔌 Conectando a Supabase...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarConexion() {
    try {
        console.log('\n🔍 Verificando conexión a Supabase...');
        
        // Intenta hacer una consulta simple
        const { data, error } = await supabase
            .from('registros')
            .select('count')
            .limit(1);
        
        if (error) {
            if (error.message.includes('relation') && error.message.includes('does not exist')) {
                console.log('⚠️  La tabla "registros" no existe todavía.');
                console.log('\n📋 Por favor, ejecuta el siguiente SQL en Supabase SQL Editor:');
                console.log('👉 https://supabase.com/dashboard/project/hbzviibmcoehmykrvrjw/sql/new\n');
                
                const schemaPath = path.join(__dirname, 'schema.sql');
                const schema = fs.readFileSync(schemaPath, 'utf-8');
                console.log('------- COPIA Y PEGA ESTE SQL -------\n');
                console.log(schema);
                console.log('\n------- FIN DEL SQL -------\n');
                return false;
            } else {
                console.error('❌ Error al verificar la tabla:', error.message);
                return false;
            }
        }
        
        console.log('✅ Conexión exitosa a Supabase!');
        console.log('✅ La tabla "registros" existe y está lista para usar.');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        return false;
    }
}

// Ejecutar verificación
verificarConexion();
