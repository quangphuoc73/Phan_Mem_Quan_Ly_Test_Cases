// Quản lý bảng THAM SỐ (các quy định thay đổi được – YC10).
const { getDb } = require('../db');
const { badRequest, notFound } = require('../utils/errors');

// Giới hạn hợp lệ cho từng tham số, tránh người dùng nhập giá trị vô lý
const LIMITS = {
  MAX_TC_PER_STORY: [1, 50],
  AI_MAX_RETRY: [0, 5],
  AI_TIMEOUT_SEC: [5, 120],
  AI_CALLS_PER_HOUR: [1, 500],
  RUN_TIMEOUT_SEC: [10, 300],
  MIN_AC_PER_STORY: [1, 10],
  SPRINT_MAX_DAYS: [7, 42],
};

function getAll() {
  return getDb().prepare('SELECT * FROM parameters ORDER BY key').all();
}

function get(key) {
  const row = getDb().prepare('SELECT value, data_type FROM parameters WHERE key = ?').get(key);
  if (!row) throw notFound(`Không có tham số ${key}`);
  return row.data_type === 'int' ? Number(row.value) : row.value;
}

function update(key, value, userId) {
  const row = getDb().prepare('SELECT * FROM parameters WHERE key = ?').get(key);
  if (!row) throw notFound(`Không có tham số ${key}`);
  if (row.data_type === 'int') {
    const n = Number(value);
    const [min, max] = LIMITS[key] || [0, Number.MAX_SAFE_INTEGER];
    if (!Number.isInteger(n) || n < min || n > max) {
      throw badRequest(`Giá trị của ${key} phải là số nguyên từ ${min} đến ${max}`);
    }
    value = String(n);
  } else if (key === 'PRIORITIES') {
    const items = String(value).split(',').map((s) => s.trim()).filter(Boolean);
    if (!items.length) throw badRequest('Danh sách độ ưu tiên không được rỗng');
    value = items.join(',');
  }
  getDb()
    .prepare("UPDATE parameters SET value = ?, updated_by = ?, updated_at = datetime('now','localtime') WHERE key = ?")
    .run(String(value), userId, key);
  return { key, old: row.value, value: String(value) };
}

module.exports = { getAll, get, update };
