// State
const state = {
  agents: [],
  query: '',
  division: '',
  sort: 'title'
};

// DOM Elements
const els = {
  grid: document.getElementById('agentsGrid'),
  search: document.getElementById('searchInput'),
  division: document.getElementById('divisionFilter'),
  sort: document.getElementById('sortSelect'),
  count: document.getElementById('resultCount'),
  stats: document.getElementById('statsContainer'),
  totalAgents: document.getElementById('totalAgents'),
  totalDivisions: document.getElementById('totalDivisions'),
  modal: document.getElementById('modal'),
  modalBody: document.getElementById('modalBody'),
  toast: document.getElementById('toast')
};

let toastTimer = null;

// Init
async function init() {
  bindEvents();

  try {
    const [agents, stats] = await Promise.all([
      fetchJson('/api/agents'),
      fetchJson('/api/stats')
    ]);

    state.agents = agents;
    populateDivisions(stats.divisions);
    renderStats(stats);
    render();
  } catch (error) {
    console.error('Error loading dashboard:', error);
    els.grid.innerHTML = '<div class="no-results">Error al cargar los agentes</div>';
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} respondió ${response.status}`);
  return response.json();
}

// Events (delegated, so re-rendering the grid needs no rebinding)
function bindEvents() {
  els.search.addEventListener('input', (e) => {
    state.query = e.target.value.trim().toLowerCase();
    render();
  });

  els.division.addEventListener('change', (e) => {
    state.division = e.target.value;
    render();
  });

  els.sort.addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });

  document.querySelector('.search-btn').addEventListener('click', () => els.search.focus());

  els.grid.addEventListener('click', onGridClick);
  els.grid.addEventListener('keydown', (e) => {
    const card = e.target.closest('.agent-card');
    if (card && e.key === 'Enter' && e.target === card) openAgent(card.dataset.id);
  });

  els.modal.addEventListener('click', (e) => {
    if (e.target.matches('.modal-overlay, .modal-close')) closeModal();
    const copyBtn = e.target.closest('[data-copy-id]');
    if (copyBtn) {
      const agent = findAgent(copyBtn.dataset.copyId);
      if (agent) copyToClipboard(agent.fullContent, `"${agent.title}" copiado`);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal.classList.contains('active')) closeModal();
    if (e.key === '/' && document.activeElement !== els.search && !els.modal.classList.contains('active')) {
      e.preventDefault();
      els.search.focus();
    }
  });
}

function onGridClick(e) {
  const card = e.target.closest('.agent-card');
  if (!card) return;

  const agent = findAgent(card.dataset.id);
  if (!agent) return;

  if (e.target.closest('[data-action="copy"]')) {
    copyToClipboard(agent.fullContent, `"${agent.title}" copiado`);
    return;
  }

  openModal(agent);
}

function openAgent(id) {
  const agent = findAgent(id);
  if (agent) openModal(agent);
}

function findAgent(id) {
  return state.agents.find(a => a.id === id);
}

// Stats & filters
function renderStats(stats) {
  const divisionCount = Object.keys(stats.divisions).length;
  const largest = Math.max(...Object.values(stats.divisions));

  els.totalAgents.textContent = stats.totalAgents;
  els.totalDivisions.textContent = divisionCount;

  els.stats.innerHTML = `
    <div class="stat-card">
      <div class="stat-number">${stats.totalAgents}</div>
      <div class="stat-label">Agentes instalados</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${divisionCount}</div>
      <div class="stat-label">Divisiones</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${largest}</div>
      <div class="stat-label">Máximo por división</div>
    </div>
  `;
}

function populateDivisions(divisions) {
  Object.keys(divisions)
    .sort()
    .forEach(division => {
      const option = document.createElement('option');
      option.value = division;
      option.textContent = `${capitalize(division)} (${divisions[division]})`;
      els.division.appendChild(option);
    });
}

function filteredAgents() {
  const list = state.agents.filter(agent => {
    if (state.division && agent.division !== state.division) return false;
    if (!state.query) return true;

    return [agent.title, agent.id, agent.division, agent.description, agent.vibe]
      .some(value => (value || '').toLowerCase().includes(state.query));
  });

  if (state.sort === 'division') {
    return list.sort((a, b) => a.division.localeCompare(b.division) || a.title.localeCompare(b.title, 'es'));
  }
  return list.sort((a, b) => a.title.localeCompare(b.title, 'es'));
}

// Render
function render() {
  const list = filteredAgents();

  els.count.textContent = `${list.length} de ${state.agents.length} agentes`;

  if (list.length === 0) {
    els.grid.innerHTML = '<div class="no-results">No se encontraron agentes. Intenta con otro filtro.</div>';
    return;
  }

  els.grid.innerHTML = list.map(cardTemplate).join('');
}

function cardTemplate(agent) {
  return `
    <article class="agent-card" data-id="${escapeHtml(agent.id)}" tabindex="0">
      <div class="agent-header">
        <span class="agent-emoji" aria-hidden="true">${escapeHtml(agent.emoji || '🤖')}</span>
        <h3 class="agent-title">${escapeHtml(agent.title)}</h3>
      </div>
      <div class="agent-division">📁 ${escapeHtml(agent.division.toUpperCase())}</div>
      <p class="agent-description">${escapeHtml(agent.vibe || agent.description)}</p>
      <div class="agent-footer">
        <button class="btn btn-primary" data-action="view">Ver detalles</button>
        <button class="btn btn-secondary" data-action="copy">Copiar</button>
      </div>
    </article>
  `;
}

// Modal
function openModal(agent) {
  const meta = [
    ['ID', agent.id],
    ['División', agent.division],
    ['Archivo', agent.filename],
    ['Color', agent.color]
  ].filter(([, value]) => value);

  els.modalBody.innerHTML = `
    <div class="modal-title-row">
      <span class="agent-emoji" aria-hidden="true">${escapeHtml(agent.emoji || '🤖')}</span>
      <h2>${escapeHtml(agent.title)}</h2>
    </div>
    ${agent.vibe ? `<p class="modal-vibe">${escapeHtml(agent.vibe)}</p>` : ''}
    ${agent.description ? `<p class="modal-desc">${escapeHtml(agent.description)}</p>` : ''}
    <div class="modal-meta">
      ${meta.map(([key, value]) => `<div class="meta-item"><strong>${key}:</strong> ${escapeHtml(value)}</div>`).join('')}
    </div>
    <h3 class="modal-section">Contenido</h3>
    <pre class="agent-source"><code>${escapeHtml(agent.fullContent)}</code></pre>
    <button class="copy-btn" data-copy-id="${escapeHtml(agent.id)}">📋 Copiar agente completo</button>
  `;

  els.modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  els.modal.querySelector('.modal-close').focus();
}

function closeModal() {
  els.modal.classList.remove('active');
  document.body.style.overflow = '';
  els.modalBody.innerHTML = '';
}

// Clipboard & feedback
async function copyToClipboard(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`✅ ${message}`);
  } catch {
    showToast('❌ No se pudo copiar');
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2000);
}

// Helpers
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

init();
