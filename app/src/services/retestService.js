// YC18 – BM17, QĐ18: Developer báo đã sửa lỗi, Tester kiểm thử lại.
//  - Chỉ báo cho lần chạy Fail gần nhất của test trong cùng Test Run; mỗi lần chạy chỉ báo một lần; bắt buộc build (1–50 ký tự)
//  - Chạy lại ngay trong đợt chứa lần Fail chỉ khi đợt còn mở và build trùng build đã báo; ngược lại QA Lead lập
//    đợt Kiểm thử lại với build đã sửa [R1]. Kết quả chạy lại cập nhật trạng thái ở runService.record [3.3]
const { z } = require('zod');
const { getDb } = require('../db');
const runs = require('./runService');
const { badRequest, conflict, notFound } = require('../utils/errors');

const fixSchema = z.object({
  build: z.string().trim().min(1, 'Phải nhập bản build đã sửa lỗi (QĐ18)').max(50, 'Build tối đa 50 ký tự (QĐ18)'),
  note: z.string().trim().max(2000).optional().default(''),
});

function reportFix(executionId, input, userId) {
  const d = fixSchema.parse(input);
  const db = getDb();
  const e = db.prepare('SELECT * FROM test_executions WHERE id = ?').get(executionId);
  if (!e) throw notFound('Không tìm thấy lần chạy');
  if (e.result !== 'FAIL') throw conflict('Chỉ báo đã sửa cho lần chạy có kết quả Fail (QĐ18)');
  const latest = db.prepare('SELECT MAX(id) id FROM test_executions WHERE run_id = ? AND test_case_id = ?').get(e.run_id, e.test_case_id).id;
  if (latest !== e.id) throw conflict('Test đã được chạy lại trong đợt sau lần Fail này, chỉ báo cho lần Fail gần nhất (QĐ18)');
  if (db.prepare('SELECT 1 FROM fix_reports WHERE execution_id = ?').get(e.id)) throw conflict('Lần chạy này đã được báo sửa (QĐ18)');
  const id = db.prepare('INSERT INTO fix_reports (execution_id, build, note, reported_by) VALUES (?, ?, ?, ?)').run(e.id, d.build, d.note || null, userId).lastInsertRowid;
  return get(Number(id));
}

function get(id) {
  const f = getDb()
    .prepare(
      `SELECT f.*, u.full_name reported_by_name, e.run_id, e.test_case_id, e.note fail_note, e.defect_code, e.executed_at fail_at,
        r.name run_name, r.status run_status, r.build run_build, r.project_id, t.code tc_code, t.title tc_title
       FROM fix_reports f JOIN test_executions e ON e.id = f.execution_id JOIN test_runs r ON r.id = e.run_id
       JOIN test_cases t ON t.id = e.test_case_id LEFT JOIN users u ON u.id = f.reported_by WHERE f.id = ?`
    )
    .get(id);
  if (!f) throw notFound('Không tìm thấy phiếu báo sửa lỗi');
  // [R1] chạy lại ngay trong đợt cũ chỉ khi đợt còn mở và trùng build đã sửa
  return { ...f, retest_in_same_run: f.run_status === 'OPEN' && f.run_build === f.build };
}

// Màn hình Kiểm thử lại: lần Fail chưa báo sửa (cho Developer) và phiếu đang chờ / đã xử lý
function overview({ project_id } = {}) {
  const db = getDb();
  const pf = project_id ? 'AND r.project_id = ?' : '';
  const args = project_id ? [project_id] : [];
  const fails = db
    .prepare(
      `SELECT e.id execution_id, e.note, e.defect_code, e.executed_at, e.tc_version, r.id run_id, r.name run_name, r.build run_build, r.status run_status,
        t.id test_case_id, t.code tc_code, t.title tc_title, u.full_name executed_by_name
       FROM test_executions e JOIN test_runs r ON r.id = e.run_id JOIN test_cases t ON t.id = e.test_case_id LEFT JOIN users u ON u.id = e.executed_by
       WHERE e.result = 'FAIL' ${pf}
         AND e.id = (SELECT MAX(x.id) FROM test_executions x WHERE x.run_id = e.run_id AND x.test_case_id = e.test_case_id)
         AND NOT EXISTS (SELECT 1 FROM fix_reports f WHERE f.execution_id = e.id)
       ORDER BY e.id DESC`
    )
    .all(...args);
  const reports = db
    .prepare(
      `SELECT f.id FROM fix_reports f JOIN test_executions e ON e.id = f.execution_id JOIN test_runs r ON r.id = e.run_id
       WHERE 1=1 ${pf} ORDER BY CASE f.status WHEN 'WAITING' THEN 0 ELSE 1 END, f.id DESC LIMIT 200`
    )
    .all(...args)
    .map((r) => get(r.id));
  return { fails, waiting: reports.filter((r) => r.status === 'WAITING'), done: reports.filter((r) => r.status !== 'WAITING') };
}

// QĐ14, QĐ18: QA Lead lập đợt Kiểm thử lại từ danh sách test đang chờ kiểm thử lại
const retestRunSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(3).max(200).optional(),
  build: z.string().trim().min(1).max(50).optional(),
  environment: z.string().trim().min(1, 'Phải nhập môi trường kiểm thử').max(100),
  fix_ids: z.array(z.coerce.number().int().positive()).optional(),
  assignee_id: z.coerce.number().int().positive().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

function createRetestRun(input, userId) {
  const d = retestRunSchema.parse(input);
  const waiting = overview({ project_id: d.project_id }).waiting.filter((f) => !d.fix_ids || d.fix_ids.includes(f.id));
  if (!waiting.length) throw badRequest('Không có test nào đang chờ kiểm thử lại');
  const builds = [...new Set(waiting.map((f) => f.build))];
  const build = d.build || (builds.length === 1 ? builds[0] : null);
  if (!build) throw badRequest(`Các phiếu báo sửa ở nhiều build khác nhau (${builds.join(', ')}); chọn phiếu cùng build hoặc nhập build của đợt`);
  return runs.create(
    {
      project_id: d.project_id,
      name: d.name || `Kiểm thử lại – build ${build}`,
      run_type: 'RETEST',
      build,
      environment: d.environment,
      due_date: d.due_date || null,
      test_case_ids: [...new Set(waiting.map((f) => f.test_case_id))],
      assignee_id: d.assignee_id ?? null,
    },
    userId
  );
}

module.exports = { reportFix, get, overview, createRetestRun };
