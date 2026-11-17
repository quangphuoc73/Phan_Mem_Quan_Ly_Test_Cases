// YC1 – BM1, QĐ1: requirement đồng bộ từ Jira, trong hệ thống CHỈ ĐỌC.
// YC8 – QĐ8: tạo phiên bản khi nội dung đổi, gắn cờ test Cần xem lại, xử lý requirement Cần kiểm tra.
const { z } = require('zod');
const { getDb } = require('../db');
const params = require('./parameterService');
const ac = require('../utils/ac');
const { badRequest, notFound, conflict } = require('../utils/errors');

// Trạng thái đồng bộ hiển thị (BM1), suy ra từ dữ liệu, không lưu riêng
function syncState(s) {
  if (s.archived) return 'ARCHIVED';
  if (s.check_reason) return 'NEEDS_CHECK';
  if (!ac.parse(s.acceptance_criteria).length) return 'MISSING_AC';
  return 'NORMAL';
}

const STATE_SQL = {
  ARCHIVED: 's.archived = 1',
  NEEDS_CHECK: 's.archived = 0 AND s.check_reason IS NOT NULL',
  MISSING_AC: "s.archived = 0 AND s.check_reason IS NULL AND trim(s.acceptance_criteria) = ''",
  NORMAL: "s.archived = 0 AND s.check_reason IS NULL AND trim(s.acceptance_criteria) <> ''",
};

function decorate(s) {
  return s && { ...s, sync_state: syncState(s), acs: ac.parse(s.acceptance_criteria) };
}

function list({ project_id, module_id, sprint_id, backlog, state, q } = {}) {
  const where = [];
  const args = [];
  if (project_id) (where.push('s.project_id = ?'), args.push(project_id));
  if (module_id) (where.push('s.module_id = ?'), args.push(module_id));
  if (sprint_id) (where.push('s.sprint_id = ?'), args.push(sprint_id)); // YC20 (ngoài MVP)
  if (backlog) where.push('s.sprint_id IS NULL'); // YC20 (ngoài MVP): Product backlog
  if (state === 'ALL') {
    // mọi trạng thái
  } else if (STATE_SQL[state]) where.push(STATE_SQL[state]);
  else where.push('s.archived = 0'); // QĐ8: requirement lưu trữ ẩn khỏi danh sách
  if (q) (where.push('(s.code LIKE ? OR s.title LIKE ?)'), args.push(`%${q}%`, `%${q}%`));
  return getDb()
    .prepare(
      `SELECT s.*, p.name project_name, m.name module_name, ku.full_name check_kept_by_name,
        (SELECT COUNT(*) FROM test_cases t WHERE t.story_id = s.id) tc_count,
        (SELECT COUNT(*) FROM test_cases t WHERE t.story_id = s.id AND t.status = 'APPROVED') tc_approved,
        (SELECT COUNT(*) FROM test_cases t WHERE t.story_id = s.id AND t.needs_review = 1) tc_needs_review,
        (SELECT COUNT(*) FROM ai_proposals a WHERE a.story_id = s.id AND a.status = 'PENDING') proposals_pending
       FROM user_stories s
       JOIN projects p ON p.id = s.project_id
       LEFT JOIN modules m ON m.id = s.module_id
       LEFT JOIN users ku ON ku.id = s.check_kept_by
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY s.id DESC`
    )
    .all(...args)
    .map(decorate);
}

function get(id) {
  const s = getDb()
    .prepare(
      `SELECT s.*, p.name project_name, p.base_url, p.jira_key project_jira_key, m.name module_name, ku.full_name check_kept_by_name
       FROM user_stories s JOIN projects p ON p.id = s.project_id LEFT JOIN modules m ON m.id = s.module_id
       LEFT JOIN users ku ON ku.id = s.check_kept_by WHERE s.id = ?`
    )
    .get(id);
  if (!s) throw notFound('Không tìm thấy requirement');
  return decorate(s);
}

// Lịch sử phiên bản (QĐ1): mới nhất trước
function versions(id) {
  get(id);
  return getDb()
    .prepare('SELECT * FROM requirement_versions WHERE story_id = ? ORDER BY version DESC')
    .all(id)
    .map((v) => ({ ...v, changes: v.changes ? JSON.parse(v.changes) : null, acs: ac.parse(v.acceptance_criteria) }));
}

function version(id, v) {
  const row = getDb().prepare('SELECT * FROM requirement_versions WHERE story_id = ? AND version = ?').get(id, v);
  if (!row) throw notFound(`Requirement không có phiên bản ${v}`);
  return { ...row, acs: ac.parse(row.acceptance_criteria) };
}

