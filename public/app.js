// State
let allAgents = [];
let filteredAgents = [];
let writable = false;
let editorState = { mode: 'create', id: null };

// DOM Elements
const agentsGrid = document.getElementById('agentsGrid');
const searchInput = document.getElementById('searchInput');
const divisionFilter = document.getElementById('divisionFilter');
const statsContainer = document.getElementById('statsContainer');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const closeBtn = document.querySelector('.modal-close');
const newAgentBtn = document.getElementById('newAgentBtn');
const editorModal = document.getElementById('editorModal');
const editorForm = document.getElementById('editorForm');
const editorTitle = document.getElementById('editorTitle');
const editorIdField = document.getElementById('editorIdField');
const editorId = document.getElementById('editorId');
const editorContent = document.getElementById('editorContent');
const editorError = document.getElementById('editorError');

// Event listeners
function initializeEventListeners() {
  if (searchInput) searchInput.addEventListener('input', filterAgents);
  if (divisionFilter) divisionFilter.addEventListener('change', filterAgents);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (newAgentBtn) newAgentBtn.addEventListener('click', () => openEditor('create'));
  document.getElementById('editorClose').addEventListener('click', closeEditor);
  document.getElementById('editorCancel').addEventListener('click', closeEditor);
  editorForm.addEventListener('submit', saveEditor);
  window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
    if (e.target === editorModal) closeEditor();
  });
}

// Initialize
async function init() {
    initializeEventListeners();
    await loadStatus();
    await reloadAll();
}

// Reload agents and stats, keeping the current search and filter
async function reloadAll() {
    await loadAgents();
    await loadStats();
    filterAgents();
}

// Check whether this deployment accepts writes
async function loadStatus() {
    try {
        const response = await fetch('/api/status');
        writable = (await response.json()).writable;
    } catch (error) {
        writable = false;
    }
    newAgentBtn.hidden = !writable;
}

