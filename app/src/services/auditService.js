// Nhật ký hoạt động: ai làm gì, trên đối tượng nào, lúc nào.
const { getDb } = require('../db');

function log(req, action, entity, entityId, detail) {
  getDb()
    .prepare('INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, ip) VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      req.user?.id ?? null,
      action,
      entity ?? null,
      entityId ?? null,
      detail ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : null,
      req.ip ?? null
    );
}

module.exports = { log };
