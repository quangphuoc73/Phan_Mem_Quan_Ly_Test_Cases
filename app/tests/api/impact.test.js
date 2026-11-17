// IT-65 → IT-77: YC15 AI phân tích ảnh hưởng, YC16 rà soát và áp dụng đề xuất, YC17 AI đề xuất bộ regression (QĐ15, QĐ16, QĐ17)
const test = require('node:test');
const assert = require('node:assert/strict');
const { as, createStory, approvedTest, changeRequirement, getDb, UID } = require('../helpers');
const ai = require('../../src/services/ai/aiService');
const MockProvider = require('../../src/services/ai/providers/MockProvider');

const tcRow = (id) => getDb().prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
const analyze = async (story) => (await as('qalead')).post(`/api/stories/${story.id}/analyze`);
const byTest = (proposals, id) => proposals.filter((p) => p.test_case_id === id);

// Kịch bản A: AC1 đổi 10 MB → 15 MB (có AC thay thế), thêm AC mới; test A2, A3 liên kết AC không đổi
const A = {};
test('IT-65 QĐ15: chỉ phân tích khi requirement có ít nhất 2 phiên bản; requirement đã lưu trữ thì không phân tích', async () => {
  A.story = createStory();
  const [ac1, ac2, ac3] = A.story.acs;
  A.t1 = approvedTest(A.story, { acs: [ac1], title: 'Tải hóa đơn 10 MB' });
  A.t2 = approvedTest(A.story, { acs: [ac2], title: 'Bắt buộc chọn thú cưng' });
  A.t3 = approvedTest(A.story, { acs: [ac3], title: 'Hiển thị mã yêu cầu' });
  const one = await analyze(A.story);
  assert.equal(one.status, 409);
  assert.match(one.body.error, /ít nhất 2 phiên bản/);
  const archived = createStory();
  changeRequirement(archived, { title: 'Đổi tiêu đề' });
  getDb().prepare('UPDATE user_stories SET archived = 1 WHERE id = ?').run(archived.id);
  assert.equal((await analyze(archived)).status, 409);
});

test('IT-66 YC15 – QĐ15: AI đề xuất Cần sửa cho test liên kết AC đã đổi và Còn thiếu cho AC mới; mỗi đề xuất có loại, lý do, phần thay đổi nguồn; không tự đổi test', async () => {
  A.ac1New = 'Tải lên hóa đơn tối đa 15 MB';
  A.ac4 = 'Hủy được yêu cầu khi chưa được duyệt';
  changeRequirement(A.story, {
    acceptance_criteria: `${A.story.acceptance_criteria.replace('Tải lên hóa đơn tối đa 10 MB', A.ac1New)}\n- ${A.ac4}`,
  });
  const res = await analyze(A.story);
  assert.equal(res.status, 200);
  const { analysis } = res.body;
  assert.equal(analysis.from_version, 1);
  assert.equal(analysis.to_version, 2);
  const ps = analysis.proposals;
  assert.ok(ps.every((p) => p.reason && p.source_part && p.status === 'PENDING'));
  const upd = byTest(ps, A.t1.id);
  assert.equal(upd.length, 1);
  assert.equal(upd[0].type, 'UPDATE');
  assert.equal(upd[0].source_ac, A.ac1New);
  assert.ok(upd[0].content.steps.length >= 1);
  const missing = ps.filter((p) => p.type === 'MISSING');
  assert.deepEqual(missing.map((p) => p.source_ac), [A.ac4]);
  assert.equal(byTest(ps, A.t2.id).length + byTest(ps, A.t3.id).length, 0, 'test không bị ảnh hưởng thì không có đề xuất');
  assert.equal(tcRow(A.t1.id).version, A.t1.version, 'phân tích không tự đổi test');
  assert.equal(tcRow(A.t1.id).status, 'APPROVED');
  assert.equal(getDb().prepare('SELECT task FROM ai_logs WHERE id = ?').get(analysis.ai_log_id).task, 'ANALYZE_IMPACT');
  A.update = upd[0];
  A.missing = missing[0];
});

test('IT-67 YC16 – QĐ16: Tester xem được đề xuất (trước/sau) nhưng không quyết định; từ chối bắt buộc ghi chú', async () => {
  const tester = await as('tester');
  const qa = await as('qalead');
  const list = (await tester.get(`/api/proposals?story_id=${A.story.id}`)).body;
  const upd = list.find((p) => p.id === A.update.id);
  assert.equal(upd.before.title, 'Tải hóa đơn 10 MB');
  assert.ok(upd.content.title);
  assert.equal((await tester.post(`/api/proposals/${A.missing.id}/decision`).send({ decision: 'REJECT', note: 'x' })).status, 403);
  assert.equal((await qa.post(`/api/proposals/${A.missing.id}/decision`).send({ decision: 'REJECT' })).status, 400);
  const rej = (await qa.post(`/api/proposals/${A.missing.id}/decision`).send({ decision: 'REJECT', note: 'Để sprint sau' })).body;
  assert.equal(rej.status, 'REJECTED');
  assert.equal(rej.decided_by, UID.qalead);
  assert.equal((await qa.post(`/api/proposals/${A.missing.id}/decision`).send({ decision: 'ACCEPT' })).status, 409);
});

