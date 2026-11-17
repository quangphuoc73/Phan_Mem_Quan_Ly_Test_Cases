-- =====================================================================
-- Hệ thống quản lý kiểm thử có AI (SE104) – lược đồ CSDL theo đặc tả chốt 16/11/2026
-- Viết theo SQL chuẩn để chuyển sang PostgreSQL dễ dàng.
-- Demo dùng SQLite. Khi chuyển PostgreSQL: INTEGER PRIMARY KEY AUTOINCREMENT
-- -> SERIAL/IDENTITY, TEXT JSON -> JSONB.
-- "Requirement" trong đặc tả = một issue Jira đồng bộ về, lưu ở bảng user_stories.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- BM10: người dùng, 5 vai trò toàn cục (QĐ11)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  full_name     TEXT    NOT NULL,
  email         TEXT,
  role          TEXT    NOT NULL CHECK (role IN ('ADMIN','QA_LEAD','PO_BA','TESTER','DEVELOPER')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- BM11: dự án đồng bộ từ Jira (QĐ12)
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  description TEXT,
  base_url    TEXT,                       -- URL ứng dụng cần test (YC19, ngoài MVP)
  jira_key    TEXT,                       -- mã dự án trên Jira (NULL với dữ liệu mẫu)
  synced_at   TEXT,                       -- lần đồng bộ thành công gần nhất
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- BM11: thành viên dự án lấy từ Jira, chỉ để hiển thị và phân công (QĐ12)
CREATE TABLE IF NOT EXISTS project_members (
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jira_account_id TEXT,
  PRIMARY KEY (project_id, user_id)
);

-- BM11: module = component của Jira
CREATE TABLE IF NOT EXISTS modules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  description TEXT,
  UNIQUE (project_id, name)
);

-- YC20 (ngoài MVP, bật bằng SPRINT_ENABLED): sprint đồng bộ từ Jira
CREATE TABLE IF NOT EXISTS sprints (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  goal        TEXT,
  start_date  TEXT    NOT NULL,
  end_date    TEXT    NOT NULL,
  jira_id     INTEGER,
  state       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (project_id, name),
  CHECK (end_date >= start_date)
);

-- BM1: requirement hiện tại (QĐ1, QĐ8). Nội dung từng phiên bản ở requirement_versions
CREATE TABLE IF NOT EXISTS user_stories (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  jira_issue_id       TEXT    UNIQUE,              -- [1.1] định danh không đổi; NULL với dữ liệu mẫu
  code                TEXT    NOT NULL UNIQUE,     -- mã hiển thị (VD SHOP-5), cập nhật khi Jira đổi mã
  project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module_id           INTEGER REFERENCES modules(id) ON DELETE SET NULL,
  sprint_id           INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
  issue_type          TEXT    NOT NULL DEFAULT 'Story',   -- [B2]
  title               TEXT    NOT NULL,
  description         TEXT    NOT NULL,
  acceptance_criteria TEXT    NOT NULL,            -- mỗi dòng 1 AC; có thể rỗng (Thiếu AC)
  priority            TEXT    NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High','Medium','Low')),
  story_points        INTEGER,                     -- YC20, ngoài MVP
  jira_status         TEXT,
  jira_updated_at     TEXT,                        -- [1.2] chỉ ghi khi Jira có bản mới hơn
  current_version     INTEGER NOT NULL DEFAULT 1,
  archived            INTEGER NOT NULL DEFAULT 0,  -- [1.4] chỉ lưu trữ khi QA Lead/Admin chọn
  check_reason        TEXT    CHECK (check_reason IN ('NOT_FOUND','TYPE_EXCLUDED')), -- khác NULL = Cần kiểm tra
  check_kept_by       INTEGER REFERENCES users(id),  -- [D2] đã chọn Giữ lại, cờ vẫn còn
  check_kept_at       TEXT,
  synced_at           TEXT,
  created_by          INTEGER REFERENCES users(id),
  created_at          TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- QĐ1, QĐ8: mỗi lần tiêu đề, mô tả hoặc AC đổi tạo một phiên bản, không xóa phiên bản cũ
CREATE TABLE IF NOT EXISTS requirement_versions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id            INTEGER NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL,
  title               TEXT    NOT NULL,
  description         TEXT    NOT NULL,
  acceptance_criteria TEXT    NOT NULL,
  jira_updated_at     TEXT,
  changes             TEXT,                        -- JSON: {title, description, ac_added[], ac_removed[]}
  source              TEXT    NOT NULL DEFAULT 'IMPORT' CHECK (source IN ('IMPORT','WEBHOOK','SCHEDULE','MANUAL','SEED')),
  created_at          TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (story_id, version)
);

