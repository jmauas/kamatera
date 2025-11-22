const url = 'https://console.kamatera.com/service';

const pedirToken = async () => {
  const body = {
    clientId: `${process.env.CLIENT_ID}`,
    secret: `${process.env.API_SECRET}`
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

  try {
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
    return token.authentication;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
  
export const statusServer = async () => {
  const token = await pedirToken()

  const res = await fetch(`${url}/server/${process.env.SERVER_ID}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  })
  const srv = await res.json()
  return srv
}
  
export const pedirTasks = async () => {
  const token = await pedirToken()
  const res = await fetch(`${url}/queue`, {
    next: { revalidate: 1 }, 
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  })
  const tasks = await res.json()
  return tasks;
}
  
  
export const pwr = async (tipo) => {
  const token = await pedirToken();
  const body = {power: tipo};
  
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
    return rspta;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export const apagadoCompleto = async (cpuValue = '8T') => {
  const token = await pedirToken();
  let resultados = {
    cpu: { ok: false, mensaje: '' },
    power: { ok: false, mensaje: '' }
  };
  
  // Paso 1: Modificar CPU (reducir recursos)
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
    } else {
      resultados.cpu.ok = true;
      resultados.cpu.mensaje = 'OK';
    }
  } catch (error) {
    resultados.cpu.mensaje = error.message;
  }
  
  // Esperar 20 segundos antes de enviar el apagado
  await new Promise(resolve => setTimeout(resolve, 20000));
  
  // Paso 2: SIEMPRE ejecutar apagado, independientemente del resultado del CPU
  try {
    const powerController = new AbortController();
    const powerTimeoutId = setTimeout(() => powerController.abort(), 30000);
    
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
    } else {
      resultados.power.ok = true;
      resultados.power.mensaje = 'OK';
    }
  } catch (error) {
    resultados.power.mensaje = error.message;
  }
  
  // Devolver resultado combinado
  return {
    errors: (!resultados.power.ok) ? [{ info: `CPU: ${resultados.cpu.mensaje}, Power: ${resultados.power.mensaje}` }] : null,
    resultados
  };
}


export const modificar = async (tipo, valor) => {
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
  const token = await pedirToken();
  console.log(JSON.stringify(body));
  
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
    console.log(rspta);
    return rspta;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
