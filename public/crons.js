/* Cronograma de encendido/apagado del servidor (cron-job.org).
   Vista principal: día por día, con editar y pausar en cada evento y un botón para agregar.
   Usa la misma sesión que la Configuración del panel (cookie HttpOnly). */

const $ = (id) => document.getElementById(id);

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ORDEN = [1, 2, 3, 4, 5, 6, 0]; // la semana empieza el lunes

const CPUS = [1, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 88, 104]
  .map((n) => [`${n}T`, n === 1 ? '1 procesador' : `${n} procesadores`]);
const RAMS = [256, 512, 1024, 2048, 3072, 4096, 6144, 8192, 10240, 12288, 16384, 24576, 32768,
  49152, 65536, 98304, 131072, 200704, 262144, 327680, 393216, 458752, 524288]
  .map((mb) => [String(mb), mb < 1024 ? `${mb} MB` : `${mb / 1024} GB`]);

let crons = [];

/* ---------- Utilidades ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
  toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

class ErrorApi extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
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
  if (!res.ok) throw new ErrorApi(datos?.error || `Error ${res.status}`, res.status);
  return datos;
}

const llenarSelect = (id, opciones, vacio) => {
  $(id).innerHTML = (vacio ? `<option value="">${esc(vacio)}</option>` : '')
    + opciones.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
};

/* ---------- Diálogo genérico ---------- */

