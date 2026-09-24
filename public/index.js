/* Panel del servidor Kamatera.
   La sesión vive en una cookie HttpOnly: el navegador nunca conoce ningún token. */

const $ = (id) => document.getElementById(id);

const ESPERA_APAGADO_MS = 120000;   // entre reducir la CPU y apagar
const ESPERA_ESTADO_MS = 180000;    // máximo esperando que cambie el estado
const REFRESCO_MS = 20000;
const PASO_REGISTRO = 50;

const CPUS = [1, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 88, 104]
  .map((n) => [`${n}T`, n === 1 ? '1 procesador' : `${n} procesadores`]);
const RAMS = [256, 512, 1024, 2048, 3072, 4096, 6144, 8192, 10240, 12288, 16384, 24576, 32768,
  49152, 65536, 98304, 131072, 200704, 262144, 327680, 393216, 458752, 524288]
  .map((mb) => [String(mb), mb < 1024 ? `${mb} MB` : `${mb / 1024} GB`]);
const DISCOS = [250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1500, 2000]
  .map((gb) => [String(gb), `${gb} GB`]);

const estado = {
  lat: 0,
  long: 0,
  status: null,
  cfg: false,
  ocupado: false,
  limite: PASO_REGISTRO,
};

/* ---------- Utilidades ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fecha = (f) => {
  const d = new Date(f);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-AR');
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const guardado = (clave, valor) => {
  try {
    if (valor === undefined) return localStorage.getItem(clave) || '';
    localStorage.setItem(clave, valor);
  } catch { /* sin storage */ }
  return valor || '';
};

