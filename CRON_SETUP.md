# Configuración de Cron Jobs con cron-job.org
https://console.cron-job.org/dashboard
Este documento describe cómo configurar las tareas programadas usando cron-job.org (gratis e ilimitado).

## 📋 Prerequisitos

1. Despliega tu aplicación en Vercel
2. Obtén la URL de producción (ej: `https://kamatera.vercel.app`)
3. Token: `<TU_TOKEN>`

## 🔧 Configuración en cron-job.org

### 1. Registrarse en cron-job.org

Ve a https://cron-job.org/en/signup/ y crea una cuenta gratuita.

### 2. Crear los Cron Jobs

Después de iniciar sesión, ve a **"Cronjobs"** → **"Create cronjob"** y configura cada uno de los siguientes:

---

#### 📅 **Job 1: Encendido Lun-Vie 9:00 AM**

- **Title:** `Encendido Servidor Lun-Vie`
- **Address:** `https://kamatera.vercel.app/api/cron/encendido`
- **Schedule (cron):** `0 9 * * 1-5`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

#### 📅 **Job 2: Apagado Lun-Jue 11:00 PM (Primera fase - 8 CPU)**

- **Title:** `Apagado Lun-Jue 11:00 PM - Fase 1`
- **Address:** `https://kamatera.vercel.app/api/cron/apagado?cpu=8`
- **Schedule (cron):** `0 23 * * 1-4`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

#### 📅 **Job 3: Apagado Lun-Jue 11:59 PM (Segunda fase)**

- **Title:** `Apagado Lun-Jue 11:59 PM - Fase 2`
- **Address:** `https://kamatera.vercel.app/api/cron/apagado?cpu=8`
- **Schedule (cron):** `59 23 * * 1-4`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

#### 📅 **Job 4: Apagado Viernes 11:00 PM (Primera fase - 4 CPU)**

- **Title:** `Apagado Viernes 11:00 PM - Fase 1`
- **Address:** `https://kamatera.vercel.app/api/cron/apagado?cpu=4`
- **Schedule (cron):** `0 23 * * 5`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

#### 📅 **Job 5: Apagado Viernes 11:59 PM (Segunda fase)**

- **Title:** `Apagado Viernes 11:59 PM - Fase 2`
- **Address:** `https://kamatera.vercel.app/api/cron/apagado?cpu=4`
- **Schedule (cron):** `59 23 * * 5`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

#### 📅 **Job 6: Encendido Sábado 10:00 AM**

- **Title:** `Encendido Servidor Sábado`
- **Address:** `https://kamatera.vercel.app/api/cron/encendido`
- **Schedule (cron):** `0 10 * * 6`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

#### 📅 **Job 7: Apagado Sábado 8:30 PM (Primera fase - 4 CPU)**

- **Title:** `Apagado Sábado 8:30 PM - Fase 1`
- **Address:** `https://kamatera.vercel.app/api/cron/apagado?cpu=4`
- **Schedule (cron):** `30 20 * * 6`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

#### 📅 **Job 8: Apagado Sábado 11:00 PM (Segunda fase)**

- **Title:** `Apagado Sábado 11:00 PM - Fase 2`
- **Address:** `https://kamatera.vercel.app/api/cron/apagado?cpu=4`
- **Schedule (cron):** `0 23 * * 6`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

#### 📅 **Job 9: Apagado Sábado 11:59 PM (Tercera fase)**

- **Title:** `Apagado Sábado 11:59 PM - Fase 3`
- **Address:** `https://kamatera.vercel.app/api/cron/apagado?cpu=4`
- **Schedule (cron):** `59 23 * * 6`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

#### 📅 **Job 10: Apagado Domingo 8:00 PM (Primera fase - 8 CPU)**

- **Title:** `Apagado Domingo 8:00 PM - Fase 1`
- **Address:** `https://kamatera.vercel.app/api/cron/apagado?cpu=8`
- **Schedule (cron):** `0 20 * * 0`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

#### 📅 **Job 11: Apagado Domingo 11:00 PM (Segunda fase)**

- **Title:** `Apagado Domingo 11:00 PM - Fase 2`
- **Address:** `https://kamatera.vercel.app/api/cron/apagado?cpu=8`
- **Schedule (cron):** `0 23 * * 0`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

#### 📅 **Job 12: Apagado Domingo 11:59 PM (Tercera fase)**

- **Title:** `Apagado Domingo 11:59 PM - Fase 2`
- **Address:** `https://kamatera.vercel.app/api/cron/apagado?cpu=8`
- **Schedule (cron):** `59 23 * * 0`
- **Request settings:**
  - Request method: `GET`
  - Custom request headers:
    ```
    token: <TU_TOKEN>
    ```
- **Timezone:** `America/Argentina/Buenos_Aires`

---

## ✅ Verificación

Después de configurar todos los cron jobs:

1. Ve a la sección **"Cronjobs"** en cron-job.org
2. Deberías ver los 12 jobs listados
3. Puedes ejecutar un test manual usando el botón **"Run"** junto a cada job
4. Verifica en tu aplicación que el registro se creó correctamente

## 🔐 Seguridad

- Los endpoints están protegidos con el header `token`
- Solo las peticiones con el token correcto serán procesadas
- cron-job.org enviará el header en cada petición automática

## 📊 Monitoreo

En cron-job.org puedes:
- Ver el historial de ejecuciones
- Ver logs de cada ejecución
- Recibir notificaciones si un job falla
- Ver estadísticas de éxito/error

## 🎯 Resumen de Horarios (Hora Argentina)

| Día | Hora | Acción |
|-----|------|--------|
| Lun-Vie | 09:00 | Encender servidor |
| Lun-Jue | 23:00-23:59 | Apagar (8 CPU) |
| Viernes | 23:00-23:59 | Apagar (4 CPU) |
| Sábado | 10:00 | Encender servidor |
| Sábado | 20:30 | Apagar (4 CPU) |
| Sábado | 23:00-23:59 | Apagar (4 CPU) |
| Domingo | 20:00 | Apagar (8 CPU) |
| Domingo | 23:00-23:59 | Apagar (8 CPU) |
