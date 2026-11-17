// YC2 (lưu kết quả AI), YC3 (soạn thảo, gửi duyệt, Đã xem lại), YC4 (duyệt), YC7 (tra cứu).
// Vòng đời test case (QĐ3, QĐ4, [R4]):
//   DRAFT/RETURNED --gửi duyệt (≥ 1 AC)--> PENDING_REVIEW --duyệt--> APPROVED
//                                              \--trả lại (bắt buộc ghi chú)--> RETURNED
//   APPROVED --sửa--> DRAFT (phải duyệt lại; đợt đang mở vẫn chạy phiên bản đã cố định)
// Cờ Cần xem lại (needs_review) độc lập với trạng thái: gỡ khi Đã xem lại hoặc bản sửa được duyệt.
const crypto = require('crypto');
const { z } = require('zod');
const { getDb } = require('../db');
const params = require('./parameterService');
const ac = require('../utils/ac');
const { testCaseSchema } = require('./ai/schemas');
const { badRequest, notFound, conflict } = require('../utils/errors');

const EDITABLE = ['DRAFT', 'RETURNED', 'APPROVED'];

const snapshot = ({ title, precondition, steps, expected_result, priority, type }) =>
  JSON.stringify({ title, precondition, steps, expected_result, priority, type });

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

// QĐ6, QĐ7 [B3]: "Kết quả gần nhất" chỉ lấy lần chạy của phiên bản hiện tại; test vừa sửa hiện "Chưa chạy"
const LAST_RESULT = `(SELECT e.result FROM test_executions e WHERE e.test_case_id = t.id AND e.tc_version = t.version ORDER BY e.id DESC LIMIT 1)`;
// QĐ18: có phiếu báo đã sửa đang chờ kiểm thử lại
const NEEDS_RETEST = `EXISTS (SELECT 1 FROM fix_reports f JOIN test_executions fe ON fe.id = f.execution_id
  WHERE fe.test_case_id = t.id AND f.status = 'WAITING')`;

function toDto(row) {
  if (!row) return row;
  const acs = getDb().prepare('SELECT ac_text FROM test_case_acs WHERE test_case_id = ? ORDER BY rowid').all(row.id).map((r) => r.ac_text);
  return { ...row, steps: JSON.parse(row.steps), acs, needs_review: Boolean(row.needs_review), needs_retest: Boolean(row.needs_retest) };
}

// YC7 – BM6, QĐ7: lọc kết hợp AND, sắp theo requirement mới nhất rồi theo mã test
function list(f = {}) {
  const where = [];
  const args = [];
  const add = (sql, v) => (where.push(sql), args.push(v));
  if (f.story_id) add('t.story_id = ?', f.story_id);
  if (f.project_id) add('s.project_id = ?', f.project_id);
  if (f.module_id) add('s.module_id = ?', f.module_id);
  if (f.status) add('t.status = ?', f.status);
  if (f.priority) add('t.priority = ?', f.priority);
  if (f.type) add('t.type = ?', f.type);
  if (f.source) add('t.source = ?', f.source);
  if (f.suite_id) add('t.id IN (SELECT test_case_id FROM test_suite_items WHERE suite_id = ?)', f.suite_id);
  if (f.run_id) add('t.id IN (SELECT test_case_id FROM test_run_items WHERE run_id = ?)', f.run_id);
  if (f.needs_review === 'true' || f.needs_review === true) where.push('t.needs_review = 1');
  if (f.needs_retest === 'true' || f.needs_retest === true) where.push(NEEDS_RETEST);
  if (!f.include_archived) where.push('s.archived = 0');
  if (f.q) {
    where.push('(t.code LIKE ? OR t.title LIKE ?)');
    args.push(`%${f.q}%`, `%${f.q}%`);
  }
  return getDb()
    .prepare(
      `SELECT t.*, s.code story_code, s.title story_title, s.project_id, s.current_version story_version, p.name project_name,
        ${LAST_RESULT} last_result, ${NEEDS_RETEST} needs_retest,
        (SELECT GROUP_CONCAT(ts.name, ', ') FROM test_suite_items si JOIN test_suites ts ON ts.id = si.suite_id WHERE si.test_case_id = t.id) suites
       FROM test_cases t JOIN user_stories s ON s.id = t.story_id JOIN projects p ON p.id = s.project_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY s.id DESC, t.code`
    )
    .all(...args)
    .map(toDto);
}