let toastTimer;
function toast(mensaje, tipo = '') {
  const el = $('toast');
  el.textContent = mensaje;
  el.className = `toast${tipo ? ` toast--${tipo}` : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
}

function aviso(texto) {
  const el = $('aviso');
  el.textContent = texto || '';
  el.hidden = !texto;
}

/* ---------- API ---------- */

class ErrorApi extends Error {
  constructor(mensaje, status, datos) {
    super(mensaje);
    this.status = status;
    this.datos = datos || {};
  }
}

async function api(ruta, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/${ruta}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const datos = await res.json().catch(() => null);

  if (!res.ok) throw new ErrorApi(datos?.error || `Error ${res.status}`, res.status, datos);
  return datos;
}

/* ---------- Diálogo ---------- */

/* Muestra un formulario modal. Resuelve con los valores del formulario o null si se cancela. */
function pedir({ titulo, mensaje = '', campos = [], confirmar = 'Confirmar', peligro = false }) {
  return new Promise((resolve) => {
    const dlg = $('dlg');
    const form = $('dlgForm');
    $('dlgTitulo').textContent = titulo;
    $('dlgMensaje').textContent = mensaje;
    $('dlgCampos').innerHTML = campos.map((c) => `
      <label class="field">${esc(c.label)}
        <input name="${esc(c.name)}" type="${esc(c.type || 'text')}" value="${esc(c.value || '')}"
               placeholder="${esc(c.placeholder || '')}" maxlength="60" required autocomplete="off"
               ${c.pattern ? `pattern="${esc(c.pattern)}" title="${esc(c.title || '')}"` : ''}>
      </label>`).join('');

    const ok = $('dlgOk');
    ok.textContent = confirmar;
    ok.className = `btn ${peligro ? 'btn--danger' : 'btn--primary'}`;

    let resuelto = false;
    const terminar = (valor) => {
      if (resuelto) return;
      resuelto = true;
      if (dlg.open) dlg.close();
      resolve(valor);
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      terminar(Object.fromEntries(new FormData(form)));
    };
    $('dlgCancel').onclick = () => terminar(null);
    dlg.oncancel = () => terminar(null);

    dlg.showModal();
    dlg.querySelector('input')?.focus();
  });
}

/* Pide confirmación + nombre de quien hace la acción. Devuelve el nombre o null. */
async function confirmarConNombre(titulo, mensaje, { peligro = false, extra = [] } = {}) {
  const v = await pedir({
    titulo,
    mensaje,
    peligro,
    campos: [
      { name: 'nombre', label: 'Ingresá tu nombre para continuar', value: guardado('nombre'), placeholder: 'Nombre' },
      ...extra,
    ],
  });
  if (!v) return null;
  const nombre = v.nombre.trim();
  if (!nombre) return null;
  guardado('nombre', nombre);
  return nombre;
}

/* ---------- Estado del servidor ---------- */

const ICONO = (id) => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;

function pintarStatus(s) {
  estado.status = s;
  $('nombre').textContent = s.name || '—';
  $('cant').textContent = s.cpu ?? '—';
  $('memoria').textContent = s.ram != null ? (s.ram < 1024 ? `${s.ram} MB` : `${s.ram / 1024} GB`) : '—';
  $('ssd').textContent = s.diskSizes?.[0] != null ? `${s.diskSizes[0]} GB` : '—';
  $('ip').textContent = s.networks?.[0]?.ips?.[0] ?? '—';

  const badge = $('estado');
  if (s.power === 'on') {
    badge.className = 'badge badge--on';
    badge.innerHTML = `${ICONO('i-check')} Encendido`;
  } else {
    badge.className = 'badge badge--off';
    badge.innerHTML = `${ICONO('i-x')} Fuera de línea`;
  }
  $('actualizado').textContent = `Actualizado ${new Date().toLocaleTimeString('es-AR')}`;

  // Los selectores de configuración reflejan el estado real, salvo que el usuario ya haya elegido otro valor.
  fijarSelect('procesadores', s.cpu);
  fijarSelect('memoriaRam', s.ram);
  fijarSelect('disco', s.diskSizes?.[0]);
  actualizarBotones();
}

function fijarSelect(id, valor) {
  const sel = $(id);
  if (!sel || sel.dataset.tocado || valor == null) return;
  sel.value = String(valor);
}

function actualizarBotones() {
  const power = estado.status?.power;
  const off = estado.ocupado;
  $('encender').disabled = off || power === 'on';
  $('apagar').disabled = off || power === 'off';
  $('reiniciar').disabled = off || power === 'off';
  $('actualizar').disabled = off;
  for (const id of ['aplicarProc', 'aplicarRam', 'aplicarSsd']) $(id).disabled = off;
}

async function refrescarStatus() {
  try {
    pintarStatus(await api('status'));
  } catch (error) {
    toast(`No se pudo leer el estado: ${error.message}`, 'error');
  }
}

/* ---------- Tareas y registro ---------- */

const domicilio = (r) => [r.street, r.number, r.neighbourhood, r.locality, r.county,
  r.administrative_area, r.postal_code, r.country]
  .filter((v) => v && v !== 'null' && v !== 'undefined').join(' ');

function pintarTareas(tasks) {
  $('tareas').innerHTML = tasks.length
    ? tasks.map((t) => `<tr>
        <td data-label="Fecha">${esc(fecha(t.added))}</td>
        <td data-label="Tarea">${esc(t.description)}</td>
        <td data-label="Estado">${esc(t.status)}</td>
      </tr>`).join('')
    : '<tr><td colspan="3" class="vacio">Sin tareas en la cola.</td></tr>';
}

function pintarRegistro(filas, hayMas) {
  $('registro').innerHTML = filas.length
    ? filas.map((r) => `<tr>
        <td data-label="Fecha">${esc(fecha(r.fecha))}</td>
        <td data-label="Acción">${esc(r.evento)}</td>
        <td data-label="Quién">${esc([r.nombre, domicilio(r), r.ip].filter(Boolean).join(' · '))}</td>
        <td data-label="Resultado">${esc(r.res)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="vacio">Todavía no hay registros.</td></tr>';
  $('verMas').hidden = !hayMas;
}

async function refrescarTareas() {
  try {
    const d = await api(`tasks?limit=${estado.limite}`);
    pintarTareas(d.tasks || []);
    pintarRegistro(d.registro || [], !!d.hayMas);
  } catch (error) {
    toast(`No se pudo leer el registro: ${error.message}`, 'error');
  }
}

const refrescarTodo = () => Promise.all([refrescarStatus(), refrescarTareas()]);

$('verMas').addEventListener('click', async () => {
  estado.limite += PASO_REGISTRO;
  await refrescarTareas();
});

/* ---------- Refresco automático ---------- */

let timerRefresco = null;

function iniciarRefresco() {
  detenerRefresco();
  timerRefresco = setInterval(() => {
    if (!document.hidden && !estado.ocupado) refrescarTodo();
  }, REFRESCO_MS);
}
function detenerRefresco() {
  clearInterval(timerRefresco);
  timerRefresco = null;
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && timerRefresco && !estado.ocupado) refrescarTodo();
});

