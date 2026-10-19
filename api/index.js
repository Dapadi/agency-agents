import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Use local agents directory in the repository
const agentsDir = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, '../agents')
  : path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'agents');

// Writes touch the filesystem, so they are off in production (Vercel's filesystem is read-only)
// unless ALLOW_WRITES=true is set explicitly.
const writesEnabled = process.env.NODE_ENV !== 'production' || process.env.ALLOW_WRITES === 'true';

const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MAX_CONTENT_LENGTH = 200_000;

// Middleware
app.use(express.json({ limit: '512kb' }));
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendError(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
}

function requireWrites(req, res, next) {
  if (!writesEnabled) {
    return res.status(403).json({ error: 'Writes are disabled in this deployment' });
  }
  next();
}

function agentFile(id) {
  if (typeof id !== 'string' || !AGENT_ID_PATTERN.test(id)) {
    throw new HttpError(400, 'Invalid agent id: use lowercase letters, numbers and hyphens');
  }
  return path.join(agentsDir, `${id}.md`);
}

function validateContent(content) {
  if (typeof content !== 'string' || content.trim() === '') {
    throw new HttpError(400, 'Agent content cannot be empty');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new HttpError(400, 'Agent content is too large');
  }
  try {
    matter(content);
  } catch (err) {
    throw new HttpError(400, `Invalid frontmatter: ${err.message}`);
  }
}

function parseAgent(file, content) {
  const { data, content: markdown } = matter(content);

  return {
    id: file.replace('.md', ''),
    filename: file,
    title: data.title || data.name || file.replace('.md', ''),
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
          agents.push(parseAgent(file, content));
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

function extractDivision(filename) {
  const parts = filename.split('-');
  return parts.length > 0 ? parts[0] : 'other';
}

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ writable: writesEnabled });
});

app.get('/api/agents', async (req, res) => {
  try {
    const agents = await loadAgents();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load agents' });
  }
});

app.get('/api/agents/:id', async (req, res) => {
  try {
    const file = agentFile(req.params.id);
    if (!(await fs.pathExists(file))) {
      throw new HttpError(404, 'Agent not found');
    }

    const raw = await fs.readFile(file, 'utf-8');
    res.json({ ...parseAgent(path.basename(file), raw), raw });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/agents', requireWrites, async (req, res) => {
  try {
    const file = agentFile(req.body?.id);
    validateContent(req.body?.content);

    await fs.ensureDir(agentsDir);
    await writeNewAgent(file, req.body.content);

    const created = await fs.readFile(file, 'utf-8');
    res.status(201).json({ ...parseAgent(path.basename(file), created), raw: created });
  } catch (err) {
    sendError(res, err);
  }
});

app.put('/api/agents/:id', requireWrites, async (req, res) => {
  try {
    const file = agentFile(req.params.id);
    validateContent(req.body?.content);

    if (!(await fs.pathExists(file))) {
      throw new HttpError(404, 'Agent not found');
    }

    await fs.writeFile(file, req.body.content, 'utf-8');
    const saved = await fs.readFile(file, 'utf-8');
    res.json({ ...parseAgent(path.basename(file), saved), raw: saved });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete('/api/agents/:id', requireWrites, async (req, res) => {
  try {
    const file = agentFile(req.params.id);
    if (!(await fs.pathExists(file))) {
      throw new HttpError(404, 'Agent not found');
    }

    await fs.remove(file);
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/agents/:id/duplicate', requireWrites, async (req, res) => {
  try {
    const source = agentFile(req.params.id);
    const target = agentFile(req.body?.id);

    if (!(await fs.pathExists(source))) {
      throw new HttpError(404, 'Agent not found');
    }

    const content = await fs.readFile(source, 'utf-8');
    await fs.ensureDir(agentsDir);
    await writeNewAgent(target, content);

    const created = await fs.readFile(target, 'utf-8');
    res.status(201).json({ ...parseAgent(path.basename(target), created), raw: created });
  } catch (err) {
    sendError(res, err);
  }
});

// Creates the file only if it does not exist yet, so two requests cannot overwrite each other
async function writeNewAgent(file, content) {
  try {
    await fs.writeFile(file, content, { encoding: 'utf-8', flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') {
      throw new HttpError(409, 'An agent with that id already exists');
    }
    throw err;
  }
}

app.get('/api/stats', async (req, res) => {
  try {
    const agents = await loadAgents();
    const divisions = {};

    agents.forEach(agent => {
      if (!divisions[agent.division]) {
        divisions[agent.division] = 0;
      }
      divisions[agent.division]++;
    });

    res.json({
      totalAgents: agents.length,
      divisions
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats' });
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
