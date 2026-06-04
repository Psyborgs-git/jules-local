import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// Initialize SQLite database
const dbPath = join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    // Create settings table
    db.run(
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )`,
      (createErr) => {
        if (createErr) console.error('Failed to create settings table:', createErr.message);
      }
    );
  }
});

// Helper database functions
const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });
};

const setSetting = (key, value) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value],
      (err) => {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
};

const deleteSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM settings WHERE key = ?', [key], (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
};

// Jules API Helper
const normalize = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj.name && !obj.id) {
    obj.id = obj.name.split('/').pop();
  }
  return obj;
};

const julesRequest = async (path, method = 'GET', body = null) => {
  const apiKey = await getSetting('jules_api_key');
  if (!apiKey) throw new Error('Jules API key not configured');

  const url = `https://jules.googleapis.com/v1alpha${path}`;
  const headers = { 'x-goog-api-key': apiKey };
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    let message = `Jules API error: ${res.status}`;
    try {
      const error = await res.json();
      if (error.error?.message) message = error.error.message;
    } catch (e) { /* ignore */ }
    throw new Error(message);
  }

  if (method === 'DELETE' || res.status === 204) return {};
  const data = await res.json();
  
  // Normalize responses
  if (data.sessions) data.sessions.forEach(normalize);
  if (data.sources) data.sources.forEach(normalize);
  if (data.activities) data.activities.forEach(normalize);
  if (data.name) normalize(data);
  
  return data;
};

// SSE State
let clients = []; // [{ res, sessionId }]
const sessionCache = new Map(); // sessionId -> lastSerializedData

const broadcast = (sessionId, type, data) => {
  const payload = JSON.stringify({ type, data });
  const serialized = JSON.stringify(data);
  
  // Cache check to avoid redundant sends
  const cacheKey = `${sessionId}:${type}`;
  if (sessionCache.get(cacheKey) === serialized) return;
  sessionCache.set(cacheKey, serialized);

  clients.forEach(client => {
    if (client.sessionId === sessionId || (!sessionId && !client.sessionId)) {
      client.res.write(`data: ${payload}\n\n`);
    }
  });
};

// Polling Engine
const sentActivityIds = new Map(); // sessionId -> Set of activity IDs

const pollJules = async () => {
  try {
    const apiKey = await getSetting('jules_api_key');
    if (!apiKey) return;

    // 1. Poll sessions list for anyone on the dashboard
    const sessionsRes = await julesRequest('/sessions');
    broadcast(null, 'sessions', sessionsRes.sessions || []);

    // 2. Poll active sessions for connected clients
    const activeSessionIds = [...new Set(clients.map(c => c.sessionId).filter(Boolean))];
    for (const sessionId of activeSessionIds) {
      try {
        const [session, activitiesRes] = await Promise.all([
          julesRequest(`/sessions/${sessionId}`),
          julesRequest(`/sessions/${sessionId}/activities`)
        ]);
        
        const allActivities = activitiesRes.activities || [];
        if (!sentActivityIds.has(sessionId)) {
          sentActivityIds.set(sessionId, new Set());
        }
        const sentSet = sentActivityIds.get(sessionId);
        
        const newActivities = allActivities.filter(act => !sentSet.has(act.id));
        
        if (newActivities.length > 0) {
          newActivities.forEach(act => sentSet.add(act.id));
          broadcast(sessionId, 'sessionUpdate', { session, activities: newActivities });
        } else {
          broadcast(sessionId, 'sessionUpdate', { session, activities: [] });
        }
      } catch (err) {
        console.error(`Error polling session ${sessionId}:`, err.message);
      }
    }
  } catch (err) {
    // Silently handle polling errors to avoid log spam
  }
};

