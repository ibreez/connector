import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { bmlConnector } from './src/server/serverInstance.js';
import { createBmlApiRouter } from './src/server/bmlApiRouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Mount the read-only BML API
app.use('/api/bml', createBmlApiRouter(bmlConnector));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'BML Transaction Monitor' });
});

// Serve static assets from dist
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BML Private Restaurant Connector running on http://0.0.0.0:${PORT}`);
});
