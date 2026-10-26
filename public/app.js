const $ = (s) => document.querySelector(s);
const COLORS = { purple:'#8b5cf6', blue:'#3b82f6', green:'#10b981', orange:'#f59e0b', red:'#ef4444', pink:'#ec4899', cyan:'#06b6d4', yellow:'#eab308', indigo:'#6366f1', teal:'#14b8a6', gray:'#64748b' };
const SHIRTS = ['#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#ef4444','#14b8a6'];
const HAIR = ['#2b1d14','#111','#6b3f1d','#c58b3a','#4a1f4a','#1f2937'];
const OFFICE_EMOJIS = ['🏢','📸','🎓','💼','🛒','💻','🎨','📣','⚙️','🧪','🏥','⚖️','🎮','🚀'];
const STORE_KEY = 'agency-controlhub.offices.v1';

let allAgents = [];
let store = { offices: [], active: null };

const esc = (t) => { const d = document.createElement('div'); d.textContent = t ?? ''; return d.innerHTML; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const color = (a) => COLORS[(a.color || '').toLowerCase()] || (/^#|^rgb/.test(a.color || '') ? a.color : '#3b82f6');
const byId = (id) => allAgents.find(a => a.id === id);
const shuffle = (arr) => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
const uid = () => 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const activeOffice = () => store.offices.find(o => o.id === store.active) || store.offices[0] || null;
const inOffice = (o, id) => !!o && o.agents.some(x => x.id === id);

// ---------- persistencia ----------
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { console.warn('No se pudo guardar', e); } }
function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (raw && Array.isArray(raw.offices)) store = raw;
  } catch (e) { /* almacenamiento no disponible o corrupto */ }
  if (!store.offices.length) {
    const seed = shuffle(allAgents.filter(a => a.emoji)).slice(0, 8).map(a => ({ id: a.id, note: '' }));
    store = { offices: [{ id: uid(), name: 'Oficina principal', emoji: '🏢', agents: seed }], active: null };
    store.active = store.offices[0].id;
    save();
  }
  if (!store.offices.some(o => o.id === store.active)) store.active = store.offices[0].id;
}

