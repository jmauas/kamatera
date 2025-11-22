-- Esquema de base de datos para Supabase
-- Tabla principal de registros de eventos del servidor

CREATE TABLE IF NOT EXISTS registros (
    id SERIAL PRIMARY KEY,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL,
    evento VARCHAR(100) NOT NULL,
    res TEXT NOT NULL,
    nombre VARCHAR(100),
    ip VARCHAR(45),
    
    -- Campos de geolocalización
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    type VARCHAR(50),
    distance DECIMAL(10, 3),
    name VARCHAR(255),
    number VARCHAR(50),
    postal_code VARCHAR(20),
    street VARCHAR(255),
    confidence DECIMAL(3, 2),
    region VARCHAR(100),
    region_code VARCHAR(10),
    county VARCHAR(100),
    locality VARCHAR(100),
    administrative_area VARCHAR(100),
    neighbourhood VARCHAR(100),
    country VARCHAR(100),
    country_code VARCHAR(10),
    continent VARCHAR(50),
    label TEXT,
    
    -- Información adicional de país (puede ser NULL)
    country_module JSONB,
    map_url TEXT,
    
    -- Índices para búsquedas frecuentes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento de las consultas
CREATE INDEX idx_registros_fecha ON registros(fecha DESC);
CREATE INDEX idx_registros_evento ON registros(evento);
CREATE INDEX idx_registros_nombre ON registros(nombre);
CREATE INDEX idx_registros_ip ON registros(ip);
CREATE INDEX idx_registros_country ON registros(country);
CREATE INDEX idx_registros_created_at ON registros(created_at DESC);

-- Comentarios en la tabla
COMMENT ON TABLE registros IS 'Registro de eventos del servidor Kamatera con información de geolocalización';
COMMENT ON COLUMN registros.fecha IS 'Fecha y hora del evento';
COMMENT ON COLUMN registros.evento IS 'Tipo de evento (on, off, restart, ENC. AUTO., APAG. AUTO., etc.)';
COMMENT ON COLUMN registros.res IS 'Resultado de la operación';
COMMENT ON COLUMN registros.nombre IS 'Nombre del usuario que realizó la acción';
COMMENT ON COLUMN registros.ip IS 'Dirección IP del cliente';
COMMENT ON COLUMN registros.country_module IS 'Información adicional del país en formato JSON';
