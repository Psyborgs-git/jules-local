import { getSetting, saveSession, saveActivity } from './db.js';
import { julesRequest } from './jules.js';
import { broadcast, getActiveSessionIds } from './sse.js';
import { broadcastMcpNotification } from './mcp/index.js';

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
    // Merge SSE clients and active MCP clients to poll
    // (Assuming any session that changed should be broadcast to MCP clients as well if they are listening)
    // We can poll recent sessions to check for activity since we might not know which session the MCP client cares about
    // Or we poll the most recent sessions up to a limit. Let's poll sessions that changed recently.
    // For now, let's poll sessions of connected SSE clients, and additionally, poll the top 5 recent sessions
    // to ensure MCP clients get notified of long running tasks completion.

    let sessionIdsToPoll = new Set(getActiveSessionIds());
    const recentSessions = allSessions.slice(0, 5); // top 5
    recentSessions.forEach(s => sessionIdsToPoll.add(s.id));

    for (const sessionId of sessionIdsToPoll) {
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
            // Notify MCP clients of new activities without awaiting
            broadcastMcpNotification('jules/activity_received', { sessionId, activity: act });
          }
        }
        
        if (newActivities.length > 0) {
          broadcast(sessionId, 'sessionUpdate', { session, activities: newActivities });
          // Notify MCP clients of session updates without awaiting
          broadcastMcpNotification('jules/session_update', { session, activities: newActivities });
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
