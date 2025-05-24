const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join('/data', 'attendance.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      username TEXT PRIMARY KEY,
      dates TEXT,       -- JSON array of ISO date strings
      last TEXT,        -- ISO string
      streak INTEGER
    )
  `);
});

module.exports = db;