// State
let allAgents = [];
let filteredAgents = [];

// DOM Elements
const agentsGrid = document.getElementById('agentsGrid');
const searchInput = document.getElementById('searchInput');
const divisionFilter = document.getElementById('divisionFilter');
const statsContainer = document.getElementById('statsContainer');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const closeBtn = document.querySelector('.close');

// Event Listeners
searchInput.addEventListener('input', filterAgents);
divisionFilter.addEventListener('change', filterAgents);
closeBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Initialize
async function init() {
    await loadAgents();
    await loadStats();
    displayAgents(allAgents);
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
            <div class="number">${Math.max(...Object.values(divisions))}</div>
            <div class="label">Máximos por División</div>
        </div>
    `;
}

// Populate division filter
function populateDivisionFilter() {
    const divisions = [...new Set(allAgents.map(a => a.division))].sort();

    divisions.forEach(division => {
        const option = document.createElement('option');
        option.value = division;
        option.textContent = division.charAt(0).toUpperCase() + division.slice(1);
        divisionFilter.appendChild(option);
    });
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
                <span class="agent-badge">${agent.division}</span>
            </div>
            <div class="agent-division">📁 ${agent.division.toUpperCase()}</div>
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
        .map(([key, value]) => `<div class="meta-item"><strong>${key}:</strong> ${escapeHtml(String(value))}</div>`)
        .join('');

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

// Start app
init();
