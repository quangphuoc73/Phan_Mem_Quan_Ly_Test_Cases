// YC2 (lưu kết quả AI), YC3 (soạn thảo, gửi duyệt), YC4 (duyệt), YC7 (tra cứu).
// Vòng đời test case:
//   DRAFT/RETURNED --gửi duyệt--> PENDING_REVIEW --duyệt--> APPROVED
//                                     \--trả lại (bắt buộc ghi chú)--> RETURNED
//   APPROVED --sửa--> DRAFT (phải duyệt lại)
const { z } = require('zod');
const { getDb } = require('../db');
const params = require('./parameterService');
const { testCaseSchema } = require('./ai/schemas');
const { badRequest, notFound, conflict } = require('../utils/errors');

const EDITABLE = ['DRAFT', 'RETURNED', 'APPROVED'];

function toDto(row) {
  return row && { ...row, steps: JSON.parse(row.steps) };
}

function snapshot(tc) {
  const { title, precondition, steps, expected_result, priority, type, status } = tc;
  return JSON.stringify({ title, precondition, steps, expected_result, priority, type, status });
}

function addVersion(tcId, version, tc, userId, note) {
  getDb()
    .prepare('INSERT INTO test_case_versions (test_case_id, version, snapshot, change_note, changed_by) VALUES (?, ?, ?, ?, ?)')
    .run(tcId, version, snapshot(tc), note || null, userId);
}

function nextCode(story) {
  const rows = getDb().prepare('SELECT code FROM test_cases WHERE story_id = ?').all(story.id);
  const max = rows.reduce((m, r) => Math.max(m, Number(r.code.split('-TC').pop()) || 0), 0);
  return (offset) => `${story.code}-TC${String(max + offset).padStart(2, '0')}`;
}

// YC13: lần chạy gần nhất là Fail và Developer đã báo sửa → Tester cần kiểm thử lại
const NEEDS_RETEST = `EXISTS (SELECT 1 FROM test_runs r WHERE r.id = (SELECT MAX(x.id) FROM test_runs x WHERE x.test_case_id = t.id)
  AND r.result = 'FAIL' AND r.fixed_at IS NOT NULL)`;

function list(f = {}) {
  const where = [];
  const args = [];
  const add = (sql, v) => (where.push(sql), args.push(v));
  if (f.story_id) add('t.story_id = ?', f.story_id);
  if (f.project_id) add('s.project_id = ?', f.project_id);
  if (f.module_id) add('s.module_id = ?', f.module_id);
  if (f.sprint_id) add('s.sprint_id = ?', f.sprint_id);
  if (f.status) add('t.status = ?', f.status);
  if (f.priority) add('t.priority = ?', f.priority);
  if (f.type) add('t.type = ?', f.type);
  if (f.source) add('t.source = ?', f.source);
  if (f.needs_retest) where.push(NEEDS_RETEST);
  if (f.q) {
    where.push('(t.code LIKE ? OR t.title LIKE ?)');
    args.push(`%${f.q}%`, `%${f.q}%`);
  }
  return getDb()
    .prepare(
      `SELECT t.*, s.code story_code, s.title story_title, s.project_id, p.name project_name,
        (SELECT r.result FROM test_runs r WHERE r.test_case_id = t.id ORDER BY r.id DESC LIMIT 1) last_result,
        ${NEEDS_RETEST} needs_retest,
        (SELECT COUNT(*) FROM automation_scripts a WHERE a.test_case_id = t.id) has_script
       FROM test_cases t JOIN user_stories s ON s.id = t.story_id JOIN projects p ON p.id = s.project_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY t.story_id DESC, t.code`
    )
    .all(...args)
    .map(toDto);
}

function get(id) {
  const tc = getDb()
    .prepare(
      `SELECT t.*, s.code story_code, s.title story_title, s.project_id, p.base_url
       FROM test_cases t JOIN user_stories s ON s.id = t.story_id JOIN projects p ON p.id = s.project_id
       WHERE t.id = ?`
    )
    .get(id);
  if (!tc) throw notFound('Không tìm thấy test case');
  return toDto(tc);
}

function countByStory(storyId) {
  return getDb().prepare('SELECT COUNT(*) n FROM test_cases WHERE story_id = ?').get(storyId).n;
}

// Lưu kết quả AI. Các test case AI còn ở trạng thái Nháp sẽ được thay thế khi sinh lại.
const saveAiResult = (story, items, aiLogId, userId) =>
  getDb().transaction(() => {
    getDb().prepare("DELETE FROM test_cases WHERE story_id = ? AND source = 'AI' AND status = 'DRAFT'").run(story.id);
    const max = params.get('MAX_TC_PER_STORY');
    const remaining = max - countByStory(story.id);
    if (remaining <= 0) throw conflict(`User story đã đủ ${max} test case (QĐ2), không thể sinh thêm`);
    const codeOf = nextCode(story);
    const ins = getDb().prepare(
      `INSERT INTO test_cases (code, story_id, title, precondition, steps, expected_result, priority, type, status, source, ai_log_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'AI', ?, ?)`
    );
    const ids = items.slice(0, remaining).map((tc, i) => {
      const info = ins.run(codeOf(i + 1), story.id, tc.title, tc.precondition || '', JSON.stringify(tc.steps),
        tc.expected_result, tc.priority, tc.type, aiLogId, userId);
      addVersion(info.lastInsertRowid, 1, { ...tc, status: 'DRAFT' }, userId, 'Bản gốc do AI sinh');
      return info.lastInsertRowid;
    });
    return ids.map(get);
  })();