// QĐ8: nội dung nghiệp vụ (tiêu đề, mô tả, AC) đổi → phiên bản mới + gắn cờ test.
//  - AC đổi hoặc bị bỏ: chỉ test liên kết với AC đó [A1]
//  - Tiêu đề hoặc mô tả đổi: mọi test của requirement [D1]
// Trả về null nếu nội dung không đổi (không tạo phiên bản).
function applyContentChange(story, next, source, jiraUpdatedAt) {
  const db = getDb();
  const titleChanged = story.title !== next.title;
  const descChanged = story.description !== next.description;
  const d = ac.diff(story.acceptance_criteria, next.acceptance_criteria);
  const acChanged = d.added.length > 0 || d.removed.length > 0;
  if (!titleChanged && !descChanged && !acChanged) return null;

  const version = story.current_version + 1;
  const changes = { title: titleChanged, description: descChanged, ac_added: d.added, ac_removed: d.removed };
  db.prepare(
    `INSERT INTO requirement_versions (story_id, version, title, description, acceptance_criteria, jira_updated_at, changes, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(story.id, version, next.title, next.description, next.acceptance_criteria, jiraUpdatedAt || null, JSON.stringify(changes), source);
  db.prepare(
    `UPDATE user_stories SET title = ?, description = ?, acceptance_criteria = ?, current_version = ?,
       updated_at = datetime('now','localtime') WHERE id = ?`
  ).run(next.title, next.description, next.acceptance_criteria, version, story.id);

  const countFlagged = () => db.prepare('SELECT COUNT(*) n FROM test_cases WHERE story_id = ? AND needs_review = 1').get(story.id).n;
  const before = countFlagged();
  // Test đã có cờ từ lần đổi trước thì giữ lý do cũ; lý do theo AC (cụ thể hơn) được gắn trước lý do tiêu đề/mô tả
  if (d.removed.length) {
    // AC bị sửa nội dung hoặc bị bỏ: AC_CHANGED nếu có AC mới thay thế, ngược lại AC_REMOVED
    const reason = d.added.length ? 'AC_CHANGED' : 'AC_REMOVED';
    const mark = db.prepare(
      `UPDATE test_cases SET review_reason = CASE WHEN needs_review = 1 THEN review_reason ELSE ? END, needs_review = 1
       WHERE story_id = ? AND id IN (SELECT test_case_id FROM test_case_acs WHERE ac_text = ?)`
    );
    d.removed.forEach((text) => mark.run(reason, story.id, text));
  }
  if (titleChanged || descChanged) {
    db.prepare(
      `UPDATE test_cases SET review_reason = CASE WHEN needs_review = 1 THEN review_reason ELSE 'CONTENT_CHANGED' END, needs_review = 1
       WHERE story_id = ?`
    ).run(story.id);
  }
  return { version, changes, flagged: countFlagged() - before };
}

// YC8 – QĐ8 [1.4] [D2]: QA Lead/Admin xử lý requirement Cần kiểm tra
function checkDecision(id, decision, userId) {
  const s = get(id);
  if (!s.check_reason) throw conflict('Requirement không ở trạng thái Cần kiểm tra');
  if (decision === 'ARCHIVE') {
    getDb()
      .prepare(`UPDATE user_stories SET archived = 1, check_reason = NULL, check_kept_by = NULL, check_kept_at = NULL,
        updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(id);
  } else if (decision === 'KEEP') {
    // Giữ lại chỉ ghi nhận quyết định, cờ Cần kiểm tra vẫn giữ tới khi đồng bộ lấy lại được issue [D2]
    getDb().prepare("UPDATE user_stories SET check_kept_by = ?, check_kept_at = datetime('now','localtime') WHERE id = ?").run(userId, id);
  } else throw badRequest('Quyết định phải là ARCHIVE (Lưu trữ) hoặc KEEP (Giữ lại)');
  return get(id);
}

// QĐ2: AI chỉ sinh test khi requirement còn hiệu lực và đủ MIN_AC_PER_STORY AC
function assertReady(story) {
  if (story.archived) throw conflict('Requirement đã lưu trữ, chỉ còn để xem (QĐ8)');
  if (story.check_reason) throw conflict('Requirement đang Cần kiểm tra, chưa sinh được test (QĐ8)');
  const minAc = params.get('MIN_AC_PER_STORY');
  if (story.acs.length < minAc) {
    throw badRequest(`Requirement chưa có đủ ${minAc} AC – PO/BA bổ sung mục "Acceptance criteria" trong Description trên Jira (QĐ1)`);
  }
}

// Tạo requirement trực tiếp: CHỈ dùng cho kiểm thử tự động và dữ liệu mẫu (QĐ1: không có API tạo requirement)
const testStorySchema = z.object({
  code: z.string().trim().toUpperCase(),
  project_id: z.coerce.number().int().positive(),
  module_id: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(3000).default(''),
  acceptance_criteria: z.string().max(5000).default(''),
  priority: z.enum(['High', 'Medium', 'Low']).default('Medium'),
  jira_issue_id: z.string().optional(),
});

function createForTest(input, userId) {
  const d = testStorySchema.parse(input);
  const db = getDb();
  const id = Number(
    db.prepare(
      `INSERT INTO user_stories (jira_issue_id, code, project_id, module_id, title, description, acceptance_criteria, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(d.jira_issue_id || null, d.code, d.project_id, d.module_id || null, d.title, d.description, d.acceptance_criteria, d.priority, userId).lastInsertRowid
  );
  db.prepare(
    "INSERT INTO requirement_versions (story_id, version, title, description, acceptance_criteria, source) VALUES (?, 1, ?, ?, ?, 'SEED')"
  ).run(id, d.title, d.description, d.acceptance_criteria);
  return get(id);
}

module.exports = { list, get, versions, version, applyContentChange, checkDecision, assertReady, createForTest, syncState };