function get(id) {
  const tc = getDb()
    .prepare(
      `SELECT t.*, s.code story_code, s.title story_title, s.project_id, s.current_version story_version, s.archived story_archived,
        s.check_reason story_check_reason, p.base_url, ${LAST_RESULT} last_result, ${NEEDS_RETEST} needs_retest
       FROM test_cases t JOIN user_stories s ON s.id = t.story_id JOIN projects p ON p.id = s.project_id
       WHERE t.id = ?`
    )
    .get(id);
  if (!tc) throw notFound('Không tìm thấy test case');
  return toDto(tc);
}

const countByStory = (storyId) => getDb().prepare('SELECT COUNT(*) n FROM test_cases WHERE story_id = ?').get(storyId).n;

// QĐ3: AC phải thuộc phiên bản hiện tại của requirement
function checkAcs(story, acs) {
  const valid = ac.parse(story.acceptance_criteria);
  const list = [...new Set((acs || []).map(ac.normalize).filter(Boolean))];
  const bad = list.filter((a) => !valid.includes(a));
  if (bad.length) throw badRequest(`AC không thuộc phiên bản hiện tại của requirement: ${bad[0]}`);
  return list;
}

function setAcs(tcId, acs) {
  const db = getDb();
  db.prepare('DELETE FROM test_case_acs WHERE test_case_id = ?').run(tcId);
  const ins = db.prepare('INSERT INTO test_case_acs (test_case_id, ac_text) VALUES (?, ?)');
  acs.forEach((a) => ins.run(tcId, a));
}

function insertTestCase(story, d, { source, aiLogId, proposalId, userId, note }) {
  const db = getDb();
  const info = db.prepare(
    `INSERT INTO test_cases (code, story_id, title, precondition, steps, expected_result, priority, type, status, source, ai_log_id,
       proposal_id, req_version, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)`
  ).run(nextCode(story)(1), story.id, d.title, d.precondition || '', JSON.stringify(d.steps), d.expected_result, d.priority, d.type,
    source, aiLogId || null, proposalId || null, story.current_version, userId);
  const id = Number(info.lastInsertRowid);
  setAcs(id, d.acs || []);
  addVersion(id, 1, d, userId, note);
  return id;
}

// YC2 – QĐ2: kết quả AI là bản nháp mới; bản nháp cũ được giữ nguyên, không bị thay thế; chỉ sinh trong giới hạn còn lại
const saveAiResult = (story, items, aiLogId, userId) =>
  getDb().transaction(() => {
    const max = params.get('MAX_TC_PER_STORY');
    const remaining = max - countByStory(story.id);
    if (remaining <= 0) throw conflict(`Requirement đã đủ ${max} test case (QĐ2), không thể sinh thêm`);
    const ids = items.slice(0, remaining).map((tc) => {
      const acs = [...new Set(tc.ac_refs.map((n) => story.acs[n - 1]).filter(Boolean))];
      return insertTestCase(story, { ...tc, acs }, { source: 'AI', aiLogId, userId, note: 'Bản gốc do AI sinh' });
    });
    return { testCases: ids.map(get), truncated: Math.max(0, items.length - remaining) };
  })();

const manualSchema = testCaseSchema.extend({
  story_id: z.coerce.number().int().positive(),
  acs: z.array(z.string()).optional().default([]),
});

