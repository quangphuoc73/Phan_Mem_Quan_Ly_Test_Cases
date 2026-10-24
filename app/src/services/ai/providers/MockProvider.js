// MockProvider: "AI giả lập" chạy hoàn toàn offline, không cần API key.
// Dùng khi phát triển, khi chạy test tự động (CI) và làm phương án dự phòng
// lúc demo (mất mạng / hết quota API). Kết quả sinh theo luật từ acceptance
// criteria nên luôn ổn định và tuân thủ quy định QĐ2.
const { LLMProvider } = require('./LLMProvider');

const NEGATIVE_HINT = /(không|bắt buộc|tối đa|tối thiểu|\bsai\b|hết hạn|chỉ |phải|vượt|bị khóa|đúng định dạng)/i;
const BOUNDARY = /(\d+(?:[.,]\d+)?)\s*(MB|KB|GB|ký tự|kí tự|ngày|lần|%|tuổi|giây|phút|test case|ảnh|file)/i;

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function parseCriteria(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

function generateTestCases({ story, maxTestCases }) {
  const acs = parseCriteria(story.acceptance_criteria);
  const feature = story.title;
  const baseSteps = [`Đăng nhập hệ thống bằng tài khoản hợp lệ`, `Mở chức năng "${feature}"`];
  const positives = [];
  const negatives = [];
  const edges = [];

  acs.forEach((ac, i) => {
    positives.push({
      title: `Kiểm tra ${lowerFirst(ac)}`.slice(0, 200),
      precondition: 'Người dùng có tài khoản hợp lệ và đủ quyền thao tác',
      steps: [...baseSteps, `Nhập dữ liệu hợp lệ theo tiêu chí: ${ac}`, 'Xác nhận thao tác'],
      expected_result: `Hệ thống xử lý thành công, đáp ứng tiêu chí: ${ac}`,
      priority: i === 0 ? 'High' : 'Medium',
      type: 'Positive',
    });

    if (NEGATIVE_HINT.test(ac)) {
      negatives.push({
        title: `Kiểm tra trường hợp vi phạm: ${lowerFirst(ac)}`.slice(0, 200),
        precondition: 'Người dùng có tài khoản hợp lệ',
        steps: [...baseSteps, `Nhập dữ liệu vi phạm điều kiện: ${ac}`, 'Xác nhận thao tác'],
        expected_result: 'Hệ thống chặn thao tác và hiển thị thông báo lỗi rõ ràng, dữ liệu không bị lưu',
        priority: /(bắt buộc|hết hạn|chỉ )/i.test(ac) ? 'High' : 'Medium',
        type: 'Negative',
      });
    }

    const m = ac.match(BOUNDARY);
    if (m) {
      const [, num, unit] = m;
      edges.push({
        title: `Kiểm tra giá trị biên ${num} ${unit} (${lowerFirst(ac)})`.slice(0, 200),
        precondition: 'Chuẩn bị dữ liệu có giá trị đúng bằng và vượt ngưỡng',
        steps: [
          ...baseSteps,
          `Nhập dữ liệu có giá trị đúng bằng ${num} ${unit}`,
          'Xác nhận thao tác và ghi nhận kết quả',
          `Lặp lại với giá trị vượt ${num} ${unit} một đơn vị`,
        ],
        expected_result: `Giá trị đúng bằng ${num} ${unit} được chấp nhận; giá trị vượt ngưỡng bị từ chối kèm thông báo`,
        priority: 'Medium',
        type: 'Edge',
      });
    }
  });

  // Ưu tiên bao phủ: mọi tiêu chí có ít nhất 1 case Positive trước khi cắt theo QĐ2
  return { test_cases: [...positives, ...negatives, ...edges].slice(0, maxTestCases) };
}

// ---- Sinh script Playwright từ các bước test case (luật đơn giản) ----
function quoted(text) {
  const m = String(text).match(/["“'‘]([^"”'’]*)["”'’]/);
  return m ? m[1] : null;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function stepToCode(step, baseUrl) {
  const q = quoted(step);
  const s = step.toLowerCase();
  const lit = (v) => JSON.stringify(v ?? '');
  if (/(mở|truy cập|vào) (trang|website|ứng dụng)/.test(s)) return `await page.goto(${lit(baseUrl)});`;
  if (/(tên đăng nhập|username)/.test(s))
    return `await page.locator('[data-test="username"]').fill(${lit(/để trống/.test(s) ? '' : q)});`;
  if (/(mật khẩu|password)/.test(s))
    return `await page.locator('[data-test="password"]').fill(${lit(/để trống/.test(s) ? '' : q)});`;
  if (/(nhấn|bấm|click).*(đăng nhập|login)/.test(s)) return `await page.locator('[data-test="login-button"]').click();`;
  if (/(thêm|add).*(giỏ|cart)/.test(s) && q) return `await page.locator('[data-test="add-to-cart-${slug(q)}"]').click();`;
  if (/(mở|nhấn|bấm|vào).*(giỏ hàng|cart)/.test(s)) return `await page.locator('[data-test="shopping-cart-link"]').click();`;
  if (/(nhấn|bấm).*(checkout|thanh toán)/.test(s)) return `await page.locator('[data-test="checkout"]').click();`;
  return `// TODO: bổ sung thao tác cho bước này`;
}

function expectedToCode(expected) {
  const s = expected.toLowerCase();
  const q = quoted(expected);
  const lines = [];
  if (/(products|sản phẩm|inventory)/.test(s) && !/lỗi/.test(s)) {
    lines.push(`await expect(page).toHaveURL(/inventory/);`);
    lines.push(`await expect(page.locator('[data-test="title"]')).toHaveText('Products');`);
  }
  if (/lỗi/.test(s)) {
    lines.push(`await expect(page.locator('[data-test="error"]')).toBeVisible();`);
    if (q) lines.push(`await expect(page.locator('[data-test="error"]')).toContainText(${JSON.stringify(q)});`);
  }
  const cart = s.match(/giỏ hàng[^\d]*(\d+)/);
  if (cart) lines.push(`await expect(page.locator('[data-test="shopping-cart-badge"]')).toHaveText('${cart[1]}');`);
  if (!lines.length) lines.push(`await expect(page).toHaveTitle(/.+/); // TODO: kiểm tra cụ thể hơn`);
  return lines;
}

function generateScript({ testCase, baseUrl }) {
  const name = `${testCase.code} - ${testCase.title}`;
  const body = [];
  testCase.steps.forEach((step, i) => {
    body.push(`  // Bước ${i + 1}: ${step}`);
    body.push(`  ${stepToCode(step, baseUrl)}`);
  });
  body.push(`  // Kết quả mong đợi: ${testCase.expected_result}`);
  expectedToCode(testCase.expected_result).forEach((l) => body.push(`  ${l}`));

  const code = [
    `// Script Playwright do AI sinh từ test case ${testCase.code}.`,
    `// Tester cần xem lại trước khi chạy.`,
    `const { test, expect } = require('@playwright/test');`,
    ``,
    `test(${JSON.stringify(name)}, async ({ page }) => {`,
    ...body,
    `});`,
    ``,
  ].join('\n');
  return { code };
}

class MockProvider extends LLMProvider {
  constructor({ delayMs = 0 } = {}) {
    super({ name: 'mock', model: 'rule-based-v1' });
    this.delayMs = delayMs;
  }

  async complete({ task, context }) {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    const result = task === 'GENERATE_SCRIPT' ? generateScript(context) : generateTestCases(context);
    return JSON.stringify(result);
  }
}

module.exports = MockProvider;
module.exports.parseCriteria = parseCriteria;
