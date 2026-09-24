# Kamatera Server Management

Sistema de gestión y monitoreo de servidor Kamatera con integración de Supabase y despliegue en Vercel.

## Características

- 🚀 Gestión de servidor Kamatera (encendido, apagado, reinicio)
- 📊 Monitoreo de eventos con geolocalización
- ⏰ Tareas programadas automáticas con node-cron
- 🗄️ Persistencia en PostgreSQL con Supabase
- ☁️ Desplegable en Vercel

## Instalación

1. Clonar el repositorio:
```bash
git clone <url-del-repositorio>
cd kamatera2
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
Copiar `.env.example` a `.env` y configurar las variables:
```bash
cp .env.example .env
```

Variables necesarias (ver `.env.example`):
- `CLIENT_ID`, `API_SECRET`, `SERVER_ID`: credenciales y servidor de Kamatera
- `GEOCODE_KEY`: geolocalización por IP (positionstack)
- `CONFIG_PASSWORD`: contraseña que protege la Configuración (CPU/RAM/disco). El resto del panel es público
- `SESSION_SECRET`: firma de la cookie de sesión (mínimo 16 caracteres, aleatorio)
- `TOKEN`: token de servicio, **solo** para cron-job.org y pruebas (header `token`); no va en el frontend
- `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` (clave service_role, solo servidor; `SUPABASE_KEY` queda como respaldo)

## Migración de Datos

### 1. Crear la base de datos en Supabase

1. Ir a [Supabase](https://supabase.com) y crear un nuevo proyecto
2. En el SQL Editor, ejecutar el contenido de `database/schema.sql`

### 2. Ejecutar la migración

```bash
npm run migrate
```

Este comando migrará todos los datos de `registro.json` a Supabase.

## Desarrollo

```bash
npm run dev
```

El servidor se iniciará en `http://localhost:3000`

## Despliegue en Vercel

### 1. Instalar Vercel CLI (opcional)

```bash
npm i -g vercel
```

### 2. Configurar variables de entorno en Vercel

En el panel de Vercel, agregar las siguientes variables:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `TOKEN`
- `CLIENT_ID`
- `API_SECRET`
- `SERVER_ID`
- `GEOCODE_KEY`

### 3. Desplegar

```bash
vercel
```

O conectar el repositorio de GitHub con Vercel para despliegue automático.

### 4. Configurar Cron Jobs

Este proyecto usa **cron-job.org** (gratis, ilimitado) para ejecutar tareas programadas.

📋 **Ver guía completa**: [CRON_SETUP.md](CRON_SETUP.md)

**Resumen rápido**:
1. Regístrate en https://cron-job.org
2. Crea 12 cron jobs apuntando a tus endpoints `/api/cron/encendido` y `/api/cron/apagado`
3. Configura el header `token` con tu TOKEN en cada job
4. Selecciona timezone: `America/Argentina/Buenos_Aires`

Los horarios ya están documentados en el archivo CRON_SETUP.md con instrucciones paso a paso.

## Estructura del Proyecto

```
kamatera2/
├── database/
│   ├── schema.sql          # Esquema de base de datos
│   └── migrate.js          # Script de migración
├── public/
│   ├── index.html
│   ├── index.js
│   └── sa.js
├── src/
│   ├── server.js           # Servidor Express
│   ├── controllers/
│   │   ├── kamatera.js     # Lógica de Kamatera
│   │   └── localizacion.js # Geolocalización
│   ├── db/
│   │   └── supabase.js     # Cliente y funciones de Supabase
│   └── tareas/
│       └── registro.js     # Registro de eventos
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── vercel.json
```

## API Endpoints

Todos bajo `/api`:

- Públicos: `GET /api/status`, `GET /api/tasks?limit=50`, `POST /api/power {tipo: on|off|restart, nombre}` y `POST /api/apagado-completo {paso: cpu|power, ...}` (apagado en dos pasos: Vercel corta a los 60 s). Las acciones exigen `nombre` y quedan registradas con la IP que ve el servidor.
- `GET /api/session` · `POST /api/session {password}` · `DELETE /api/session` - estado, desbloqueo y bloqueo de la Configuración (cookie firmada `HttpOnly`)
- `POST /api/modificar {tipo: procesador|ram|disco, valor, nombre}` - requiere la Configuración desbloqueada
- `GET /api/cron/encendido` y `GET /api/cron/apagado?cpu=8&final=1` - solo con header `token` (el apagado funciona por fases; ver CRON_SETUP.md)

## Seguridad

- Solo la Configuración pide contraseña; se valida en el servidor y la sesión es una cookie firmada `HttpOnly`. El navegador nunca conoce el `TOKEN`.
- El registro público muestra fecha, acción, nombre y resultado; la IP y el domicilio solo aparecen con la Configuración desbloqueada.
- El `TOKEN` solo se acepta por header, nunca por query string.
- Todo valor de CPU/RAM/disco se valida contra listas permitidas, y el disco no se puede reducir.
- Para cerrar el acceso anónimo a la tabla `registros` en Supabase, ejecutá `database/enable-rls.sql` **después** de configurar `SUPABASE_SERVICE_KEY`.

## Pruebas

```bash
npm test
```

## Licencia

ISC