-- BM7 [1.3]: kết quả từng lần đồng bộ
CREATE TABLE IF NOT EXISTS sync_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source      TEXT    NOT NULL CHECK (source IN ('IMPORT','WEBHOOK','SCHEDULE','MANUAL')),
  status      TEXT    NOT NULL CHECK (status IN ('SUCCESS','FAILED')),
  attempts    INTEGER NOT NULL DEFAULT 1,
  summary     TEXT,                                -- JSON số requirement thêm, đổi, cần kiểm tra
  error       TEXT,
  user_id     INTEGER REFERENCES users(id),
  started_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  finished_at TEXT
);

-- Nhật ký gọi AI (QĐ2, QĐ15, QĐ17)
CREATE TABLE IF NOT EXISTS ai_logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id       INTEGER REFERENCES user_stories(id) ON DELETE SET NULL,
  test_case_id   INTEGER,
  user_id        INTEGER REFERENCES users(id),
  task           TEXT    NOT NULL,                 -- GENERATE_TESTCASE | ANALYZE_IMPACT | RANK_REGRESSION | GENERATE_SCRIPT
  provider       TEXT    NOT NULL,
  model          TEXT    NOT NULL,
  prompt_masked  TEXT    NOT NULL,                 -- prompt ĐÃ che dữ liệu nhạy cảm
  pii_found      TEXT,
  injection_flag INTEGER NOT NULL DEFAULT 0,
  raw_output     TEXT,
  status         TEXT    NOT NULL,                 -- SUCCESS | FAILED
  attempts       INTEGER NOT NULL DEFAULT 1,
  duration_ms    INTEGER,
  error          TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- BM14: một lần chạy phân tích ảnh hưởng (QĐ15)
CREATE TABLE IF NOT EXISTS impact_analyses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id     INTEGER NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
  from_version INTEGER NOT NULL,
  to_version   INTEGER NOT NULL,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  ai_log_id    INTEGER REFERENCES ai_logs(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  CHECK (from_version < to_version)
);

-- BM2: test case (QĐ2, QĐ3)
CREATE TABLE IF NOT EXISTS test_cases (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT    NOT NULL UNIQUE,
  story_id        INTEGER NOT NULL REFERENCES user_stories(id) ON DELETE RESTRICT,
  title           TEXT    NOT NULL,
  precondition    TEXT,
  steps           TEXT    NOT NULL,                -- JSON array chuỗi, 1–15 bước
  expected_result TEXT    NOT NULL,
  priority        TEXT    NOT NULL CHECK (priority IN ('High','Medium','Low')),
  type            TEXT    NOT NULL CHECK (type IN ('Positive','Negative','Edge')),
  status          TEXT    NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT','PENDING_REVIEW','APPROVED','RETURNED')),
  source          TEXT    NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('AI','MANUAL')),
  ai_log_id       INTEGER REFERENCES ai_logs(id),
  proposal_id     INTEGER,                         -- tạo/sửa từ đề xuất AI (QĐ16), FK logic tới ai_proposals
  version         INTEGER NOT NULL DEFAULT 1,
  req_version     INTEGER NOT NULL DEFAULT 1,      -- phiên bản requirement đã liên kết (QĐ3, [R5])
  needs_review    INTEGER NOT NULL DEFAULT 0,      -- cờ Cần xem lại (QĐ3, [A1], [D1])
  review_reason   TEXT    CHECK (review_reason IN ('AC_CHANGED','AC_REMOVED','CONTENT_CHANGED')),
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- QĐ3: liên kết test ↔ AC, AC nhận diện theo nội dung dòng đã chuẩn hóa
CREATE TABLE IF NOT EXISTS test_case_acs (
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  ac_text      TEXT    NOT NULL,
  PRIMARY KEY (test_case_id, ac_text)
);

