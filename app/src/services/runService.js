// YC5: Ghi nhận kết quả chạy test (BM4).
const { z } = require('zod');
const { getDb } = require('../db');
const testCases = require('./testCaseService');
const { badRequest, conflict } = require('../utils/errors');

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

function list({ project_id, limit = 100 } = {}) {
  return getDb()
    .prepare(
      `SELECT r.*, t.code tc_code, t.title tc_title, s.code story_code, u.full_name executed_by_name
       FROM test_runs r JOIN test_cases t ON t.id = r.test_case_id JOIN user_stories s ON s.id = t.story_id
       LEFT JOIN users u ON u.id = r.executed_by
       ${project_id ? 'WHERE s.project_id = ?' : ''}
       ORDER BY r.id DESC LIMIT ?`
    )
    .all(...(project_id ? [project_id, limit] : [limit]));
}

module.exports = { record, list };
