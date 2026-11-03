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
  const projCols = conn.prepare("SELECT name FROM pragma_table_info('projects')").all().map((c) => c.name);
  if (projCols.length && !projCols.includes('jira_key')) {
    conn.exec('ALTER TABLE projects ADD COLUMN jira_key TEXT; ALTER TABLE projects ADD COLUMN synced_at TEXT');
  }
  if (cols.length && !cols.includes('archived')) {
    conn.exec(`ALTER TABLE user_stories ADD COLUMN jira_status TEXT;
      ALTER TABLE user_stories ADD COLUMN synced_at TEXT;
      ALTER TABLE user_stories ADD COLUMN changed_at TEXT;
      ALTER TABLE user_stories ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`);
  }
  const spCols = conn.prepare("SELECT name FROM pragma_table_info('sprints')").all().map((c) => c.name);
  if (spCols.length && !spCols.includes('jira_id')) {
    conn.exec('ALTER TABLE sprints ADD COLUMN jira_id INTEGER; ALTER TABLE sprints ADD COLUMN state TEXT');
  }
  const runCols = conn.prepare("SELECT name FROM pragma_table_info('test_runs')").all().map((c) => c.name);
  if (runCols.length && !runCols.includes('fix_build')) {
    conn.exec(`ALTER TABLE test_runs ADD COLUMN fix_build TEXT;
      ALTER TABLE test_runs ADD COLUMN fix_note TEXT;
      ALTER TABLE test_runs ADD COLUMN fixed_by INTEGER REFERENCES users(id);
      ALTER TABLE test_runs ADD COLUMN fixed_at TEXT`);
  }
  // CSDL tạo trước khi có vai trò PO_BA: SQLite không sửa được CHECK nên tạo lại bảng users, giữ nguyên id
  const users = conn.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (users && !users.sql.includes("'PO_BA'")) {
    conn.pragma('foreign_keys = OFF');
    conn.transaction(() => {
      conn.exec(users.sql.replace('CREATE TABLE users', 'CREATE TABLE users_new').replace("'QA_LEAD',", "'QA_LEAD','PO_BA',"));
      conn.exec('INSERT INTO users_new SELECT * FROM users; DROP TABLE users; ALTER TABLE users_new RENAME TO users');
    })();
    conn.pragma('foreign_keys = ON');
  }
}

function closeDb() {
  if (db) db.close();
  db = undefined;
}

module.exports = { getDb, closeDb };
