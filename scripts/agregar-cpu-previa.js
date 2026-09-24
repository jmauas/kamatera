/* Agrega, a cada cron de apagado, un cron que cambia la CPU del servidor unos minutos antes.
   Los crons de apagado NO se tocan. Es idempotente: si ya existe el de configuración, lo omite.

   Uso:
     node scripts/agregar-cpu-previa.js                       -> solo muestra el plan (no cambia nada)
     node scripts/agregar-cpu-previa.js --aplicar             -> crea los crons en cron-job.org
     opciones: --cpu=12 (por defecto 12)  --minutos=2 (por defecto 2)

   Requiere CRONJOB_API_KEY y TOKEN en el .env. */

import 'dotenv/config';
import { listarCrons, planificarCpuPrevia, crearJob, textoDias } from '../src/cronjob.js';

const aplicar = process.argv.includes('--aplicar');
const opcion = (nombre, defecto) => process.argv.find((a) => a.startsWith(`--${nombre}=`))?.split('=')[1] ?? defecto;
const cpu = opcion('cpu', '12');
const minutosAntes = Number(opcion('minutos', '2'));

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const hhmm = (s) => `${String(s.hours[0]).padStart(2, '0')}:${String(s.minutes[0]).padStart(2, '0')}`;
const cuando = (s) => `${textoDias(s.wdays)} ${hhmm(s)}`;

if (aplicar && !process.env.TOKEN) {
    console.error('Falta TOKEN en el .env: los crons nuevos no podrían autenticarse.');
    process.exit(1);
}

const plan = planificarCpuPrevia(await listarCrons(), { cpu, minutosAntes });

console.log(aplicar ? 'APLICANDO\n' : 'PLAN (no se cambia nada; agregá --aplicar para ejecutarlo)\n');

let creados = 0;
for (const p of plan) {
    const o = p.original;
    if (p.omitido) {
        console.log(`- ${o.titulo}\n    se omite: ${p.omitido}`);
        continue;
    }
    console.log(`- ${o.titulo}   [apaga: ${cuando(o.schedule)}]`);
    console.log(`    + NUEVO  ${cuando(p.nuevo.schedule)}  ${p.nuevo.url.replace(/^https?:\/\/[^/]+/, '')}`);
    if (!aplicar) continue;

    // cron-job.org limita la velocidad: pausa entre creaciones y reintento ante un 429.
    let r;
    for (let intento = 1; ; intento++) {
        try {
            r = await crearJob(p.nuevo);
            break;
        } catch (error) {
            if (error.status !== 429 || intento >= 4) throw error;
            console.log(`    límite de velocidad, reintento en ${intento * 15} s…`);
            await dormir(intento * 15000);
        }
    }
    console.log(`    creado (#${r.jobId})`);
    creados++;
    await dormir(3000);
}

const nuevos = plan.filter((p) => p.nuevo).length;
console.log(`\n${nuevos} crons de configuración ${aplicar ? `creados: ${creados}` : 'a crear'}. `
    + `Pedidos a cron-job.org: ${aplicar ? 1 + nuevos : 1}.`);
