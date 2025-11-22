let tareas = [];
let registro = [];
let lat = 0;
let long = 0;

// Detectar si estamos en desarrollo local o en Vercel
const API_PREFIX = window.location.hostname === 'localhost' ? '' : '/api';

const fh = (f) => {
    const d = new Date(f);
    // Mostrar en hora local del navegador
    return d.toLocaleString();
} 

const pwr = async (pw, nombre, ip) => {
    const res = await fetch(`${API_PREFIX}/power?tipo=${pw}&lat=${lat}&long=${long}&nombre=${nombre}&ip=${ip}&token=${localStorage.getItem('token') || ''}`)
    const rspta = await res.json()
    return rspta;
}

const pedirTareas = async () => {
    const res = await fetch(`${API_PREFIX}/tasks`)
    const rspta = await res.json()
    tareas = rspta.tasks;
    let html = ``;
    tareas.forEach(tarea => {
        html += `<tr>
            <td class="fila">${fh(tarea.added)}</td>
            <td class="fila">${tarea.description}</td>
            <td class="fila">${tarea.status}</td>
        </tr>`;
    });
    document.getElementById("tareas").innerHTML = html;
    html = ``;
    rspta.registro.forEach(tarea => {
        let domi = agregarTxt(tarea.nombre);
        domi += agregarTxt(tarea.street);
        domi += agregarTxt(tarea.number);
        domi += agregarTxt(tarea.neighbourhood);
        domi += agregarTxt(tarea.locality);
        domi += agregarTxt(tarea.county);
        domi += agregarTxt(tarea.administrative_area);
        domi += agregarTxt(tarea.postal_code);
        domi += agregarTxt(tarea.country);
        domi += agregarTxt(tarea.ip);       
        html += `<tr>
            <td class="fila">${fh(tarea.fecha)}</td>
            <td class="fila">${tarea.evento}</td>
            <td class="fila">${domi}</td>
            <td class="fila">${tarea.res}</td>
        </tr>`;
    });
    document.getElementById("registro").innerHTML = html;
}

const agregarTxt = (val) => {
    if (val && val !== null && val !== undefined && val !== 'null' && val !== 'undefined') {
        return ' '+val;
    } else {
        return '';
    }
}

const pedirStatus = async () => {
    const res = await fetch(`${API_PREFIX}/status`)
    const data = await res.json()
    document.getElementById("nombre").innerText = data.name;
    if (data.power === "on") {
        document.getElementById("estado").innerHTML = `
            <span class="estadoOn">
                <i class="fa fa-check-circle fa-2x" aria-hidden="true"></i> Encendido
            </span>
        `;
    } else {
        document.getElementById("estado").innerHTML = `
            <span class="estadoOff">
                <i class="fa fa-stop-circle fa-2x" aria-hidden="true"></i> Fuera de Línea
            </span>
        `;
    }
    document.getElementById("cant").innerText = data.cpu;
    document.getElementById("memoria").innerText = data.ram;
    document.getElementById("ssd").innerText = data.diskSizes[0];
    document.getElementById("ip").innerText = data.networks[0].ips[0];
    document.getElementById("procesadores").value = data.cpu;
    document.getElementById("memoriaRam").value = data.ram;
    document.getElementById("disco").value = data.diskSizes[0];
}

window.onload = async () => {
    showLoader();
    navigator.geolocation.getCurrentPosition(async (position) => {
        lat = position.coords.latitude;
        long = position.coords.longitude;
    }, (error) => {
        console.error(error);
    });
    pedirStatus();
    await pedirTareas();
    hideLoader();
};

const swal = async (text) => {
    const val = localStorage.getItem("nombre");
    const ipAPI = "//api.ipify.org?format=json";
    const response = await fetch(ipAPI);
    const data = await response.json();
    const ip = data.ip;
    console.log(val, ip);
    let { value: nombre } = await Swal.fire({
        title: "Confirmación",
        text: text,
        input: "text",
        inputLabel: `INGRESÀ TU NOMBRE PARA CONTINUAR.`,
        inputPlaceholder: "Nombre",
        inputValue: val,
        icon: "warning",
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) {
                return "No ingresaste un Nombre !!!!!!!!!!";
            }
        }
    });
    nombre = nombre.trim();
    localStorage.setItem("nombre", nombre);
    return {nombre, ip};
}

