/* Valores permitidos para operar el servidor. Todo lo que llega del cliente
   se valida contra estas listas antes de hablar con Kamatera. */

export const POWER_TIPOS = ['on', 'off', 'restart'];

export const CPU_VALORES = [1, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 88, 104]
    .map((n) => `${n}T`);

export const RAM_VALORES = [256, 512, 1024, 2048, 3072, 4096, 6144, 8192, 10240, 12288, 16384,
    24576, 32768, 49152, 65536, 98304, 131072, 200704, 262144, 327680, 393216, 458752, 524288];

export const DISCO_VALORES = [250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1500, 2000];

/** "12", "12T" -> "12T"; null si no es un valor permitido. */
export const normalizarCpu = (v) => {
    const m = /^(\d{1,3})T?$/.exec(String(v ?? '').trim().toUpperCase());
    if (!m) return null;
    const valor = `${Number(m[1])}T`;
    return CPU_VALORES.includes(valor) ? valor : null;
};

/** Valida un cambio de recurso. Devuelve { valor } o { error }. */
export const validarCambio = (tipo, valor) => {
    if (tipo === 'procesador') {
        const v = normalizarCpu(valor);
        return v ? { valor: v } : { error: 'Cantidad de procesadores no permitida.' };
    }
    if (tipo === 'ram') {
        const v = Number(valor);
        return RAM_VALORES.includes(v) ? { valor: v } : { error: 'Cantidad de RAM no permitida.' };
    }
    if (tipo === 'disco') {
        const v = Number(valor);
        return DISCO_VALORES.includes(v) ? { valor: v } : { error: 'Tamaño de disco no permitido.' };
    }
    return { error: 'Tipo de modificación inválido (procesador, ram o disco).' };
};
