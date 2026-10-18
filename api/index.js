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

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Load all agents
async function loadAgents() {
  try {
    const files = await fs.readdir(agentsDir);
    const agents = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const filePath = path.join(agentsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const { data, content: markdown } = matter(content);

          agents.push({
            id: file.replace('.md', ''),
            filename: file,
            title: data.title || file.replace('.md', ''),
            category: data.category || 'Uncategorized',
            division: extractDivision(file),
            description: data.description || '',
            frontmatter: data,
            content: markdown.substring(0, 500) + '...',
            fullContent: markdown
          });
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
  if (parts.length > 0) {
    return parts[0];
  }
  return 'other';
}

// API Routes
app.get('/api/agents', async (req, res) => {
  const agents = await loadAgents();
  res.json(agents);
});

app.get('/api/agents/:id', async (req, res) => {
  const agents = await loadAgents();
  const agent = agents.find(a => a.id === req.params.id);

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  res.json(agent);
});

app.get('/api/stats', async (req, res) => {
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
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Catch-all for static files
app.use((req, res, next) => {
  const filePath = path.join(__dirname, '../public', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

export default app;