document.getElementById("encender").addEventListener("click", async () => {
    const data = await swal(`Se Va a Encender el Servidor. ¿Estás seguro?`);
    if (data.nombre && data.nombre != '') {
        showLoader();
        const res = await pwr("on", data.nombre, data.ip);
        if (res.ok) {
            Swal.fire("El servidor se ha encendido correctamente", {
                icon: "success",
            });
        } else {
            Swal.fire(res.mensaje, {
                icon: "error",
            });    
        }
        pedirStatus();
        await pedirTareas();
        hideLoader();
    }
});

document.getElementById("apagar").addEventListener("click", async () => {
    const data = await swal(`Se Va a Apagar el Servidor.
        Nadie podrá acceder a el. ¿Estás seguro?`);
    if (data.nombre && data.nombre != '') {
        showLoader();
        const res = await pwr("off", data.nombre, data.ip);
        if (res.ok) {
            Swal.fire("El servidor se ha apagado correctamente", {
                icon: "success",
            });
        } else {
            Swal.fire(res.mensaje, {
                icon: "error",
            });    
        }
        pedirStatus();
        await pedirTareas();
        hideLoader();     
    } 
});

document.getElementById("reiniciar").addEventListener("click", async () => {
    const data = await swal(`Se Va a RE Iniciar el Servidor. 
        Se le va a Cerrar la sesión a todos los usuarios.
        ¿Estás seguro?`);
    if (data.nombre && data.nombre != '') {
        showLoader();
        const res = await pwr("restart", data.nombre, data.ip);
        if (res.ok) {
            Swal.fire("El servidor se ha Re Iniciado.", {
                icon: "success",
            });
        } else {
            Swal.fire(res.mensaje, {
                icon: "error",
            });    
        }
        pedirStatus();
        await pedirTareas();
        hideLoader();   
    };
});

document.getElementById("actualizar").addEventListener("click", async () => {
    showLoader();
    pedirStatus();
    await pedirTareas();
    hideLoader();
});

document.getElementById("aplicarProc").addEventListener("click", async () => {
    const val = document.getElementById("procesadores").value;
    const data = await swal(`Se Va a Modificar la Cantidad 
        de Procesadores del Servidor.
        Se va Reinicair el Servidor.
        ¿Estás seguro?`);
    if (data.nombre && data.nombre != '') {
        showLoader();
        const res = await modificar("procesador", val, data.nombre, data.ip);
        if (res.ok) {
            Swal.fire("El servidor se ha Modificado.", {
                icon: "success",
            });
        } else {
            Swal.fire(res.mensaje, {
                icon: "error",
            });    
        }
        pedirStatus();
        await pedirTareas();
        hideLoader();       
    };
});

document.getElementById("aplicarRam").addEventListener("click", async () => {
    const val = document.getElementById("memoriaRam").value;
    const data = await swal(`Se Va a Modificar la Cantidad 
        de Memoria RAM del Servidor.
        Se va Reinicair el Servidor.
        ¿Estás seguro?`);
    if (data.nombre && data.nombre != '') {
        showLoader();
        const res = await modificar("ram", val, data.nombre, data.ip);
        if (res.ok) {
            Swal.fire("El servidor se ha Modificado.", {
                icon: "success",
            });
        } else {
            Swal.fire(res.mensaje, {
                icon: "error",
            });    
        }
        pedirStatus();
        await pedirTareas();
        hideLoader(); 
    };
});

document.getElementById("aplicarSsd").addEventListener("click", async () => {
    const val = document.getElementById("disco").value;
    const data = await swal(`Se Va a Modificar la Capacidad 
        del Disco SSD del Servidor.
        UNA VEZ APLICADO, NO SE PUEDE MODIFICAR A UNA CAPACIDAD MENOR ¡¡¡¡
        Se va Reinicair el Servidor.
        ¿Estás seguro?`);
    if (data.nombre && data.nombre != '') {  
        showLoader();
        const res = await modificar("ssd", val, data.nombre, data.ip);
        if (res.ok) {
            Swal.fire("El servidor se ha Modificado.", {
                icon: "success",
            });
        } else {
            Swal.fire(res.mensaje, {
                icon: "error",
            });    
        }
        pedirStatus();
        await pedirTareas();
        showLoader();
    };
});

const modificar = async (tipo, valor, nombre, ip) => {
    const res = await fetch(`${API_PREFIX}/modificar?tipo=${tipo}&valor=${valor}&nombre=${nombre}&ip=${ip}&token=${localStorage.getItem('token') || ''}`)
    const rspta = await res.json()
    return rspta;
}

function showLoader() {
    document.getElementById('loader').style.display = 'flex';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}
