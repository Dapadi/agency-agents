import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const isProduction = process.env.NODE_ENV === 'production';

// Use local agents directory in the repository
const agentsDir = isProduction
  ? path.join(__dirname, '../agents')
  : path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'agents');

const publicDir = path.join(__dirname, '../public');

// Configuration (set in Vercel → Environment Variables)
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const GITHUB = {
  token: process.env.GITHUB_TOKEN || '',
  repo: process.env.GITHUB_REPO || 'Dapadi/agency-agents',
  branch: process.env.GITHUB_BRANCH || 'main'
};
const SCHEDULED_TASKS = {
  url: process.env.CLAUDE_TRIGGERS_URL || '',
  token: process.env.CLAUDE_API_TOKEN || ''
};

const SESSION_COOKIE = 'agency_session';
const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MAX_AGENT_BYTES = 200 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Middleware
app.use(express.json({ limit: '300kb' }));
app.use(express.static(publicDir));

// ---------- Auth ----------

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Derived from the password, so the cookie cannot be forged without it.
function sessionToken() {
  return crypto.createHmac('sha256', DASHBOARD_PASSWORD).update('agency-session').digest('hex');
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map(part => part.trim().split('=')).filter(([key]) => key)
      .map(([key, ...value]) => [key, value.join('=')])
  );
}

function isAuthorized(req) {
  if (!DASHBOARD_PASSWORD) return !isProduction;
  const cookie = parseCookies(req.headers.cookie)[SESSION_COOKIE] || '';
  return safeEqual(cookie, sessionToken());
}

// Simple in-memory limiter for login attempts: 10 per 15 minutes per IP.
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function registerLoginAttempt(ip) {
  const now = Date.now();
  const recent = (loginAttempts.get(ip) || []).filter(time => now - time < LOGIN_WINDOW_MS);
  recent.push(now);
  loginAttempts.set(ip, recent);
  return recent.length <= LOGIN_MAX_ATTEMPTS;
}

app.get('/api/session', (req, res) => {
  res.json({
    configured: Boolean(DASHBOARD_PASSWORD),
    authenticated: isAuthorized(req),
    writable: Boolean(GITHUB.token) || !isProduction
  });
});

app.post('/api/login', (req, res) => {
  if (!DASHBOARD_PASSWORD) {
    return res.status(503).json({ error: 'DASHBOARD_PASSWORD no está configurada' });
  }
  if (!registerLoginAttempt(req.ip)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  }

  const password = String(req.body?.password || '');
  if (!safeEqual(sha256(password), sha256(DASHBOARD_PASSWORD))) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=${sessionToken()}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${60 * 60 * 24 * 30}`,
    isProduction ? 'Secure' : ''
  ].filter(Boolean).join('; '));
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

// Everything else under /api requires a session.
app.use('/api', (req, res, next) => {
  if (isAuthorized(req)) return next();
  if (!DASHBOARD_PASSWORD && isProduction) {
    return res.status(503).json({ error: 'DASHBOARD_PASSWORD no está configurada en el servidor' });
  }
  res.status(401).json({ error: 'No autorizado' });
});

// ---------- Agents: read ----------

function extractDivision(filename) {
  const parts = filename.split('-');
  return parts.length > 0 ? parts[0] : 'other';
}

function toAgent(file, content) {
  const { data, content: markdown } = matter(content);
  return {
    id: file.replace('.md', ''),
    filename: file,
    title: data.name || data.title || file.replace('.md', ''),
    emoji: data.emoji || '',
    color: data.color || '',
    vibe: data.vibe || '',
    category: data.category || 'Uncategorized',
    division: extractDivision(file),
    description: data.description || '',
    frontmatter: data,
    content: markdown.substring(0, 500) + '...',
    fullContent: markdown
  };
}

// Load all agents
async function loadAgents() {
  try {
    const files = await fs.readdir(agentsDir);
    const agents = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const content = await fs.readFile(path.join(agentsDir, file), 'utf-8');
          agents.push(toAgent(file, content));
        } catch (err) {
          console.error(`Error reading ${file}:`, err.message);
        }
      }
    }

    return agents.sort((a, b) => a.title.localeCompare(b.title));
  } catch (err) {
    console.error('Error loading agents:', err.message);
    return [];
  }
}

// Resolve an agent id to its filename, rejecting anything that is not an existing agent file.
async function agentFilename(id) {
  if (!AGENT_ID_PATTERN.test(id)) throw new HttpError(400, 'ID de agente no válido');
  const filename = `${id}.md`;
  if (!(await fs.pathExists(path.join(agentsDir, filename)))) {
    throw new HttpError(404, 'Agent not found');
  }
  return filename;
}

app.get('/api/agents', async (req, res) => {
  try {
    const agents = await loadAgents();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load agents' });
  }
});

// Returns the raw markdown source too, so the editor can show the frontmatter.
app.get('/api/agents/:id', async (req, res) => {
  try {
    const filename = await agentFilename(req.params.id);
    const raw = await fs.readFile(path.join(agentsDir, filename), 'utf-8');
    res.json({ ...toAgent(filename, raw), raw });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to load agent' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const agents = await loadAgents();
    const divisions = {};

    agents.forEach(agent => {
      divisions[agent.division] = (divisions[agent.division] || 0) + 1;
    });

    res.json({
      totalAgents: agents.length,
      divisions
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ---------- Agents: write ----------

const GITHUB_API = 'https://api.github.com';

async function github(method, apiPath, body) {
  const response = await fetch(`${GITHUB_API}/repos/${GITHUB.repo}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'agency-agents-dashboard',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(502, `GitHub respondió ${response.status}: ${detail.slice(0, 200)}`);
  }
  return response.status === 204 ? null : response.json();
}

