import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize SQLite database
const dbPath = join(__dirname, '../data.db'); // Move up one level if server.js is at root
export const db = new sqlite3.Database(dbPath);
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

// Helper database functions
export const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });
};

export const setSetting = (key, value) => {
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

export const deleteSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM settings WHERE key = ?', [key], (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
};

export const saveSource = (source) => {
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

export const saveSession = (session) => {
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

import { broadcastMcpNotification } from './mcp/index.js';

export const saveActivity = async (activity, sessionId) => {
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
      
      db.run('SELECT 1', [], () => {
        // Trigger MCP notification on activity creation
        try {
          broadcastMcpNotification('jules/activity_received', { sessionId, activity });
        } catch (e) {
          // Ignore
        }
        resolve(true);
      }); // Signal completion
    });
  });
};

export const getSources = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT data FROM sources', [], (err, rows) => {
      if (err) return reject(err);
      try {
        resolve(rows.map(r => JSON.parse(r.data)));
      } catch (e) {
        reject(e);
      }
    });
  });
};

export const getSource = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT data FROM sources WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      try {
        resolve(JSON.parse(row.data));
      } catch (e) {
        reject(e);
      }
    });
  });
};

export const getSessions = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT data FROM sessions', [], (err, rows) => {
      if (err) return reject(err);
      try {
        resolve(rows.map(r => JSON.parse(r.data)));
      } catch (e) {
        reject(e);
      }
    });
  });
};

export const getSession = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT data FROM sessions WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      try {
        resolve(JSON.parse(row.data));
      } catch (e) {
        reject(e);
      }
    });
  });
};

export const getActivitiesForSession = (sessionId) => {
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
