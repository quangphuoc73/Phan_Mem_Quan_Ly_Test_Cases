// YC1: User story (BM1). Story chỉ được tạo, sửa trên Jira rồi đồng bộ về (jiraService);
// trong hệ thống story là CHỈ ĐỌC. Hàm create chỉ dùng cho dữ liệu mẫu và kiểm thử.
const { z } = require('zod');
const { getDb } = require('../db');
const params = require('./parameterService');
const { parseCriteria } = require('./ai/providers/MockProvider');
const { badRequest, notFound, conflict } = require('../utils/errors');

// QĐ1: mã user story là mã issue Jira (VD SHOP-5); dữ liệu mẫu dùng dạng US-XXX. Không trùng
const STORY_POINTS = [1, 2, 3, 5, 8, 13];
const CODE_REGEX = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/;

const storySchema = z.object({
  code: z.string().trim().toUpperCase().regex(CODE_REGEX, 'Mã phải có dạng KEY-số (chữ in hoa, số, dấu -)'),
  project_id: z.coerce.number().int().positive(),
  module_id: z.coerce.number().int().positive().nullable().optional(),
  sprint_id: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(200),
  description: z.string().trim().min(10, 'Mô tả tối thiểu 10 ký tự').max(3000),
  acceptance_criteria: z.string().trim().min(3).max(5000),
  priority: z.string().trim().default('Medium'),
  // Story point theo dãy Fibonacci (QĐ14)
  story_points: z.coerce.number().int().refine((n) => STORY_POINTS.includes(n), 'Story point phải thuộc 1, 2, 3, 5, 8, 13')
    .nullable().optional(),
});

function validate(input) {
  const data = storySchema.parse(input);
  const allowed = params.get('PRIORITIES').split(',');
  if (!allowed.includes(data.priority)) throw badRequest(`Độ ưu tiên phải thuộc: ${allowed.join(', ')}`);
  const minAc = params.get('MIN_AC_PER_STORY');
  if (parseCriteria(data.acceptance_criteria).length < minAc) {
    throw badRequest(`User story phải có ít nhất ${minAc} acceptance criteria (mỗi dòng 1 tiêu chí)`);
  }
  const project = getDb().prepare('SELECT id FROM projects WHERE id = ?').get(data.project_id);
  if (!project) throw badRequest('Dự án không tồn tại');
  if (data.module_id) {
    const m = getDb().prepare('SELECT id FROM modules WHERE id = ? AND project_id = ?').get(data.module_id, data.project_id);
    if (!m) throw badRequest('Module không thuộc dự án đã chọn');
  }
  if (data.sprint_id) {
    const sp = getDb().prepare('SELECT id FROM sprints WHERE id = ? AND project_id = ?').get(data.sprint_id, data.project_id);
    if (!sp) throw badRequest('Sprint không thuộc dự án đã chọn');
  }
  return data;
}

function list({ project_id, module_id, sprint_id, backlog, archived, q } = {}) {
  const where = [];
  const args = [];
  if (project_id) (where.push('s.project_id = ?'), args.push(project_id));
  if (module_id) (where.push('s.module_id = ?'), args.push(module_id));
  if (sprint_id) (where.push('s.sprint_id = ?'), args.push(sprint_id));
  if (backlog) where.push('s.sprint_id IS NULL'); // Product backlog: story chưa đưa vào sprint nào
  if (!archived) where.push('s.archived = 0'); // story đã xóa trên Jira chỉ hiện khi xem lưu trữ
  if (q) (where.push('(s.code LIKE ? OR s.title LIKE ?)'), args.push(`%${q}%`, `%${q}%`));
  return getDb()
    .prepare(
      `SELECT s.*, p.name project_name, m.name module_name, sp.name sprint_name, u.full_name created_by_name,
        (SELECT COUNT(*) FROM test_cases t WHERE t.story_id = s.id) tc_count,
        (SELECT COUNT(*) FROM test_cases t WHERE t.story_id = s.id AND t.status = 'APPROVED') tc_approved
       FROM user_stories s
       JOIN projects p ON p.id = s.project_id
       LEFT JOIN modules m ON m.id = s.module_id
       LEFT JOIN sprints sp ON sp.id = s.sprint_id
       LEFT JOIN users u ON u.id = s.created_by
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY s.id DESC`
    )
    .all(...args);
}

function get(id) {
  const s = getDb()
    .prepare(
      `SELECT s.*, p.name project_name, p.base_url, p.jira_key project_jira_key, m.name module_name, sp.name sprint_name FROM user_stories s
       JOIN projects p ON p.id = s.project_id LEFT JOIN modules m ON m.id = s.module_id
       LEFT JOIN sprints sp ON sp.id = s.sprint_id WHERE s.id = ?`
    )
    .get(id);
  if (!s) throw notFound('Không tìm thấy user story');
  return s;
}

function create(input, userId) {
  const d = validate(input);
  const exists = getDb().prepare('SELECT 1 FROM user_stories WHERE code = ?').get(d.code);
  if (exists) throw conflict(`Mã user story ${d.code} đã tồn tại (QĐ1)`);
  const info = getDb()
    .prepare(
      `INSERT INTO user_stories (code, project_id, module_id, sprint_id, title, description, acceptance_criteria, priority, story_points, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(d.code, d.project_id, d.module_id || null, d.sprint_id || null, d.title, d.description, d.acceptance_criteria, d.priority, d.story_points ?? null, userId);
  return get(info.lastInsertRowid);
}

// YC8: Tester đã xem lại test case sau khi story đổi trên Jira → bỏ đánh dấu
function markReviewed(id) {
  const s = get(id);
  if (!s.changed_at) throw conflict('User story không có thay đổi nào cần xem lại');
  getDb().prepare('UPDATE user_stories SET changed_at = NULL WHERE id = ?').run(id);
  return get(id);
}

// QĐ1: chỉ sinh test case cho story còn trên Jira và có đủ acceptance criteria
function assertReady(story) {
  if (story.archived) throw conflict('User story đã bị xóa trên Jira, chỉ còn để xem');
  const minAc = params.get('MIN_AC_PER_STORY');
  if (parseCriteria(story.acceptance_criteria).length < minAc) {
    throw badRequest(`User story chưa có đủ ${minAc} acceptance criteria – bổ sung mục "Acceptance criteria" trong Description trên Jira (QĐ1)`);
  }
}

module.exports = { list, get, create, markReviewed, assertReady, CODE_REGEX, STORY_POINTS };