-- Lịch sử nội dung test case (mỗi lần sửa một phiên bản)
CREATE TABLE IF NOT EXISTS test_case_versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  snapshot     TEXT    NOT NULL,                   -- JSON toàn bộ nội dung
  change_note  TEXT,
  changed_by   INTEGER REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (test_case_id, version)
);

-- QĐ3 [2.2]: nhật ký Đã xem lại; batch_id gom các test xác nhận hàng loạt [D1]
CREATE TABLE IF NOT EXISTS recheck_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  req_version  INTEGER NOT NULL,
  reason       TEXT    NOT NULL,
  batch_id     TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- BM3: phiếu duyệt test case (QĐ4)
CREATE TABLE IF NOT EXISTS reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  reviewer_id  INTEGER NOT NULL REFERENCES users(id),
  decision     TEXT    NOT NULL CHECK (decision IN ('APPROVED','RETURNED')),
  note         TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- BM12: Test Suite phẳng (QĐ13)
CREATE TABLE IF NOT EXISTS test_suites (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  description TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS test_suite_items (
  suite_id     INTEGER NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  PRIMARY KEY (suite_id, test_case_id)
);

-- BM16: bộ regression đề xuất cho một thay đổi requirement (QĐ17)
CREATE TABLE IF NOT EXISTS regression_sets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id     INTEGER NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
  from_version INTEGER NOT NULL,
  to_version   INTEGER NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','CONFIRMED')),
  ai_log_id    INTEGER REFERENCES ai_logs(id),
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  confirmed_by INTEGER REFERENCES users(id),
  confirmed_at TEXT,
  run_id       INTEGER                              -- Test Run tạo khi xác nhận
);

CREATE TABLE IF NOT EXISTS regression_items (
  set_id        INTEGER NOT NULL REFERENCES regression_sets(id) ON DELETE CASCADE,
  test_case_id  INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  priority      TEXT    NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH','MEDIUM','LOW')),
  reason        TEXT,
  origin        TEXT    NOT NULL CHECK (origin IN ('LINKED','AI','PROPOSAL','MANUAL')),
  mandatory     INTEGER NOT NULL DEFAULT 0,         -- liên kết với phần đã đổi, bỏ phải ghi lý do
  removed       INTEGER NOT NULL DEFAULT 0,
  remove_reason TEXT,
  PRIMARY KEY (set_id, test_case_id)
);

-- BM13: Test Run = đợt kiểm thử (QĐ14)
CREATE TABLE IF NOT EXISTS test_runs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name              TEXT    NOT NULL,
  run_type          TEXT    NOT NULL DEFAULT 'NORMAL' CHECK (run_type IN ('NORMAL','RETEST','REGRESSION')),
  build             TEXT    NOT NULL,              -- [3.2]; khóa khi đã có kết quả [D3]
  environment       TEXT    NOT NULL,
  due_date          TEXT,
  status            TEXT    NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  regression_set_id INTEGER REFERENCES regression_sets(id),
  created_by        INTEGER NOT NULL REFERENCES users(id),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  closed_by         INTEGER REFERENCES users(id),
  closed_at         TEXT
);

-- BM13: test trong đợt, phiên bản cố định khi đưa vào đợt (QĐ14)
CREATE TABLE IF NOT EXISTS test_run_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id       INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id),
  tc_version   INTEGER NOT NULL,
  assignee_id  INTEGER REFERENCES users(id),
  UNIQUE (run_id, test_case_id)
);

