// YC13 – BM12, QĐ13: Test Suite dạng phẳng, không lồng nhau. Một test thuộc được nhiều suite
// nhưng phải cùng dự án. Xóa suite không xóa test.
const { z } = require('zod');
const { getDb } = require('../db');
const { badRequest, notFound, conflict } = require('../utils/errors');

const suiteSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(3, 'Tên suite 3–100 ký tự (QĐ13)').max(100, 'Tên suite 3–100 ký tự (QĐ13)'),
  description: z.string().trim().max(1000).optional().default(''),
});

function list({ project_id } = {}) {
  return getDb()
    .prepare(
      `SELECT ts.*, u.full_name created_by_name, p.name project_name,
        (SELECT COUNT(*) FROM test_suite_items i WHERE i.suite_id = ts.id) tc_count
       FROM test_suites ts JOIN projects p ON p.id = ts.project_id LEFT JOIN users u ON u.id = ts.created_by
       ${project_id ? 'WHERE ts.project_id = ?' : ''} ORDER BY ts.name`
    )
    .all(...(project_id ? [project_id] : []));
}

function get(id) {
  const s = getDb()
    .prepare(
      `SELECT ts.*, u.full_name created_by_name FROM test_suites ts LEFT JOIN users u ON u.id = ts.created_by WHERE ts.id = ?`
    )
    .get(id);
  if (!s) throw notFound('Không tìm thấy Test Suite');
  const items = getDb()
    .prepare(
      `SELECT t.id, t.code, t.title, t.status, t.needs_review, s.code story_code FROM test_suite_items i
       JOIN test_cases t ON t.id = i.test_case_id JOIN user_stories s ON s.id = t.story_id
       WHERE i.suite_id = ? ORDER BY t.code`
    )
    .all(id);
  return { ...s, items };
}

function create(input, userId) {
  const d = suiteSchema.parse(input);
  if (!getDb().prepare('SELECT 1 FROM projects WHERE id = ?').get(d.project_id)) throw badRequest('Dự án không tồn tại');
  if (getDb().prepare('SELECT 1 FROM test_suites WHERE project_id = ? AND name = ?').get(d.project_id, d.name)) {
    throw conflict(`Dự án đã có suite tên "${d.name}" (QĐ13)`);
  }
  const id = getDb()
    .prepare('INSERT INTO test_suites (project_id, name, description, created_by) VALUES (?, ?, ?, ?)')
    .run(d.project_id, d.name, d.description, userId).lastInsertRowid;
  return get(Number(id));
}

function update(id, input) {
  const s = get(id);
  const d = suiteSchema.omit({ project_id: true }).parse({ name: s.name, description: s.description, ...input });
  if (getDb().prepare('SELECT 1 FROM test_suites WHERE project_id = ? AND name = ? AND id <> ?').get(s.project_id, d.name, id)) {
    throw conflict(`Dự án đã có suite tên "${d.name}" (QĐ13)`);
  }
  getDb().prepare('UPDATE test_suites SET name = ?, description = ? WHERE id = ?').run(d.name, d.description, id);
  return get(id);
}

function remove(id) {
  const s = get(id);
  getDb().prepare('DELETE FROM test_suites WHERE id = ?').run(id); // test_suite_items xóa theo (CASCADE), test giữ nguyên
  return s;
}

// Thêm, bớt test: test phải cùng dự án với suite
function setItems(id, { add = [], remove: rm = [] } = {}) {
  const s = get(id);
  const db = getDb();
  db.transaction(() => {
    for (const tcId of add) {
      const tc = db.prepare('SELECT t.code, s.project_id FROM test_cases t JOIN user_stories s ON s.id = t.story_id WHERE t.id = ?').get(tcId);
      if (!tc) throw notFound(`Không tìm thấy test case ${tcId}`);
      if (tc.project_id !== s.project_id) throw badRequest(`${tc.code} không cùng dự án với suite (QĐ13)`);
      db.prepare('INSERT OR IGNORE INTO test_suite_items (suite_id, test_case_id) VALUES (?, ?)').run(id, tcId);
    }
    for (const tcId of rm) db.prepare('DELETE FROM test_suite_items WHERE suite_id = ? AND test_case_id = ?').run(id, tcId);
  })();
  return get(id);
}

module.exports = { list, get, create, update, remove, setItems };
