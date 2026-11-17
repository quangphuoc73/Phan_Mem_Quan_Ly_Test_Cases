// Interface chung cho mọi nhà cung cấp LLM (Strategy pattern).
// Muốn đổi model chỉ cần thêm 1 lớp con và đăng ký trong providers/index.js,
// phần còn lại của hệ thống không phải sửa.
class LLMProvider {
  constructor({ name, model }) {
    this.name = name;
    this.model = model;
  }

  /**
   * @param {object} req
   * @param {string} req.system   prompt hệ thống
   * @param {string} req.user     dữ liệu người dùng (đã che PII)
   * @param {object} req.jsonSchema schema kết quả mong muốn
   * @param {string} req.task     GENERATE_TESTCASE | GENERATE_SCRIPT
   * @param {object} req.context  dữ liệu có cấu trúc (chỉ MockProvider dùng)
   * @param {number} req.timeoutMs
   * @returns {Promise<string>} chuỗi JSON thô do model trả về
   */
  // eslint-disable-next-line no-unused-vars
  async complete(req) {
    throw new Error('complete() chưa được hiện thực');
  }
}

// Bỏ ```json ... ``` nếu model bọc kết quả trong code fence
function stripFences(text) {
  const m = String(text || '').trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : String(text || '').trim();
}

async function postJson(url, { headers, body, timeoutMs }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LLM API lỗi HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

module.exports = { LLMProvider, stripFences, postJson };
