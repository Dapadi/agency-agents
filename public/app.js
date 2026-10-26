const $ = (s) => document.querySelector(s);
const COLORS = { purple:'#8b5cf6', blue:'#3b82f6', green:'#10b981', orange:'#f59e0b', red:'#ef4444', pink:'#ec4899', cyan:'#06b6d4', yellow:'#eab308', indigo:'#6366f1', teal:'#14b8a6', gray:'#64748b' };
const PEOPLE = ['🧑‍💻','👩‍💻','👨‍💼','👩‍🔬','🧑‍🎨','👨‍🔧','👩‍💼','🧑‍🚀'];

let allAgents = [];
let office = [];

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
    $('#sourceInfo').textContent = 'Error al cargar agentes';
    allAgents = [];
  }
  const divs = sortedDivisions();
  $('#navAgents').textContent = allAgents.length;
  $('#navDivisions').textContent = divs.length;
  $('#sourceInfo').textContent = `${allAgents.length} agentes cargados`;
  const sel = $('#divisionFilter');
  divs.map(d => d[0]).sort().forEach(d => sel.insertAdjacentHTML('beforeend', `<option value="${esc(d)}">${esc(cap(d))}</option>`));
  pickOffice();
  renderHome();
  renderDivisions();
  route();
}

function pickOffice() { office = shuffle(allAgents.filter(a => a.emoji)).slice(0, 8); }

function renderOffice() {
  const desks = office.map((a, i) => `
    <div class="desk" data-id="${esc(a.id)}">
      <div class="bubble"><span class="badge" style="background:${color(a)}33">${esc(a.emoji)}</span>
        <span class="txt"><strong>${esc(a.title)}</strong><small>${esc(a.vibe || a.description)}</small></span></div>
      <div class="person">${PEOPLE[i % PEOPLE.length]}</div><div class="table"></div>
    </div>`).join('');
  $('#office').innerHTML = `<div class="office-title"><span class="big">✺</span><div><h1>Agency ControlHub</h1><p>Tu oficina de agentes de IA</p></div></div>${desks}`;
}

function renderHome() {
  const divs = sortedDivisions();
  renderOffice();
  $('#topDivisions').innerHTML = divs.slice(0, 6).map(([d, n]) =>
    `<li data-div="${esc(d)}"><span class="chip">📁</span>${esc(cap(d))}<span class="n">${n} agentes</span></li>`).join('');
  $('#kpis').innerHTML = [
    ['🤖', allAgents.length, 'Agentes'], ['🗂️', divs.length, 'Divisiones'],
    ['🏆', divs[0] ? divs[0][1] : 0, divs[0] ? 'En ' + cap(divs[0][0]) : 'Mayor división'],
    ['😀', allAgents.filter(a => a.emoji).length, 'Con perfil'],
  ].map(([i, v, l]) => `<div class="kpi"><div>${i}</div><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join('');
  $('#bigDivisions').innerHTML = divs.slice(0, 5).map(([d, n]) =>
    `<li data-div="${esc(d)}"><span class="chip">📂</span>${esc(cap(d))}<span class="n tag">${n}</span></li>`).join('');
  $('#featured').innerHTML = shuffle(allAgents).slice(0, 5).map(a =>
    `<li data-id="${esc(a.id)}"><span class="chip">${esc(a.emoji || '🤖')}</span>${esc(a.title)}<span class="n">${esc(a.division)}</span></li>`).join('');
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
  const v = ['home', 'agents', 'divisions'].includes(view) ? view : 'home';
  document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== 'view-' + v);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === v));
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
$('#qaAgents').onclick = () => go('agents', '');
$('#qaDivisions').onclick = () => go('divisions');
$('#qaShuffle').onclick = () => { pickOffice(); renderOffice(); };
$('#qaRandom').onclick = () => allAgents.length && showAgent(allAgents[Math.floor(Math.random() * allAgents.length)].id);
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());
window.addEventListener('hashchange', route);

function tick() {
  const d = new Date();
  $('#clock').textContent = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const h = d.getHours();
  $('#greeting').textContent = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}
tick(); setInterval(tick, 30000);
load();
