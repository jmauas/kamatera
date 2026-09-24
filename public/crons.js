/* Administración de los crons de encendido/apagado (cron-job.org).
   Usa la misma sesión que la Configuración del panel (cookie HttpOnly). */

const $ = (id) => document.getElementById(id);

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ORDEN = [1, 2, 3, 4, 5, 6, 0]; // la semana empieza el lunes

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
  toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
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
  const partes = grupos.map((g) => {
    const nombres = g.map((i) => DIAS_CORTO[ORDEN[i]]);
    if (nombres.length >= 3) return `${nombres[0]} a ${nombres[nombres.length - 1]}`;
    return nombres.join(' y ');
  });
  return partes.join(', ');
}

/* Horarios como lista "HH:MM" cuando horas y minutos son explícitos; null si no. */
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

const esEncendido = (c) => /\/encendido/i.test(c.url) || /^encendido/i.test(c.titulo.trim());

/* Detalle legible de la URL de un apagado: CPU y última fase. */
function detalleUrl(c) {
  try {
    const q = new URL(c.url).searchParams;
    const partes = [];
    if (q.get('cpu')) partes.push(`CPU ${q.get('cpu').replace(/t$/i, '')}T`);
    if (q.get('final') === '1' || q.get('final') === 'true') partes.push('última fase');
    return partes.join(', ');
  } catch { return ''; }
}

const rutaUrl = (url) => { try { const u = new URL(url); return u.pathname + u.search; } catch { return url; } };

const fechaHora = (ms, tz) => {
  if (!ms) return '—';
  try { return new Date(ms).toLocaleString('es-AR', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }); }
  catch { return new Date(ms).toLocaleString('es-AR'); }
};

/* ---------- Render ---------- */

function pintarSemana() {
  const porDia = new Map(DIAS.map((_, i) => [i, []]));
  let especiales = 0;

  for (const c of crons) {
    const h = horarios(c.schedule);
    if (!h) { especiales++; continue; }
    const dias = todos(c.schedule.wdays) ? [0, 1, 2, 3, 4, 5, 6] : c.schedule.wdays;
    for (const d of dias) {
      for (const hora of h) porDia.get(d).push({ hora, cron: c });
    }
  }

  $('semana').innerHTML = ORDEN.map((d) => {
    const eventos = porDia.get(d).sort((a, b) => a.hora.localeCompare(b.hora));
    const lis = eventos.length ? eventos.map(({ hora, cron }) => {
      const on = esEncendido(cron);
      const det = on ? '' : detalleUrl(cron);
      return `<li class="ev ev--${on ? 'on' : 'off'}${cron.habilitado ? '' : ' ev--pausa'}">
        <b class="ev__hora">${hora}</b>
        <span>${on ? '▲ Encendido' : '▼ Apagado'}${det ? `<small>${esc(det)}</small>` : ''}${cron.habilitado ? '' : '<small>pausado</small>'}</span>
      </li>`;
    }).join('') : '<li class="vacio">Sin eventos</li>';
    return `<div class="dia"><h3>${DIAS[d]}</h3><ul>${lis}</ul></div>`;
  }).join('');

  return especiales;
}

function pintarLista() {
  $('lista').innerHTML = crons.map((c) => `
    <article class="cron${c.habilitado ? '' : ' cron--pausa'}">
      <header class="cron__cab">
        <h3>${esc(c.titulo)}</h3>
        <span class="badge ${c.habilitado ? 'badge--on' : 'badge--neutral'}">${c.habilitado ? 'Activo' : 'Pausado'}</span>
      </header>
      <p class="cron__sched">${esc(textoHorario(c.schedule))}</p>
      <p class="muted small">Hora de ${esc(c.schedule.timezone)}</p>
      <code class="cron__url" title="${esc(c.url)}">${esc(rutaUrl(c.url))}</code>
      <p class="muted small">
        Última ejecución: <b class="${c.ultimoOk || !c.ultimaEjecucion ? '' : 'error'}">${esc(c.ultimoEstado)}</b>
        ${c.ultimaEjecucion ? `(${esc(fechaHora(c.ultimaEjecucion, c.schedule.timezone))})` : ''}
        · Próxima: ${esc(fechaHora(c.proximaEjecucion, c.schedule.timezone))}
      </p>
      <div class="cron__acc">
        <button class="btn btn--primary btn--sm" type="button" data-editar="${c.id}">Editar</button>
        <button class="btn btn--neutral btn--sm" type="button" data-alternar="${c.id}">${c.habilitado ? 'Pausar' : 'Activar'}</button>
      </div>
    </article>`).join('') || '<p class="muted">No se encontraron crons de encendido o apagado.</p>';
}