// ---------- carga ----------
async function load() {
  try {
    const r = await fetch('/api/agents');
    if (!r.ok) throw new Error(r.status);
    allAgents = await r.json();
    if (!Array.isArray(allAgents)) throw new Error('bad response');
  } catch (e) { console.error(e); allAgents = []; }
  loadStore();
  const divs = divisionCounts();
  $('#navAgents').textContent = allAgents.length;
  $('#navDivisions').textContent = divs.length;
  const sel = $('#divisionFilter');
  divs.map(d => d[0]).sort().forEach(d => sel.insertAdjacentHTML('beforeend', `<option value="${esc(d)}">${esc(cap(d))}</option>`));
  renderAll();
  renderDivisions();
  route();
}
function divisionCounts(ids) {
  const list = ids ? ids.map(byId).filter(Boolean) : allAgents;
  const m = list.reduce((acc, a) => ((acc[a.division] = (acc[a.division] || 0) + 1), acc), {});
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

// ---------- render ----------
function renderAll() { renderSidebar(); renderHead(); renderOffice(); renderPanels(); if (location.hash === '#agents') renderAgents(); }

function renderSidebar() {
  $('#officeList').innerHTML = store.offices.map(o =>
    `<a href="#home" class="office-item ${o.id === store.active ? 'active' : ''}" data-open="${esc(o.id)}"><span>${esc(o.emoji)}</span><span class="nm">${esc(o.name)}</span><b>${o.agents.length}</b></a>`).join('');
}

function renderHead() {
  const o = activeOffice();
  $('#officeHead').innerHTML = `<div class="oh-title"><span class="oh-emoji">${esc(o.emoji)}</span><div><h2>${esc(o.name)}</h2><p class="muted">${o.agents.length} ${o.agents.length === 1 ? 'agente' : 'agentes'} en esta oficina</p></div></div>
    <div class="oh-actions"><button class="btn primary" data-act="add">➕ Añadir agentes</button><button class="btn" data-act="edit">✏️ Editar</button><button class="btn danger" data-act="delete">🗑️ Eliminar</button></div>`;
}

function renderOffice() {
  const o = activeOffice();
  const desks = o.agents.map((m, i) => {
    const a = byId(m.id);
    if (!a) return '';
    return `<div class="desk" data-id="${esc(a.id)}" style="--shirt:${SHIRTS[i % SHIRTS.length]};--hair:${HAIR[i % HAIR.length]};--glow:${color(a)}">
      <button class="x" data-remove="${esc(a.id)}" title="Quitar de la oficina">×</button>
      <div class="bubble"><span class="badge" style="background:${color(a)}33">${esc(a.emoji || '🤖')}</span>
        <span class="txt"><strong>${esc(a.title)}</strong><small>${esc(m.note || a.vibe || a.description)}</small></span></div>
      <div class="worker"><div class="head"></div><div class="body"></div></div>
      <div class="desktop"><span class="laptop"></span><span class="mug"></span></div>
    </div>`;
  }).join('');
  const empty = `<div class="empty"><p>Esta oficina está vacía.</p><button class="btn primary" data-act="add">➕ Añadir agentes</button></div>`;
  $('#office').innerHTML = `<div class="wall"><span class="window"></span>
    <div class="sign"><span class="big">${esc(o.emoji)}</span><div><h1>${esc(o.name)}</h1><p>Agency ControlHub · ${o.agents.length} agentes</p></div></div>
    <span class="window"></span></div>
    <span class="deco" style="left:2%;top:140px">🪴</span><span class="deco" style="right:2%;top:140px">🪴</span>
    <div class="floor">${desks || empty}</div>`;
}

function renderPanels() {
  const o = activeOffice();
  const ids = o.agents.map(m => m.id);
  const divs = divisionCounts(ids);
  $('#officesPanel').innerHTML = store.offices.map(x =>
    `<li data-open="${esc(x.id)}"><span class="chip">${esc(x.emoji)}</span>${esc(x.name)}<span class="n">${x.agents.length} agentes</span></li>`).join('');
  $('#kpis').innerHTML = [['🤖', ids.length, 'Agentes'], ['🗂️', divs.length, 'Divisiones'], ['🏢', store.offices.length, 'Oficinas'], ['🌐', allAgents.length, 'Disponibles']]
    .map(([i, v, l]) => `<div class="kpi"><div>${i}</div><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
  $('#officeDivisions').innerHTML = divs.length ? divs.map(([d, n]) => `<li><span class="chip">📂</span>${esc(cap(d))}<span class="n tag">${n}</span></li>`).join('') : '<li class="muted">Sin agentes</li>';
  $('#officeAgents').innerHTML = ids.length ? ids.map(id => { const a = byId(id); return a ? `<li data-id="${esc(a.id)}"><span class="chip">${esc(a.emoji || '🤖')}</span>${esc(a.title)}<span class="n">${esc(a.division)}</span></li>` : ''; }).join('') : '<li class="muted">Sin agentes</li>';
}

function cardHtml(a) {
  const o = activeOffice(); const has = inOffice(o, a.id);
  return `<div class="card" data-id="${esc(a.id)}" style="--accent:${color(a)}">
    <h4>${esc((a.emoji ? a.emoji + ' ' : '') + a.title)}</h4>
    <p>${esc(a.description || a.content)}</p>
    <div class="meta"><span>📁 ${esc(a.division)}</span>
      <span><button class="btn ${has ? 'on' : ''}" data-toggle="${esc(a.id)}">${has ? '✓ En oficina' : '＋ Oficina'}</button> <button class="btn" data-copy="${esc(a.id)}">Copiar</button></span></div></div>`;
}
function renderAgents() {
  const q = $('#searchInput').value.trim().toLowerCase();
  const div = $('#divisionFilter').value;
  const list = allAgents.filter(a => (!div || a.division === div) &&
    (!q || [a.title, a.id, a.division, a.description, a.vibe].some(x => (x || '').toLowerCase().includes(q))));
  $('#resultCount').textContent = `${list.length} resultados · oficina: ${activeOffice().name}`;
  $('#agentsGrid').innerHTML = list.length ? list.map(cardHtml).join('') : '<div class="no-results">No se encontraron agentes.</div>';
}
function renderDivisions() {
  $('#divGrid').innerHTML = divisionCounts().map(([d, n]) =>
    `<div class="card" data-div="${esc(d)}"><h4>📁 ${esc(cap(d))}</h4><p>${n} agentes en esta división</p></div>`).join('');
}

// ---------- acciones sobre oficinas ----------
function openOffice(id) { store.active = id; save(); renderAll(); go('home'); }
function toggleAgent(id, officeId) {
  const o = store.offices.find(x => x.id === (officeId || store.active)); if (!o) return;
  const i = o.agents.findIndex(x => x.id === id);
  if (i >= 0) o.agents.splice(i, 1); else o.agents.push({ id, note: '' });
  save(); renderAll();
}
function setNote(id, text) { const m = activeOffice().agents.find(x => x.id === id); if (m) { m.note = text.trim(); save(); renderOffice(); } }

function dialog(html) { $('#modalBody').innerHTML = html; $('#modal').classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeModal() { $('#modal').classList.remove('active'); document.body.style.overflow = ''; $('#modalBody').innerHTML = ''; }

function officeForm(office) {
  const isNew = !office;
  const cur = office || { name: '', emoji: OFFICE_EMOJIS[0] };
  dialog(`<h2>${isNew ? 'Nueva oficina' : 'Editar oficina'}</h2>
    <label class="field">Nombre<input id="offName" value="${esc(cur.name)}" placeholder="Ej: Oficina de Instagram" maxlength="40"></label>
    <div class="field">Icono<div class="emoji-grid" id="emojiGrid">${OFFICE_EMOJIS.map(e => `<button type="button" class="emoji ${e === cur.emoji ? 'sel' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div></div>
    <div class="form-actions"><button class="btn primary" id="offSave">${isNew ? 'Crear oficina' : 'Guardar'}</button></div>`);
  let emoji = cur.emoji;
  $('#emojiGrid').onclick = (e) => { const b = e.target.closest('[data-emoji]'); if (!b) return; emoji = b.dataset.emoji; document.querySelectorAll('.emoji').forEach(x => x.classList.toggle('sel', x === b)); };
  $('#offName').focus();
  const submit = () => {
    const name = $('#offName').value.trim(); if (!name) { $('#offName').focus(); return; }
    if (isNew) { const o = { id: uid(), name, emoji, agents: [] }; store.offices.push(o); store.active = o.id; save(); closeModal(); renderAll(); go('home'); setTimeout(openPicker, 50); }
    else { office.name = name; office.emoji = emoji; save(); closeModal(); renderAll(); }
  };
  $('#offSave').onclick = submit;
  $('#offName').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}
function confirmDelete(o) {
  if (store.offices.length <= 1) { dialog(`<h2>No se puede eliminar</h2><p>Debe quedar al menos una oficina. Crea otra antes de eliminar esta.</p>`); return; }
  dialog(`<h2>¿Eliminar "${esc(o.name)}"?</h2><p>Se quitará la oficina y su distribución de ${o.agents.length} agentes. Los agentes no se borran.</p>
    <div class="form-actions"><button class="btn danger" id="delYes">Sí, eliminar</button><button class="btn" id="delNo">Cancelar</button></div>`);
  $('#delNo').onclick = closeModal;
  $('#delYes').onclick = () => { store.offices = store.offices.filter(x => x.id !== o.id); store.active = store.offices[0].id; save(); closeModal(); renderAll(); };
}

function openPicker() {
  const o = activeOffice();
  const divs = divisionCounts().map(d => d[0]).sort();
  dialog(`<h2>Añadir agentes a "${esc(o.name)}"</h2>
    <div class="picker-bar"><input id="pkQ" type="search" placeholder="Buscar agente…"><select id="pkDiv"><option value="">Todas</option>${divs.map(d => `<option value="${esc(d)}">${esc(cap(d))}</option>`).join('')}</select></div>
    <p class="muted" id="pkInfo"></p><div class="picker-list" id="pkList"></div>
    <div class="form-actions"><button class="btn primary" id="pkDone">Listo</button></div>`);
  const draw = () => {
    const q = $('#pkQ').value.trim().toLowerCase(), d = $('#pkDiv').value;
    const res = allAgents.filter(a => (!d || a.division === d) && (!q || [a.title, a.id, a.description].some(x => (x || '').toLowerCase().includes(q))));
    $('#pkInfo').textContent = `${res.length} agentes${res.length > 80 ? ' (mostrando 80, afina la búsqueda)' : ''} · ${o.agents.length} en la oficina`;
    $('#pkList').innerHTML = res.slice(0, 80).map(a => `<label class="pk-row"><input type="checkbox" data-pk="${esc(a.id)}" ${inOffice(o, a.id) ? 'checked' : ''}><span class="chip">${esc(a.emoji || '🤖')}</span><span class="pk-t"><strong>${esc(a.title)}</strong><small>${esc(a.division)}</small></span></label>`).join('');
  };
  draw();
  $('#pkQ').oninput = draw; $('#pkDiv').onchange = draw;
  $('#pkList').onchange = (e) => { const id = e.target.dataset.pk; if (id) { toggleAgent(id, o.id); $('#pkInfo').textContent = $('#pkInfo').textContent.replace(/· \d+ en la oficina/, `· ${o.agents.length} en la oficina`); } };
  $('#pkDone').onclick = closeModal;
}

function showAgent(id) {
  const a = byId(id); if (!a) return;
  const o = activeOffice(); const m = o.agents.find(x => x.id === id);
  dialog(`<h2>${esc((a.emoji ? a.emoji + ' ' : '') + a.title)}</h2>
    <div class="meta-line"><span>📁 ${esc(a.division)}</span><span>📄 ${esc(a.filename)}</span>${a.color ? `<span>🎨 ${esc(a.color)}</span>` : ''}</div>
    ${a.vibe ? `<p class="muted"><em>${esc(a.vibe)}</em></p>` : ''}<p>${esc(a.description)}</p>
    <div class="field"><strong>Oficinas</strong><div class="chips">${store.offices.map(x => `<button class="btn ${inOffice(x, id) ? 'on' : ''}" data-mv="${esc(x.id)}">${esc(x.emoji)} ${esc(x.name)} ${inOffice(x, id) ? '✓' : ''}</button>`).join('')}</div></div>
    ${m ? `<label class="field">Texto del globo en "${esc(o.name)}"<input id="noteIn" value="${esc(m.note)}" placeholder="${esc(a.vibe || 'Texto personalizado')}" maxlength="80"></label>` : ''}
    <pre>${esc((a.fullContent || '').slice(0, 4000))}</pre>
    <button class="btn" data-copyfull="${esc(a.id)}">📋 Copiar agente completo</button>`);
  const n = $('#noteIn'); if (n) n.onchange = () => setNote(id, n.value);
  document.querySelector('.chips').onclick = (e) => { const b = e.target.closest('[data-mv]'); if (!b) return; toggleAgent(id, b.dataset.mv); showAgent(id); };
}

function copy(text) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => alert('✅ Copiado al portapapeles'), () => alert('❌ Error al copiar')); }
function exportStore() {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'oficinas-agency-controlhub.json'; a.click(); URL.revokeObjectURL(a.href);
}
function importStore(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d || !Array.isArray(d.offices) || !d.offices.every(o => o && typeof o.name === 'string' && Array.isArray(o.agents))) throw new Error('formato');
      store = { offices: d.offices.map(o => ({ id: o.id || uid(), name: o.name, emoji: o.emoji || '🏢', agents: o.agents.map(x => ({ id: x.id, note: x.note || '' })) })), active: d.active };
      if (!store.offices.length) throw new Error('vacío');
      if (!store.offices.some(o => o.id === store.active)) store.active = store.offices[0].id;
      save(); renderAll(); alert('✅ Oficinas importadas');
    } catch (e) { alert('❌ Archivo no válido'); }
  };
  fr.readAsText(file);
}