const manualSchema = testCaseSchema.extend({ story_id: z.coerce.number().int().positive() });

function create(input, story, userId) {
  const d = manualSchema.parse(input);
  const max = params.get('MAX_TC_PER_STORY');
  if (countByStory(story.id) >= max) throw conflict(`User story đã đủ ${max} test case (QĐ2)`);
  const info = getDb()
    .prepare(
      `INSERT INTO test_cases (code, story_id, title, precondition, steps, expected_result, priority, type, status, source, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'MANUAL', ?)`
    )
    .run(nextCode(story)(1), story.id, d.title, d.precondition || '', JSON.stringify(d.steps), d.expected_result,
      d.priority, d.type, userId);
  addVersion(info.lastInsertRowid, 1, { ...d, status: 'DRAFT' }, userId, 'Tạo thủ công');
  return get(info.lastInsertRowid);
}

function update(id, input, userId) {
  const tc = get(id);
  if (!EDITABLE.includes(tc.status)) throw conflict('Test case đang chờ duyệt, không thể sửa');
  const d = testCaseSchema.parse({ ...tc, ...input });
  const version = tc.version + 1;
  getDb()
    .prepare(
      `UPDATE test_cases SET title = ?, precondition = ?, steps = ?, expected_result = ?, priority = ?, type = ?,
       status = 'DRAFT', version = ?, updated_at = datetime('now','localtime') WHERE id = ?`
    )
    .run(d.title, d.precondition || '', JSON.stringify(d.steps), d.expected_result, d.priority, d.type, version, id);
  addVersion(id, version, { ...d, status: 'DRAFT' }, userId, input.change_note || 'Cập nhật nội dung');
  return get(id);
}

function remove(id) {
  const tc = get(id);
  if (!['DRAFT', 'RETURNED'].includes(tc.status)) throw conflict('Chỉ xóa được test case ở trạng thái Nháp hoặc Bị trả lại');
  getDb().prepare('DELETE FROM test_cases WHERE id = ?').run(id);
  return tc;
}

function submit(ids) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Chưa chọn test case nào');
  return getDb().transaction(() =>
    ids.map((id) => {
      const tc = get(id);
      if (!['DRAFT', 'RETURNED'].includes(tc.status)) throw conflict(`${tc.code} không ở trạng thái có thể gửi duyệt`);
      getDb().prepare("UPDATE test_cases SET status = 'PENDING_REVIEW', updated_at = datetime('now','localtime') WHERE id = ?").run(id);
      return tc.code;
    })
  )();
}

// QĐ4: chỉ QA Lead duyệt (kiểm tra ở middleware); trả lại phải có ghi chú
function review(id, { decision, note }, reviewerId) {
  if (!['APPROVED', 'RETURNED'].includes(decision)) throw badRequest('Quyết định không hợp lệ');
  if (decision === 'RETURNED' && !String(note || '').trim()) throw badRequest('Trả lại test case bắt buộc phải có ghi chú');
  const tc = get(id);
  if (tc.status !== 'PENDING_REVIEW') throw conflict('Test case không ở trạng thái chờ duyệt');
  getDb().transaction(() => {
    getDb().prepare("UPDATE test_cases SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(decision, id);
    getDb().prepare('INSERT INTO reviews (test_case_id, reviewer_id, decision, note) VALUES (?, ?, ?, ?)').run(id, reviewerId, decision, note || null);
  })();
  return get(id);
}

function history(id) {
  get(id);
  const db = getDb();
  return {
    versions: db
      .prepare(
        `SELECT v.*, u.full_name changed_by_name FROM test_case_versions v LEFT JOIN users u ON u.id = v.changed_by
         WHERE test_case_id = ? ORDER BY version DESC`
      )
      .all(id)
      .map((v) => ({ ...v, snapshot: JSON.parse(v.snapshot) })),
    reviews: db
      .prepare(
        `SELECT r.*, u.full_name reviewer_name FROM reviews r JOIN users u ON u.id = r.reviewer_id
         WHERE test_case_id = ? ORDER BY r.id DESC`
      )
      .all(id),
    runs: db
      .prepare(
        `SELECT r.*, u.full_name executed_by_name, fu.full_name fixed_by_name FROM test_runs r
         LEFT JOIN users u ON u.id = r.executed_by LEFT JOIN users fu ON fu.id = r.fixed_by
         WHERE test_case_id = ? ORDER BY r.id DESC`
      )
      .all(id),
  };
}

module.exports = { list, get, saveAiResult, create, update, remove, submit, review, history };