test('IT-68 QĐ16 [R4] [R5]: chấp nhận Cần sửa → test về Nháp theo nội dung đề xuất, ghi mã đề xuất, phải duyệt lại (YC4) rồi mới gỡ cờ', async () => {
  const qa = await as('qalead');
  assert.equal(tcRow(A.t1.id).needs_review, 1);
  const acc = (await qa.post(`/api/proposals/${A.update.id}/decision`).send({ decision: 'ACCEPT' })).body;
  assert.equal(acc.status, 'ACCEPTED');
  assert.equal(acc.result_test_case_id, A.t1.id);
  const t = tcRow(A.t1.id);
  assert.equal(t.status, 'DRAFT');
  assert.equal(t.proposal_id, A.update.id);
  assert.equal(t.expected_result, A.update.content.expected_result);
  assert.equal(t.needs_review, 1);
  await (await as('tester')).post('/api/testcases/submit').send({ ids: [A.t1.id] });
  await qa.post(`/api/testcases/${A.t1.id}/review`).send({ decision: 'APPROVED' });
  assert.equal(tcRow(A.t1.id).needs_review, 0);
  assert.equal(tcRow(A.t1.id).req_version, 2);
  const linked = getDb().prepare('SELECT ac_text FROM test_case_acs WHERE test_case_id = ?').all(A.t1.id).map((r) => r.ac_text);
  assert.deepEqual(linked, [A.ac1New]);
});

test('IT-69 QĐ16 + QĐ2: chấp nhận Còn thiếu → test nháp mới nguồn AI liên kết AC nguồn, trong giới hạn số test tối đa', async () => {
  const qa = await as('qalead');
  const again = (await analyze(A.story)).body.analysis.proposals;
  const missing = again.find((p) => p.type === 'MISSING');
  assert.equal(missing.source_ac, A.ac4);
  assert.ok(!again.some((p) => p.type === 'MISSING' && p.source_ac === A.ac1New), 'AC đã có test liên kết thì không còn thiếu');
  const count = getDb().prepare('SELECT COUNT(*) n FROM test_cases WHERE story_id = ?').get(A.story.id).n;
  await qa.put('/api/parameters/MAX_TC_PER_STORY').send({ value: count });
  assert.equal((await qa.post(`/api/proposals/${missing.id}/decision`).send({ decision: 'ACCEPT' })).status, 409);
  await qa.put('/api/parameters/MAX_TC_PER_STORY').send({ value: 20 });
  const acc = (await qa.post(`/api/proposals/${missing.id}/decision`).send({ decision: 'ACCEPT' })).body;
  const created = tcRow(acc.result_test_case_id);
  assert.equal(created.status, 'DRAFT');
  assert.equal(created.source, 'AI');
  assert.equal(created.proposal_id, missing.id);
  assert.deepEqual(getDb().prepare('SELECT ac_text FROM test_case_acs WHERE test_case_id = ?').all(created.id).map((r) => r.ac_text), [A.ac4]);
});

// Kịch bản B: v1 → v2 (AC B1 sửa, AC B3 bị bỏ) → v3 (đổi tiêu đề); test B4 viết ở v2
const B = {};
test('IT-70 QĐ15 [A5]: mốc so là phiên bản cũ nhất mà các test đã liên kết; với từng test chỉ xét thay đổi sau phiên bản test đó liên kết', async () => {
  B.story = createStory({ acceptance_criteria: '- Hiển thị danh sách theo thời gian mới nhất\n- Mỗi yêu cầu có trạng thái rõ ràng\n- Bị từ chối thì hiển thị lý do' });
  const [b1, , b3] = B.story.acs;
  B.t1 = approvedTest(B.story, { acs: [b1], title: 'Danh sách mới nhất trước' });
  B.t3 = approvedTest(B.story, { acs: [b3], title: 'Hiển thị lý do từ chối' });
  B.b1New = 'Hiển thị danh sách theo thời gian mới nhất, mỗi trang 20 yêu cầu';
  changeRequirement(B.story, { acceptance_criteria: `- ${B.b1New}\n- Mỗi yêu cầu có trạng thái rõ ràng` });
  B.t4 = approvedTest(B.story, { acs: [B.b1New], title: 'Phân trang 20 yêu cầu' });
  assert.equal(B.t4.req_version, 2);
  changeRequirement(B.story, { title: 'Theo dõi trạng thái yêu cầu bồi thường' });
  const { analysis } = (await analyze(B.story)).body;
  assert.equal(analysis.from_version, 1);
  assert.equal(analysis.to_version, 3);
  const ps = analysis.proposals;
  assert.equal(byTest(ps, B.t1.id)[0].type, 'UPDATE'); // thay đổi v1 → v2 không bị bỏ sót
  assert.equal(byTest(ps, B.t3.id)[0].type, 'CLARIFY'); // AC bị bỏ, không có AC thay thế
  assert.equal(byTest(ps, B.t3.id)[0].source_ac, b3);
  const p4 = byTest(ps, B.t4.id);
  assert.deepEqual(p4.map((p) => [p.type, p.source_part]), [['RERUN', 'TITLE']]); // chỉ xét v2 → v3
  B.ps = ps;
});

