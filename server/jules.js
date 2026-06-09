import { getSetting } from './db.js';

export const normalize = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj.name && !obj.id) {
    obj.id = obj.name.split('/').pop();
  }
  return obj;
};

export const julesRequest = async (path, method = 'GET', body = null) => {
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