// Load agents from API
async function loadAgents() {
    try {
        const response = await fetch('/api/agents');
        allAgents = await response.json();
        populateDivisionFilter();
    } catch (error) {
        console.error('Error loading agents:', error);
        agentsGrid.innerHTML = '<div class="no-results">Error al cargar los agentes</div>';
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        displayStats(stats);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Display statistics
function displayStats(stats) {
    const divisions = stats.divisions;
    const divisionCount = Object.keys(divisions).length;
    const largest = divisionCount ? Math.max(...Object.values(divisions)) : 0;

    document.getElementById('totalAgents').textContent = stats.totalAgents;
    document.getElementById('totalDivisions').textContent = divisionCount;

    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="number">${stats.totalAgents}</div>
            <div class="label">Agentes Totales</div>
        </div>
        <div class="stat-card">
            <div class="number">${divisionCount}</div>
            <div class="label">Divisiones</div>
        </div>
        <div class="stat-card">
            <div class="number">${largest}</div>
            <div class="label">Máximos por División</div>
        </div>
    `;
}

// Populate division filter (rebuilt on every reload so options are not duplicated)
function populateDivisionFilter() {
    const selected = divisionFilter.value;
    const divisions = [...new Set(allAgents.map(a => a.division))].sort();

    divisionFilter.length = 1;
    divisions.forEach(division => {
        const option = document.createElement('option');
        option.value = division;
        option.textContent = division.charAt(0).toUpperCase() + division.slice(1);
        divisionFilter.appendChild(option);
    });

    if (divisions.includes(selected)) divisionFilter.value = selected;
}

// Filter agents
function filterAgents() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedDivision = divisionFilter.value;

    filteredAgents = allAgents.filter(agent => {
        const matchesSearch = agent.title.toLowerCase().includes(searchTerm) ||
                            agent.division.toLowerCase().includes(searchTerm) ||
                            agent.id.toLowerCase().includes(searchTerm);
        const matchesDivision = !selectedDivision || agent.division === selectedDivision;

        return matchesSearch && matchesDivision;
    });

    displayAgents(filteredAgents);
}

// Display agents
function displayAgents(agents) {
    if (agents.length === 0) {
        agentsGrid.innerHTML = '<div class="no-results">No se encontraron agentes. Intenta con otro filtro.</div>';
        return;
    }

    agentsGrid.innerHTML = agents.map(agent => `
        <div class="agent-card" onclick="showModal('${agent.id}')">
            <div class="agent-header">
                <h3 class="agent-title">${escapeHtml(agent.title)}</h3>
                <span class="agent-badge">${escapeHtml(agent.division)}</span>
            </div>
            <div class="agent-division">📁 ${escapeHtml(agent.division.toUpperCase())}</div>
            <p class="agent-description">${escapeHtml(agent.content)}</p>
            <div class="agent-footer">
                <button class="btn btn-primary">Ver Detalles</button>
                <button class="btn btn-secondary" onclick="copyAgent(event, '${agent.id}')">Copiar</button>
            </div>
        </div>
    `).join('');
}

// Show modal
function showModal(agentId) {
    const agent = allAgents.find(a => a.id === agentId);

    if (!agent) return;

    const frontmatterHtml = Object.entries(agent.frontmatter)
        .map(([key, value]) => `<div class="meta-item"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</div>`)
        .join('');

    const adminHtml = writable ? `
        <div class="admin-actions">
            <button class="btn btn-primary" onclick="openEditor('edit', '${agent.id}')">Editar</button>
            <button class="btn btn-secondary" onclick="duplicateAgent('${agent.id}')">Duplicar</button>
            <button class="btn btn-danger" onclick="deleteAgent('${agent.id}')">Eliminar</button>
        </div>` : '';

    modalBody.innerHTML = `
        <h2>${escapeHtml(agent.title)}</h2>
        <div class="modal-meta">
            <div class="meta-item"><strong>ID:</strong> ${escapeHtml(agent.id)}</div>
            <div class="meta-item"><strong>División:</strong> ${escapeHtml(agent.division)}</div>
            <div class="meta-item"><strong>Archivo:</strong> ${escapeHtml(agent.filename)}</div>
        </div>
        ${frontmatterHtml ? '<h3 style="margin-top: 20px; color: var(--primary);">Metadatos</h3><div class="modal-meta">' + frontmatterHtml + '</div>' : ''}
        <h3 style="margin-top: 20px; color: var(--primary);">Contenido</h3>
        <pre><code>${escapeHtml(agent.fullContent.substring(0, 2000))}</code></pre>
        <button class="copy-btn" onclick="copyFullAgent('${agent.id}')">
            📋 Copiar Agente Completo
        </button>
        ${adminHtml}
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    modalBody.innerHTML = '';
}

// Open the editor: create a new agent or edit the raw file of an existing one
async function openEditor(mode, agentId = null) {
    editorState = { mode, id: agentId };
    editorError.textContent = '';
    closeModal();

    if (mode === 'create') {
        editorTitle.textContent = 'Nuevo agente';
        editorId.value = '';
        editorId.readOnly = false;
        editorIdField.hidden = false;
        editorContent.value = `---\nname: Mi agente\ndescription: Qué hace este agente\n---\n\n# Mi agente\n\nInstrucciones del agente.\n`;
    } else {
        try {
            const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}`);
            if (!response.ok) throw new Error((await response.json()).error);
            const agent = await response.json();
            editorTitle.textContent = `Editar: ${agent.title}`;
            editorIdField.hidden = true;
            editorContent.value = agent.raw;
        } catch (error) {
            alert(`❌ No se pudo abrir el agente: ${error.message}`);
            return;
        }
    }

    editorModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    (mode === 'create' ? editorId : editorContent).focus();
}

// Close editor
function closeEditor() {
    editorModal.classList.remove('active');
    document.body.style.overflow = 'auto';
    editorContent.value = '';
}

// Save the editor (POST for create, PUT for edit)
async function saveEditor(event) {
    event.preventDefault();
    editorError.textContent = '';

    const isCreate = editorState.mode === 'create';
    const body = { content: editorContent.value };
    if (isCreate) body.id = editorId.value.trim();

    const url = isCreate ? '/api/agents' : `/api/agents/${encodeURIComponent(editorState.id)}`;
    const method = isCreate ? 'POST' : 'PUT';

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            editorError.textContent = (await response.json()).error;
            return;
        }
        closeEditor();
        await reloadAll();
    } catch (error) {
        editorError.textContent = 'Error de conexión con el servidor';
    }
}

// Duplicate an agent under a new id
async function duplicateAgent(agentId) {
    const newId = prompt('ID para la copia (minúsculas, números y guiones):', `${agentId}-copia`);
    if (!newId) return;

    try {
        const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/duplicate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: newId.trim() })
        });
        if (!response.ok) {
            alert(`❌ ${(await response.json()).error}`);
            return;
        }
        closeModal();
        await reloadAll();
        showModal(newId.trim());
    } catch (error) {
        alert('❌ Error de conexión con el servidor');
    }
}

// Delete an agent after confirmation
async function deleteAgent(agentId) {
    if (!confirm(`¿Eliminar el agente "${agentId}"? Esta acción no se puede deshacer.`)) return;

    try {
        const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, { method: 'DELETE' });
        if (!response.ok) {
            alert(`❌ ${(await response.json()).error}`);
            return;
        }
        closeModal();
        await reloadAll();
    } catch (error) {
        alert('❌ Error de conexión con el servidor');
    }
}

// Copy agent
function copyAgent(event, agentId) {
    event.stopPropagation();
    const agent = allAgents.find(a => a.id === agentId);

    if (!agent) return;

    const text = `${agent.title}\nDivisión: ${agent.division}\nArchivo: ${agent.filename}`;
    copyToClipboard(text);
}

// Copy full agent
function copyFullAgent(agentId) {
    const agent = allAgents.find(a => a.id === agentId);

    if (!agent) return;

    copyToClipboard(agent.fullContent);
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ Copiado al portapapeles');
    }).catch(() => {
        alert('❌ Error al copiar');
    });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