test('IT-71 QĐ16: Cần làm rõ chỉ ghi nhận; Nên chạy lại thêm test vào bộ regression của cùng thay đổi (chưa có bộ thì tạo)', async () => {
  const qa = await as('qalead');
  const clarify = byTest(B.ps, B.t3.id)[0];
  const before = tcRow(B.t3.id);
  assert.equal((await qa.post(`/api/proposals/${clarify.id}/decision`).send({ decision: 'ACCEPT', note: 'Hỏi PO trên Jira' })).body.status, 'ACCEPTED');
  assert.deepEqual(tcRow(B.t3.id), before);
  const rerun = byTest(B.ps, B.t4.id)[0];
  assert.equal((await qa.post(`/api/proposals/${rerun.id}/decision`).send({ decision: 'ACCEPT' })).body.status, 'ACCEPTED');
  const set = getDb().prepare("SELECT * FROM regression_sets WHERE story_id = ? AND status = 'DRAFT'").get(B.story.id);
  assert.equal(set.to_version, 3);
  const items = getDb().prepare('SELECT * FROM regression_items WHERE set_id = ? AND test_case_id = ?').all(set.id, B.t4.id);
  assert.equal(items.length, 1, 'không thêm trùng test đã có trong bộ');
  assert.equal(items[0].removed, 0);
  // Tiêu đề đổi nên mọi test đã nằm sẵn trong bộ với nguồn Liên kết [R3]
  assert.equal(items[0].origin, 'LINKED');
});

test('IT-72 QĐ16: requirement đổi sau khi phân tích thì đề xuất chuyển Lỗi thời và không áp dụng được', async () => {
  const qa = await as('qalead');
  changeRequirement(B.story, { description: 'Là chủ thú cưng, tôi muốn theo dõi yêu cầu bồi thường theo thời gian thực.' });
  const upd = byTest(B.ps, B.t1.id)[0];
  const res = await qa.post(`/api/proposals/${upd.id}/decision`).send({ decision: 'ACCEPT' });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /Lỗi thời/);
  assert.equal(getDb().prepare('SELECT status FROM ai_proposals WHERE id = ?').get(upd.id).status, 'OUTDATED');
  assert.equal(tcRow(B.t1.id).version, B.t1.version);
});

test('IT-73 QĐ15 [R5]: mọi test đã được xem lại theo phiên bản hiện tại thì không còn thay đổi để phân tích', async () => {
  const tester = await as('tester');
  const c = createStory();
  const t = approvedTest(c);
  changeRequirement(c, { title: 'Gửi yêu cầu bồi thường có đính kèm' });
  assert.equal((await analyze(c)).status, 200);
  await tester.post('/api/testcases/recheck').send({ ids: [t.id], reason: 'Đổi tiêu đề không ảnh hưởng' });
  const res = await analyze(c);
  assert.equal(res.status, 409);
  assert.match(res.body.error, /đã được xem lại/);
});

