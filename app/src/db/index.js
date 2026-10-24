// Kết nối CSDL (SQLite cho demo). Mọi truy vấn đều dùng prepared statement
// (tham số hóa) để chống SQL injection.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

let db;

function getDb() {
  if (db) return db;
  if (config.dbFile !== ':memory:') {
    fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
  }
  db = new Database(config.dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

// Nâng cấp CSDL cũ (tạo trước khi có sprint) mà không mất dữ liệu
function migrate(conn) {
  const cols = conn.prepare("SELECT name FROM pragma_table_info('user_stories')").all().map((c) => c.name);
  if (cols.length && !cols.includes('sprint_id')) {
    conn.exec('ALTER TABLE user_stories ADD COLUMN sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL');
  }
  if (cols.length && !cols.includes('story_points')) {
    conn.exec('ALTER TABLE user_stories ADD COLUMN story_points INTEGER');
  }
}

function closeDb() {
  if (db) db.close();
  db = undefined;
}

module.exports = { getDb, closeDb };
