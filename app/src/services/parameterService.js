// YC10 – QĐ10: bảng THAM SỐ (các quy định thay đổi được).
// Độ ưu tiên (High, Medium, Low) và nhãn "Acceptance criteria" là cố định, không nằm trong bảng này.
const { getDb } = require('../db');
const config = require('../config');
const { badRequest, notFound } = require('../utils/errors');

const PRIORITIES = ['High', 'Medium', 'Low'];

// Miền giá trị hợp lệ (BM9)
const LIMITS = {
  MAX_TC_PER_STORY: [1, 50],
  MIN_AC_PER_STORY: [1, 10],
  AI_MAX_RETRY: [0, 5],
  AI_TIMEOUT_SEC: [5, 120],
  AI_CALLS_PER_HOUR: [1, 500],
  RUN_TIMEOUT_SEC: [10, 300],
  SPRINT_MAX_DAYS: [7, 42],
};

// Tham số của phần ngoài MVP chỉ hiện khi bật cờ tương ứng
const FEATURE_OF = { RUN_TIMEOUT_SEC: 'script', SPRINT_MAX_DAYS: 'sprint' };
const visible = (key) => !FEATURE_OF[key] || config.features[FEATURE_OF[key]];

function getAll() {
  return getDb()
    .prepare('SELECT * FROM parameters ORDER BY key')
    .all()
    .filter((p) => visible(p.key) && p.key !== 'PRIORITIES')
    .map((p) => ({ ...p, min: LIMITS[p.key]?.[0], max: LIMITS[p.key]?.[1] }));
}

function get(key) {
  const row = getDb().prepare('SELECT value, data_type FROM parameters WHERE key = ?').get(key);
  if (!row) throw notFound(`Không có tham số ${key}`);
  return row.data_type === 'int' ? Number(row.value) : row.value;
}

function update(key, value, userId) {
  const row = getDb().prepare('SELECT * FROM parameters WHERE key = ?').get(key);
  if (!row || !LIMITS[key] || !visible(key)) throw notFound(`Không có tham số ${key}`);
  const n = Number(value);
  const [min, max] = LIMITS[key];
  if (!Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`Giá trị của ${key} phải là số nguyên từ ${min} đến ${max} (QĐ10)`);
  }
  getDb()
    .prepare("UPDATE parameters SET value = ?, updated_by = ?, updated_at = datetime('now','localtime') WHERE key = ?")
    .run(String(n), userId, key);
  return { key, old: row.value, value: String(n) };
}

module.exports = { getAll, get, update, PRIORITIES, LIMITS };