// YC3: test thủ công không bị chặn bởi MIN_AC_PER_STORY (QĐ1), chỉ bị chặn bởi giới hạn QĐ2
function create(input, story, userId, extra = {}) {
  const d = manualSchema.parse(input);
  if (story.archived) throw conflict('Requirement đã lưu trữ, không thêm test được (QĐ8)');
  const max = params.get('MAX_TC_PER_STORY');
  if (countByStory(story.id) >= max) throw conflict(`Requirement đã đủ ${max} test case (QĐ2)`);
  const acs = checkAcs(story, d.acs);
  const id = getDb().transaction(() =>
    insertTestCase(story, { ...d, acs }, { source: extra.source || 'MANUAL', proposalId: extra.proposalId, userId, note: extra.note || 'Tạo thủ công' })
  )();
  return get(id);
}

// YC3 – QĐ3: mỗi lần sửa tạo một phiên bản mới; sửa test Đã duyệt thì quay về Nháp [R4]
function update(id, input, userId, extra = {}) {
  const tc = get(id);
  if (!EDITABLE.includes(tc.status)) throw conflict('Test case đang chờ duyệt, không thể sửa (QĐ3)');
  const d = testCaseSchema.parse({ ...tc, ...input });
  const story = getDb().prepare('SELECT * FROM user_stories WHERE id = ?').get(tc.story_id);
  const acs = input.acs !== undefined ? checkAcs(story, input.acs) : null;
  const version = tc.version + 1;
  getDb().transaction(() => {
    getDb()
      .prepare(
        `UPDATE test_cases SET title = ?, precondition = ?, steps = ?, expected_result = ?, priority = ?, type = ?,
         status = 'DRAFT', version = ?, proposal_id = COALESCE(?, proposal_id), updated_at = datetime('now','localtime') WHERE id = ?`
      )
      .run(d.title, d.precondition || '', JSON.stringify(d.steps), d.expected_result, d.priority, d.type, version, extra.proposalId || null, id);
    if (acs) setAcs(id, acs);
    addVersion(id, version, d, userId, input.change_note || extra.note || 'Cập nhật nội dung');
  })();
  return get(id);
}

// QĐ3 [A2]: chỉ xóa test Nháp hoặc Bị trả lại chưa có lần chạy nào
function remove(id) {
  const tc = get(id);
  if (!['DRAFT', 'RETURNED'].includes(tc.status)) throw conflict('Chỉ xóa được test case ở trạng thái Nháp hoặc Bị trả lại (QĐ3)');
  const ran = getDb().prepare('SELECT 1 FROM test_executions WHERE test_case_id = ? LIMIT 1').get(id);
  if (ran) throw conflict('Test case đã có lần chạy, chỉ được bỏ khỏi suite hoặc khỏi đợt chưa ghi kết quả (QĐ3)');
  getDb().transaction(() => {
    getDb().prepare('DELETE FROM test_run_items WHERE test_case_id = ?').run(id);
    getDb().prepare('DELETE FROM test_cases WHERE id = ?').run(id);
  })();
  return tc;
}

// QĐ3: chỉ Nháp hoặc Bị trả lại mới được gửi duyệt; phải liên kết ít nhất 1 AC
function submit(ids) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Chưa chọn test case nào');
  return getDb().transaction(() =>
    ids.map((id) => {
      const tc = get(id);
      if (!['DRAFT', 'RETURNED'].includes(tc.status)) throw conflict(`${tc.code} không ở trạng thái có thể gửi duyệt (QĐ3)`);
      if (!tc.acs.length) throw conflict(`${tc.code} chưa liên kết AC nào, chưa gửi duyệt được (QĐ3)`);
      getDb().prepare("UPDATE test_cases SET status = 'PENDING_REVIEW', updated_at = datetime('now','localtime') WHERE id = ?").run(id);
      return tc.code;
    })
  )();
}

