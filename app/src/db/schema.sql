-- =====================================================================
-- Hệ thống quản lý test case có hỗ trợ AI (SE104)
-- Lược đồ CSDL. Viết theo SQL chuẩn để chuyển sang PostgreSQL dễ dàng.
-- Demo dùng SQLite. Khi chuyển PostgreSQL: INTEGER PRIMARY KEY AUTOINCREMENT
-- -> SERIAL/IDENTITY, TEXT JSON -> JSONB.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- Người dùng và phân quyền (RBAC)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  full_name     TEXT    NOT NULL,
  email         TEXT,
  role          TEXT    NOT NULL CHECK (role IN ('ADMIN','QA_LEAD','TESTER','DEVELOPER')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Dự án
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  description TEXT,
  base_url    TEXT,                       -- URL ứng dụng cần test (dùng cho YC9)
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Module thuộc dự án
CREATE TABLE IF NOT EXISTS modules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  description TEXT,
  UNIQUE (project_id, name)
);

-- Sprint (Agile/Scrum): mỗi dự án chia thành các sprint 1–4 tuần
CREATE TABLE IF NOT EXISTS sprints (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  goal        TEXT,                       -- mục tiêu sprint
  start_date  TEXT    NOT NULL,           -- YYYY-MM-DD
  end_date    TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (project_id, name),
  CHECK (end_date >= start_date)
);

-- BM1: User story
CREATE TABLE IF NOT EXISTS user_stories (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  code                TEXT    NOT NULL UNIQUE,     -- QĐ1: mã không trùng
  project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module_id           INTEGER REFERENCES modules(id) ON DELETE SET NULL,
  sprint_id           INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
  title               TEXT    NOT NULL,
  description         TEXT    NOT NULL,            -- "Là ..., tôi muốn ..., để ..."
  acceptance_criteria TEXT    NOT NULL,            -- mỗi dòng 1 tiêu chí
  priority            TEXT    NOT NULL DEFAULT 'Medium',
  story_points        INTEGER,                     -- ước lượng độ lớn (Fibonacci)
  created_by          INTEGER REFERENCES users(id),
  created_at          TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Nhật ký gọi AI (truy vết khi AI sinh sai, dữ liệu cho khóa luận)
CREATE TABLE IF NOT EXISTS ai_logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id       INTEGER REFERENCES user_stories(id) ON DELETE SET NULL,
  test_case_id   INTEGER,
  user_id        INTEGER REFERENCES users(id),
  task           TEXT    NOT NULL,                 -- GENERATE_TESTCASE | GENERATE_SCRIPT
  provider       TEXT    NOT NULL,
  model          TEXT    NOT NULL,
  prompt_masked  TEXT    NOT NULL,                 -- prompt ĐÃ che dữ liệu nhạy cảm
  pii_found      TEXT,                             -- JSON: loại dữ liệu đã che
  injection_flag INTEGER NOT NULL DEFAULT 0,       -- phát hiện dấu hiệu prompt injection
  raw_output     TEXT,
  status         TEXT    NOT NULL,                 -- SUCCESS | FAILED
  attempts       INTEGER NOT NULL DEFAULT 1,
  duration_ms    INTEGER,
  error          TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- BM2: Test case
CREATE TABLE IF NOT EXISTS test_cases (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT    NOT NULL UNIQUE,
  story_id        INTEGER NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
  title           TEXT    NOT NULL,
  precondition    TEXT,
  steps           TEXT    NOT NULL,                -- JSON array chuỗi
  expected_result TEXT    NOT NULL,
  priority        TEXT    NOT NULL,
  type            TEXT    NOT NULL CHECK (type IN ('Positive','Negative','Edge')),
  status          TEXT    NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT','PENDING_REVIEW','APPROVED','RETURNED')),
  source          TEXT    NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('AI','MANUAL')),
  ai_log_id       INTEGER REFERENCES ai_logs(id),
  version         INTEGER NOT NULL DEFAULT 1,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Lịch sử phiên bản test case (so sánh bản AI gốc với bản người sửa)
CREATE TABLE IF NOT EXISTS test_case_versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  snapshot     TEXT    NOT NULL,                   -- JSON toàn bộ nội dung
  change_note  TEXT,
  changed_by   INTEGER REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- BM3: Phiếu duyệt test case
CREATE TABLE IF NOT EXISTS reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  reviewer_id  INTEGER NOT NULL REFERENCES users(id),
  decision     TEXT    NOT NULL CHECK (decision IN ('APPROVED','RETURNED')),
  note         TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- BM9: Script tự động (Playwright) do AI sinh
CREATE TABLE IF NOT EXISTS automation_scripts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  framework    TEXT    NOT NULL DEFAULT 'playwright',
  code         TEXT    NOT NULL,
  ai_log_id    INTEGER REFERENCES ai_logs(id),
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- BM4: Kết quả chạy test (thủ công hoặc tự động)
CREATE TABLE IF NOT EXISTS test_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  result       TEXT    NOT NULL CHECK (result IN ('PASS','FAIL','BLOCKED')),
  run_type     TEXT    NOT NULL DEFAULT 'MANUAL' CHECK (run_type IN ('MANUAL','AUTO')),
  note         TEXT,
  log          TEXT,
  screenshot   TEXT,
  duration_ms  INTEGER,
  executed_by  INTEGER REFERENCES users(id),
  executed_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Bảng THAM SỐ: lưu quy định để thay đổi được (tính tiến hóa – YC10)
CREATE TABLE IF NOT EXISTS parameters (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  data_type   TEXT NOT NULL DEFAULT 'int',
  description TEXT NOT NULL,
  updated_by  INTEGER REFERENCES users(id),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Nhật ký hoạt động (audit log)
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  INTEGER,
  detail     TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_tc_story   ON test_cases(story_id);
CREATE INDEX IF NOT EXISTS idx_tc_status  ON test_cases(status);
CREATE INDEX IF NOT EXISTS idx_runs_tc    ON test_runs(test_case_id);
CREATE INDEX IF NOT EXISTS idx_story_proj ON user_stories(project_id);
CREATE INDEX IF NOT EXISTS idx_story_sprint ON user_stories(sprint_id);
