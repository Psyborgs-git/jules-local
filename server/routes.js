import express from 'express';
import { 
  getSetting, setSetting, deleteSetting, db,
  getSources, getSource, saveSource,
  getSessions, getSession, saveSession,
  getActivitiesForSession, saveActivity 
} from './db.js';
import { julesRequest } from './jules.js';
import { handleSseConnection } from './sse.js';

const router = express.Router();

// Config Endpoints
router.get('/config', async (req, res) => {
  try {
    const apiKey = await getSetting('jules_api_key');
    if (apiKey) {
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

router.post('/config', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ error: 'API key is required' });
  }

  try {
    const testRes = await fetch('https://jules.googleapis.com/v1alpha/sources?pageSize=1', {
      headers: { 'x-goog-api-key': apiKey.trim() }
    });

    if (!testRes.ok) {
      let message = 'API key validation failed. Please verify credentials.';
      try {
        const errJson = await testRes.json();
        if (errJson.error?.message) message = errJson.error.message;
      } catch { /* ignore */ }
      return res.status(400).json({ error: message });
    }

    await setSetting('jules_api_key', apiKey.trim());
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Validation error: ${err.message}` });
  }
});

router.delete('/config', async (req, res) => {
  try {
    await deleteSetting('jules_api_key');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/settings', async (req, res) => {
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

router.post('/settings', async (req, res) => {
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
          } catch { /* ignore */ }
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

// SSE Events
router.get('/events', handleSseConnection);

// Sources Endpoints
router.get('/sources', async (req, res) => {
  try {
    const { pageSize, pageToken, filter } = req.query;
    const cachedSources = await getSources();
    if (cachedSources.length > 0 && !pageToken && !filter) {
      res.json({ sources: cachedSources });
      (async () => {
        try {
          const path = `/sources?pageSize=${pageSize || 30}`;
          const data = await julesRequest(path);
          if (data.sources) {
            for (const source of data.sources) await saveSource(source);
          }
        } catch (e) { /* ignore */ }
      })();
      return;
    }

    let path = `/sources?pageSize=${pageSize || 30}`;
    if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
    if (filter) path += `&filter=${encodeURIComponent(filter)}`;
    
    const data = await julesRequest(path);
    if (data.sources) {
      for (const source of data.sources) await saveSource(source);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sources/:id', async (req, res) => {
  try {
    const cachedSource = await getSource(req.params.id);
    if (cachedSource) {
      res.json(cachedSource);
      (async () => {
        try {
          const data = await julesRequest(`/sources/${req.params.id}`);
          await saveSource(data);
        } catch (e) { /* ignore */ }
      })();
      return;
    }

    const data = await julesRequest(`/sources/${req.params.id}`);
    await saveSource(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sessions Endpoints
router.get('/sessions', async (req, res) => {
  try {
    const cachedSessions = await getSessions();
    if (cachedSessions.length > 0) {
      res.json({ sessions: cachedSessions });
      (async () => {
        try {
          const data = await julesRequest('/sessions');
          if (data.sessions) {
            for (const session of data.sessions) await saveSession(session);
          }
        } catch (e) { /* ignore */ }
      })();
      return;
    }

    const data = await julesRequest('/sessions');
    if (data.sessions) {
      for (const session of data.sessions) await saveSession(session);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const data = await julesRequest('/sessions', 'POST', req.body);
    await saveSession(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sessions/:id', async (req, res) => {
  try {
    const cachedSession = await getSession(req.params.id);
    if (cachedSession) {
      res.json(cachedSession);
      (async () => {
        try {
          const data = await julesRequest(`/sessions/${req.params.id}`);
          await saveSession(data);
        } catch (e) { /* ignore */ }
      })();
      return;
    }

    const data = await julesRequest(`/sessions/${req.params.id}`);
    await saveSession(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sessions/:id/activities', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const cachedActivities = await getActivitiesForSession(sessionId);
    if (cachedActivities.length > 0) {
      res.json({ activities: cachedActivities });
      (async () => {
        try {
          const data = await julesRequest(`/sessions/${sessionId}/activities`);
          const activities = data.activities || [];
          for (const act of activities) await saveActivity(act, sessionId);
        } catch (e) { /* ignore */ }
      })();
      return;
    }

    try {
      const data = await julesRequest(`/sessions/${sessionId}/activities`);
      const activities = data.activities || [];
      for (const act of activities) await saveActivity(act, sessionId);
    } catch (e) {
      console.warn(`Failed to sync activities for ${sessionId} from Jules:`, e.message);
    }
    
    const canonicalActivities = await getActivitiesForSession(sessionId);
    res.json({ activities: canonicalActivities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    await julesRequest(`/sessions/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sessions/:id/:action', async (req, res) => {
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

export default router;