// YC4 – QĐ4: chỉ QA Lead duyệt (kiểm tra ở middleware), chỉ test Chờ duyệt; trả lại phải có ghi chú.
// Bản sửa được duyệt thì gỡ cờ Cần xem lại và nâng phiên bản requirement đã liên kết [R5]
function review(id, { decision, note }, reviewerId) {
  if (!['APPROVED', 'RETURNED'].includes(decision)) throw badRequest('Quyết định không hợp lệ');
  if (decision === 'RETURNED' && !String(note || '').trim()) throw badRequest('Trả lại test case bắt buộc phải có ghi chú (QĐ4)');
  const tc = get(id);
  if (tc.status !== 'PENDING_REVIEW') throw conflict('Test case không ở trạng thái chờ duyệt (QĐ4)');
  getDb().transaction(() => {
    if (decision === 'APPROVED') {
      getDb()
        .prepare(`UPDATE test_cases SET status = 'APPROVED', needs_review = 0, review_reason = NULL, req_version = ?,
          updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(tc.story_version, id);
    } else {
      getDb().prepare("UPDATE test_cases SET status = 'RETURNED', updated_at = datetime('now','localtime') WHERE id = ?").run(id);
    }
    getDb().prepare('INSERT INTO reviews (test_case_id, reviewer_id, decision, note) VALUES (?, ?, ?, ?)').run(id, reviewerId, decision, note || null);
  })();
  return get(id);
}

// YC3 – QĐ3 [2.2] [D1] [R5]: Đã xem lại (test vẫn đúng). Bắt buộc lý do; được chọn nhiều test, một lý do chung;
// một test thì được gán lại AC. Lưu người xác nhận, phiên bản requirement, lý do, thời điểm; gỡ cờ; nâng mốc phiên bản.
const recheckSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1, 'Chưa chọn test case nào'),
  reason: z.string().trim().min(3, 'Đã xem lại bắt buộc ghi lý do (QĐ3)').max(1000),
  acs: z.array(z.string()).optional(),
});

function recheck(input, userId) {
  const d = recheckSchema.parse(input);
  if (d.acs && d.ids.length > 1) throw badRequest('Chỉ gán lại AC khi xác nhận từng test');
  const batch = d.ids.length > 1 ? crypto.randomUUID() : null;
  const db = getDb();
  return db.transaction(() =>
    d.ids.map((id) => {
      const tc = get(id);
      if (!tc.needs_review) throw conflict(`${tc.code} không có cờ Cần xem lại`);
      const story = db.prepare('SELECT * FROM user_stories WHERE id = ?').get(tc.story_id);
      if (d.acs) setAcs(id, checkAcs(story, d.acs));
      else {
        // AC không còn trong phiên bản hiện tại thì bỏ liên kết (đã xác nhận test vẫn đúng)
        const valid = ac.parse(story.acceptance_criteria);
        setAcs(id, tc.acs.filter((a) => valid.includes(a)));
      }
      db.prepare('UPDATE test_cases SET needs_review = 0, review_reason = NULL, req_version = ? WHERE id = ?').run(story.current_version, id);
      db.prepare('INSERT INTO recheck_logs (test_case_id, user_id, req_version, reason, batch_id) VALUES (?, ?, ?, ?, ?)')
        .run(id, userId, story.current_version, d.reason, batch);
      return tc.code;
    })
  )();
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
    rechecks: db
      .prepare(
        `SELECT c.*, u.full_name user_name FROM recheck_logs c JOIN users u ON u.id = c.user_id
         WHERE test_case_id = ? ORDER BY c.id DESC`
      )
      .all(id),
    executions: db
      .prepare(
        `SELECT e.*, r.name run_name, r.build, r.environment, u.full_name executed_by_name,
          f.id fix_id, f.build fix_build, f.status fix_status, fu.full_name fixed_by_name
         FROM test_executions e JOIN test_runs r ON r.id = e.run_id LEFT JOIN users u ON u.id = e.executed_by
         LEFT JOIN fix_reports f ON f.execution_id = e.id LEFT JOIN users fu ON fu.id = f.reported_by
         WHERE e.test_case_id = ? ORDER BY e.id DESC`
      )
      .all(id),
  };
}

module.exports = { list, get, saveAiResult, create, update, remove, submit, review, recheck, history, countByStory };