// Kịch bản R: AC R3 đổi (khóa sau 5 lần → 3 lần)
const R = {};
test('IT-74 YC17 – QĐ17: bộ regression luôn gồm test liên kết AC đã đổi; AI xếp ưu tiên kèm lý do, gợi ý thêm; test chưa đủ điều kiện liệt kê riêng và chặn xác nhận', async () => {
  const qa = await as('qalead');
  R.story = createStory({ acceptance_criteria: '- Đăng nhập đúng thì vào trang chủ\n- Sai mật khẩu thì báo lỗi\n- Khóa tài khoản sau 5 lần sai' });
  R.t1 = approvedTest(R.story, { acs: [R.story.acs[0]], title: 'Đăng nhập đúng' });
  R.t3 = approvedTest(R.story, { acs: [R.story.acs[2]], title: 'Khóa sau nhiều lần sai' });
  R.newAc = 'Khóa tài khoản sau 3 lần sai';
  changeRequirement(R.story, { acceptance_criteria: R.story.acceptance_criteria.replace('Khóa tài khoản sau 5 lần sai', R.newAc) });
  const res = await qa.post('/api/regressions').send({ story_id: R.story.id });
  assert.equal(res.status, 201);
  const set = res.body;
  R.set = set;
  assert.equal(set.aiAvailable, true);
  const linked = set.items.filter((i) => i.mandatory);
  assert.deepEqual(linked.map((i) => i.test_case_id), [R.t3.id]);
  assert.equal(linked[0].origin, 'LINKED');
  assert.equal(linked[0].priority, 'HIGH');
  assert.ok(linked[0].reason);
  assert.ok(!set.items.some((i) => i.test_case_id === R.t1.id), 'test liên kết AC không đổi không bắt buộc');
  assert.ok(set.items.some((i) => i.origin === 'AI' && i.reason), 'AI gợi ý thêm kèm lý do');
  assert.deepEqual(set.blocked.map((b) => b.test_case_id), [R.t3.id]);
  const c = await qa.post(`/api/regressions/${set.id}/confirm`).send({ build: '3.0.0', environment: 'Staging' });
  assert.equal(c.status, 409);
  assert.match(c.body.error, /chưa đủ điều kiện chạy/);
  assert.equal((await (await as('tester')).get(`/api/regressions/${set.id}`)).status, 200);
});

test('IT-75 QĐ17 [2.2]: bỏ test bắt buộc phải ghi lý do; QA Lead thêm, bớt; xác nhận xong tạo Test Run loại Regression', async () => {
  const qa = await as('qalead');
  await (await as('tester')).post('/api/testcases/recheck').send({ ids: [R.t3.id], reason: 'Test chỉ kiểm tra việc khóa, cập nhật AC mới', acs: [R.newAc] });
  const suggestion = R.set.items.find((i) => i.origin === 'AI');
  assert.equal((await qa.put(`/api/regressions/${R.set.id}/items`).send({ remove: [{ test_case_id: R.t3.id }] })).status, 400);
  const upd = (await qa.put(`/api/regressions/${R.set.id}/items`).send({ add: [R.t1.id], remove: [{ test_case_id: suggestion.test_case_id }] })).body;
  assert.ok(upd.items.some((i) => i.test_case_id === R.t1.id && i.origin === 'MANUAL'));
  assert.equal(upd.blocked.length, 0);
  const ok = await qa.post(`/api/regressions/${R.set.id}/confirm`).send({ build: '3.0.0', environment: 'Staging', assignee_id: UID.tester });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.set.status, 'CONFIRMED');
  assert.equal(ok.body.run.run_type, 'REGRESSION');
  assert.equal(ok.body.run.regression_set_id, R.set.id);
  const inRun = ok.body.run.items.map((i) => i.test_case_id);
  assert.ok(inRun.includes(R.t3.id) && inRun.includes(R.t1.id) && !inRun.includes(suggestion.test_case_id));
  assert.equal((await qa.post('/api/regressions').send({ story_id: R.story.id })).status, 409);
});

test('IT-76 QĐ17 [R3]: chỉ tiêu đề hoặc mô tả đổi thì bộ regression gồm mọi test của requirement', async () => {
  const qa = await as('qalead');
  const s = createStory();
  const a = approvedTest(s, { acs: [s.acs[0]] });
  const b = approvedTest(s, { acs: [s.acs[1]], title: 'Bắt buộc chọn thú cưng' });
  changeRequirement(s, { description: 'Là chủ thú cưng, tôi muốn gửi yêu cầu bồi thường qua ứng dụng di động.' });
  const set = (await qa.post('/api/regressions').send({ story_id: s.id })).body;
  assert.deepEqual(set.items.filter((i) => i.mandatory).map((i) => i.test_case_id).sort(), [a.id, b.id].sort());
});

test('IT-77 QĐ17: không gọi được AI thì hệ thống vẫn đưa ra danh sách test liên kết', async () => {
  const qa = await as('qalead');
  const s = createStory();
  const a = approvedTest(s, { acs: [s.acs[1]] });
  changeRequirement(s, { acceptance_criteria: s.acceptance_criteria.replace('Bắt buộc chọn thú cưng', 'Bắt buộc chọn thú cưng và ngày khám') });
  ai.setProvider({ name: 'down', model: 'test', complete: async () => { throw new Error('Mất kết nối AI'); } });
  const res = await qa.post('/api/regressions').send({ story_id: s.id });
  ai.setProvider(new MockProvider());
  assert.equal(res.status, 201);
  assert.equal(res.body.aiAvailable, false);
  assert.deepEqual(res.body.items.map((i) => [i.test_case_id, i.origin]), [[a.id, 'LINKED']]);
  assert.match(res.body.items[0].reason, /AC đã đổi/);
});
