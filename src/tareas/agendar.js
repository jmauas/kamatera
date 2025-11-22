import cron from 'node-cron';
import { pwr, modificar } from "../controllers/kamatera.js";
import { registrar } from "./registro.js";

const sc = {
    scheduled: true,
    timezone: 'America/Argentina/Buenos_Aires'
}

export const agendar = () => {
        // SEG MIN HORAS DIA_MES MES DIA_SEMANA
        // * TODOS LOS VALORES
        // ? CUALQUIER VALOR
        // , VALORES DE UNA LISTA
        // - RANGO DE VALORES
        // / INCREMENTOS DE UN INTERVALO
        //
        cron.schedule('0 00 09 * * MON-FRI', () => {
            encendido()
        }, sc);
        // cron.schedule('0 00 13 * * MON-FRI', async () => {
        //     await modificar('procesador', '8T');
        //     await modificar('ram', '16384');
        // }, sc);
        apagarNoche('SUN-THU', 8);
        apagarNoche('FRI', 4);
               
        cron.schedule('0 00 10 * * SAT', () => {
            encendido()
        }, sc);
        cron.schedule('0 30 20 * * SAT', () => {
            apagado(true, 4)
        }, sc);
        apagarNoche('SAT', 4);       

        cron.schedule('0 00 20 * * SUN', () => {
            apagado(true, 8)
        }, sc);
        apagarNoche('SUN', 8);

        console.log('Tareas Agendadas');
}

const apagarNoche = async (dias, procesadores) => {
    cron.schedule(`0 0 23 * * ${dias}`, () => {
        apagado(true, procesadores)
    }, sc);
    cron.schedule(`59 59 23 * * ${dias}`, () => {
        apagado(false, procesadores)
    }, sc);
}

const apagado = async (log, procesadores) => {
    if (!procesadores) procesadores = '4';
    let res = await modificar('procesador', procesadores+'T');
    if (!res.errors) {
        setTimeout(async () => {
            apagado(false, procesadores);
        }, 15000);
        return;
    } 
    res = await modificar('ram', '16384');
    if (!res.errors) {
        setTimeout(async () => {
            apagado(false, procesadores);
        }, 15000);
        return;
    }
    console.log(res);
    res = await pwr('off');
    if (res.errors) {
        if (log===true) await registrar('APAG. AUTO.', 0, 0, res.errors[0].info, '')
    } else {
        await registrar('APAG. AUTO.', 0, 0, 'OK', '')
    }
}

const encendido = async () => {
    const res = await pwr('on');
    console.log(res);
    if (res.errors) {
        await registrar('ENC. AUTO.', 0, 0, res.errors[0].info, '')
    } else {
        await registrar('ENC. AUTO.', 0, 0, 'OK', '')
    }
}