/* ---------- Acciones ---------- */

/* Ejecuta una acción larga: bloquea los botones y siempre refresca al terminar. */
async function ejecutar(fn) {
  if (estado.ocupado) return;
  estado.ocupado = true;
  actualizarBotones();
  try {
    await fn();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      bloquearConfig();
      toast('La configuración se bloqueó. Volvé a ingresar la contraseña.', 'error');
    } else {
      toast(error.message, 'error');
    }
  } finally {
    aviso('');
    estado.ocupado = false;
    await refrescarTodo();
  }
}

/* Espera `ms` llamando a `alTick(segundosRestantes)` cada segundo. */
async function esperar(ms, alTick) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    alTick(Math.ceil((fin - Date.now()) / 1000));
    await dormir(1000);
  }
}

/* Consulta el estado cada 5 s hasta que `power` llegue al valor esperado.
   `alTick(segundosTranscurridos)` se llama en cada vuelta. */
async function esperarPower(deseado, alTick) {
  const inicio = Date.now();
  const fin = inicio + ESPERA_ESTADO_MS;
  while (Date.now() < fin) {
    alTick(Math.round((Date.now() - inicio) / 1000));
    await dormir(5000);
    try {
      const s = await api('status');
      pintarStatus(s);
      if (s.power === deseado) return true;
    } catch { /* se reintenta en la próxima vuelta */ }
  }
  return false;
}

const posicion = () => ({ lat: estado.lat, long: estado.long });

async function accionPower(tipo) {
  const textos = {
    on: ['Encender el servidor', 'Se va a encender el servidor. ¿Estás seguro?', ],
    restart: ['Reiniciar el servidor', 'Se le va a cerrar la sesión a todos los usuarios. ¿Estás seguro?', ],
  };
  const [titulo, mensaje] = textos[tipo];
  const nombre = await confirmarConNombre(titulo, mensaje, { peligro: tipo === 'restart' });
  if (!nombre) return;

  await ejecutar(async () => {
    aviso('Enviando la orden…');
    const r = await api('power', { method: 'POST', body: { tipo, nombre, ...posicion() } });
    if (!r.ok) return toast(r.mensaje || 'Kamatera rechazó la orden.', 'error');
    if (tipo === 'on') {
      const listo = await esperarPower('on', () => aviso('Encendiendo el servidor…'));
      toast(listo ? 'El servidor está encendido.' : 'La orden se envió; todavía no figura encendido.', listo ? 'ok' : '');
    } else {
      toast('El servidor se está reiniciando.', 'ok');
    }
  });
}

/* ---------- Modal de progreso ---------- */

const PASOS_APAGADO = [
  ['cpu', 'Reducir la CPU'],
  ['espera', 'Esperar antes de apagar'],
  ['orden', 'Enviar la orden de apagado'],
  ['confirmar', 'Confirmar que el servidor está apagado'],
];

const MARCA = { pendiente: '', activo: '', ok: '✓', aviso: '!', error: '✕' };

/* Abre un modal con una lista de pasos que se van actualizando. No se puede cerrar
   (ni con Escape) hasta que se llame a terminar(). */
