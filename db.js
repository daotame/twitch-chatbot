const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join('/data', 'attendance.db');
const db = new Database(dbPath)

// Create table if not exists
db.prepare(`
    CREATE TABLE IF NOT EXISTS attendance (
        username TEXT PRIMARY KEY,
        dates TEXT,
        last TEXT,
        streak INTEGER
  )
`).run();

module.exports = db;