-- BM4: từng lần ghi kết quả (QĐ5)
CREATE TABLE IF NOT EXISTS test_executions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id       INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  item_id      INTEGER NOT NULL REFERENCES test_run_items(id) ON DELETE CASCADE,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id),
  tc_version   INTEGER NOT NULL,
  result       TEXT    NOT NULL CHECK (result IN ('PASS','FAIL','BLOCKED')),
  note         TEXT,
  defect_code  TEXT,
  evidence_url TEXT,
  retest_of    INTEGER REFERENCES test_executions(id),  -- [3.1] lần Fail gốc
  run_type     TEXT    NOT NULL DEFAULT 'MANUAL' CHECK (run_type IN ('MANUAL','AUTO')),
  log          TEXT,
  screenshot   TEXT,
  duration_ms  INTEGER,
  executed_by  INTEGER NOT NULL REFERENCES users(id),
  executed_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- BM17: phiếu báo đã sửa lỗi và trạng thái kiểm thử lại (QĐ18, [3.3])
CREATE TABLE IF NOT EXISTS fix_reports (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id         INTEGER NOT NULL UNIQUE REFERENCES test_executions(id) ON DELETE CASCADE,
  build                TEXT    NOT NULL,
  note                 TEXT,
  reported_by          INTEGER NOT NULL REFERENCES users(id),
  reported_at          TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  status               TEXT    NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING','CLOSED','REOPENED')),
  last_execution_id    INTEGER REFERENCES test_executions(id)
);

-- BM14, BM15: đề xuất AI và quyết định của QA Lead (QĐ15, QĐ16)
CREATE TABLE IF NOT EXISTS ai_proposals (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id         INTEGER NOT NULL REFERENCES impact_analyses(id) ON DELETE CASCADE,
  story_id            INTEGER NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
  type                TEXT    NOT NULL CHECK (type IN ('UPDATE','MISSING','RERUN','CLARIFY')),
  test_case_id        INTEGER REFERENCES test_cases(id) ON DELETE SET NULL,
  source_part         TEXT    NOT NULL CHECK (source_part IN ('AC','TITLE','DESCRIPTION')),  -- [R2]
  source_ac           TEXT,
  content             TEXT,                        -- JSON test đề xuất (UPDATE, MISSING)
  reason              TEXT    NOT NULL,
  req_version         INTEGER NOT NULL,            -- phiên bản lúc phân tích, để phát hiện Lỗi thời
  tc_version          INTEGER,
  status              TEXT    NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','REJECTED','OUTDATED')),
  decided_by          INTEGER REFERENCES users(id),
  decided_at          TEXT,
  note                TEXT,
  result_test_case_id INTEGER REFERENCES test_cases(id) ON DELETE SET NULL,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- YC19 (ngoài MVP, bật bằng SCRIPT_ENABLED): script Playwright do AI sinh
CREATE TABLE IF NOT EXISTS automation_scripts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id INTEGER NOT NULL UNIQUE REFERENCES test_cases(id) ON DELETE CASCADE,
  framework    TEXT    NOT NULL DEFAULT 'playwright',
  code         TEXT    NOT NULL,
  ai_log_id    INTEGER REFERENCES ai_logs(id),
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- BM9: bảng THAM SỐ (YC10, QĐ10)
CREATE TABLE IF NOT EXISTS parameters (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  data_type   TEXT NOT NULL DEFAULT 'int',
  description TEXT NOT NULL,
  updated_by  INTEGER REFERENCES users(id),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Nhật ký hoạt động
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

CREATE INDEX IF NOT EXISTS idx_story_proj    ON user_stories(project_id);
CREATE INDEX IF NOT EXISTS idx_story_sprint  ON user_stories(sprint_id);
CREATE INDEX IF NOT EXISTS idx_reqver_story  ON requirement_versions(story_id);
CREATE INDEX IF NOT EXISTS idx_tc_story      ON test_cases(story_id);
CREATE INDEX IF NOT EXISTS idx_tc_status     ON test_cases(status);
CREATE INDEX IF NOT EXISTS idx_run_project   ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_item_run      ON test_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_exec_run      ON test_executions(run_id);
CREATE INDEX IF NOT EXISTS idx_exec_tc       ON test_executions(test_case_id);
CREATE INDEX IF NOT EXISTS idx_prop_story    ON ai_proposals(story_id);
CREATE INDEX IF NOT EXISTS idx_suiteitem_tc  ON test_suite_items(test_case_id);
