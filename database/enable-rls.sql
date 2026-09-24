-- Activa Row Level Security en la tabla de registros.
-- Sin políticas, solo la clave service_role (que usa el servidor) puede leer y escribir;
-- la clave anónima queda sin acceso.
--
-- IMPORTANTE: ejecutalo DESPUÉS de definir SUPABASE_SERVICE_KEY en Vercel y en .env,
-- porque si no, el servidor (que usaría la clave anónima) deja de poder leer/escribir.

ALTER TABLE registros ENABLE ROW LEVEL SECURITY;
