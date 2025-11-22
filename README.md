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

Variables necesarias:
- `SUPABASE_URL`: URL de tu proyecto Supabase
- `SUPABASE_KEY`: Clave anónima de Supabase
- `TOKEN`: Token de seguridad para la API
- `KAMATERA_API_KEY`: API Key de Kamatera
- `KAMATERA_SECRET`: Secret de Kamatera

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
│       ├── agendar.js      # Tareas programadas
│       └── registro.js     # Registro de eventos
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── vercel.json
```

## API Endpoints

- `GET /` - Interfaz web
- `GET /status` - Estado del servidor
- `GET /tasks` - Tareas y registros
- `GET /power?tipo={on|off|restart}&nombre=X&ip=X&lat=X&long=X` - Control de energía
- `GET /modificar?tipo={procesador|ram}&valor=X&nombre=X&ip=X` - Modificar recursos

## Seguridad

Todos los endpoints requieren el header `token` con el valor configurado en las variables de entorno.

## Licencia

ISC
