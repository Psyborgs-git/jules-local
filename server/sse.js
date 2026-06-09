let clients = []; // [{ res, sessionId }]
const sessionCache = new Map(); // sessionId -> lastSerializedData

export const broadcast = (sessionId, type, data) => {
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

export const handleSseConnection = (req, res) => {
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
};

export const getActiveSessionIds = () => {
  return [...new Set(clients.map(c => c.sessionId).filter(Boolean))];
};