function pedir({ titulo, mensaje = '', campos = [], confirmar = 'Confirmar', peligro = false }) {
  return new Promise((resolve) => {
    const dlg = $('dlg');
    const form = $('dlgForm');
    $('dlgTitulo').textContent = titulo;
    $('dlgMensaje').textContent = mensaje;
    $('dlgCampos').innerHTML = campos.map((c) => `
      <label class="field">${esc(c.label)}
        <input name="${esc(c.name)}" type="${esc(c.type || 'text')}" value="${esc(c.value || '')}"
               maxlength="60" required autocomplete="off">
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
    form.onsubmit = (e) => { e.preventDefault(); terminar(Object.fromEntries(new FormData(form))); };
    $('dlgCancel').onclick = () => terminar(null);
    dlg.oncancel = () => terminar(null);
    dlg.showModal();
    dlg.querySelector('input')?.focus();
  });
}

/* ---------- Interpretación del horario ---------- */

const todos = (arr) => arr.length === 1 && arr[0] === -1;
const pad = (n) => String(n).padStart(2, '0');

/* Días como texto: "Lun a Jue", "Sáb", "Vie y Sáb". */
function textoDias(wdays) {
  if (todos(wdays)) return 'Todos los días';
  const idx = wdays.map((d) => ORDEN.indexOf(d)).sort((a, b) => a - b);
  const grupos = [];
  for (const i of idx) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && i === ultimo[ultimo.length - 1] + 1) ultimo.push(i);
    else grupos.push([i]);
  }
  return grupos.map((g) => {
    const nombres = g.map((i) => DIAS_CORTO[ORDEN[i]]);
    return nombres.length >= 3 ? `${nombres[0]} a ${nombres[nombres.length - 1]}` : nombres.join(' y ');
  }).join(', ');
}

/* Suma minutos a { dias, hora, minuto }; si cruza la medianoche corre los días. */
function sumarMinutos({ dias, hora, minuto }, minutos) {
  const total = hora * 60 + minuto + minutos;
  const salto = Math.floor(total / 1440);
  const resto = ((total % 1440) + 1440) % 1440;
  return { dias: dias.map((d) => (((d + salto) % 7) + 7) % 7), hora: Math.floor(resto / 60), minuto: resto % 60 };
}

/* Horarios "HH:MM" cuando horas y minutos son explícitos; null si no. */
function horarios(s) {
  if (todos(s.hours) || todos(s.minutes)) return null;
  const out = [];
  for (const h of s.hours) for (const m of s.minutes) out.push(`${pad(h)}:${pad(m)}`);
  return out;
}

function textoHorario(s) {
  const h = horarios(s);
  let texto;
  if (h) texto = `a las ${h.join(', ')}`;
  else if (todos(s.hours) && todos(s.minutes)) texto = 'cada minuto';
  else if (todos(s.hours)) texto = `cada hora, en el minuto ${s.minutes.join(', ')}`;
  else texto = `todos los minutos de las ${s.hours.map(pad).join(', ')} h`;
  const extra = [];
  if (!todos(s.mdays)) extra.push(`solo los días ${s.mdays.join(', ')} del mes`);
  if (!todos(s.months)) extra.push(`solo en los meses ${s.months.join(', ')}`);
  return `${textoDias(s.wdays)} ${texto}${extra.length ? ` (${extra.join('; ')})` : ''}`;
}

const etiquetaRam = (mb) => (mb < 1024 ? `${mb} MB` : `${mb / 1024} GB`);

/* Cómo se muestra un cron en el cronograma. */
function infoEvento(c) {
  let q;
  try { q = new URL(c.url).searchParams; } catch { q = new URLSearchParams(); }
  if (c.tipo === 'encendido') return { clase: 'on', icono: '▲', texto: 'Encender', detalle: '' };
  if (c.tipo === 'configurar') {
    const partes = [];
    if (q.get('cpu')) partes.push(`CPU ${q.get('cpu').toUpperCase().replace(/T?$/, 'T')}`);
    if (q.get('ram')) partes.push(`RAM ${etiquetaRam(Number(q.get('ram')))}`);
    return { clase: 'cfg', icono: '⚙', texto: 'Configurar', detalle: partes.join(' · ') };
  }
  if (c.tipo === 'apagado') return { clase: 'off', icono: '▼', texto: 'Apagar', detalle: '' };
  return { clase: 'otro', icono: '•', texto: c.titulo, detalle: '' };
}

const fechaHora = (ms, tz) => {
  if (!ms) return '—';
  try { return new Date(ms).toLocaleString('es-AR', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }); }
  catch { return new Date(ms).toLocaleString('es-AR'); }
};

/* ---------- Render ---------- */

function htmlEvento(c, hora) {
  const { clase, icono, texto, detalle } = infoEvento(c);
  const estado = `Última: ${c.ultimoEstado}${c.ultimaEjecucion ? ` (${fechaHora(c.ultimaEjecucion, c.schedule.timezone)})` : ''}`
    + ` · Próxima: ${fechaHora(c.proximaEjecucion, c.schedule.timezone)}`;
  return `<li class="ev ev--${clase}${c.habilitado ? '' : ' ev--pausa'}" title="${esc(`${c.titulo}\n${estado}`)}">
    <b class="ev__hora">${hora || ''}</b>
    <span class="ev__txt">${icono} ${esc(texto)}
      ${detalle ? `<small>${esc(detalle)}</small>` : ''}
      ${c.habilitado ? '' : '<small>⏸ pausado</small>'}
      ${!c.habilitado || c.ultimoOk || !c.ultimaEjecucion ? '' : `<small class="error">Falló: ${esc(c.ultimoEstado)}</small>`}
    </span>
    <span class="ev__acc">
      <button class="ev__btn" type="button" data-editar="${c.id}" aria-label="Editar: ${esc(c.titulo)}">Editar</button>
      <button class="ev__btn" type="button" data-alternar="${c.id}" aria-label="${c.habilitado ? 'Pausar' : 'Activar'}: ${esc(c.titulo)}">${c.habilitado ? 'Pausar' : 'Activar'}</button>
    </span>
  </li>`;
}

function pintar() {
  const porDia = new Map(DIAS.map((_, i) => [i, []]));
  const especiales = [];

  for (const c of crons) {
    const h = horarios(c.schedule);
    if (!h || c.tipo === 'otro') { especiales.push(c); continue; }
    const dias = todos(c.schedule.wdays) ? [0, 1, 2, 3, 4, 5, 6] : c.schedule.wdays;
    for (const d of dias) for (const hora of h) porDia.get(d).push({ hora, cron: c });
  }

  $('semana').innerHTML = ORDEN.map((d) => {
    const eventos = porDia.get(d).sort((a, b) => a.hora.localeCompare(b.hora));
    const lis = eventos.length
      ? eventos.map(({ hora, cron }) => htmlEvento(cron, hora)).join('')
      : '<li class="vacio">Sin eventos</li>';
    return `<div class="dia"><h3>${DIAS[d]}</h3><ul>${lis}</ul></div>`;
  }).join('');

  $('especialesSec').hidden = !especiales.length;
  $('especiales').innerHTML = especiales.map((c) => `
    <li class="especial">
      <p><b>${esc(c.titulo)}</b><br><span class="muted small">${esc(textoHorario(c.schedule))}</span></p>
      <ul class="ev-lista">${htmlEvento(c, '')}</ul>
    </li>`).join('');

  const activos = crons.filter((c) => c.habilitado).length;
  $('resumen').textContent = `${crons.length} crons (${activos} activos)`;
}

/* ---------- Acceso ---------- */

function mostrarGate() {
  $('contenido').hidden = true;
  $('gate').hidden = false;
}

async function desbloquear() {
  const v = await pedir({
    titulo: 'Acceso al cronograma',
    mensaje: 'Ingresá la contraseña.',
    campos: [{ name: 'password', label: 'Contraseña', type: 'password' }],
    confirmar: 'Desbloquear',
  });
  if (!v) return;
  try {
    await api('session', { method: 'POST', body: { password: v.password } });
    await cargar();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function cargar() {
  try {
    const d = await api('crons');
    crons = d.crons;
    $('gate').hidden = true;
    $('contenido').hidden = false;
    pintar();
  } catch (error) {
    if (error.status === 401 || error.status === 403) return mostrarGate();
    $('gate').hidden = true;
    $('contenido').hidden = false;
    toast(error.message, 'error');
  }
}

$('btnDesbloquear').addEventListener('click', desbloquear);
$('btnActualizar').addEventListener('click', cargar);
$('btnBloquear').addEventListener('click', async () => {
  await api('session', { method: 'DELETE' }).catch(() => {});
  mostrarGate();
});

/* ---------- Pausar / activar ---------- */

async function alternar(id) {
  const c = crons.find((x) => x.id === id);
  if (!c) return;
  const nuevo = !c.habilitado;
  const info = infoEvento(c);
  const v = await pedir({
    titulo: `${nuevo ? 'Activar' : 'Pausar'} cron`,
    mensaje: `${c.titulo}\n${info.texto} · ${textoHorario(c.schedule)}\n${nuevo ? 'Volverá a ejecutarse en su horario.' : 'No se ejecutará hasta que lo actives de nuevo.'}`,
    campos: [{ name: 'nombre', label: 'Tu nombre', value: guardado('nombre') }],
    confirmar: nuevo ? 'Activar' : 'Pausar',
    peligro: !nuevo,
  });
  if (!v || !v.nombre.trim()) return;
  guardado('nombre', v.nombre.trim());
  try {
    await guardar(id, { habilitado: nuevo, nombre: v.nombre.trim() });
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* Envía cambios a un cron y actualiza la vista. Los errores se propagan. */
async function guardar(id, cambios) {
  try {
    const r = await api('crons', { method: 'PATCH', body: { id, ...cambios } });
    if (!r.cambios.length) return toast('No había cambios para guardar.');
    crons = crons.map((c) => (c.id === id ? r.cron : c));
    pintar();
    toast(`Guardado: ${r.cambios.join(', ')}.`, 'ok');
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      $('dlgCron').close();
      mostrarGate();
    }
    throw error;
  }
}

/* ---------- Editor ---------- */

let editando = null;

const leerLista = (texto) => String(texto).split(/[,\s]+/).filter(Boolean).map(Number);

const chipsDias = (id, activos) => {
  $(id).innerHTML = ORDEN.map((d) => `
    <label class="chip"><input type="checkbox" value="${d}" ${activos.includes(d) ? 'checked' : ''}>
      <span>${DIAS_CORTO[d]}</span></label>`).join('');
};
const diasElegidos = (id) => [...document.querySelectorAll(`#${id} input:checked`)].map((i) => Number(i.value));

function estadoForm() {
  return {
    wdays: diasElegidos('cronDias'),
    hours: leerLista($('cronHoras').value),
    minutes: leerLista($('cronMinutos').value),
  };
}

function previaEditor() {
  const s = estadoForm();
  const valido = s.wdays.length && s.hours.length && s.minutes.length
    && s.hours.every((h) => Number.isInteger(h) && h >= 0 && h <= 23)
    && s.minutes.every((m) => Number.isInteger(m) && m >= 0 && m <= 59);
  $('cronPrevia').textContent = valido
    ? `Quedaría: ${textoHorario({ ...editando.schedule, ...s, wdays: s.wdays.length === 7 ? [-1] : s.wdays })}`
    : 'Completá días, horas (0–23) y minutos (0–59) válidos.';
}

function abrirEditor(id) {
  editando = crons.find((c) => c.id === id);
  if (!editando) return;
  const s = editando.schedule;
  const info = infoEvento(editando);
  const activos = todos(s.wdays) ? [0, 1, 2, 3, 4, 5, 6] : s.wdays;

  $('cronTitulo').textContent = editando.titulo;
  $('cronSub').textContent = `${info.icono} ${info.texto}. Los cambios valen para todos sus días (${textoDias(s.wdays)}).`;
  chipsDias('cronDias', activos);
  $('cronHoras').value = todos(s.hours) ? '' : s.hours.join(', ');
  $('cronMinutos').value = todos(s.minutes) ? '' : s.minutes.join(', ');
  $('cronNombre').value = guardado('nombre');
  $('cronError').hidden = true;

  // CPU/RAM para los crons de "configurar"; URL editable solo para los de tipo desconocido.
  $('cronCfg').hidden = editando.tipo !== 'configurar';
  $('cronUrlBloque').hidden = editando.tipo !== 'otro';
  $('cronUrl').required = editando.tipo === 'otro';
  $('cronUrl').value = editando.tipo === 'otro' ? editando.url : '';
  if (editando.tipo === 'configurar') {
    const q = new URL(editando.url).searchParams;
    $('cronCpu').value = q.get('cpu') ? q.get('cpu').toUpperCase().replace(/T?$/, 'T') : '';
    $('cronRam').value = q.get('ram') || '';
  }

  const notas = [];
  if (!todos(s.mdays)) notas.push(`solo los días ${s.mdays.join(', ')} del mes`);
  if (!todos(s.months)) notas.push(`solo en los meses ${s.months.join(', ')}`);
  if (todos(s.hours) || todos(s.minutes)) notas.push('hoy corre en todas las horas o minutos: al guardar tenés que elegir valores concretos');
  $('cronNota').textContent = notas.length ? `Nota: ${notas.join('; ')}. Lo que no se edita acá se conserva.` : '';
  $('cronNota').hidden = !notas.length;

  previaEditor();
  $('dlgCron').showModal();
}

$('semana').addEventListener('click', clicEvento);
$('especiales').addEventListener('click', clicEvento);

function clicEvento(e) {
  const ed = e.target.closest('[data-editar]');
  if (ed) return abrirEditor(Number(ed.dataset.editar));
  const al = e.target.closest('[data-alternar]');
  if (al) alternar(Number(al.dataset.alternar));
}

$('cronForm').addEventListener('input', previaEditor);
$('cronCancelar').addEventListener('click', () => $('dlgCron').close());

$('cronForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const s = estadoForm();
  const err = $('cronError');
  err.hidden = true;
  const nombre = $('cronNombre').value.trim();
  guardado('nombre', nombre);

  const cambios = { nombre, schedule: { hours: s.hours, minutes: s.minutes, wdays: s.wdays } };
  if (editando.tipo === 'configurar') {
    const cpu = $('cronCpu').value;
    const ram = $('cronRam').value;
    if (!cpu && !ram) {
      err.textContent = 'Elegí la CPU y/o la RAM a configurar.';
      err.hidden = false;
      return;
    }
    const q = new URLSearchParams();
    if (cpu) q.set('cpu', cpu);
    if (ram) q.set('ram', ram);
    cambios.url = `${new URL(editando.url).origin}/api/cron/configurar?${q}`;
  } else if (editando.tipo === 'otro') {
    cambios.url = $('cronUrl').value.trim();
  }

  try {
    await guardar(editando.id, cambios);
    $('dlgCron').close();
  } catch (error) {
    err.textContent = error.message;
    err.hidden = false;
  }
});

/* ---------- Agregar cron ---------- */

function estadoNuevo() {
  const [h, m] = ($('nuevoHora').value || '').split(':').map(Number);
  const tipo = $('nuevoTipo').value;
  const conCfg = tipo === 'configurar' || (tipo === 'apagado' && $('nuevoConCfg').checked);
  return {
    tipo,
    dias: diasElegidos('nuevoDias'),
    hora: h, minuto: m,
    cpu: conCfg ? $('nuevoCpu').value : '',
    ram: conCfg ? $('nuevoRam').value : '',
    conCfg,
  };
}

function textoCfg({ cpu, ram }) {
  return [cpu && `CPU ${cpu}`, ram && `RAM ${etiquetaRam(Number(ram))}`].filter(Boolean).join(', ');
}

function previaNuevo() {
  const n = estadoNuevo();
  const esApagado = n.tipo === 'apagado';
  $('nuevoCfgSwitch').hidden = !esApagado;
  $('nuevoCfg').hidden = !n.conCfg;
  $('nuevoHoraEtiqueta').textContent = esApagado && n.conCfg ? 'Hora de inicio (cambia la configuración)' : 'Hora';

  const valido = n.dias.length && Number.isInteger(n.hora) && Number.isInteger(n.minuto);
  if (!valido) { $('nuevoPrevia').textContent = 'Elegí al menos un día y una hora.'; return; }
  if (n.conCfg && !n.cpu && !n.ram) { $('nuevoPrevia').textContent = 'Elegí la CPU y/o la RAM.'; return; }

  const hhmm = (h, m) => `${pad(h)}:${pad(m)}`;
  const dias = textoDias(n.dias.length === 7 ? [-1] : n.dias);
  let texto;
  if (n.tipo === 'encendido') texto = `Enciende ${dias} a las ${hhmm(n.hora, n.minuto)}.`;
  else if (n.tipo === 'configurar') texto = `Cambia la configuración (${textoCfg(n)}) ${dias} a las ${hhmm(n.hora, n.minuto)}.`;
  else if (!n.conCfg) texto = `Apaga ${dias} a las ${hhmm(n.hora, n.minuto)}.`;
  else {
    const despues = sumarMinutos(n, 2);
    const dias2 = textoDias(despues.dias.length === 7 ? [-1] : despues.dias);
    texto = `${dias} ${hhmm(n.hora, n.minuto)}: cambia la configuración (${textoCfg(n)}). `
      + `${dias2} ${hhmm(despues.hora, despues.minuto)}: apaga. Se crean 2 crons.`;
  }
  $('nuevoPrevia').textContent = texto;
}

function abrirNuevo() {
  $('nuevoTipo').value = 'encendido';
  chipsDias('nuevoDias', [1, 2, 3, 4, 5]);
  $('nuevoHora').value = '09:00';
  $('nuevoConCfg').checked = false;
  $('nuevoCpu').value = '';
  $('nuevoRam').value = '';
  $('nuevoNombre').value = guardado('nombre');
  $('nuevoError').hidden = true;
  previaNuevo();
  $('dlgNuevo').showModal();
}

$('btnNuevo').addEventListener('click', abrirNuevo);
$('nuevoForm').addEventListener('input', previaNuevo);
$('nuevoForm').addEventListener('change', previaNuevo);
$('nuevoCancelar').addEventListener('click', () => $('dlgNuevo').close());

$('nuevoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const n = estadoNuevo();
  const err = $('nuevoError');
  err.hidden = true;
  const nombre = $('nuevoNombre').value.trim();
  guardado('nombre', nombre);

  if (!n.dias.length) { err.textContent = 'Elegí al menos un día.'; err.hidden = false; return; }
  if (n.conCfg && !n.cpu && !n.ram) { err.textContent = 'Elegí la CPU y/o la RAM.'; err.hidden = false; return; }

  const boton = $('nuevoOk');
  boton.disabled = true;
  try {
    const r = await api('crons', {
      method: 'POST',
      body: { nombre, tipo: n.tipo, dias: n.dias, hora: n.hora, minuto: n.minuto, cpu: n.cpu, ram: n.ram },
    });
    crons = [...crons, ...r.crons];
    pintar();
    $('dlgNuevo').close();
    toast(`Creado: ${r.crons.map((c) => c.titulo).join(' + ')}`, 'ok');
  } catch (error) {
    if (error.status === 401 || error.status === 403) { $('dlgNuevo').close(); mostrarGate(); return; }
    err.textContent = error.message;
    err.hidden = false;
  } finally {
    boton.disabled = false;
  }
});

/* ---------- Arranque ---------- */

async function arrancar() {
  llenarSelect('cronCpu', CPUS, 'No cambiar');
  llenarSelect('cronRam', RAMS, 'No cambiar');
  llenarSelect('nuevoCpu', CPUS, 'No cambiar');
  llenarSelect('nuevoRam', RAMS, 'No cambiar');
  try {
    const s = await api('session');
    if (s.cfg) return cargar();
  } catch { /* se muestra el acceso */ }
  mostrarGate();
  desbloquear();
}

arrancar();
