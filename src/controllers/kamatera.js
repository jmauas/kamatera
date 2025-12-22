const url = 'https://console.kamatera.com/service';

const pedirToken = async () => {
  console.log('[pedirToken] Iniciando solicitud de token de autenticación');
  const body = {
    clientId: `${process.env.CLIENT_ID}`,
    secret: `${process.env.API_SECRET}`
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

  try {
    console.log('[pedirToken] Enviando petición de autenticación...');
    const res = await fetch(`${url}/authenticate`, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const token = await res.json();
    console.log('[pedirToken] Token obtenido exitosamente');
    return token.authentication;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[pedirToken] Error al obtener token:', error.message);
    throw error;
  }
}
  
export const statusServer = async () => {
  console.log('[statusServer] Iniciando consulta de estado del servidor');
  const token = await pedirToken()
  console.log('[statusServer] Token obtenido, consultando servidor:', process.env.SERVER_ID);

  const res = await fetch(`${url}/server/${process.env.SERVER_ID}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  })
  const srv = await res.json()
  console.log('[statusServer] Estado recibido:', { power: srv.power, cpu: srv.cpu, ram: srv.ram });
  return srv
}
  
export const pedirTasks = async () => {
  console.log('[pedirTasks] Iniciando consulta de tareas pendientes');
  const token = await pedirToken()
  console.log('[pedirTasks] Consultando cola de tareas...');
  const res = await fetch(`${url}/queue`, {
    next: { revalidate: 1 }, 
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  })
  const tasks = await res.json()
  console.log('[pedirTasks] Tareas recibidas, cantidad:', tasks.length || 0);
  return tasks;
}
  
  
export const pwr = async (tipo) => {
  console.log('[pwr] Iniciando operación de power:', tipo);
  const token = await pedirToken();
  const body = {power: tipo};
  console.log('[pwr] Enviando comando power a servidor:', process.env.SERVER_ID);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
  
  try {
    const res = await fetch(`${url}/server/${process.env.SERVER_ID}/power`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const rspta = await res.json();
    console.log('[pwr] Respuesta recibida:', rspta.errors ? 'ERROR' : 'OK', rspta);
    return rspta;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[pwr] Error en operación de power:', error.message);
    throw error;
  }
}

export const apagadoCompleto = async (cpuValue = '8T') => {
  console.log('[apagadoCompleto] Iniciando proceso de apagado completo con CPU:', cpuValue);
  const token = await pedirToken();
  let resultados = {
    cpu: { ok: false, mensaje: '' },
    power: { ok: false, mensaje: '' }
  };
  
  // Paso 1: Modificar CPU (reducir recursos)
  console.log('[apagadoCompleto] PASO 1: Modificando CPU a', cpuValue);
  try {
    const cpuController = new AbortController();
    const cpuTimeoutId = setTimeout(() => cpuController.abort(), 30000);
    
    const cpuRes = await fetch(`${url}/server/${process.env.SERVER_ID}/cpu`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ cpu: cpuValue }),
      signal: cpuController.signal
    });
    clearTimeout(cpuTimeoutId);
    const cpuData = await cpuRes.json();
    
    if (cpuData.errors) {
      resultados.cpu.mensaje = cpuData.errors[0].info;
      console.log('[apagadoCompleto] PASO 1: Error en modificación de CPU:', cpuData.errors[0].info);
    } else {
      resultados.cpu.ok = true;
      resultados.cpu.mensaje = 'OK';
      console.log('[apagadoCompleto] PASO 1: CPU modificada exitosamente');
    }
  } catch (error) {
    resultados.cpu.mensaje = error.message;
    console.error('[apagadoCompleto] PASO 1: Excepción al modificar CPU:', error.message);
  }
  
  // Esperar 2 minutos antes de enviar el apagado
  console.log('[apagadoCompleto] Esperando 2 minutos antes de apagar...');
  await new Promise(resolve => setTimeout(resolve, 120000));
  
  // Paso 2: SIEMPRE ejecutar apagado, independientemente del resultado del CPU
  console.log('[apagadoCompleto] PASO 2: Ejecutando apagado del servidor');
  try {
    const powerController = new AbortController();
    const powerTimeoutId = setTimeout(() => powerController.abort(), 120000);
    
    const powerRes = await fetch(`${url}/server/${process.env.SERVER_ID}/power`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ power: 'off' }),
      signal: powerController.signal
    });
    clearTimeout(powerTimeoutId); 
    const powerData = await powerRes.json();
    
    if (powerData.errors) {
      resultados.power.mensaje = powerData.errors[0].info;
      console.log('[apagadoCompleto] PASO 2: Error en apagado:', powerData.errors[0].info);
    } else {
      resultados.power.ok = true;
      resultados.power.mensaje = 'OK';
      console.log('[apagadoCompleto] PASO 2: Servidor apagado exitosamente');
    }
  } catch (error) {
    resultados.power.mensaje = error.message;
    console.error('[apagadoCompleto] PASO 2: Excepción al apagar servidor:', error.message);
  }
  
  // Devolver resultado combinado
  console.log('[apagadoCompleto] Proceso finalizado. Resultados:', resultados);
  return {
    errors: (!resultados.power.ok) ? [{ info: `CPU: ${resultados.cpu.mensaje}, Power: ${resultados.power.mensaje}` }] : null,
    resultados
  };
}


export const modificar = async (tipo, valor) => {
  console.log('[modificar] Iniciando modificación de recurso:', tipo, 'valor:', valor);
  const body = {}
  switch (tipo) {
    case 'procesador':
      tipo = 'cpu'
      body.cpu = valor
      break;
    case 'ram':
      tipo = 'ram'
      body.ram = Number(valor)
      break;
    case 'disco':
      tipo = 'disk'
      body.size = Number(valor)
      body.index= 0
      body.provision = 0
      break;   
  }
  console.log('[modificar] Tipo convertido a:', tipo, 'Body:', JSON.stringify(body));
  const token = await pedirToken();
  console.log('[modificar] Enviando petición de modificación al servidor:', process.env.SERVER_ID);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
  
  try {
    const res = await fetch(`${url}/server/${process.env.SERVER_ID}/${tipo}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const rspta = await res.json();
    console.log('[modificar] Respuesta recibida:', rspta.errors ? 'ERROR' : 'OK', rspta);
    return rspta;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[modificar] Error en modificación:', error.message);
    throw error;
  }
}
