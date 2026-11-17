// Kết nối CSDL (SQLite cho demo). Mọi truy vấn đều dùng prepared statement
// (tham số hóa) để chống SQL injection.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

let db;
let upgradedFrom = null;

// CSDL tạo trước đặc tả chốt 16/11 lưu từng lần chạy trong bảng test_runs (có cột test_case_id).
// Lược đồ mới dùng test_runs cho đợt kiểm thử nên không nâng cấp tại chỗ được:
// đổi tên file cũ thành app.db.bak-<thời điểm> rồi tạo CSDL mới (dữ liệu thật lấy lại bằng đồng bộ Jira).
function backupLegacy(file) {
  if (file === ':memory:' || !fs.existsSync(file)) return;
  const probe = new Database(file); // mở ghi được để gộp nhật ký WAL vào file chính trước khi sao lưu
  const cols = probe.prepare("SELECT name FROM pragma_table_info('test_runs')").all().map((c) => c.name);
  const hasVersions = probe.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'requirement_versions'").get();
  const legacy = cols.includes('test_case_id') || (cols.length > 0 && !hasVersions);
  if (legacy) probe.pragma('wal_checkpoint(TRUNCATE)'); // dữ liệu còn trong app.db-wal được ghi vào app.db
  probe.close();
  if (!legacy) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${file}.bak-${stamp}`;
  fs.renameSync(file, backup);
  // Giữ lại file phụ (nếu còn) cạnh bản sao lưu, không xóa
  for (const ext of ['-wal', '-shm']) if (fs.existsSync(file + ext)) fs.renameSync(file + ext, backup + ext);
  upgradedFrom = backup;
}

function getDb() {
  if (db) return db;
  if (config.dbFile !== ':memory:') {
    fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
    backupLegacy(config.dbFile);
  }
  db = new Database(config.dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

// Đường dẫn file CSDL cũ đã sao lưu (nếu lần khởi động này vừa nâng cấp), để server in thông báo
function legacyBackup() {
  return upgradedFrom;
}

function closeDb() {
  if (db) db.close();
  db = undefined;
}

module.exports = { getDb, closeDb, legacyBackup };
