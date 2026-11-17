// YC14 – BM13, QĐ14: Test Run (đợt kiểm thử) và phân công.
// YC5  – BM4,  QĐ5 : ghi nhận kết quả chạy test trong Test Run.
const { z } = require('zod');
const { getDb } = require('../db');
const { badRequest, conflict, notFound, forbidden } = require('../utils/errors');

// QĐ14 [2.1]: ĐIỀU KIỆN CHẠY dùng chung cho YC14 và YC17.
// Trả về null nếu đủ điều kiện, ngược lại trả lý do.
function ineligibleReason(tc) {
  if (!tc) return 'Không tìm thấy test case';
  if (tc.status !== 'APPROVED') return 'Test chưa được duyệt';
  if (tc.needs_review) return 'Test đang có cờ Cần xem lại';
  if (tc.story_archived) return 'Requirement đã lưu trữ';
  if (tc.story_check_reason) return 'Requirement đang Cần kiểm tra';
  return null;
}

function loadTests(ids) {
  if (!ids.length) return [];
  return getDb()
    .prepare(
      `SELECT t.id, t.code, t.title, t.status, t.version, t.needs_review, s.project_id, s.archived story_archived, s.check_reason story_check_reason
       FROM test_cases t JOIN user_stories s ON s.id = t.story_id WHERE t.id IN (${ids.map(() => '?').join(',')})`
    )
    .all(...ids);
}

function eligibility(ids) {
  const rows = new Map(loadTests(ids).map((t) => [t.id, t]));
  return ids.map((id) => {
    const tc = rows.get(Number(id));
    return { id: Number(id), code: tc?.code, title: tc?.title, project_id: tc?.project_id, version: tc?.version, reason: ineligibleReason(tc) };
  });
}

const runSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(3, 'Tên đợt tối thiểu 3 ký tự').max(200),
  run_type: z.enum(['NORMAL', 'RETEST', 'REGRESSION']).default('NORMAL'),
  build: z.string().trim().min(1, 'Phải nhập build đang kiểm thử').max(50),
  environment: z.string().trim().min(1, 'Phải nhập môi trường kiểm thử').max(100),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Hạn hoàn thành dạng YYYY-MM-DD').nullable().optional(),
  suite_id: z.coerce.number().int().positive().optional(),
  test_case_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
  assignee_id: z.coerce.number().int().positive().nullable().optional(),
});

// QĐ14: người được giao là QA Lead hoặc Tester
function checkAssignee(userId) {
  if (userId == null) return null;
  const u = getDb().prepare('SELECT id, role, active FROM users WHERE id = ?').get(userId);
  if (!u || !u.active || !['QA_LEAD', 'TESTER'].includes(u.role)) throw badRequest('Người được giao phải là QA Lead hoặc Tester đang hoạt động (QĐ14)');
  return u.id;
}

function suiteTestIds(suiteId, projectId) {
  const s = getDb().prepare('SELECT project_id FROM test_suites WHERE id = ?').get(suiteId);
  if (!s) throw notFound('Không tìm thấy Test Suite');
  if (s.project_id !== projectId) throw badRequest('Test Suite không thuộc dự án của đợt');
  return getDb().prepare('SELECT test_case_id id FROM test_suite_items WHERE suite_id = ?').all(suiteId).map((r) => r.id);
}

// Đưa test vào đợt: test không đủ điều kiện bị bỏ qua và liệt kê kèm lý do; phiên bản test được cố định
function addTestsTx(run, ids, assigneeId) {
  const db = getDb();
  const ins = db.prepare('INSERT OR IGNORE INTO test_run_items (run_id, test_case_id, tc_version, assignee_id) VALUES (?, ?, ?, ?)');
  const added = [];
  const skipped = [];
  for (const e of eligibility([...new Set(ids)])) {
    let reason = e.reason;
    if (!reason && e.project_id !== run.project_id) reason = 'Test không thuộc dự án của đợt';
    if (reason) {
      skipped.push({ id: e.id, code: e.code, reason });
      continue;
    }
    if (ins.run(run.id, e.id, e.version, assigneeId).changes) added.push(e.code);
  }
  return { added, skipped };
}

