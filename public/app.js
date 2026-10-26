const $ = (s) => document.querySelector(s);
const COLORS = { purple:'#8b5cf6', blue:'#3b82f6', green:'#10b981', orange:'#f59e0b', red:'#ef4444', pink:'#ec4899', cyan:'#06b6d4', yellow:'#eab308', indigo:'#6366f1', teal:'#14b8a6', gray:'#64748b' };

let allAgents = [];

const esc = (t) => { const d = document.createElement('div'); d.textContent = t ?? ''; return d.innerHTML; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const color = (a) => COLORS[(a.color || '').toLowerCase()] || (/^#|^rgb/.test(a.color || '') ? a.color : '#3b82f6');
const byDivision = () => allAgents.reduce((m, a) => ((m[a.division] = (m[a.division] || 0) + 1), m), {});
const sortedDivisions = () => Object.entries(byDivision()).sort((a, b) => b[1] - a[1]);
const shuffle = (arr) => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

async function load() {
  try {
    const r = await fetch('/api/agents');
    if (!r.ok) throw new Error(r.status);
    allAgents = await r.json();
    if (!Array.isArray(allAgents)) throw new Error('bad response');
  } catch (e) {
    console.error(e);
    console.warn('sin agentes');
    allAgents = [];
  }
  const divs = sortedDivisions();
  $('#navAgents').textContent = allAgents.length;
    const sel = $('#divisionFilter');
  divs.map(d => d[0]).sort().forEach(d => sel.insertAdjacentHTML('beforeend', `<option value="${esc(d)}">${esc(cap(d))}</option>`));
  renderHome();
  renderDivisions();
  route();
}

// Contenido de demostración: aún no hay backend para estas secciones.
const DEMO_ACTIVITY = [
  ['✅', 'Desarrollador Full Stack', 'Completado: análisis de código', 'hace 12 min'],
  ['⚡', 'Automatización Backup', 'Ejecutada correctamente', 'hace 25 min'],
  ['🤖', 'Analista de Negocio', 'Inicio nueva tarea de análisis', 'hace 28 min'],
  ['📄', 'Revisar documentación', 'Asignada a Asistente Personal', 'hace 1 h'],
  ['🎨', 'Diseñador UI/UX', 'Pausado por límite de tokens', 'hace 3 h'],
  ['⛔', 'Error en test automatizados', 'Falló la ejecución en entorno de pruebas', 'hace 4 h'],
];
const DEMO_TASKS = [
  ['Revisar documentación API', 'Alta', 'hace 12 min'], ['Corregir error en facturación', 'Alta', 'hace 25 min'],
  ['Implementar UI móvil', 'Media', 'hace 1 h'], ['Pruebas de integración', 'Media', 'hace 2 h'],
];
const DEMO_PROJECTS = [
  ['ControlHub', 'En progreso'], ['FichaFácil', 'En progreso'], ['TimeSchool', 'En pausa'], ['Academiq', 'Activo'], ['Web personal', 'En pausa'],
];

function renderHome() {
  $('#activity').innerHTML = DEMO_ACTIVITY.map(([i, t, d, h]) =>
    `<li><span class="chip">${i}</span><span><strong>${esc(t)}</strong><small>${esc(d)}</small></span><span class="n">${esc(h)}</span></li>`).join('');
  $('#kpis').innerHTML = [
    ['🤖', allAgents.length, 'Agentes activos'], ['⚡', 4, 'Automatizaciones'], ['⏱️', 3, 'Tareas en curso'], ['📁', 5, 'Proyectos'],
  ].map(([i, v, l]) => `<div class="kpi"><div>${i}</div><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join('');
  $('#tasks').innerHTML = DEMO_TASKS.map(([t, p, h]) =>
    `<li>${esc(t)}<span class="n"><span class="prio ${p.toLowerCase()}">${p}</span> ${esc(h)}</span></li>`).join('');
  $('#projects').innerHTML = DEMO_PROJECTS.map(([t, st]) =>
    `<li>📁 ${esc(t)}<span class="n"><span class="st ${st === 'Activo' ? 'ok' : ''}">${esc(st)}</span></span></li>`).join('');
}

function cardHtml(a) {
  return `<div class="card" data-id="${esc(a.id)}" style="--accent:${color(a)}">
    <h4>${esc((a.emoji ? a.emoji + ' ' : '') + a.title)}</h4>
    <p>${esc(a.description || a.content)}</p>
    <div class="meta"><span>📁 ${esc(a.division)}</span><button class="btn" data-copy="${esc(a.id)}">Copiar</button></div></div>`;
}

function renderAgents() {
  const q = $('#searchInput').value.trim().toLowerCase();
  const div = $('#divisionFilter').value;
  const list = allAgents.filter(a =>
    (!div || a.division === div) &&
    (!q || [a.title, a.id, a.division, a.description, a.vibe].some(x => (x || '').toLowerCase().includes(q))));
  $('#resultCount').textContent = `${list.length} resultados`;
  $('#agentsGrid').innerHTML = list.length ? list.map(cardHtml).join('') : '<div class="no-results">No se encontraron agentes.</div>';
}

function renderDivisions() {
  $('#divGrid').innerHTML = sortedDivisions().map(([d, n]) =>
    `<div class="card" data-div="${esc(d)}"><h4>📁 ${esc(cap(d))}</h4><p>${n} agentes en esta división</p></div>`).join('');
}

function showAgent(id) {
  const a = allAgents.find(x => x.id === id);
  if (!a) return;
  $('#modalBody').innerHTML = `<h2>${esc((a.emoji ? a.emoji + ' ' : '') + a.title)}</h2>
    <div class="meta-line"><span>📁 ${esc(a.division)}</span><span>📄 ${esc(a.filename)}</span>${a.color ? `<span>🎨 ${esc(a.color)}</span>` : ''}</div>
    ${a.vibe ? `<p class="muted"><em>${esc(a.vibe)}</em></p>` : ''}
    <p>${esc(a.description)}</p>
    <pre>${esc((a.fullContent || '').slice(0, 4000))}</pre>
    <button class="btn" data-copyfull="${esc(a.id)}">📋 Copiar agente completo</button>`;
  $('#modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal() { $('#modal').classList.remove('active'); document.body.style.overflow = ''; }

function copy(text) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(() => alert('✅ Copiado al portapapeles'), () => alert('❌ Error al copiar'));
}

function route() {
  const view = (location.hash.slice(1) || 'home');
  const known = ['home', 'agents', 'divisions'];
  const v = known.includes(view) ? view : 'soon';
  document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== 'view-' + v);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + view));
  if (v === 'soon') $('#soonTitle').textContent = cap(view);
  if (v === 'agents') renderAgents();
}
function go(view, div) {
  if (div !== undefined) $('#divisionFilter').value = div;
  if (location.hash === '#' + view) route(); else location.hash = view;
}

document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('.modal-close') || t === $('#modal')) return closeModal();
  const cp = t.closest('[data-copy]'); if (cp) { e.stopPropagation(); const a = allAgents.find(x => x.id === cp.dataset.copy); return a && copy(`${a.title}\nDivisión: ${a.division}\nArchivo: ${a.filename}`); }
  const cf = t.closest('[data-copyfull]'); if (cf) { const a = allAgents.find(x => x.id === cf.dataset.copyfull); return a && copy(a.fullContent); }
  const dv = t.closest('[data-div]'); if (dv) return go('agents', dv.dataset.div);
  const ag = t.closest('[data-id]'); if (ag) return showAgent(ag.dataset.id);
});
$('#searchInput').addEventListener('input', () => { if (location.hash !== '#agents') go('agents'); else renderAgents(); });
$('#divisionFilter').addEventListener('change', renderAgents);
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());
window.addEventListener('hashchange', route);

function tick() {
  const d = new Date();
  $('#clock').textContent = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const h = d.getHours();
  $('#greeting').textContent = (h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches') + ', David';
}
tick(); setInterval(tick, 30000);
load();
