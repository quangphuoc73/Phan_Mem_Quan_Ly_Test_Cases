// YC14: Theo dõi sprint (Agile/Scrum). Sprint được lập trên Jira và đồng bộ về (jiraService);
// hệ thống chỉ tính trạng thái DoD của story, velocity và burndown.
// Định nghĩa "Hoàn thành" (Definition of Done) của một user story, tính tự động:
//   có ít nhất 1 test case Đã duyệt VÀ mọi test case Đã duyệt đều có lần chạy gần nhất là PASS.
const { getDb } = require('../db');
const { notFound } = require('../utils/errors');

const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;

// Ngày hoàn thành của từng story (null nếu chưa đạt DoD)
function storyProgress(where, args) {
  const rows = getDb()
    .prepare(
      `SELECT s.id, s.code, s.title, s.priority, s.story_points, s.sprint_id,
        (SELECT COUNT(*) FROM test_cases x WHERE x.story_id = s.id) tc_total,
        COUNT(t.id) approved,
        SUM(CASE WHEN lr.result = 'PASS' THEN 1 ELSE 0 END) passed,
        MAX(lr.executed_at) last_run
       FROM user_stories s
       LEFT JOIN test_cases t ON t.story_id = s.id AND t.status = 'APPROVED'
       LEFT JOIN (SELECT r.test_case_id, r.result, r.executed_at FROM test_runs r
         JOIN (SELECT test_case_id, MAX(id) mid FROM test_runs GROUP BY test_case_id) l ON l.mid = r.id) lr
         ON lr.test_case_id = t.id
       WHERE ${where} AND s.archived = 0 GROUP BY s.id ORDER BY s.code`
    )
    .all(...args);
  return rows.map((r) => {
    const done = r.approved > 0 && r.passed === r.approved;
    // Cột trên bảng sprint: TODO → IN_REVIEW → TESTING → DONE
    const stage = done ? 'DONE' : r.approved > 0 && r.approved === r.tc_total ? 'TESTING' : r.tc_total > 0 ? 'IN_REVIEW' : 'TODO';
    return { ...r, points: r.story_points || 0, done, stage, done_date: done ? r.last_run.slice(0, 10) : null };
  });
}

function withStats(sp) {
  const stories = storyProgress('s.sprint_id = ?', [sp.id]);
  const committed = stories.reduce((a, s) => a + s.points, 0);
  const completed = stories.filter((s) => s.done).reduce((a, s) => a + s.points, 0);
  return {
    ...sp,
    days: days(sp.start_date, sp.end_date),
    story_count: stories.length,
    done_count: stories.filter((s) => s.done).length,
    committed_points: committed,
    completed_points: completed, // = velocity của sprint
  };
}

function list(projectId) {
  const rows = getDb()
    .prepare(`SELECT * FROM sprints ${projectId ? 'WHERE project_id = ?' : ''} ORDER BY project_id, start_date`)
    .all(...(projectId ? [projectId] : []));
  return rows.map(withStats);
}

function get(id) {
  const sp = getDb().prepare('SELECT * FROM sprints WHERE id = ?').get(id);
  if (!sp) throw notFound('Không tìm thấy sprint');
  return sp;
}

// Burndown: số story point còn lại theo từng ngày của sprint, kèm đường lý tưởng
function burndown(id) {
  const sp = withStats(get(id));
  const stories = storyProgress('s.sprint_id = ?', [id]);
  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD theo giờ máy
  const total = sp.committed_points;
  const points = [];
  for (let i = 0; i < sp.days; i++) {
    const day = new Date(new Date(sp.start_date).getTime() + i * 86400000).toISOString().slice(0, 10);
    const doneByDay = stories.filter((s) => s.done && s.done_date <= day).reduce((a, s) => a + s.points, 0);
    points.push({
      day,
      ideal: Math.round((total - (total * i) / Math.max(sp.days - 1, 1)) * 10) / 10,
      remaining: day <= today ? total - doneByDay : null,
    });
  }
  return { sprint: sp, stories, points };
}

module.exports = { list, get, burndown, storyProgress, withStats };
