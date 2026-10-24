// YC12: Quản lý sprint (Agile/Scrum) – lập sprint, velocity, burndown.
// Định nghĩa "Hoàn thành" (Definition of Done) của một user story, tính tự động:
//   có ít nhất 1 test case Đã duyệt VÀ mọi test case Đã duyệt đều có lần chạy gần nhất là PASS.
const { z } = require('zod');
const { getDb } = require('../db');
const params = require('./parameterService');
const { badRequest, notFound, conflict } = require('../utils/errors');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const sprintSchema = z.object({
  name: z.string().trim().min(2, 'Tên sprint tối thiểu 2 ký tự').max(50),
  goal: z.string().trim().max(500).optional().default(''),
  start_date: z.string().regex(DATE, 'Ngày bắt đầu dạng YYYY-MM-DD'),
  end_date: z.string().regex(DATE, 'Ngày kết thúc dạng YYYY-MM-DD'),
});

const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;

// QĐ12: độ dài sprint từ 1 ngày đến SPRINT_MAX_DAYS; các sprint cùng dự án không chồng lấn thời gian
function validate(projectId, d, exceptId = 0) {
  if (d.end_date < d.start_date) throw badRequest('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
  const max = params.get('SPRINT_MAX_DAYS');
  if (days(d.start_date, d.end_date) > max) throw badRequest(`Sprint dài tối đa ${max} ngày (QĐ12)`);
  const overlap = getDb()
    .prepare('SELECT name FROM sprints WHERE project_id = ? AND id != ? AND start_date <= ? AND end_date >= ?')
    .get(projectId, exceptId, d.end_date, d.start_date);
  if (overlap) throw conflict(`Trùng thời gian với ${overlap.name} (QĐ12)`);
}

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
       WHERE ${where} GROUP BY s.id ORDER BY s.code`
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

function create(projectId, input) {
  const d = sprintSchema.parse(input);
  if (!getDb().prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId)) throw notFound('Dự án không tồn tại');
  validate(projectId, d);
  const info = getDb()
    .prepare('INSERT INTO sprints (project_id, name, goal, start_date, end_date) VALUES (?, ?, ?, ?, ?)')
    .run(projectId, d.name, d.goal, d.start_date, d.end_date);
  return withStats(get(info.lastInsertRowid));
}

function update(id, input) {
  const sp = get(id);
  const d = sprintSchema.parse({ ...sp, ...input });
  validate(sp.project_id, d, id);
  getDb()
    .prepare('UPDATE sprints SET name = ?, goal = ?, start_date = ?, end_date = ? WHERE id = ?')
    .run(d.name, d.goal, d.start_date, d.end_date, id);
  return withStats(get(id));
}

function remove(id) {
  get(id);
  getDb().prepare('DELETE FROM sprints WHERE id = ?').run(id); // story giữ lại, sprint_id = NULL
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

module.exports = { list, get, create, update, remove, burndown, storyProgress, withStats };
