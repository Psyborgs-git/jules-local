import { getSetting, saveSession, saveActivity } from './db.js';
import { julesRequest } from './jules.js';
import { broadcast, getActiveSessionIds } from './sse.js';

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
    const activeSessionIds = getActiveSessionIds();
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

export const runPolling = async () => {
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