// ---------- rutas y eventos ----------
function route() {
  const view = location.hash.slice(1) || 'home';
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
  const act = t.closest('[data-act]'); if (act) { const o = activeOffice(); return act.dataset.act === 'add' ? openPicker() : act.dataset.act === 'edit' ? officeForm(o) : confirmDelete(o); }
  const rm = t.closest('[data-remove]'); if (rm) { e.stopPropagation(); return toggleAgent(rm.dataset.remove); }
  const tg = t.closest('[data-toggle]'); if (tg) { e.stopPropagation(); return toggleAgent(tg.dataset.toggle); }
  const op = t.closest('[data-open]'); if (op) { e.preventDefault(); return openOffice(op.dataset.open); }
  const cp = t.closest('[data-copy]'); if (cp) { e.stopPropagation(); const a = byId(cp.dataset.copy); return a && copy(`${a.title}\nDivisión: ${a.division}\nArchivo: ${a.filename}`); }
  const cf = t.closest('[data-copyfull]'); if (cf) { const a = byId(cf.dataset.copyfull); return a && copy(a.fullContent); }
  const dv = t.closest('[data-div]'); if (dv) return go('agents', dv.dataset.div);
  const ag = t.closest('[data-id]'); if (ag) return showAgent(ag.dataset.id);
});
$('#newOfficeBtn').onclick = () => officeForm();
$('#newOfficeLink').onclick = (e) => { e.preventDefault(); officeForm(); };
$('#qaAdd').onclick = openPicker;
$('#qaEdit').onclick = () => officeForm(activeOffice());
$('#qaExport').onclick = exportStore;
$('#qaImport').onclick = () => $('#importFile').click();
$('#importFile').onchange = (e) => { if (e.target.files[0]) importStore(e.target.files[0]); e.target.value = ''; };
$('#searchInput').addEventListener('input', () => { if (location.hash !== '#agents') go('agents'); else renderAgents(); });
$('#divisionFilter').addEventListener('change', renderAgents);
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