const runPolling = async () => {
  await pollJules();
  let interval = 3000;
  try {
    const dbInterval = (await getSetting('polling_interval')) || (await getSetting('polling_timeout'));
    if (dbInterval) {
      const parsed = parseInt(dbInterval, 10);
      if (!isNaN(parsed) && parsed > 0) {
        interval = parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  setTimeout(runPolling, interval);
};

runPolling();

// Endpoints
app.get('/api/config', async (req, res) => {
  try {
    const apiKey = await getSetting('jules_api_key');
    if (apiKey) {
      // Mask key for safety (show first 4 and last 4 characters)
      const maskedKey = apiKey.length > 8
        ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
        : '••••••••';
      res.json({ hasKey: true, maskedKey });
    } else {
      res.json({ hasKey: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ error: 'API key is required' });
  }

  try {
    // Validate API key with a test call to Jules API
    const testRes = await fetch('https://jules.googleapis.com/v1alpha/sources?pageSize=1', {
      headers: { 'x-goog-api-key': apiKey.trim() }
    });

    if (!testRes.ok) {
      let message = 'API key validation failed. Please verify credentials.';
      try {
        const errJson = await testRes.json();
        if (errJson.error?.message) message = errJson.error.message;
      } catch {
        // ignore
      }
      return res.status(400).json({ error: message });
    }

    // Save key to database
    await setSetting('jules_api_key', apiKey.trim());
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Validation error: ${err.message}` });
  }
});

app.delete('/api/config', async (req, res) => {
  try {
    await deleteSetting('jules_api_key');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    db.all('SELECT key, value FROM settings', [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const data = {};
      rows.forEach((row) => {
        if (row.key === 'jules_api_key') {
          data.hasKey = !!row.value;
          data.maskedKey = row.value && row.value.length > 8
            ? `${row.value.substring(0, 4)}...${row.value.substring(row.value.length - 4)}`
            : '••••••••';
        } else {
          data[row.key] = row.value;
        }
      });
      res.json(data);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  const { key, value } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'Key is required' });
  }
  try {
    if (key === 'jules_api_key') {
      if (value && value.trim()) {
        const testRes = await fetch('https://jules.googleapis.com/v1alpha/sources?pageSize=1', {
          headers: { 'x-goog-api-key': value.trim() }
        });

        if (!testRes.ok) {
          let message = 'API key validation failed. Please verify credentials.';
          try {
            const errJson = await testRes.json();
            if (errJson.error?.message) message = errJson.error.message;
          } catch {
            // ignore
          }
          return res.status(400).json({ error: message });
        }
        await setSetting('jules_api_key', value.trim());
      } else {
        await deleteSetting('jules_api_key');
      }
    } else {
      await setSetting(key, value);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE Events Endpoint
app.get('/api/events', (req, res) => {
  const { sessionId } = req.query;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const client = { res, sessionId };
  clients.push(client);

  req.on('close', () => {
    clients = clients.filter(c => c !== client);
  });
});

// Explicit Jules API Endpoints
app.get('/api/sources', async (req, res) => {
  try {
    const { pageSize, pageToken, filter } = req.query;
    let path = `/sources?pageSize=${pageSize || 30}`;
    if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
    if (filter) path += `&filter=${encodeURIComponent(filter)}`;
    
    const data = await julesRequest(path);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sources/:id', async (req, res) => {
  try {
    const data = await julesRequest(`/sources/${req.params.id}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions', async (req, res) => {
  try {
    const data = await julesRequest('/sessions');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const data = await julesRequest('/sessions', 'POST', req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const data = await julesRequest(`/sessions/${req.params.id}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id/activities', async (req, res) => {
  try {
    const data = await julesRequest(`/sessions/${req.params.id}/activities`);
    const activities = data.activities || [];
    if (!sentActivityIds.has(req.params.id)) {
      sentActivityIds.set(req.params.id, new Set());
    }
    const sentSet = sentActivityIds.get(req.params.id);
    activities.forEach(act => sentSet.add(act.id));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await julesRequest(`/sessions/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  if (!['sendMessage', 'approvePlan'].includes(action)) {
    return res.status(404).json({ error: 'Action not found' });
  }
  try {
    const data = await julesRequest(`/sessions/${id}:${action}`, 'POST', req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start listening
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(join(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer();
