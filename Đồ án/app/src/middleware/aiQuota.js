// Giới hạn số lần gọi AI của mỗi người dùng trong 1 giờ (tham số AI_CALLS_PER_HOUR),
// tránh bị lạm dụng làm tốn chi phí API.
const { getDb } = require('../db');
const params = require('../services/parameterService');
const { AppError } = require('../utils/errors');

function aiQuota(req, _res, next) {
  const limit = params.get('AI_CALLS_PER_HOUR');
  const { n } = getDb()
    .prepare("SELECT COUNT(*) n FROM ai_logs WHERE user_id = ? AND created_at >= datetime('now','localtime','-1 hour')")
    .get(req.user.id);
  if (n >= limit) {
    return next(new AppError(429, `Bạn đã dùng hết ${limit} lượt gọi AI trong 1 giờ. Vui lòng thử lại sau.`));
  }
  next();
}

module.exports = { aiQuota };