function abrirProgreso(titulo, pasos) {
  const dlg = $('prog');
  const items = new Map(pasos.map(([id, texto]) => [id, { texto, estado: 'pendiente', detalle: '' }]));
  let activo = null;

  const pintar = () => {
    $('progPasos').innerHTML = [...items.values()].map((p) => `
      <li class="paso paso--${p.estado}">
        <span class="paso__marca" aria-hidden="true">${MARCA[p.estado]}</span>
        <span class="paso__texto">${esc(p.texto)}${p.detalle ? `<small>${esc(p.detalle)}</small>` : ''}</span>
      </li>`).join('');
  };

  $('progTitulo').textContent = titulo;
  $('progResumen').textContent = '';
  $('progResumen').className = 'prog__resumen';
  $('progCerrar').hidden = true;
  $('progAviso').hidden = false;
  pintar();

  dlg.oncancel = (e) => e.preventDefault();
  dlg.showModal();

  return {
    set(id, estadoPaso, detalle = '') {
      const p = items.get(id);
      p.estado = estadoPaso;
      p.detalle = detalle;
      if (estadoPaso === 'activo') activo = id;
      else if (activo === id) activo = null;
      pintar();
    },
    /* Marca como error el paso que estaba en curso. */
    fallar(detalle) {
      if (activo) this.set(activo, 'error', detalle);
    },
    resumen(texto, tipo = '') {
      $('progResumen').textContent = texto;
      $('progResumen').className = `prog__resumen${tipo ? ` prog__resumen--${tipo}` : ''}`;
    },
    terminar() {
      dlg.oncancel = null;
      $('progAviso').hidden = true;
      $('progCerrar').hidden = false;
      $('progCerrar').onclick = () => dlg.close();
      $('progCerrar').focus();
    },
  };
}

async function accionApagar() {
  const nombre = await confirmarConNombre(
    'Apagar el servidor',
    'Nadie podrá acceder a él.\nPrimero se reduce la CPU y unos 2 minutos después se apaga. ' +
    'Dejá esta pestaña abierta hasta que termine.\n¿Estás seguro?',
    { peligro: true },
  );
  if (!nombre) return;

  await ejecutar(async () => {
    const prog = abrirProgreso('Apagando el servidor', PASOS_APAGADO);
    try {
      // 1. Reducir la CPU. Si falla se apaga igual (el registro guarda el motivo).
      prog.set('cpu', 'activo', 'Enviando la orden a Kamatera…');
      let paso1;
      try {
        paso1 = await api('apagado-completo', { method: 'POST', body: { paso: 'cpu', cpu: $('procesadores').value } });
      } catch (error) {
        paso1 = { ok: false, mensaje: error.message };
      }
      if (paso1.ok) prog.set('cpu', 'ok', 'CPU reducida.');
      else prog.set('cpu', 'aviso', `No se pudo reducir (${paso1.mensaje}). Se apaga igual.`);

      // 2. Espera entre la reducción de CPU y el apagado.
      await esperar(ESPERA_APAGADO_MS, (seg) => prog.set('espera', 'activo', `Apagando en ${seg} s`));
      prog.set('espera', 'ok', 'Listo.');

      // 3. Orden de apagado.
      prog.set('orden', 'activo', 'Enviando la orden a Kamatera…');
      const paso2 = await api('apagado-completo', {
        method: 'POST',
        body: { paso: 'power', cpuMsg: paso1.mensaje, nombre, ...posicion() },
      });
      if (!paso2.ok) {
        prog.set('orden', 'error', paso2.mensaje || 'Kamatera rechazó la orden.');
        prog.resumen('No se pudo apagar el servidor.', 'error');
        return;
      }
      prog.set('orden', 'ok', 'Orden aceptada.');

      // 4. Confirmar que quedó apagado.
      const listo = await esperarPower('off', (seg) => prog.set('confirmar', 'activo', `Consultando el estado… (${seg} s)`));
      if (listo) {
        prog.set('confirmar', 'ok', 'El servidor está apagado.');
        prog.resumen('El servidor se apagó correctamente.', 'ok');
      } else {
        prog.set('confirmar', 'aviso', 'Todavía figura encendido.');
        prog.resumen('La orden se envió, pero después de 3 minutos el servidor sigue encendido. Revisalo en unos minutos.', 'aviso');
      }
    } catch (error) {
      prog.fallar(error.message);
      prog.resumen(`El proceso se interrumpió: ${error.message}`, 'error');
    } finally {
      prog.terminar();
    }
  });
}

/* ---------- Configuración ---------- */

async function desbloquearConfig() {
  const v = await pedir({
    titulo: 'Acceso a Configuración',
    mensaje: 'Ingresá la contraseña de configuración.',
    campos: [{ name: 'password', label: 'Contraseña', type: 'password' }],
    confirmar: 'Desbloquear',
  });
  if (!v) return false;
  try {
    await api('session', { method: 'POST', body: { password: v.password } });
    estado.cfg = true;
    return true;
  } catch (error) {
    toast(error.message, 'error');
    return false;
  }
}

