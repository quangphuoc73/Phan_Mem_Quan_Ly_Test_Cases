// YC6: Lập báo cáo – tỷ lệ pass, độ bao phủ yêu cầu, thống kê AI; lọc theo dự án và sprint.
const { getDb } = require('../db');
const sprints = require('./sprintService');

function summary(projectId, sprintId) {
  const db = getDb();
  const pf = `${projectId ? 'AND s.project_id = @p' : ''} ${sprintId ? 'AND s.sprint_id = @sp' : ''}`;
  const a = { p: projectId, sp: sprintId };

  const stories = db.prepare(`SELECT COUNT(*) n FROM user_stories s WHERE 1=1 ${pf}`).get(a).n;
  const byStatus = db
    .prepare(`SELECT t.status, COUNT(*) n FROM test_cases t JOIN user_stories s ON s.id = t.story_id WHERE 1=1 ${pf} GROUP BY t.status`)
    .all(a);

  // Kết quả LẦN CHẠY GẦN NHẤT của mỗi test case
  const latest = db
    .prepare(
      `SELECT r.result, COUNT(*) n FROM test_runs r
       JOIN (SELECT test_case_id, MAX(id) mid FROM test_runs GROUP BY test_case_id) l ON l.mid = r.id
       JOIN test_cases t ON t.id = r.test_case_id JOIN user_stories s ON s.id = t.story_id
       WHERE 1=1 ${pf} GROUP BY r.result`
    )
    .all(a);
  const runCount = Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map((k) => [k, 0]));
  latest.forEach((r) => (runCount[r.result] = r.n));
  const executed = runCount.PASS + runCount.FAIL + runCount.BLOCKED;

  const approved = db
    .prepare(`SELECT COUNT(*) n FROM test_cases t JOIN user_stories s ON s.id = t.story_id WHERE t.status = 'APPROVED' ${pf}`)
    .get(a).n;
  const covered = db
    .prepare(
      `SELECT COUNT(*) n FROM user_stories s WHERE EXISTS
       (SELECT 1 FROM test_cases t WHERE t.story_id = s.id AND t.status = 'APPROVED') ${pf}`
    )
    .get(a).n;
  const uncovered = db
    .prepare(
      `SELECT s.id, s.code, s.title FROM user_stories s WHERE NOT EXISTS
       (SELECT 1 FROM test_cases t WHERE t.story_id = s.id AND t.status = 'APPROVED') ${pf} ORDER BY s.code`
    )
    .all(a);

  const byModule = db
    .prepare(
      `SELECT COALESCE(m.name, '(Chưa phân module)') module,
        COUNT(DISTINCT t.id) total,
        SUM(CASE WHEN lr.result = 'PASS' THEN 1 ELSE 0 END) pass,
        SUM(CASE WHEN lr.result = 'FAIL' THEN 1 ELSE 0 END) fail,
        SUM(CASE WHEN lr.result = 'BLOCKED' THEN 1 ELSE 0 END) blocked
       FROM test_cases t JOIN user_stories s ON s.id = t.story_id LEFT JOIN modules m ON m.id = s.module_id
       LEFT JOIN (SELECT r.test_case_id, r.result FROM test_runs r
         JOIN (SELECT test_case_id, MAX(id) mid FROM test_runs GROUP BY test_case_id) l ON l.mid = r.id) lr
         ON lr.test_case_id = t.id
       WHERE 1=1 ${pf} GROUP BY m.name ORDER BY module`
    )
    .all(a);

  const aiStats = db
    .prepare(
      `SELECT
        SUM(CASE WHEN t.source = 'AI' THEN 1 ELSE 0 END) ai_total,
        SUM(CASE WHEN t.source = 'MANUAL' THEN 1 ELSE 0 END) manual_total,
        SUM(CASE WHEN t.source = 'AI' AND t.version > 1 THEN 1 ELSE 0 END) ai_edited
       FROM test_cases t JOIN user_stories s ON s.id = t.story_id WHERE 1=1 ${pf}`
    )
    .get(a);
  const aiCalls = db
    .prepare(
      `SELECT COUNT(*) calls, SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) ok,
        ROUND(AVG(duration_ms)) avg_ms, SUM(injection_flag) injections
       FROM ai_logs l ${projectId || sprintId ? `JOIN user_stories s ON s.id = l.story_id WHERE 1=1 ${pf}` : ''}`
    )
    .get(a);

  const trend = db
    .prepare(
      `SELECT date(r.executed_at) day,
        SUM(CASE WHEN r.result = 'PASS' THEN 1 ELSE 0 END) pass,
        SUM(CASE WHEN r.result = 'FAIL' THEN 1 ELSE 0 END) fail,
        SUM(CASE WHEN r.result = 'BLOCKED' THEN 1 ELSE 0 END) blocked
       FROM test_runs r JOIN test_cases t ON t.id = r.test_case_id JOIN user_stories s ON s.id = t.story_id
       WHERE 1=1 ${pf} GROUP BY day ORDER BY day DESC LIMIT 14`
    )
    .all(a)
    .reverse();

  // Agile: velocity (story point hoàn thành) của từng sprint trong dự án
  const sprintStats = projectId ? sprints.list(projectId) : [];
  const current = sprintId ? sprints.withStats(sprints.get(sprintId)) : null;

  return {
    stories,
    testCases: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    approved,
    runs: runCount,
    executed,
    passRate: executed ? Math.round((runCount.PASS / executed) * 1000) / 10 : 0,
    executionProgress: approved ? Math.round((executed / approved) * 1000) / 10 : 0,
    coverage: stories ? Math.round((covered / stories) * 1000) / 10 : 0,
    covered,
    uncovered,
    byModule,
    ai: { ...aiStats, ...aiCalls },
    trend,
    sprints: sprintStats,
    sprint: current,
  };
}

module.exports = { summary };
