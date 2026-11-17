// UT-24 → UT-33: quy tắc nghiệp vụ mới theo đặc tả chốt – nhận diện AC (QĐ3), schema đề xuất AI (QĐ15, QĐ17),
// AI giả lập phân tích ảnh hưởng, prompt, chuyển dữ liệu Jira (QĐ1, QĐ8), trạng thái đồng bộ (BM1)
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const ac = require('../../src/utils/ac');
const S = require('../../src/services/ai/schemas');
const MockProvider = require('../../src/services/ai/providers/MockProvider');
const { buildImpactPrompt } = require('../../src/services/ai/promptBuilder');
const jira = require('../../src/services/jiraService');
const { syncState } = require('../../src/services/storyService');

const mock = async (task, context) => JSON.parse(await new MockProvider().complete({ task, context }));

test('UT-24 QĐ3: AC chuẩn hóa theo nội dung dòng – bỏ ký hiệu đầu dòng, khoảng trắng thừa, dòng trùng', () => {
  assert.equal(ac.normalize('  -   Bắt buộc   chọn thú cưng '), 'Bắt buộc chọn thú cưng');
  assert.deepEqual(ac.parse('1. A\n2) B\n• C\n- A\n\n'), ['A', 'B', 'C']);
});

test('UT-25 QĐ3: so AC hai phiên bản – đổi thứ tự không coi là đổi; sửa nội dung = bỏ AC cũ, thêm AC mới', () => {
  assert.deepEqual(ac.diff('- A\n- B', '- B\n- A'), { kept: ['B', 'A'], added: [], removed: [] });
  assert.deepEqual(ac.diff('- A\n- B', '- A\n- B mới\n- C'), { kept: ['A'], added: ['B mới', 'C'], removed: ['B'] });
});

test('UT-26 QĐ2: test do AI sinh bắt buộc có ac_refs (ít nhất 1 AC)', () => {
  const base = { title: 'Kiểm tra abc', steps: ['a'], expected_result: 'ok', priority: 'High', type: 'Positive' };
  assert.equal(S.aiTestCaseSchema.safeParse({ ...base, ac_refs: [1] }).success, true);
  assert.equal(S.aiTestCaseSchema.safeParse({ ...base, ac_refs: [] }).success, false);
  assert.equal(S.aiTestCaseSchema.safeParse(base).success, false);
});

test('UT-27 QĐ15 [R2]: schema đề xuất – Cần sửa/Nên chạy lại phải có test; Cần sửa/Còn thiếu phải có nội dung test; nguồn AC phải ghi rõ AC', () => {
  const tc = { title: 'Kiểm tra abc', steps: ['a'], expected_result: 'ok', priority: 'High', type: 'Positive' };
  const ok = (p) => S.impactResultSchema.safeParse({ proposals: [p] }).success;
  assert.equal(ok({ type: 'UPDATE', test_code: 'X-TC01', source_part: 'AC', source_ac: 'A', reason: 'AC đã đổi', test_case: tc }), true);
  assert.equal(ok({ type: 'UPDATE', source_part: 'AC', source_ac: 'A', reason: 'AC đã đổi', test_case: tc }), false);
  assert.equal(ok({ type: 'MISSING', source_part: 'AC', source_ac: 'A', reason: 'AC mới chưa có test' }), false);
  assert.equal(ok({ type: 'RERUN', test_code: 'X-TC01', source_part: 'AC', reason: 'Nên chạy lại' }), false);
  assert.equal(ok({ type: 'RERUN', test_code: 'X-TC01', source_part: 'DESCRIPTION', reason: 'Mô tả đã đổi' }), true);
  assert.equal(ok({ type: 'CLARIFY', source_part: 'TITLE', reason: 'Tiêu đề mơ hồ' }), true);
  assert.equal(ok({ type: 'CLARIFY', source_part: 'TITLE', reason: 'x' }), false); // lý do quá ngắn
});

test('UT-28 YC15: AI giả lập – AC sửa → Cần sửa; AC bỏ không thay thế → Cần làm rõ; AC mới chưa có test → Còn thiếu; mô tả đổi → Nên chạy lại', async () => {
  const before = { version: 1, title: 'T', description: 'D', acs: ['A', 'B', 'C'] };
  const after = { version: 2, title: 'T', description: 'D mới', acs: ['A sửa', 'C', 'E'] };
  const t = (code, acs, removed) => ({ code, title: code, steps: ['x'], expected_result: 'y', priority: 'High', type: 'Positive', req_version: 1, acs,
    since: { removed, added: ['A sửa', 'E'], content: true } });
  const r = await mock('ANALYZE_IMPACT', { before, after, tests: [t('T1', ['A'], ['A', 'B']), t('T2', ['B'], ['A', 'B']), t('T3', ['C'], ['A', 'B'])] });
  const of = (code) => r.proposals.filter((p) => p.test_code === code).map((p) => p.type);
  assert.deepEqual(of('T1'), ['UPDATE']);
  assert.deepEqual(of('T2'), ['CLARIFY']);
  assert.deepEqual(of('T3'), ['RERUN']);
  assert.deepEqual(r.proposals.filter((p) => p.type === 'MISSING').map((p) => p.source_ac), ['E']);
  assert.equal(S.impactResultSchema.safeParse(r).success, true);
});

