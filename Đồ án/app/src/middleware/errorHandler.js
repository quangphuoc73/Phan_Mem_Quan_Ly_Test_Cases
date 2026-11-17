const { ZodError } = require('zod');

// Trả lỗi thân thiện; không lộ stack trace hay chi tiết nội bộ ra ngoài.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({
      error: `Dữ liệu không hợp lệ: ${first.path.join('.') || 'body'} – ${first.message}`,
      issues: err.issues,
    });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON không hợp lệ' });
  if (err.status) return res.status(err.status).json({ error: err.message, details: err.details });
  if (String(err.message).includes('UNIQUE constraint failed')) {
    return res.status(409).json({ error: 'Dữ liệu bị trùng (mã đã tồn tại)' });
  }
  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại sau' });
}

module.exports = { errorHandler };