function pintar() {
  const especiales = pintarSemana();
  pintarLista();
  const activos = crons.filter((c) => c.habilitado).length;
  $('resumen').textContent = `${crons.length} crons (${activos} activos)` +
    (especiales ? ` · ${especiales} con horario especial no se muestran en la semana` : '');
}

/* ---------- Acceso ---------- */

function mostrarGate() {
  $('contenido').hidden = true;
  $('gate').hidden = false;
}

async function desbloquear() {
  const v = await pedir({
    titulo: 'Acceso a Crons',
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
  const v = await pedir({
    titulo: `${nuevo ? 'Activar' : 'Pausar'} cron`,
    mensaje: `${c.titulo}\n${nuevo ? 'Volverá a ejecutarse en su horario.' : 'No se ejecutará hasta que lo actives de nuevo.'}`,
    campos: [{ name: 'nombre', label: 'Tu nombre', value: guardado('nombre') }],
    confirmar: nuevo ? 'Activar' : 'Pausar',
    peligro: !nuevo,
  });
  if (!v || !v.nombre.trim()) return;
  guardado('nombre', v.nombre.trim());
  await guardar(id, { habilitado: nuevo, nombre: v.nombre.trim() });
}

/* ---------- Editor ---------- */

let editando = null;

function leerLista(texto) {
  return String(texto).split(/[,\s]+/).filter(Boolean).map(Number);
}

function estadoForm() {
  return {
    wdays: [...document.querySelectorAll('#cronDias input:checked')].map((i) => Number(i.value)),
    hours: leerLista($('cronHoras').value),
    minutes: leerLista($('cronMinutos').value),
  };
}

function previa() {
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
  const activos = todos(s.wdays) ? [0, 1, 2, 3, 4, 5, 6] : s.wdays;

  $('cronTitulo').textContent = editando.titulo;
  $('cronDias').innerHTML = ORDEN.map((d) => `
    <label class="chip"><input type="checkbox" value="${d}" ${activos.includes(d) ? 'checked' : ''}>
      <span>${DIAS_CORTO[d]}</span></label>`).join('');
  $('cronHoras').value = todos(s.hours) ? '' : s.hours.join(', ');
  $('cronMinutos').value = todos(s.minutes) ? '' : s.minutes.join(', ');
  $('cronUrl').value = editando.url;
  $('cronNombre').value = guardado('nombre');
  $('cronError').hidden = true;

  const notas = [];
  if (!todos(s.mdays)) notas.push(`solo los días ${s.mdays.join(', ')} del mes`);
  if (!todos(s.months)) notas.push(`solo en los meses ${s.months.join(', ')}`);
  if (todos(s.hours) || todos(s.minutes)) notas.push('hoy corre en todas las horas o minutos: al guardar tenés que elegir valores concretos');
  $('cronNota').textContent = notas.length ? `Nota: ${notas.join('; ')}. Lo que no se edita acá se conserva.` : '';
  $('cronNota').hidden = !notas.length;

  previa();
  $('dlgCron').showModal();
}

$('lista').addEventListener('click', (e) => {
  const ed = e.target.closest('[data-editar]');
  if (ed) return abrirEditor(Number(ed.dataset.editar));
  const al = e.target.closest('[data-alternar]');
  if (al) alternar(Number(al.dataset.alternar));
});

$('cronForm').addEventListener('input', previa);
$('cronCancelar').addEventListener('click', () => $('dlgCron').close());

$('cronForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const s = estadoForm();
  const err = $('cronError');
  err.hidden = true;
  const nombre = $('cronNombre').value.trim();
  guardado('nombre', nombre);
  try {
    await guardar(editando.id, {
      nombre,
      url: $('cronUrl').value.trim(),
      schedule: { hours: s.hours, minutes: s.minutes, wdays: s.wdays },
    }, true);
    $('dlgCron').close();
  } catch (error) {
    err.textContent = error.message;
    err.hidden = false;
  }
});

/* Envía los cambios. Con `propagar` los errores vuelven al llamador (el editor los muestra en el formulario). */
async function guardar(id, cambios, propagar = false) {
  try {
    const r = await api('crons', { method: 'PATCH', body: { id, ...cambios } });
    if (!r.cambios.length) {
      toast('No había cambios para guardar.');
      return;
    }
    crons = crons.map((c) => (c.id === id ? r.cron : c));
    pintar();
    toast(`Guardado: ${r.cambios.join(', ')}.`, 'ok');
  } catch (error) {
    if (error.status === 401 || error.status === 403) { $('dlgCron').close(); mostrarGate(); return; }
    if (propagar) throw error;
    toast(error.message, 'error');
  }
}

/* ---------- Arranque ---------- */

async function arrancar() {
  try {
    const s = await api('session');
    if (s.cfg) return cargar();
  } catch { /* se muestra el acceso */ }
  mostrarGate();
  desbloquear();
}

arrancar();