test('UT-29 YC17: AI giả lập xếp ưu tiên – test liên kết AC đã đổi là HIGH; gợi ý tối đa 2 test ưu tiên cao', async () => {
  const r = await mock('RANK_REGRESSION', {
    mandatory: [{ code: 'T1', priority: 'Low', changed_acs: ['A'] }, { code: 'T2', priority: 'High', changed_acs: [] }],
    candidates: ['C1', 'C2', 'C3'].map((code) => ({ code, priority: 'High' })),
  });
  assert.deepEqual(r.items.map((i) => [i.test_code, i.priority]), [['T1', 'HIGH'], ['T2', 'MEDIUM']]);
  assert.equal(r.suggestions.length, 2);
  assert.equal(S.regressionResultSchema.safeParse(r).success, true);
});

test('UT-30 QĐ15: prompt phân tích ảnh hưởng bọc dữ liệu trong thẻ, yêu cầu chỉ xét thay đổi sau phiên bản test đã liên kết', () => {
  const v = (version) => ({ version, title: 'T', description: 'D', acs: ['A'] });
  const p = buildImpactPrompt({ before: v(1), after: v(2), tests: [{ code: 'X-TC01', title: 'T', steps: ['s'], expected_result: 'e', req_version: 1, acs: ['A'], since: { removed: [], added: [], content: false } }] });
  assert.match(p.system, /CHỈ xét các thay đổi xảy ra sau phiên bản mà test đó đã liên kết/);
  assert.match(p.user, /^<requirement>[\s\S]*<\/requirement>\n<tests>[\s\S]*<\/tests>$/);
  assert.match(p.user, /X-TC01 \(liên kết phiên bản 1\)/);
});

test('UT-31 QĐ8 [1.2]: thời điểm cập nhật Jira dạng +0700 đổi về ISO UTC để so sánh được', () => {
  assert.equal(jira.toIso('2026-11-10T10:00:00.000+0700'), '2026-11-10T03:00:00.000Z');
  assert.equal(jira.toIso('2026-11-10T03:00:00.000Z'), '2026-11-10T03:00:00.000Z');
  assert.equal(jira.toIso('không phải ngày'), null);
  assert.ok(jira.toIso('2026-11-10T10:00:00.000+0700') < jira.toIso('2026-11-10T10:30:00.000+0700'));
});

test('UT-32 QĐ1: tách Description theo nhãn "Acceptance criteria"; AC được chuẩn hóa; không có nhãn thì không có AC', () => {
  const r = jira.splitDescription('Là bạn đọc, tôi muốn mượn sách.\nAcceptance criteria:\n1.  Mượn tối đa 5 cuốn\n* Quá hạn thì bị khóa');
  assert.equal(r.description, 'Là bạn đọc, tôi muốn mượn sách.');
  assert.equal(r.criteria, 'Mượn tối đa 5 cuốn\nQuá hạn thì bị khóa');
  assert.equal(jira.splitDescription('Chỉ có mô tả').criteria, '');
  assert.deepEqual(['Highest', 'High', 'Medium', 'Low', 'Lowest', undefined].map(jira.mapPriority), ['High', 'High', 'Medium', 'Low', 'Low', 'Medium']);
});

test('UT-33 BM1: trạng thái đồng bộ suy ra từ dữ liệu – Đã lưu trữ, Cần kiểm tra, Thiếu AC, Bình thường', () => {
  assert.equal(syncState({ archived: 1, check_reason: 'NOT_FOUND', acceptance_criteria: 'A' }), 'ARCHIVED');
  assert.equal(syncState({ archived: 0, check_reason: 'NOT_FOUND', acceptance_criteria: 'A' }), 'NEEDS_CHECK');
  assert.equal(syncState({ archived: 0, check_reason: null, acceptance_criteria: '' }), 'MISSING_AC');
  assert.equal(syncState({ archived: 0, check_reason: null, acceptance_criteria: '- A' }), 'NORMAL');
});
