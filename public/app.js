// State
const state = {
  agents: [],
  tasks: [],
  query: '',
  division: '',
  sort: 'title',
  writable: false
};

// DOM Elements
const els = {
  loginView: document.getElementById('loginView'),
  loginForm: document.getElementById('loginForm'),
  loginError: document.getElementById('loginError'),
  loginHint: document.getElementById('loginHint'),
  passwordInput: document.getElementById('passwordInput'),
  appView: document.getElementById('appView'),
  logoutBtn: document.getElementById('logoutBtn'),
  grid: document.getElementById('agentsGrid'),
  search: document.getElementById('searchInput'),
  division: document.getElementById('divisionFilter'),
  sort: document.getElementById('sortSelect'),
  count: document.getElementById('resultCount'),
  stats: document.getElementById('statsContainer'),
  totalAgents: document.getElementById('totalAgents'),
  totalDivisions: document.getElementById('totalDivisions'),
  agentsView: document.getElementById('agentsView'),
  tasksView: document.getElementById('tasksView'),
  tasksList: document.getElementById('tasksList'),
  refreshTasksBtn: document.getElementById('refreshTasksBtn'),
  modal: document.getElementById('modal'),
  modalBody: document.getElementById('modalBody'),
  toast: document.getElementById('toast')
};

let toastTimer = null;

// Init
async function init() {
  bindEvents();

  try {
    const session = await api('/api/session');
    if (session.authenticated) {
      enterApp(session);
    } else {
      showLogin(session);
    }
  } catch (error) {
    showLogin();
  }
}

// API
async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// Login
function showLogin(session = {}) {
  els.appView.hidden = true;
  els.loginView.hidden = false;
  els.passwordInput.disabled = session.configured === false;
  els.loginHint.textContent = session.configured === false
    ? 'El servidor no tiene DASHBOARD_PASSWORD configurada.'
    : 'Introduce la contraseña del panel.';
}

function enterApp(session) {
  state.writable = Boolean(session.writable);
  els.loginView.hidden = true;
  els.appView.hidden = false;
  loadDashboard();
}

