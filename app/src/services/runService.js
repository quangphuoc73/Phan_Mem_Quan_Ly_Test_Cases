// YC5: Ghi nhận kết quả chạy test (BM4).
const { z } = require('zod');
const { getDb } = require('../db');
const testCases = require('./testCaseService');
const { badRequest, conflict, notFound } = require('../utils/errors');

const runSchema = z.object({
  result: z.enum(['PASS', 'FAIL', 'BLOCKED']),
  note: z.string().trim().max(2000).optional().default(''),
});

// QĐ5: chỉ test case đã duyệt mới được chạy; Fail/Blocked bắt buộc ghi chú
function record(testCaseId, input, userId, extra = {}) {
  const d = runSchema.parse(input);
  const tc = testCases.get(testCaseId);
  if (tc.status !== 'APPROVED') throw conflict('Chỉ ghi kết quả cho test case đã được duyệt (QĐ5)');
  if (d.result !== 'PASS' && !d.note && extra.run_type !== 'AUTO') {
    throw badRequest('Kết quả Fail/Blocked bắt buộc phải có ghi chú (QĐ5)');
  }
  const info = getDb()
    .prepare(
      `INSERT INTO test_runs (test_case_id, result, run_type, note, log, screenshot, duration_ms, executed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(testCaseId, d.result, extra.run_type || 'MANUAL', d.note || null, extra.log || null,
      extra.screenshot || null, extra.duration_ms ?? null, userId);
  return getDb().prepare('SELECT * FROM test_runs WHERE id = ?').get(info.lastInsertRowid);
}

const fixSchema = z.object({
  build: z.string().trim().min(1, 'Phải nhập bản build đã sửa lỗi (QĐ13)').max(50),
  note: z.string().trim().max(2000).optional().default(''),
});

// YC13 – QĐ13: chỉ báo đã sửa cho lần chạy Fail gần nhất của test case, mỗi lần chạy báo một lần
function reportFix(runId, input, userId) {
  const d = fixSchema.parse(input);
  const db = getDb();
  const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(runId);
  if (!run) throw notFound('Không tìm thấy lần chạy');
  if (run.result !== 'FAIL') throw conflict('Chỉ báo đã sửa cho lần chạy có kết quả Fail (QĐ13)');
  const latest = db.prepare('SELECT MAX(id) id FROM test_runs WHERE test_case_id = ?').get(run.test_case_id).id;
  if (latest !== run.id) throw conflict('Test case đã được chạy lại sau lần Fail này (QĐ13)');
  if (run.fixed_at) throw conflict('Lần chạy này đã được báo sửa (QĐ13)');
  db.prepare(`UPDATE test_runs SET fix_build = ?, fix_note = ?, fixed_by = ?, fixed_at = datetime('now','localtime') WHERE id = ?`)
    .run(d.build, d.note || null, userId, run.id);
  return db.prepare('SELECT * FROM test_runs WHERE id = ?').get(run.id);
}

function list({ project_id, limit = 100 } = {}) {
  return getDb()
    .prepare(
      `SELECT r.*, t.code tc_code, t.title tc_title, s.code story_code, u.full_name executed_by_name, fu.full_name fixed_by_name,
        r.id = (SELECT MAX(id) FROM test_runs x WHERE x.test_case_id = r.test_case_id) is_latest
       FROM test_runs r JOIN test_cases t ON t.id = r.test_case_id JOIN user_stories s ON s.id = t.story_id
       LEFT JOIN users u ON u.id = r.executed_by LEFT JOIN users fu ON fu.id = r.fixed_by
       ${project_id ? 'WHERE s.project_id = ?' : ''}
       ORDER BY r.id DESC LIMIT ?`
    )
    .all(...(project_id ? [project_id, limit] : [limit]));
}

module.exports = { record, reportFix, list };
