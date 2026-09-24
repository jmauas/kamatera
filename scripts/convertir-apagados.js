/* Convierte los crons de apagado que traen ?cpu=N en DOS crons separados:
     1. "configurar": cambia la CPU a la hora original.
     2. "apagar": el cron existente, movido 2 minutos después y sin parámetros.

   Uso:
     node scripts/convertir-apagados.js            -> solo muestra el plan (no cambia nada)
     node scripts/convertir-apagados.js --aplicar  -> lo ejecuta en cron-job.org

   Requiere CRONJOB_API_KEY y TOKEN en el .env. */

import 'dotenv/config';
import { listarCrons, planificarConversion, crearJob, editarJob, textoDias } from '../src/cronjob.js';

const aplicar = process.argv.includes('--aplicar');
const hhmm = (s) => `${String(s.hours[0]).padStart(2, '0')}:${String(s.minutes[0]).padStart(2, '0')}`;
const cuando = (s) => `${textoDias(s.wdays)} ${hhmm(s)}`;

if (aplicar && !process.env.TOKEN) {
    console.error('Falta TOKEN en el .env: los crons nuevos no podrían autenticarse.');
    process.exit(1);
}

const crons = await listarCrons();
const plan = planificarConversion(crons);

console.log(aplicar ? 'APLICANDO la conversión\n' : 'PLAN (no se cambia nada; agregá --aplicar para ejecutarlo)\n');

let hechos = 0;
for (const p of plan) {
    const o = p.original;
    if (p.omitido) {
        console.log(`- ${o.titulo}\n    se omite: ${p.omitido}`);
        continue;
    }
    console.log(`- ${o.titulo}   [#${o.id}, hoy: ${cuando(o.schedule)}]`);
    console.log(`    + NUEVO   ${cuando(p.configurar.schedule)}  ${p.configurar.url.replace(/^https?:\/\/[^/]+/, '')}`);
    console.log(`    ~ MOVER   ${cuando(p.apagar.schedule)}  ${p.apagar.url.replace(/^https?:\/\/[^/]+/, '')}   (título: "${p.apagar.titulo}")`);

    if (!aplicar) continue;
    // Primero se crea el de configuración; solo si salió bien se mueve el apagado.
    const creado = await crearJob(p.configurar);
    await editarJob(o.id, { title: p.apagar.titulo, url: p.apagar.url, schedule: p.apagar.schedule });
    console.log(`    listo (nuevo cron #${creado.jobId})`);
    hechos++;
}

const convertibles = plan.filter((p) => !p.omitido).length;
console.log(`\n${convertibles} apagados a convertir → ${convertibles} crons nuevos y ${convertibles} movidos`
    + `${aplicar ? ` (hechos: ${hechos})` : ''}. Pedidos a cron-job.org: ${aplicar ? 1 + convertibles * 2 : 1}.`);