async function login(event) {
  event.preventDefault();
  els.loginError.textContent = '';

  try {
    await api('/api/login', { method: 'POST', body: { password: els.passwordInput.value } });
    els.passwordInput.value = '';
    const session = await api('/api/session');
    enterApp(session);
  } catch (error) {
    els.loginError.textContent = error.message;
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  state.agents = [];
  state.tasks = [];
  closeModal();
  showLogin({ configured: true });
}

// Events (delegated, so re-rendering needs no rebinding)
function bindEvents() {
  els.loginForm.addEventListener('submit', login);
  els.logoutBtn.addEventListener('click', logout);

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

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  els.refreshTasksBtn.addEventListener('click', loadTasks);
  els.tasksList.addEventListener('click', onTasksClick);

  document.querySelector('.search-btn').addEventListener('click', () => els.search.focus());

  els.grid.addEventListener('click', onGridClick);
  els.grid.addEventListener('keydown', (e) => {
    const card = e.target.closest('.agent-card');
    if (card && e.key === 'Enter' && e.target === card) {
      const agent = findAgent(card.dataset.id);
      if (agent) openDetail(agent);
    }
  });

  els.modal.addEventListener('click', onModalClick);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal.classList.contains('active')) closeModal();
    if (e.key === '/' && document.activeElement !== els.search && !els.modal.classList.contains('active') && !els.appView.hidden) {
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

  switch (e.target.closest('[data-action]')?.dataset.action) {
    case 'copy':
      copyToClipboard(agent.fullContent, `"${agent.title}" copiado`);
      break;
    case 'edit':
      openEditor(agent);
      break;
    case 'delete':
      openDeleteConfirm(agent);
      break;
    default:
      openDetail(agent);
  }
}

function onModalClick(e) {
  if (e.target.matches('.modal-overlay, .modal-close') || e.target.closest('[data-cancel]')) {
    closeModal();
    return;
  }

  const copyBtn = e.target.closest('[data-copy-id]');
  if (copyBtn) {
    const agent = findAgent(copyBtn.dataset.copyId);
    if (agent) copyToClipboard(agent.fullContent, `"${agent.title}" copiado`);
    return;
  }

  const saveBtn = e.target.closest('[data-save]');
  if (saveBtn) {
    saveAgentEdit(saveBtn.dataset.save);
    return;
  }

  const deleteBtn = e.target.closest('[data-confirm-delete]');
  if (deleteBtn) {
    deleteAgent(deleteBtn.dataset.confirmDelete, deleteBtn);
  }
}

function onTasksClick(e) {
  const btn = e.target.closest('[data-task-prompt]');
  if (!btn) return;

  const task = state.tasks.find(t => t.id === btn.dataset.taskPrompt);
  if (task) openTaskPrompt(task);
}

// Tabs
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(tab => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  els.agentsView.hidden = name !== 'agents';
  els.tasksView.hidden = name !== 'tasks';

  if (name === 'tasks') loadTasks();
}

// Data loading
async function loadDashboard() {
  try {
    const [agents, stats] = await Promise.all([
      api('/api/agents'),
      api('/api/stats')
    ]);

    state.agents = agents;
    populateDivisions(stats.divisions);
    renderStats(stats);
    render();
  } catch (error) {
    if (error.status === 401) return showLogin({ configured: true });
    console.error('Error loading dashboard:', error);
    els.grid.innerHTML = '<div class="no-results">Error al cargar los agentes</div>';
  }
}

async function loadTasks() {
  els.tasksList.innerHTML = '<div class="loading">Cargando tareas...</div>';

  try {
    state.tasks = await api('/api/scheduled-tasks');
    renderTasks();
  } catch (error) {
    if (error.status === 401) return showLogin({ configured: true });
    els.tasksList.innerHTML = `<div class="no-results">${escapeHtml(error.message)}</div>`;
  }
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
  els.division.innerHTML = '<option value="">Todas las divisiones</option>';

  Object.keys(divisions)
    .sort()
    .forEach(division => {
      const option = document.createElement('option');
      option.value = division;
      option.textContent = `${capitalize(division)} (${divisions[division]})`;
      els.division.appendChild(option);
    });

  els.division.value = state.division;
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

function findAgent(id) {
  return state.agents.find(a => a.id === id);
}

// Render agents
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
  const writeDisabled = state.writable ? '' : 'disabled title="Guardar requiere GITHUB_TOKEN en el servidor"';

  return `
    <article class="agent-card" data-id="${escapeHtml(agent.id)}" tabindex="0">
      <div class="agent-header">
        <span class="agent-emoji" aria-hidden="true">${escapeHtml(agent.emoji || '🤖')}</span>
        <h3 class="agent-title">${escapeHtml(agent.title)}</h3>
      </div>
      <div class="agent-division">📁 ${escapeHtml(agent.division.toUpperCase())}</div>
      <p class="agent-description">${escapeHtml(agent.vibe || agent.description)}</p>
      <div class="agent-footer">
        <button class="btn btn-primary btn-small" data-action="view">Ver</button>
        <button class="btn btn-secondary btn-small" data-action="edit" ${writeDisabled}>Editar</button>
        <button class="btn btn-secondary btn-small" data-action="copy">Copiar</button>
        <button class="btn btn-danger btn-small" data-action="delete" ${writeDisabled}>Eliminar</button>
      </div>
    </article>
  `;
}

// Render tasks
function renderTasks() {
  if (state.tasks.length === 0) {
    els.tasksList.innerHTML = '<div class="no-results">No hay tareas programadas.</div>';
    return;
  }

  els.tasksList.innerHTML = state.tasks.map(taskTemplate).join('');
}

function taskTemplate(task) {
  const schedule = task.cron
    ? `Cron: ${task.cron}`
    : task.runOnceAt
      ? `Una vez: ${formatDate(task.runOnceAt)}`
      : 'Sin horario';

  const lastRun = task.lastRun
    ? `${task.lastRun.status.replace('ROUTINE_RUN_STATUS_', '')} · ${formatDate(task.lastRun.firedAt)}`
    : 'Nunca ejecutada';

  return `
    <article class="task-card">
      <div class="task-header">
        <h3 class="agent-title">${escapeHtml(task.name)}</h3>
        <span class="task-status ${task.enabled ? 'is-on' : 'is-off'}">${task.enabled ? 'Activa' : 'Pausada'}</span>
      </div>
      <dl class="task-meta">
        <div><dt>Horario</dt><dd>${escapeHtml(schedule)}</dd></div>
        <div><dt>Próxima ejecución</dt><dd>${escapeHtml(formatDate(task.nextRunAt))}</dd></div>
        <div><dt>Última ejecución</dt><dd>${escapeHtml(lastRun)}</dd></div>
      </dl>
      <button class="btn btn-secondary btn-small" data-task-prompt="${escapeHtml(task.id)}">Ver instrucciones</button>
    </article>
  `;
}

// Modal
function showModal(html) {
  els.modalBody.innerHTML = html;
  els.modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function openDetail(agent) {
  const meta = [
    ['ID', agent.id],
    ['División', agent.division],
    ['Archivo', agent.filename],
    ['Color', agent.color]
  ].filter(([, value]) => value);

  showModal(`
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
    <div class="modal-actions">
      <button class="btn btn-secondary" type="button" data-copy-id="${escapeHtml(agent.id)}">📋 Copiar agente completo</button>
      <button class="btn btn-primary" type="button" data-cancel>Cerrar</button>
    </div>
  `);
}

async function openEditor(agent) {
  showModal(`<div class="loading">Cargando ${escapeHtml(agent.title)}...</div>`);

  try {
    const full = await api(`/api/agents/${encodeURIComponent(agent.id)}`);

    showModal(`
      <h2>Editar ${escapeHtml(full.title)}</h2>
      <p class="modal-desc">Edita el archivo completo: el frontmatter (name, description, emoji, vibe, color) y el contenido. Los campos name y description son obligatorios.</p>
      <textarea id="agentEditor" class="agent-editor" spellcheck="false" aria-label="Contenido del agente">${escapeHtml(full.raw)}</textarea>
      <div class="form-error" id="editorError" role="alert"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" type="button" data-cancel>Cancelar</button>
        <button class="btn btn-primary" type="button" data-save="${escapeHtml(full.id)}">Guardar en GitHub</button>
      </div>
    `);
    document.getElementById('agentEditor').focus();
  } catch (error) {
    if (error.status === 401) return showLogin({ configured: true });
    showModal(`<div class="form-error" role="alert">${escapeHtml(error.message)}</div>
      <div class="modal-actions"><button class="btn btn-secondary" type="button" data-cancel>Cerrar</button></div>`);
  }
}

async function saveAgentEdit(id) {
  const textarea = document.getElementById('agentEditor');
  const errorBox = document.getElementById('editorError');
  const saveBtn = els.modalBody.querySelector('[data-save]');

  saveBtn.disabled = true;
  errorBox.textContent = '';

  try {
    await api(`/api/agents/${encodeURIComponent(id)}`, { method: 'PUT', body: { content: textarea.value } });
    closeModal();
    showToast('✅ Guardado en GitHub. Puede tardar un minuto en verse tras el despliegue.');
    await loadDashboard();
  } catch (error) {
    if (error.status === 401) return showLogin({ configured: true });
    errorBox.textContent = error.message;
    saveBtn.disabled = false;
  }
}

function openDeleteConfirm(agent) {
  showModal(`
    <h2>Eliminar ${escapeHtml(agent.title)}</h2>
    <p class="modal-desc">Se borrará <code>${escapeHtml(agent.filename)}</code> del repositorio con un commit. Podrás recuperarlo desde el historial de Git.</p>
    <div class="form-error" id="editorError" role="alert"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" type="button" data-cancel>Cancelar</button>
      <button class="btn btn-danger" type="button" data-confirm-delete="${escapeHtml(agent.id)}">Eliminar agente</button>
    </div>
  `);
}

async function deleteAgent(id, button) {
  const errorBox = document.getElementById('editorError');
  button.disabled = true;
  errorBox.textContent = '';

  try {
    await api(`/api/agents/${encodeURIComponent(id)}`, { method: 'DELETE' });
    state.agents = state.agents.filter(agent => agent.id !== id);
    closeModal();
    showToast('🗑️ Agente eliminado. Puede tardar un minuto en desaparecer tras el despliegue.');
    render();
  } catch (error) {
    if (error.status === 401) return showLogin({ configured: true });
    errorBox.textContent = error.message;
    button.disabled = false;
  }
}

function openTaskPrompt(task) {
  showModal(`
    <h2>${escapeHtml(task.name)}</h2>
    <p class="modal-desc">Estas son las instrucciones que ejecuta la tarea cada vez que se dispara.</p>
    <pre class="agent-source"><code>${escapeHtml(task.prompt || '(sin instrucciones)')}</code></pre>
    <div class="modal-actions">
      <button class="btn btn-primary" type="button" data-cancel>Cerrar</button>
    </div>
  `);
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
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3500);
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

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

init();
