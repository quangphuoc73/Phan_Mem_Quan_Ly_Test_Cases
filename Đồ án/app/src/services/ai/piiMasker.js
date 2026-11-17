// Che dữ liệu nhạy cảm (PII) TRƯỚC khi gửi lên LLM bên ngoài.
// Thứ tự quan trọng: số thẻ (16 số) và CCCD (12 số) phải che trước số điện thoại.
const RULES = [
  { type: 'EMAIL', regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { type: 'CARD', regex: /\b(?:\d[ -]?){15}\d\b/g },
  { type: 'ID', regex: /\b\d{12}\b/g },
  { type: 'PHONE', regex: /(?:\+84|\b0)(?:[\s.-]?\d){9}\b/g },
];

function maskPII(text) {
  if (!text) return { masked: text || '', found: {} };
  const found = {};
  let masked = String(text);
  for (const { type, regex } of RULES) {
    masked = masked.replace(regex, () => {
      found[type] = (found[type] || 0) + 1;
      return `[${type}]`;
    });
  }
  return { masked, found };
}

module.exports = { maskPII };
