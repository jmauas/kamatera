/* Decide qué hace una fase del apagado automático (cron-job.org llama a
   /api/cron/apagado?cpu=8 varias veces por noche).

   - 'nada'   : el servidor ya está apagado.
   - 'apagar' : apagarlo.
   - 'cpu'    : reducir la CPU y esperar a la próxima fase.

   Reglas:
   - Sin `cpu` en la URL, o con `final=1` (última fase), siempre se apaga.
   - Con `cpu`, si el servidor todavía tiene otra CPU, esta fase solo la reduce.
   - Si ya tiene esa CPU, se apaga.
   - Si no se pudo leer el estado del servidor, se apaga (es lo más seguro). */
export const decidirApagado = ({ power, cpuActual, cpuObjetivo, final }) => {
    if (power === 'off') return 'nada';
    if (final || !cpuObjetivo) return 'apagar';
    if (cpuActual == null) return 'apagar';
    return String(cpuActual).toUpperCase() === cpuObjetivo ? 'apagar' : 'cpu';
};

export const esFinal = (v) => v === '1' || v === 'true';
