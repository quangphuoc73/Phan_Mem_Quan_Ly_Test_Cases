// UT-13 → UT-23: MockProvider, prompt, schema kết quả AI
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const MockProvider = require('../../src/services/ai/providers/MockProvider');
const { parseCriteria } = MockProvider;
const { generateResultSchema, testCaseSchema } = require('../../src/services/ai/schemas');
const { buildTestCasePrompt } = require('../../src/services/ai/promptBuilder');
const { stripFences } = require('../../src/services/ai/providers/LLMProvider');

const story = {
  code: 'US-X-1',
  title: 'Gửi yêu cầu bồi thường',
  description: 'Là chủ thú cưng...',
  acceptance_criteria: '- Tải lên hóa đơn tối đa 10 MB\n- Bắt buộc chọn thú cưng\n- Gửi thành công thì hiển thị mã',
};

async function gen(maxTestCases) {
  const raw = await new MockProvider().complete({ task: 'GENERATE_TESTCASE', context: { story, maxTestCases } });
  return generateResultSchema.parse(JSON.parse(raw)).test_cases;
}

test('UT-13 tách acceptance criteria theo dòng, bỏ ký hiệu đầu dòng', () => {
  assert.deepEqual(parseCriteria('- a\n* b\n1. c\n\n  '), ['a', 'b', 'c']);
});

test('UT-14 MockProvider trả kết quả đúng schema', async () => {
  const tcs = await gen(20);
  assert.ok(tcs.length >= 3);
});

test('UT-15 mỗi acceptance criterion có ít nhất 1 case Positive', async () => {
  const tcs = await gen(20);
  parseCriteria(story.acceptance_criteria).forEach((ac) =>
    assert.ok(tcs.some((t) => t.type === 'Positive' && t.title.toLowerCase().includes(ac.toLowerCase().slice(0, 15)))));
});

test('UT-16 có sinh case Negative và Edge (giá trị biên 10 MB)', async () => {
  const tcs = await gen(20);
  assert.ok(tcs.some((t) => t.type === 'Negative'));
  assert.ok(tcs.some((t) => t.type === 'Edge' && t.title.includes('10 MB')));
});

test('UT-17 tuân thủ QĐ2: không vượt số test case tối đa', async () => {
  assert.equal((await gen(2)).length, 2);
});

test('UT-18 prompt chứa quy định số lượng và bọc dữ liệu trong <user_story>', () => {
  const p = buildTestCasePrompt({ story, maxTestCases: 5 });
  assert.match(p.system, /TỐI ĐA 5 test case/);
  assert.match(p.user, /^<user_story>[\s\S]*<\/user_story>$/);
});

test('UT-19 schema từ chối priority không hợp lệ và steps rỗng', () => {
  const base = { title: 'Kiểm tra abc', steps: ['a'], expected_result: 'ok', priority: 'High', type: 'Positive' };
  assert.equal(testCaseSchema.safeParse(base).success, true);
  assert.equal(testCaseSchema.safeParse({ ...base, priority: 'Urgent' }).success, false);
  assert.equal(testCaseSchema.safeParse({ ...base, steps: [] }).success, false);
});

test('UT-20 bỏ code fence ```json khi model bọc kết quả', () => {
  assert.equal(stripFences('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(stripFences('{"a":1}'), '{"a":1}');
});

test('UT-21 sinh script Playwright có locator data-test từ các bước', async () => {
  const testCase = {
    code: 'TC1',
    title: 'Đăng nhập',
    steps: ['Mở trang đăng nhập', 'Nhập tên đăng nhập "standard_user"', 'Nhập mật khẩu "secret_sauce"', 'Nhấn nút Login'],
    expected_result: 'Chuyển tới trang Products',
  };
  const raw = await new MockProvider().complete({ task: 'GENERATE_SCRIPT', context: { testCase, baseUrl: 'https://www.saucedemo.com/' } });
  const { code } = JSON.parse(raw);
  assert.match(code, /require\('@playwright\/test'\)/);
  assert.match(code, /page\.goto\("https:\/\/www\.saucedemo\.com\/"\)/);
  assert.match(code, /\[data-test="username"\]'\)\.fill\("standard_user"\)/);
  assert.match(code, /toHaveURL\(\/inventory\/\)/);
});

const genScript = async (testCase, baseUrl) =>
  JSON.parse(await new MockProvider().complete({ task: 'GENERATE_SCRIPT', context: { testCase, baseUrl } })).code;

test('UT-22 script luôn mở URL cần test trước tiên dù bước test case viết chung chung', async () => {
  const code = await genScript({
    code: 'TC2', title: 'Xem báo cáo',
    steps: ['Đăng nhập hệ thống bằng tài khoản hợp lệ', 'Mở chức năng "Báo cáo"', 'Xác nhận thao tác'],
    expected_result: 'Hiển thị báo cáo',
  }, 'https://app.example.test/');
  const first = code.split('\n').find((l) => l.trim().startsWith('await'));
  assert.equal(first.trim(), 'await page.goto("https://app.example.test/");');
  assert.doesNotMatch(code, /TODO: bổ sung thao tác/);
});

test('UT-23 Sauce Demo: tiêu chí đăng xuất sinh thao tác menu Logout và kiểm tra về trang đăng nhập', async () => {
  const code = await genScript({
    code: 'TC3', title: 'Đăng xuất',
    steps: ['Đăng nhập hệ thống bằng tài khoản hợp lệ', 'Mở chức năng "Đăng xuất"',
      'Nhập dữ liệu hợp lệ theo tiêu chí: Mở menu bên trái và chọn Logout thì quay về trang đăng nhập', 'Xác nhận thao tác'],
    expected_result: 'Hệ thống xử lý thành công, đáp ứng tiêu chí: Mở menu bên trái và chọn Logout thì quay về trang đăng nhập',
  }, 'https://www.saucedemo.com/');
  assert.match(code, /\[data-test="login-button"\]'\)\.click\(\)/);
  assert.match(code, /#react-burger-menu-btn/);
  assert.match(code, /logout-sidebar-link/);
  assert.match(code, /login-button"\]'\)\)\.toBeVisible\(\)/);
  assert.doesNotMatch(code, /TODO/);
});
