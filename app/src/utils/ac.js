// Acceptance criteria (AC): mỗi dòng sau nhãn "Acceptance criteria" là một AC (QĐ1).
// QĐ3: AC được nhận diện theo NỘI DUNG từng dòng đã chuẩn hóa, không theo số thứ tự,
// nên đổi thứ tự AC không làm mất liên kết; sửa nội dung một dòng = bỏ AC cũ, thêm AC mới.

// Bỏ ký hiệu đầu dòng (-, *, •, "1.", "2)") và khoảng trắng thừa
function normalize(line) {
  return String(line || '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parse(text) {
  const seen = new Set();
  return String(text || '')
    .split(/\r?\n/)
    .map(normalize)
    .filter((l) => l && !seen.has(l) && seen.add(l));
}

// So hai danh sách AC: AC giữ nguyên, AC mới, AC bị bỏ (gồm cả AC bị sửa nội dung)
function diff(oldText, newText) {
  const before = parse(oldText);
  const after = parse(newText);
  return {
    kept: after.filter((a) => before.includes(a)),
    added: after.filter((a) => !before.includes(a)),
    removed: before.filter((b) => !after.includes(b)),
  };
}

module.exports = { normalize, parse, diff };
