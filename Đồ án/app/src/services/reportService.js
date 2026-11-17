// YC6 – BM5, QĐ6: báo cáo kiểm thử, tính ngay khi mở (không lưu sẵn), theo dự án hoặc Test Run.
//  - Kết quả lấy từ lần chạy gần nhất của từng test; chọn Test Run thì lấy lần gần nhất trong đợt
//  - Phạm vi dự án: số test trong phạm vi = test Đã duyệt; chỉ tính lần chạy của phiên bản hiện tại (tiến độ ≤ 100%)
//  - Blocked tính là đã chạy, không tính là Pass. Chỉ tính requirement chưa lưu trữ
//  - Bao phủ story: mẫu số không gồm story Thiếu AC [B1]; bao phủ AC theo AC của phiên bản hiện tại
const { getDb } = require('../db');
const ac = require('../utils/ac');
const { notFound } = require('../utils/errors');

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const RESULTS = ['PASS', 'FAIL', 'BLOCKED'];

function summary({ project_id: projectId = null, run_id: runId = null } = {}) {
  const db = getDb();
  let run = null;
  if (runId) {
    run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(runId);
    if (!run) throw notFound('Không tìm thấy Test Run');
    projectId = run.project_id;
  }
  const pf = projectId ? 'AND s.project_id = @p' : '';
  const a = { p: projectId, r: runId };

  // Requirement và AC trong phạm vi
  const stories = db.prepare(`SELECT s.id, s.code, s.title, s.acceptance_criteria, s.module_id FROM user_stories s WHERE s.archived = 0 ${pf}`).all(a);
  const approved = db
    .prepare(`SELECT t.id, t.story_id, t.version, t.source, t.needs_review FROM test_cases t JOIN user_stories s ON s.id = t.story_id
      WHERE t.status = 'APPROVED' AND s.archived = 0 ${pf}`)
    .all(a);
  const links = db
    .prepare(`SELECT ta.test_case_id, ta.ac_text, t.story_id FROM test_case_acs ta JOIN test_cases t ON t.id = ta.test_case_id
      JOIN user_stories s ON s.id = t.story_id WHERE t.status = 'APPROVED' AND s.archived = 0 ${pf}`)
    .all(a);

  const withAc = stories.filter((s) => ac.parse(s.acceptance_criteria).length);
  const missingAc = stories.filter((s) => !ac.parse(s.acceptance_criteria).length).map(({ id, code, title }) => ({ id, code, title }));
  const coveredIds = new Set(approved.map((t) => t.story_id));
  const covered = withAc.filter((s) => coveredIds.has(s.id));
  const uncovered = withAc.filter((s) => !coveredIds.has(s.id)).map(({ id, code, title }) => ({ id, code, title }));
  let acTotal = 0;
  let acCovered = 0;
  const uncoveredAcs = [];
  for (const s of withAc) {
    for (const text of ac.parse(s.acceptance_criteria)) {
      acTotal += 1;
      if (links.some((l) => l.story_id === s.id && l.ac_text === text)) acCovered += 1;
      else uncoveredAcs.push({ story_id: s.id, code: s.code, ac: text });
    }
  }

  // Lần chạy gần nhất của từng test trong phạm vi
  const latest = runId
    ? db.prepare(
      `SELECT i.test_case_id, (SELECT e.result FROM test_executions e WHERE e.item_id = i.id ORDER BY e.id DESC LIMIT 1) result
       FROM test_run_items i WHERE i.run_id = @r`
    ).all(a)
    : approved.map((t) => ({
      test_case_id: t.id,
      result: db.prepare('SELECT result FROM test_executions WHERE test_case_id = ? AND tc_version = ? ORDER BY id DESC LIMIT 1').get(t.id, t.version)?.result || null,
    }));
  const runs = Object.fromEntries(RESULTS.map((k) => [k, 0]));
  latest.forEach((l) => l.result && (runs[l.result] += 1));
  const executed = runs.PASS + runs.FAIL + runs.BLOCKED;
  const inScope = latest.length;

  // Kết quả theo module
  const resultOf = new Map(latest.map((l) => [l.test_case_id, l.result]));
  const moduleNames = new Map(db.prepare('SELECT id, name FROM modules').all().map((m) => [m.id, m.name]));
  const storyModule = new Map(stories.map((s) => [s.id, moduleNames.get(s.module_id) || '(Chưa phân module)']));
  const tcStory = new Map(db.prepare('SELECT id, story_id FROM test_cases').all().map((t) => [t.id, t.story_id]));
  const modules = new Map();
  for (const l of latest) {
    const name = storyModule.get(tcStory.get(l.test_case_id)) || '(Chưa phân module)';
    const m = modules.get(name) || { module: name, total: 0, pass: 0, fail: 0, blocked: 0, not_run: 0 };
    m.total += 1;
    if (l.result) m[l.result.toLowerCase()] += 1;
    else m.not_run += 1;
    modules.set(name, m);
  }

  // Xu hướng theo ngày (14 ngày có chạy gần nhất)
  const trend = db
    .prepare(
      `SELECT date(e.executed_at) day,
        SUM(CASE WHEN e.result = 'PASS' THEN 1 ELSE 0 END) pass,
        SUM(CASE WHEN e.result = 'FAIL' THEN 1 ELSE 0 END) fail,
        SUM(CASE WHEN e.result = 'BLOCKED' THEN 1 ELSE 0 END) blocked
       FROM test_executions e JOIN test_runs r ON r.id = e.run_id
       WHERE 1=1 ${runId ? 'AND e.run_id = @r' : projectId ? 'AND r.project_id = @p' : ''}
       GROUP BY day ORDER BY day DESC LIMIT 14`
    )
    .all(a)
    .reverse();

  // Thống kê AI (QĐ6): chỉ test nguồn AI; "phải sửa" khi các bước hoặc kết quả mong đợi khác bản AI gốc
  const aiTests = db
    .prepare(`SELECT t.id, t.steps, t.expected_result, t.proposal_id FROM test_cases t JOIN user_stories s ON s.id = t.story_id
      WHERE t.source = 'AI' AND s.archived = 0 ${pf}`)
    .all(a);
  const firstVersion = db.prepare('SELECT snapshot FROM test_case_versions WHERE test_case_id = ? ORDER BY version LIMIT 1');
  const aiEdited = aiTests.filter((t) => {
    const v = firstVersion.get(t.id);
    if (!v) return false;
    const o = JSON.parse(v.snapshot);
    return JSON.stringify(o.steps) !== t.steps || o.expected_result !== t.expected_result;
  }).length;
  const manualTotal = db
    .prepare(`SELECT COUNT(*) n FROM test_cases t JOIN user_stories s ON s.id = t.story_id WHERE t.source = 'MANUAL' AND s.archived = 0 ${pf}`)
    .get(a).n;
  const aiCalls = db
    .prepare(
      `SELECT COUNT(*) calls, SUM(CASE WHEN l.status = 'SUCCESS' THEN 1 ELSE 0 END) ok, ROUND(AVG(l.duration_ms)) avg_ms, SUM(l.injection_flag) injections
       FROM ai_logs l ${projectId ? 'JOIN user_stories s ON s.id = l.story_id WHERE 1=1 ' + pf : ''}`
    )
    .get(a);
  const proposals = Object.fromEntries(['PENDING', 'ACCEPTED', 'REJECTED', 'OUTDATED'].map((k) => [k, 0]));
  db.prepare(`SELECT p.status, COUNT(*) n FROM ai_proposals p JOIN user_stories s ON s.id = p.story_id WHERE 1=1 ${pf} GROUP BY p.status`)
    .all(a)
    .forEach((r) => (proposals[r.status] = r.n));

  const byStatus = Object.fromEntries(
    db.prepare(`SELECT t.status, COUNT(*) n FROM test_cases t JOIN user_stories s ON s.id = t.story_id WHERE s.archived = 0 ${pf} GROUP BY t.status`)
      .all(a)
      .map((r) => [r.status, r.n])
  );
  const needsReview = db
    .prepare(`SELECT COUNT(*) n FROM test_cases t JOIN user_stories s ON s.id = t.story_id WHERE t.needs_review = 1 AND s.archived = 0 ${pf}`)
    .get(a).n;
  const needsRetest = db
    .prepare(
      `SELECT COUNT(DISTINCT e.test_case_id) n FROM fix_reports f JOIN test_executions e ON e.id = f.execution_id
       JOIN test_cases t ON t.id = e.test_case_id JOIN user_stories s ON s.id = t.story_id WHERE f.status = 'WAITING' ${pf}`
    )
    .get(a).n;

  return {
    scope: run ? { type: 'RUN', run: { id: run.id, name: run.name, build: run.build, environment: run.environment, status: run.status } } : { type: 'PROJECT', project_id: projectId },
    stories: stories.length,
    testCases: byStatus,
    approved: approved.length,
    inScope,
    runs,
    executed,
    notRun: inScope - executed,
    passRate: pct(runs.PASS, executed),
    executionProgress: pct(executed, inScope),
    coverage: pct(covered.length, withAc.length),
    covered: covered.length,
    storiesWithAc: withAc.length,
    acCoverage: pct(acCovered, acTotal),
    acCovered,
    acTotal,
    uncovered,
    uncoveredAcs,
    missingAc,
    needsReview,
    needsRetest,
    proposals,
    byModule: [...modules.values()].sort((x, y) => x.module.localeCompare(y.module)),
    trend,
    ai: { ai_total: aiTests.length, manual_total: manualTotal, ai_edited: aiEdited, ai_edit_rate: pct(aiEdited, aiTests.length), ...aiCalls },
  };
}

module.exports = { summary };
