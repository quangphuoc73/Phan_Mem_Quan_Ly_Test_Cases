// Phát hiện dấu hiệu prompt injection trong dữ liệu người dùng.
// Đây chỉ là lớp cảnh báo. Lớp bảo vệ chính là: (1) prompt hệ thống tách
// biệt và coi user story là DỮ LIỆU, (2) kết quả bắt buộc qua kiểm tra schema.
const PATTERNS = [
  /ignore (all |the )?(previous|above|prior) (instructions|prompts?)/i,
  /disregard (all |the )?(previous|above) /i,
  /bỏ qua (tất cả |mọi )?(các )?(hướng dẫn|chỉ dẫn|yêu cầu) (trước|ở trên)/i,
  /you are now/i,
  /system prompt/i,
  /reveal (your|the) (prompt|instructions|api key)/i,
  /tiết lộ (prompt|api key|khóa)/i,
  /<\/?(system|user_story)>/i,
];

function detectInjection(text) {
  if (!text) return false;
  return PATTERNS.some((p) => p.test(text));
}

// Loại bỏ thẻ phân cách để dữ liệu người dùng không "thoát" khỏi khối <user_story>
function neutralize(text) {
  return String(text || '').replace(/<\/?\s*(system|user_story|instructions)\s*>/gi, '');
}

module.exports = { detectInjection, neutralize };