/* Oculta la configuración y vuelve a cerrar la sesión de configuración. */
function bloquearConfig() {
  estado.cfg = false;
  $('configDiv').hidden = true;
  $('btnMostrarConfig').setAttribute('aria-expanded', 'false');
  $('txtConfig').textContent = 'Configuración';
  api('session', { method: 'DELETE' }).catch(() => {});
  refrescarTareas(); // vuelve a la vista pública del registro
}

$('btnMostrarConfig').addEventListener('click', async () => {
  if (!$('configDiv').hidden) return bloquearConfig();
  if (!estado.cfg && !(await desbloquearConfig())) return;
  $('configDiv').hidden = false;
  $('btnMostrarConfig').setAttribute('aria-expanded', 'true');
  $('txtConfig').textContent = 'Ocultar configuración';
  refrescarTareas(); // con la configuración desbloqueada el registro incluye IP y domicilio
});

async function aplicarCambio({ tipo, selectId, titulo, mensaje, confirmarTexto }) {
  const valor = $(selectId).value;
  const etiqueta = $(selectId).selectedOptions[0]?.textContent || valor;

  const extra = confirmarTexto
    ? [{
      name: 'confirmacion',
      label: `Para confirmar, escribí ${confirmarTexto}`,
      pattern: confirmarTexto,
      title: `Escribí exactamente ${confirmarTexto}`,
    }]
    : [];
  const nombre = await confirmarConNombre(titulo, `${mensaje}\nNuevo valor: ${etiqueta}.\nSe va a reiniciar el servidor. ¿Estás seguro?`, {
    peligro: true,
    extra,
  });
  if (!nombre) return;

  await ejecutar(async () => {
    aviso('Aplicando el cambio…');
    const r = await api('modificar', { method: 'POST', body: { tipo, valor, nombre } });
    if (!r.ok) return toast(r.mensaje || 'No se pudo aplicar el cambio.', 'error');
    delete $(selectId).dataset.tocado;
    toast('El cambio se envió al servidor.', 'ok');
  });
}

for (const id of ['procesadores', 'memoriaRam', 'disco']) {
  $(id).addEventListener('change', (e) => { e.target.dataset.tocado = '1'; });
}

$('aplicarProc').addEventListener('click', () => aplicarCambio({
  tipo: 'procesador', selectId: 'procesadores',
  titulo: 'Modificar procesadores', mensaje: 'Se va a cambiar la cantidad de procesadores.',
}));
$('aplicarRam').addEventListener('click', () => aplicarCambio({
  tipo: 'ram', selectId: 'memoriaRam',
  titulo: 'Modificar memoria RAM', mensaje: 'Se va a cambiar la memoria RAM.',
}));
$('aplicarSsd').addEventListener('click', () => aplicarCambio({
  tipo: 'disco', selectId: 'disco',
  titulo: 'Modificar disco SSD',
  mensaje: 'ATENCIÓN: una vez aplicado, el disco NO se puede reducir a una capacidad menor.',
  confirmarTexto: 'DISCO',
}));

/* ---------- Botones principales ---------- */

$('encender').addEventListener('click', () => accionPower('on'));
$('reiniciar').addEventListener('click', () => accionPower('restart'));
$('apagar').addEventListener('click', accionApagar);
$('actualizar').addEventListener('click', () => ejecutar(async () => {}));

/* ---------- Arranque ---------- */

function llenarSelect(id, opciones) {
  $(id).innerHTML = opciones.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
}

function pedirUbicacion() {
  navigator.geolocation?.getCurrentPosition(
    (p) => { estado.lat = p.coords.latitude; estado.long = p.coords.longitude; },
    () => { /* sin permiso: el registro queda sin coordenadas */ },
  );
}

function iniciarPanel() {
  pedirUbicacion();
  refrescarTodo();
  iniciarRefresco();
}

llenarSelect('procesadores', CPUS);
llenarSelect('memoriaRam', RAMS);
llenarSelect('disco', DISCOS);
iniciarPanel();
