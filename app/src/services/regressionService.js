// YC17 – BM16, QĐ17: AI đề xuất bộ regression cho một thay đổi requirement.
//  - Bộ luôn gồm test liên kết với AC đã đổi; tiêu đề hoặc mô tả đổi thì gồm mọi test của requirement [R3]
//  - AI chỉ xếp ưu tiên và gợi ý thêm; không gọi được AI vẫn đưa ra danh sách test liên kết
//  - Chỉ test đủ điều kiện chạy (QĐ14) được đưa vào đợt; QA Lead chỉ xác nhận khi không còn test bị chặn trong bộ
//  - Bỏ test thuộc phần bắt buộc phải ghi lý do [2.2]; xác nhận xong tạo Test Run loại Regression
const { z } = require('zod');
const { getDb } = require('../db');
const stories = require('./storyService');
const runs = require('./runService');
const ai = require('./ai/aiService');
const ac = require('../utils/ac');
const { badRequest, conflict, notFound } = require('../utils/errors');

const testsOf = (storyId) =>
  getDb()
    .prepare('SELECT id, code, title, priority, type, status FROM test_cases WHERE story_id = ? ORDER BY code')
    .all(storyId)
    .map((t) => ({ ...t, acs: getDb().prepare('SELECT ac_text FROM test_case_acs WHERE test_case_id = ?').all(t.id).map((r) => r.ac_text) }));

// Phạm vi thay đổi: từ phiên bản cuối đã có bộ regression được xác nhận (mặc định phiên bản liền trước) tới phiên bản hiện tại
function changeRange(story) {
  if (story.current_version < 2) throw conflict('Requirement chưa có thay đổi nào (mới có 1 phiên bản)');
  const last = getDb()
    .prepare("SELECT MAX(to_version) v FROM regression_sets WHERE story_id = ? AND status = 'CONFIRMED'")
    .get(story.id).v;
  const from = last || story.current_version - 1;
  if (from >= story.current_version) throw conflict('Thay đổi hiện tại của requirement đã có bộ regression được xác nhận');
  return { from, to: story.current_version };
}