function create(input, userId, extra = {}) {
  const d = runSchema.parse(input);
  if (!getDb().prepare('SELECT 1 FROM projects WHERE id = ?').get(d.project_id)) throw badRequest('Dự án không tồn tại');
  const assignee = checkAssignee(d.assignee_id ?? null);
  const ids = [...d.test_case_ids, ...(d.suite_id ? suiteTestIds(d.suite_id, d.project_id) : [])];
  if (!ids.length) throw badRequest('Chọn Test Suite hoặc ít nhất một test case');
  const db = getDb();
  return db.transaction(() => {
    const id = Number(
      db.prepare(
        `INSERT INTO test_runs (project_id, name, run_type, build, environment, due_date, regression_set_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(d.project_id, d.name, d.run_type, d.build, d.environment, d.due_date || null, extra.regressionSetId || null, userId).lastInsertRowid
    );
    const r = addTestsTx({ id, project_id: d.project_id }, ids, assignee);
    if (!r.added.length) throw conflict(`Không có test nào đủ điều kiện chạy (QĐ14): ${r.skipped.map((s) => `${s.code || s.id} – ${s.reason}`).join('; ')}`);
    return { run: get(id), skipped: r.skipped };
  })();
}

function requireOpen(run) {
  if (run.status !== 'OPEN') throw conflict('Đợt kiểm thử đã đóng (QĐ14)');
}

function getRow(id) {
  const run = getDb().prepare('SELECT * FROM test_runs WHERE id = ?').get(id);
  if (!run) throw notFound('Không tìm thấy Test Run');
  return run;
}

const hasResults = (runId) => Boolean(getDb().prepare('SELECT 1 FROM test_executions WHERE run_id = ? LIMIT 1').get(runId));

function addTests(runId, input) {
  const run = getRow(runId);
  requireOpen(run);
  const d = z.object({
    suite_id: z.coerce.number().int().positive().optional(),
    test_case_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
    assignee_id: z.coerce.number().int().positive().nullable().optional(),
  }).parse(input);
  const ids = [...d.test_case_ids, ...(d.suite_id ? suiteTestIds(d.suite_id, run.project_id) : [])];
  if (!ids.length) throw badRequest('Chọn Test Suite hoặc ít nhất một test case');
  const assignee = checkAssignee(d.assignee_id ?? null);
  const r = getDb().transaction(() => addTestsTx(run, ids, assignee))();
  return { run: get(runId), ...r };
}

// QĐ3 [A2]: chỉ bỏ test khỏi đợt khi test chưa có kết quả trong đợt
function removeItem(runId, itemId) {
  const run = getRow(runId);
  requireOpen(run);
  const item = getDb().prepare('SELECT * FROM test_run_items WHERE id = ? AND run_id = ?').get(itemId, runId);
  if (!item) throw notFound('Test không có trong đợt');
  if (getDb().prepare('SELECT 1 FROM test_executions WHERE item_id = ? LIMIT 1').get(itemId)) {
    throw conflict('Test đã có kết quả trong đợt, không bỏ ra được (QĐ3)');
  }
  getDb().prepare('DELETE FROM test_run_items WHERE id = ?').run(itemId);
  return get(runId);
}

function assign(runId, itemId, assigneeId) {
  const run = getRow(runId);
  requireOpen(run);
  const a = checkAssignee(assigneeId ?? null);
  const r = getDb().prepare('UPDATE test_run_items SET assignee_id = ? WHERE id = ? AND run_id = ?').run(a, itemId, runId);
  if (!r.changes) throw notFound('Test không có trong đợt');
  return get(runId);
}

// QĐ14 [D3]: build và môi trường chỉ sửa được khi đợt chưa có kết quả nào
function update(runId, input) {
  const run = getRow(runId);
  requireOpen(run);
  const d = runSchema.pick({ name: true, build: true, environment: true, due_date: true }).partial().parse(input);
  const changesBuild = (d.build !== undefined && d.build !== run.build) || (d.environment !== undefined && d.environment !== run.environment);
  if (changesBuild && hasResults(runId)) {
    throw conflict('Đợt đã có kết quả nên build và môi trường đã cố định; muốn chạy build hoặc môi trường khác thì lập đợt mới (QĐ14)');
  }
  getDb()
    .prepare('UPDATE test_runs SET name = ?, build = ?, environment = ?, due_date = ? WHERE id = ?')
    .run(d.name ?? run.name, d.build ?? run.build, d.environment ?? run.environment, d.due_date === undefined ? run.due_date : d.due_date, runId);
  return get(runId);
}

const execSchema = z.object({
  result: z.enum(['PASS', 'FAIL', 'BLOCKED']),
  note: z.string().trim().max(2000).optional().default(''),
  defect_code: z.string().trim().max(50).optional().default(''),
  evidence_url: z.string().trim().url('Bằng chứng phải là đường dẫn (QĐ5)').or(z.literal('')).optional().default(''),
});

// YC5 – QĐ5: ghi trong đợt đang mở, theo phiên bản đã cố định; chỉ người được giao hoặc QA Lead;
// Fail/Blocked bắt buộc ghi chú. QĐ18: nếu test đang chờ kiểm thử lại thì lần chạy này gắn với lần Fail gốc.
function record(runId, itemId, input, user, extra = {}) {
  const d = execSchema.parse(input);
  const run = getRow(runId);
  requireOpen(run);
  const db = getDb();
  const item = db.prepare('SELECT * FROM test_run_items WHERE id = ? AND run_id = ?').get(itemId, runId);
  if (!item) throw notFound('Test không có trong đợt');
  if (user.role !== 'QA_LEAD' && item.assignee_id !== user.id) throw forbidden('Chỉ người được giao hoặc QA Lead được ghi kết quả (QĐ5)');
  if (d.result !== 'PASS' && !d.note && extra.run_type !== 'AUTO') throw badRequest('Kết quả Fail/Blocked bắt buộc phải có ghi chú (QĐ5)');

  const warnings = [];
  // [3.1] Lần Fail ở các đợt khác được theo dõi riêng: ưu tiên phiếu báo sửa của lần Fail trong chính đợt này,
  // không có thì lấy phiếu đang chờ gần nhất (VD đợt Kiểm thử lại)
  const waiting = db
    .prepare(
      `SELECT f.*, fe.run_id fail_run_id FROM fix_reports f JOIN test_executions fe ON fe.id = f.execution_id
       WHERE fe.test_case_id = ? AND f.status = 'WAITING' ORDER BY f.id DESC`
    )
    .all(item.test_case_id);
  const fix = waiting.find((f) => f.fail_run_id === runId) || waiting[0];
  if (fix && fix.build !== run.build) warnings.push(`Build của đợt (${run.build}) khác build Developer đã báo sửa (${fix.build}) (QĐ18)`);

  const execId = db.transaction(() => {
    const id = Number(
      db.prepare(
        `INSERT INTO test_executions (run_id, item_id, test_case_id, tc_version, result, note, defect_code, evidence_url, retest_of,
           run_type, log, screenshot, duration_ms, executed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(runId, itemId, item.test_case_id, item.tc_version, d.result, d.note || null, d.defect_code || null, d.evidence_url || null,
        fix?.execution_id ?? null, extra.run_type || 'MANUAL', extra.log || null, extra.screenshot || null, extra.duration_ms ?? null, user.id).lastInsertRowid
    );
    // [3.3]: Pass → Đã đóng; Fail → Mở lại (Developer báo sửa lần nữa trên lần Fail mới); Blocked → vẫn chờ
    if (fix && d.result !== 'BLOCKED') {
      db.prepare('UPDATE fix_reports SET status = ?, last_execution_id = ? WHERE id = ?').run(d.result === 'PASS' ? 'CLOSED' : 'REOPENED', id, fix.id);
    } else if (fix) db.prepare('UPDATE fix_reports SET last_execution_id = ? WHERE id = ?').run(id, fix.id);
    return id;
  })();
  return { execution: db.prepare('SELECT * FROM test_executions WHERE id = ?').get(execId), warnings };
}

// QĐ14 [B4]: được đóng đợt khi còn test chưa chạy nhưng phải xác nhận; test chưa chạy tính là chưa chạy
function close(runId, { confirm } = {}, userId) {
  const run = getRow(runId);
  requireOpen(run);
  const notRun = getDb()
    .prepare('SELECT COUNT(*) n FROM test_run_items i WHERE i.run_id = ? AND NOT EXISTS (SELECT 1 FROM test_executions e WHERE e.item_id = i.id)')
    .get(runId).n;
  if (notRun && !confirm) {
    throw conflict(`Còn ${notRun} test chưa chạy; xác nhận để đóng đợt, các test này được tính là chưa chạy (QĐ14)`, { notRun });
  }
  getDb().prepare("UPDATE test_runs SET status = 'CLOSED', closed_by = ?, closed_at = datetime('now','localtime') WHERE id = ?").run(userId, runId);
  return { run: get(runId), notRun };
}

function progressOf(runId) {
  const rows = getDb()
    .prepare(
      `SELECT i.id, (SELECT e.result FROM test_executions e WHERE e.item_id = i.id ORDER BY e.id DESC LIMIT 1) result
       FROM test_run_items i WHERE i.run_id = ?`
    )
    .all(runId);
  const p = { total: rows.length, executed: 0, PASS: 0, FAIL: 0, BLOCKED: 0 };
  rows.forEach((r) => r.result && ((p.executed += 1), (p[r.result] += 1)));
  p.percent = p.total ? Math.round((p.executed / p.total) * 1000) / 10 : 0;
  return p;
}

function list({ project_id, status } = {}) {
  const where = [];
  const args = [];
  if (project_id) (where.push('r.project_id = ?'), args.push(project_id));
  if (status) (where.push('r.status = ?'), args.push(status));
  return getDb()
    .prepare(
      `SELECT r.*, p.name project_name, u.full_name created_by_name FROM test_runs r JOIN projects p ON p.id = r.project_id
       LEFT JOIN users u ON u.id = r.created_by ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.id DESC`
    )
    .all(...args)
    .map((r) => ({ ...r, progress: progressOf(r.id), locked: hasResults(r.id) }));
}

// Chi tiết đợt: từng test kèm kết quả gần nhất trong đợt và cảnh báo [A6] (không chặn ghi)
function get(id) {
  const run = getDb()
    .prepare(
      `SELECT r.*, p.name project_name, u.full_name created_by_name, cu.full_name closed_by_name FROM test_runs r
       JOIN projects p ON p.id = r.project_id LEFT JOIN users u ON u.id = r.created_by LEFT JOIN users cu ON cu.id = r.closed_by WHERE r.id = ?`
    )
    .get(id);
  if (!run) throw notFound('Không tìm thấy Test Run');
  const items = getDb()
    .prepare(
      `SELECT i.*, t.code, t.title, t.version current_version, t.status tc_status, t.needs_review, t.steps, t.expected_result, t.precondition,
        s.code story_code, s.archived story_archived, s.check_reason story_check_reason, a.full_name assignee_name,
        le.id last_execution_id, le.result last_result, le.note last_note, le.executed_at last_executed_at,
        (SELECT f.build FROM fix_reports f JOIN test_executions fe ON fe.id = f.execution_id
          WHERE fe.test_case_id = i.test_case_id AND f.status = 'WAITING' ORDER BY f.id DESC LIMIT 1) waiting_fix_build
       FROM test_run_items i JOIN test_cases t ON t.id = i.test_case_id JOIN user_stories s ON s.id = t.story_id
       LEFT JOIN users a ON a.id = i.assignee_id
       LEFT JOIN test_executions le ON le.id = (SELECT MAX(e.id) FROM test_executions e WHERE e.item_id = i.id)
       WHERE i.run_id = ? ORDER BY t.code`
    )
    .all(id)
    .map((i) => {
      const warnings = [];
      if (i.current_version > i.tc_version) warnings.push('Test đã có phiên bản mới; đợt vẫn chạy phiên bản đã cố định');
      if (i.needs_review) warnings.push('Requirement đã đổi, test đang Cần xem lại');
      if (i.story_archived) warnings.push('Requirement đã lưu trữ');
      if (i.story_check_reason) warnings.push('Requirement đang Cần kiểm tra');
      if (i.waiting_fix_build && i.waiting_fix_build !== run.build) warnings.push(`Chờ kiểm thử lại trên build ${i.waiting_fix_build}, khác build của đợt`);
      return { ...i, steps: JSON.parse(i.steps), needs_review: Boolean(i.needs_review), warnings };
    });
  return { ...run, items, progress: progressOf(id), locked: hasResults(id) };
}

function executions(runId) {
  getRow(runId);
  return getDb()
    .prepare(
      `SELECT e.*, t.code tc_code, u.full_name executed_by_name FROM test_executions e JOIN test_cases t ON t.id = e.test_case_id
       LEFT JOIN users u ON u.id = e.executed_by WHERE e.run_id = ? ORDER BY e.id DESC`
    )
    .all(runId);
}

module.exports = { create, get, list, addTests, removeItem, assign, update, record, close, executions, eligibility, ineligibleReason };
