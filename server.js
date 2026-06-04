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
    
    db.serialize(() => {
      // Create settings table
      db.run(
        `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )`
      );

      // Create sources table
      db.run(
        `CREATE TABLE IF NOT EXISTS sources (
          id TEXT PRIMARY KEY,
          data TEXT
        )`
      );

      // Create sessions table
      db.run(
        `CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          data TEXT
        )`
      );

      // Create activities table
      db.run(
        `CREATE TABLE IF NOT EXISTS activities (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          name TEXT,
          originator TEXT,
          description TEXT,
          create_time TEXT
        )`
      );

      // Create messages table
      db.run(
        `CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id TEXT,
          role TEXT,
          content TEXT,
          FOREIGN KEY(activity_id) REFERENCES activities(id)
        )`
      );

      // Create events table
      db.run(
        `CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id TEXT,
          event_type TEXT,
          data TEXT,
          FOREIGN KEY(activity_id) REFERENCES activities(id)
        )`
      );

      // Create artifacts table
      db.run(
        `CREATE TABLE IF NOT EXISTS artifacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id TEXT,
          artifact_type TEXT,
          data TEXT,
          FOREIGN KEY(activity_id) REFERENCES activities(id)
        )`
      );
    });
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

const saveSource = (source) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO sources (id, data) VALUES (?, ?)',
      [source.id, JSON.stringify(source)],
      (err) => {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
};

const saveSession = (session) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO sessions (id, data) VALUES (?, ?)',
      [session.id, JSON.stringify(session)],
      (err) => {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
};

const saveActivity = async (activity, sessionId) => {
  // Check if activity exists
  const existing = await new Promise((resolve) => {
    db.get('SELECT id FROM activities WHERE id = ?', [activity.id], (err, row) => {
      resolve(row);
    });
  });

  if (existing) return false;

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        'INSERT INTO activities (id, session_id, name, originator, description, create_time) VALUES (?, ?, ?, ?, ?, ?)',
        [activity.id, sessionId, activity.name, activity.originator, activity.description, activity.createTime],
        (err) => { if (err) reject(err); }
      );

      if (activity.userMessaged) {
        db.run(
          'INSERT INTO messages (activity_id, role, content) VALUES (?, ?, ?)',
          [activity.id, 'user', activity.userMessaged.userMessage]
        );
      }
      if (activity.agentMessaged) {
        db.run(
          'INSERT INTO messages (activity_id, role, content) VALUES (?, ?, ?)',
          [activity.id, 'agent', activity.agentMessaged.agentMessage]
        );
      }
      
      const eventTypes = ['progressUpdated', 'planGenerated', 'planApproved', 'sessionCompleted', 'sessionFailed'];
      eventTypes.forEach(type => {
        if (activity[type]) {
          db.run(
            'INSERT INTO events (activity_id, event_type, data) VALUES (?, ?, ?)',
            [activity.id, type, JSON.stringify(activity[type])]
          );
        }
      });

      if (activity.artifacts && activity.artifacts.length > 0) {
        activity.artifacts.forEach(artifact => {
          let type = 'unknown';
          if (artifact.changeSet) type = 'changeSet';
          else if (artifact.bashOutput) type = 'bashOutput';
          else if (artifact.media) type = 'media';
          
          db.run(
            'INSERT INTO artifacts (activity_id, artifact_type, data) VALUES (?, ?, ?)',
            [activity.id, type, JSON.stringify(artifact)]
          );
        });
      }
      
      db.run('SELECT 1', [], () => resolve(true)); // Signal completion
    });
  });
};

const getActivitiesForSession = (sessionId) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT a.*, m.role, m.content, e.event_type, e.data as event_data, art.artifact_type, art.data as artifact_data
       FROM activities a
       LEFT JOIN messages m ON a.id = m.activity_id
       LEFT JOIN events e ON a.id = e.activity_id
       LEFT JOIN artifacts art ON a.id = art.activity_id
       WHERE a.session_id = ?
       ORDER BY a.create_time ASC`,
      [sessionId],
      (err, rows) => {
        if (err) return reject(err);
        
        const activityMap = new Map();
        rows.forEach(row => {
          if (!activityMap.has(row.id)) {
            activityMap.set(row.id, {
              id: row.id,
              name: row.name,
              originator: row.originator,
              description: row.description,
              createTime: row.create_time,
              artifacts: []
            });
          }
          const act = activityMap.get(row.id);
          
          if (row.role === 'user') act.userMessaged = { userMessage: row.content };
          if (row.role === 'agent') act.agentMessaged = { agentMessage: row.content };
          
          if (row.event_type) {
            try {
              act[row.event_type] = JSON.parse(row.event_data);
            } catch (e) { /* ignore */ }
          }
          
          if (row.artifact_data) {
            try {
              const artData = JSON.parse(row.artifact_data);
              // Avoid duplicate artifacts if multiple rows per activity due to joins
              const artKey = JSON.stringify(artData);
              if (!act.artifacts.some(existingArt => JSON.stringify(existingArt) === artKey)) {
                act.artifacts.push(artData);
              }
            } catch (e) { /* ignore */ }
          }
        });
        
        resolve(Array.from(activityMap.values()));
      }
    );
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
const pollJules = async () => {
  try {
    const apiKey = await getSetting('jules_api_key');
    if (!apiKey) return;

    // 1. Poll sessions list for anyone on the dashboard
    const sessionsRes = await julesRequest('/sessions');
    const allSessions = sessionsRes.sessions || [];
    for (const session of allSessions) {
      await saveSession(session);
    }
    broadcast(null, 'sessions', allSessions);

    // 2. Poll active sessions for connected clients
    const activeSessionIds = [...new Set(clients.map(c => c.sessionId).filter(Boolean))];
    for (const sessionId of activeSessionIds) {
      try {
        const [session, activitiesRes] = await Promise.all([
          julesRequest(`/sessions/${sessionId}`),
          julesRequest(`/sessions/${sessionId}/activities`)
        ]);
        
        await saveSession(session);
        const allActivities = activitiesRes.activities || [];
        
        const newActivities = [];
        for (const act of allActivities) {
          const saved = await saveActivity(act, sessionId);
          if (saved) {
            newActivities.push(act);
          }
        }
        
        if (newActivities.length > 0) {
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
    if (data.sources) {
      for (const source of data.sources) {
        await saveSource(source);
      }
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sources/:id', async (req, res) => {
  try {
    const data = await julesRequest(`/sources/${req.params.id}`);
    await saveSource(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions', async (req, res) => {
  try {
    const data = await julesRequest('/sessions');
    if (data.sessions) {
      for (const session of data.sessions) {
        await saveSession(session);
      }
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const data = await julesRequest('/sessions', 'POST', req.body);
    await saveSession(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const data = await julesRequest(`/sessions/${req.params.id}`);
    await saveSession(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id/activities', async (req, res) => {
  try {
    const sessionId = req.params.id;
    // Attempt to sync from Jules first
    try {
      const data = await julesRequest(`/sessions/${sessionId}/activities`);
      const activities = data.activities || [];
      for (const act of activities) {
        await saveActivity(act, sessionId);
      }
    } catch (e) {
      console.warn(`Failed to sync activities for ${sessionId} from Jules:`, e.message);
    }
    
    // Return canonical list from DB
    const canonicalActivities = await getActivitiesForSession(sessionId);
    res.json({ activities: canonicalActivities });
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