async function create(storyId, userId, { skipAi = false } = {}) {
  const story = stories.get(storyId);
  const { from, to } = changeRange(story);
  const existing = getDb().prepare("SELECT id FROM regression_sets WHERE story_id = ? AND to_version = ? AND status = 'DRAFT'").get(storyId, to);
  if (existing) return get(existing.id);

  const before = stories.version(storyId, from);
  const after = stories.version(storyId, to);
  const d = ac.diff(before.acceptance_criteria, after.acceptance_criteria);
  const changedAcs = [...d.added, ...d.removed];
  const contentChanged = before.title !== after.title || before.description !== after.description;
  const all = testsOf(storyId);
  const mandatory = all
    .map((t) => ({ ...t, changed_acs: t.acs.filter((a) => changedAcs.includes(a)) }))
    .filter((t) => contentChanged || t.changed_acs.length);
  const candidates = getDb()
    .prepare(
      `SELECT t.id, t.code, t.title, t.priority, t.type FROM test_cases t JOIN user_stories s ON s.id = t.story_id
       WHERE s.project_id = ? AND t.story_id <> ? AND t.status = 'APPROVED' AND t.needs_review = 0 AND s.archived = 0 AND s.check_reason IS NULL
       ORDER BY CASE t.priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, t.code LIMIT 30`
    )
    .all(story.project_id, storyId);

  const ranked = skipAi || !mandatory.length
    ? { ok: false }
    : await ai.rankRegression({ story, after, mandatory, candidates }, userId);
  const rankOf = new Map((ranked.items || []).map((i) => [i.test_code, i]));
  const byCode = new Map(candidates.map((c) => [c.code, c]));

  const db = getDb();
  const id = db.transaction(() => {
    const setId = Number(
      db.prepare('INSERT INTO regression_sets (story_id, from_version, to_version, ai_log_id, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(storyId, from, to, ranked.aiLogId || null, userId).lastInsertRowid
    );
    const ins = db.prepare(
      'INSERT OR IGNORE INTO regression_items (set_id, test_case_id, priority, reason, origin, mandatory) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const t of mandatory) {
      const r = rankOf.get(t.code);
      const reason = r?.reason || (t.changed_acs.length ? `Liên kết với AC đã đổi: ${t.changed_acs[0]}` : 'Tiêu đề hoặc mô tả requirement đã đổi');
      ins.run(setId, t.id, r?.priority || (t.changed_acs.length ? 'HIGH' : 'MEDIUM'), reason, 'LINKED', 1);
    }
    for (const s of ranked.suggestions || []) {
      const c = byCode.get(s.test_code);
      if (c) ins.run(setId, c.id, 'LOW', s.reason, 'AI', 0);
    }
    return setId;
  })();
  return { ...get(id), aiAvailable: Boolean(ranked.ok) };
}

function get(id) {
  const set = getDb()
    .prepare(
      `SELECT r.*, s.code story_code, s.title story_title, s.project_id, u.full_name created_by_name, cu.full_name confirmed_by_name
       FROM regression_sets r JOIN user_stories s ON s.id = r.story_id LEFT JOIN users u ON u.id = r.created_by
       LEFT JOIN users cu ON cu.id = r.confirmed_by WHERE r.id = ?`
    )
    .get(id);
  if (!set) throw notFound('Không tìm thấy bộ regression');
  const items = getDb()
    .prepare(
      `SELECT i.*, t.code, t.title, t.status, t.priority tc_priority FROM regression_items i JOIN test_cases t ON t.id = i.test_case_id
       WHERE i.set_id = ? ORDER BY i.removed, CASE i.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END, t.code`
    )
    .all(id);
  const elig = new Map(runs.eligibility(items.map((i) => i.test_case_id)).map((e) => [e.id, e.reason]));
  const withReason = items.map((i) => ({ ...i, mandatory: Boolean(i.mandatory), removed: Boolean(i.removed), blocked_reason: elig.get(i.test_case_id) }));
  return {
    ...set,
    items: withReason,
    blocked: withReason.filter((i) => !i.removed && i.blocked_reason), // test chưa đủ điều kiện chạy, liệt kê riêng
  };
}

function list({ story_id, project_id } = {}) {
  const where = [];
  const args = [];
  if (story_id) (where.push('r.story_id = ?'), args.push(story_id));
  if (project_id) (where.push('s.project_id = ?'), args.push(project_id));
  return getDb()
    .prepare(
      `SELECT r.*, s.code story_code, (SELECT COUNT(*) FROM regression_items i WHERE i.set_id = r.id AND i.removed = 0) tc_count
       FROM regression_sets r JOIN user_stories s ON s.id = r.story_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.id DESC`
    )
    .all(...args);
}

const itemsSchema = z.object({
  add: z.array(z.coerce.number().int().positive()).optional().default([]),
  remove: z.array(z.object({ test_case_id: z.coerce.number().int().positive(), reason: z.string().trim().max(500).optional().default('') })).optional().default([]),
  restore: z.array(z.coerce.number().int().positive()).optional().default([]),
});

// QĐ17: QA Lead được thêm, bớt; bỏ test thuộc phần bắt buộc phải ghi lý do [2.2]
function updateItems(id, input) {
  const set = get(id);
  if (set.status !== 'DRAFT') throw conflict('Bộ regression đã được xác nhận');
  const d = itemsSchema.parse(input);
  const db = getDb();
  db.transaction(() => {
    for (const tcId of d.add) {
      const tc = db.prepare('SELECT t.code, s.project_id FROM test_cases t JOIN user_stories s ON s.id = t.story_id WHERE t.id = ?').get(tcId);
      if (!tc) throw notFound(`Không tìm thấy test case ${tcId}`);
      if (tc.project_id !== set.project_id) throw badRequest(`${tc.code} không cùng dự án với requirement`);
      db.prepare("INSERT OR IGNORE INTO regression_items (set_id, test_case_id, priority, reason, origin) VALUES (?, ?, 'MEDIUM', 'QA Lead thêm', 'MANUAL')").run(id, tcId);
      db.prepare('UPDATE regression_items SET removed = 0, remove_reason = NULL WHERE set_id = ? AND test_case_id = ?').run(id, tcId);
    }
    for (const r of d.remove) {
      const item = set.items.find((i) => i.test_case_id === r.test_case_id);
      if (!item) throw notFound('Test không có trong bộ regression');
      if (item.mandatory && !r.reason) throw badRequest(`Bỏ ${item.code} (liên kết với phần đã đổi) bắt buộc ghi lý do (QĐ17)`);
      db.prepare('UPDATE regression_items SET removed = 1, remove_reason = ? WHERE set_id = ? AND test_case_id = ?').run(r.reason || null, id, r.test_case_id);
    }
    for (const tcId of d.restore) db.prepare('UPDATE regression_items SET removed = 0, remove_reason = NULL WHERE set_id = ? AND test_case_id = ?').run(id, tcId);
  })();
  return get(id);
}

// QĐ17: xác nhận khi không còn test bị chặn → tạo Test Run loại Regression theo YC14
function confirm(id, input, userId) {
  const set = get(id);
  if (set.status !== 'DRAFT') throw conflict('Bộ regression đã được xác nhận');
  if (set.blocked.length) {
    throw conflict(`Còn ${set.blocked.length} test chưa đủ điều kiện chạy; xử lý hoặc bỏ khỏi bộ trước khi xác nhận (QĐ17): `
      + set.blocked.map((b) => `${b.code} – ${b.blocked_reason}`).join('; '));
  }
  const ids = set.items.filter((i) => !i.removed).map((i) => i.test_case_id);
  if (!ids.length) throw badRequest('Bộ regression không còn test nào');
  const d = z.object({
    name: z.string().trim().min(3).max(200).optional(),
    build: z.string().trim().min(1, 'Phải nhập build đang kiểm thử').max(50),
    environment: z.string().trim().min(1, 'Phải nhập môi trường kiểm thử').max(100),
    assignee_id: z.coerce.number().int().positive().nullable().optional(),
    due_date: z.string().nullable().optional(),
  }).parse(input);
  return getDb().transaction(() => {
    const r = runs.create(
      { project_id: set.project_id, name: d.name || `Regression ${set.story_code} v${set.from_version}→v${set.to_version}`, run_type: 'REGRESSION',
        build: d.build, environment: d.environment, due_date: d.due_date || null, test_case_ids: ids, assignee_id: d.assignee_id ?? null },
      userId,
      { regressionSetId: id }
    );
    getDb().prepare("UPDATE regression_sets SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = datetime('now','localtime'), run_id = ? WHERE id = ?")
      .run(userId, r.run.id, id);
    return { set: get(id), run: r.run, skipped: r.skipped };
  })();
}

// QĐ16: chấp nhận đề xuất "Nên chạy lại" → thêm test vào bộ regression của cùng thay đổi (chưa có bộ thì tạo bộ)
async function addFromProposal(p, userId) {
  const set = await create(p.story_id, userId, { skipAi: true });
  getDb()
    .prepare(
      `INSERT INTO regression_items (set_id, test_case_id, priority, reason, origin) VALUES (?, ?, 'MEDIUM', ?, 'PROPOSAL')
       ON CONFLICT (set_id, test_case_id) DO UPDATE SET removed = 0, remove_reason = NULL`
    )
    .run(set.id, p.test_case_id, p.reason);
  return set.id;
}

module.exports = { create, get, list, updateItems, confirm, addFromProposal };