async function githubFileSha(filename) {
  const file = await github('GET', `/contents/agents/${filename}?ref=${encodeURIComponent(GITHUB.branch)}`);
  return file.sha;
}

async function saveAgent(filename, content) {
  const message = `Editar agente ${filename} desde el dashboard`;

  if (GITHUB.token) {
    const sha = await githubFileSha(filename);
    await github('PUT', `/contents/agents/${filename}`, {
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      sha,
      branch: GITHUB.branch
    });
    return;
  }

  if (!isProduction) {
    await fs.writeFile(path.join(agentsDir, filename), content, 'utf-8');
    return;
  }
  throw new HttpError(503, 'GITHUB_TOKEN no está configurado: no se puede guardar en producción');
}

async function removeAgent(filename) {
  if (GITHUB.token) {
    const sha = await githubFileSha(filename);
    await github('DELETE', `/contents/agents/${filename}`, {
      message: `Eliminar agente ${filename} desde el dashboard`,
      sha,
      branch: GITHUB.branch
    });
    return;
  }

  if (!isProduction) {
    await fs.remove(path.join(agentsDir, filename));
    return;
  }
  throw new HttpError(503, 'GITHUB_TOKEN no está configurado: no se puede eliminar en producción');
}

function validateAgentSource(content) {
  if (typeof content !== 'string' || content.trim() === '') {
    throw new HttpError(400, 'El contenido del agente está vacío');
  }
  if (Buffer.byteLength(content, 'utf-8') > MAX_AGENT_BYTES) {
    throw new HttpError(413, 'El agente supera el tamaño máximo');
  }

  let data;
  try {
    ({ data } = matter(content));
  } catch (err) {
    throw new HttpError(400, `Frontmatter YAML no válido: ${err.message}`);
  }
  if (!data.name || !data.description) {
    throw new HttpError(400, 'El frontmatter necesita los campos "name" y "description"');
  }
}

app.put('/api/agents/:id', async (req, res) => {
  try {
    const filename = await agentFilename(req.params.id);
    validateAgentSource(req.body?.content);
    await saveAgent(filename, req.body.content);
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error('Error saving agent:', err);
    res.status(500).json({ error: 'No se pudo guardar el agente' });
  }
});

app.delete('/api/agents/:id', async (req, res) => {
  try {
    const filename = await agentFilename(req.params.id);
    await removeAgent(filename);
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error('Error deleting agent:', err);
    res.status(500).json({ error: 'No se pudo eliminar el agente' });
  }
});

// ---------- Scheduled tasks ----------

// Maps one task from the scheduling API to the fields the dashboard shows.
function toTask(task) {
  return {
    id: task.id,
    name: task.name || '(sin nombre)',
    cron: task.cron_expression || '',
    runOnceAt: task.run_once_at || '',
    enabled: Boolean(task.enabled),
    nextRunAt: task.next_run_at || '',
    lastRun: task.last_run
      ? { status: task.last_run.status, firedAt: task.last_run.fired_at, finishedAt: task.last_run.finished_at }
      : null,
    prompt: task.derived_state?.prompt || task.prompt || ''
  };
}

app.get('/api/scheduled-tasks', async (req, res) => {
  if (!SCHEDULED_TASKS.url || !SCHEDULED_TASKS.token) {
    return res.status(503).json({ error: 'Configura CLAUDE_TRIGGERS_URL y CLAUDE_API_TOKEN en el servidor' });
  }

  try {
    const tasks = [];
    let cursor = '';
    // Follow pagination, with a cap so a bad cursor cannot loop forever.
    for (let page = 0; page < 10; page++) {
      const url = new URL(SCHEDULED_TASKS.url);
      if (cursor) url.searchParams.set('cursor', cursor);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${SCHEDULED_TASKS.token}` }
      });
      if (!response.ok) {
        throw new HttpError(502, `La API de tareas respondió ${response.status}`);
      }

      const body = await response.json();
      tasks.push(...(body.data || []));
      if (!body.next_cursor) break;
      cursor = body.next_cursor;
    }

    res.json(tasks.map(toTask));
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error('Error loading scheduled tasks:', err);
    res.status(500).json({ error: 'No se pudieron cargar las tareas programadas' });
  }
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;
