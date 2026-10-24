// UT-13 → UT-20: MockProvider, prompt, schema kết quả AI
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
