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
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

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
  return parts.length > 0 ? parts[0] : 'other';
}

// API Routes
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
    const agents = await loadAgents();
    const agent = agents.find(a => a.id === req.params.id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load agent' });
  }
});

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
