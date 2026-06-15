import { getSetting, saveSession, saveActivity, getSessions } from './db.js';
import { julesRequest } from './jules.js';
import { broadcast, getActiveSessionIds } from './sse.js';
import { broadcastMcpNotification } from './mcp/index.js';

const pollJules = async () => {
  try {
    const apiKey = await getSetting('jules_api_key');
    if (!apiKey) return;

    // Periodically update the list of all sessions in the background
    // to catch new sessions created outside of this client.
    // We don't need to do this on every short poll tick.
    // For simplicity we'll just poll the sessions list occasionally or just do it.
    const sessionsRes = await julesRequest('/sessions');
    const remoteSessions = sessionsRes.sessions || [];
    for (const session of remoteSessions) {
      await saveSession(session);
    }

    // 1. Use local db to determine what to poll
    const allSessions = await getSessions();

    // Broadcast currently known sessions
    broadcast(null, 'sessions', allSessions);

    // 2. Poll active sessions for connected clients and any sessions that aren't complete
    let sessionIdsToPoll = new Set(getActiveSessionIds());

    // Add active/pending sessions from local db
    const activeStates = ['QUEUED', 'PLANNING', 'AWAITING_PLAN_APPROVAL', 'AWAITING_USER_FEEDBACK', 'IN_PROGRESS', 'PAUSED'];
    allSessions.forEach(s => {
      if (activeStates.includes(s.state)) {
        sessionIdsToPoll.add(s.id);
      }
    });

    // Also add most recent sessions (e.g. top 2) just in case
    const recentSessions = [...allSessions]
      .sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime())
      .slice(0, 2);
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
