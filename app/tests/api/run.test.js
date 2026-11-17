// IT-51 → IT-64: YC6 báo cáo, YC13 Test Suite, YC14 Test Run và phân công, YC5 ghi kết quả (QĐ5, QĐ6, QĐ13, QĐ14)
const test = require('node:test');
const assert = require('node:assert/strict');
const { as, createStory, approvedTest, changeRequirement, getDb, UID } = require('../helpers');

const tcId = (code) => getDb().prepare('SELECT id FROM test_cases WHERE code = ?').get(code).id;
const report = async (q) => (await (await as('tester')).get(`/api/reports/summary?${q}`)).body;
const itemOf = (run, tc) => run.items.find((i) => i.test_case_id === tc);

test('IT-51 YC6 – QĐ6 [B1]: báo cáo theo dự án – bao phủ story (mẫu số không gồm story Thiếu AC), bao phủ AC, chỉ tính requirement chưa lưu trữ', async () => {
  const sauce = await report('project_id=2');
  assert.equal(sauce.coverage, 100);
  assert.equal(sauce.acCoverage, 100);
  assert.equal(sauce.inScope, 4); // 4 test Đã duyệt
  assert.equal(sauce.executed, 1);
  assert.equal(sauce.executionProgress, 25);
  assert.equal(sauce.passRate, 100);

  const pet = await report('project_id=1');
  assert.deepEqual(pet.missingAc.map((s) => s.code), ['PETINS-5']);
  assert.equal(pet.storiesWithAc, 4);
  assert.equal(pet.coverage, 25); // chỉ PETINS-1 có test Đã duyệt
  assert.equal(pet.acCovered, 4);
  assert.equal(pet.acTotal, 15);
  getDb().prepare("UPDATE user_stories SET archived = 1 WHERE code = 'PETINS-4'").run();
  const archived = await report('project_id=1');
  assert.equal(archived.stories, 4);
  assert.equal(archived.coverage, 33.3);
  assert.equal(archived.acTotal, 12);
  getDb().prepare("UPDATE user_stories SET archived = 0 WHERE code = 'PETINS-4'").run();
});

test('IT-52 YC6 – QĐ6: báo cáo theo Test Run lấy lần chạy gần nhất trong đợt; tiến độ, tỷ lệ pass', async () => {
  const r = await report('run_id=1');
  assert.equal(r.scope.type, 'RUN');
  assert.equal(r.inScope, 4);
  assert.deepEqual(r.runs, { PASS: 3, FAIL: 1, BLOCKED: 0 });
  assert.equal(r.passRate, 75);
  assert.equal(r.executionProgress, 100);
});

test('IT-53 YC6 – QĐ6: thống kê AI chỉ tính test nguồn AI; "phải sửa" khi đổi bước hoặc kết quả mong đợi, đổi tiêu đề thì không tính', async () => {
  const tester = await as('tester');
  const base = (await report('project_id=1')).ai;
  assert.equal(base.ai_total, 3);
  assert.equal(base.ai_edited, 0);
  await tester.put(`/api/testcases/${tcId('PETINS-1-TC02')}`).send({ title: 'Đăng ký bằng email đã được dùng' });
  assert.equal((await report('project_id=1')).ai.ai_edited, 0);
  await tester.put(`/api/testcases/${tcId('PETINS-1-TC02')}`).send({ expected_result: 'Hiển thị lỗi "Email này đã được đăng ký"' });
  const after = (await report('project_id=1')).ai;
  assert.equal(after.ai_edited, 1);
  assert.equal(after.ai_edit_rate, 33.3);
});

test('IT-54 YC13 – QĐ13: Test Suite phẳng – tên 3–100 ký tự, không trùng trong dự án; test phải cùng dự án; một test thuộc nhiều suite; xóa suite không xóa test', async () => {
  const tester = await as('tester');
  assert.equal((await tester.post('/api/suites').send({ project_id: 1, name: 'ab' })).status, 400);
  assert.equal((await tester.post('/api/suites').send({ project_id: 1, name: 'Đăng ký tài khoản' })).status, 409);
  assert.equal((await tester.post('/api/suites').send({ project_id: 2, name: 'Đăng ký tài khoản' })).status, 201);
  const s = (await tester.post('/api/suites').send({ project_id: 1, name: 'Hồi quy đăng ký' })).body;
  const tc = tcId('PETINS-1-TC01');
  assert.equal((await tester.put(`/api/suites/${s.id}/items`).send({ add: [tc] })).body.items.length, 1);
  assert.equal((await tester.put(`/api/suites/${s.id}/items`).send({ add: [tcId('SAUCE-1-TC01')] })).status, 400);
  const inSuites = getDb().prepare('SELECT COUNT(*) n FROM test_suite_items WHERE test_case_id = ?').get(tc).n;
  assert.equal(inSuites, 2);
  assert.equal((await tester.delete(`/api/suites/${s.id}`)).status, 204);
  assert.ok(getDb().prepare('SELECT 1 FROM test_cases WHERE id = ?').get(tc));
  assert.equal((await (await as('dev')).post('/api/suites').send({ project_id: 1, name: 'Suite của Dev' })).status, 403);
});

// Dữ liệu cho các test Test Run: 1 test đủ điều kiện và 4 test không đủ điều kiện chạy
let ctx;
function setup() {
  if (ctx) return ctx;
  const s1 = createStory();
  const ok = approvedTest(s1, { acs: [s1.acs[0]] });
  const flagged = approvedTest(s1, { acs: [s1.acs[2]], title: 'Kiểm tra hiển thị mã yêu cầu' });
  changeRequirement(s1, { acceptance_criteria: s1.acceptance_criteria.replace('hiển thị mã yêu cầu', 'hiển thị mã và ngày gửi') });
  const draft = require('../../src/services/testCaseService').create(
    { story_id: s1.id, title: 'Test còn nháp', steps: ['a'], expected_result: 'b', priority: 'Low', type: 'Edge', acs: [s1.acs[1]] },
    require('../../src/services/storyService').get(s1.id), UID.tester
  );
  const s2 = createStory();
  const onCheck = approvedTest(s2);
  getDb().prepare("UPDATE user_stories SET check_reason = 'NOT_FOUND' WHERE id = ?").run(s2.id);
  const s3 = createStory();
  const onArchived = approvedTest(s3);
  getDb().prepare('UPDATE user_stories SET archived = 1 WHERE id = ?').run(s3.id);
  ctx = { ok, flagged, draft, onCheck, onArchived };
  return ctx;
}

const newRun = (qa, ids, over = {}) =>
  qa.post('/api/runs').send({ project_id: 1, name: 'Đợt kiểm thử', build: '2.0.0', environment: 'Staging', test_case_ids: ids, assignee_id: UID.tester, ...over });

test('IT-55 YC14 – QĐ14 [2.1]: chỉ test đủ điều kiện chạy được đưa vào đợt; test bị chặn được liệt kê kèm lý do; bắt buộc build, môi trường', async () => {
  const qa = await as('qalead');
  const c = setup();
  assert.equal((await newRun(qa, [c.ok.id], { build: '' })).status, 400);
  assert.equal((await newRun(qa, [c.ok.id], { environment: '' })).status, 400);
  assert.equal((await newRun(qa, [c.ok.id], { assignee_id: UID.dev })).status, 400); // người được giao: QA Lead hoặc Tester
  const res = await newRun(qa, [c.ok.id, c.flagged.id, c.draft.id, c.onCheck.id, c.onArchived.id]);
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.run.items.map((i) => i.test_case_id), [c.ok.id]);
  const reasons = Object.fromEntries(res.body.skipped.map((s) => [s.id, s.reason]));
  assert.match(reasons[c.flagged.id], /Cần xem lại/);
  assert.match(reasons[c.draft.id], /chưa được duyệt/);
  assert.match(reasons[c.onCheck.id], /Cần kiểm tra/);
  assert.match(reasons[c.onArchived.id], /lưu trữ/);
  assert.equal((await newRun(qa, [c.flagged.id, c.draft.id])).status, 409); // không còn test nào đủ điều kiện
  ctx.run = res.body.run;
});

test('IT-56 QĐ14, QĐ5: phiên bản test cố định khi đưa vào đợt; sửa test sau đó chỉ hiện cảnh báo, kết quả ghi theo phiên bản đã cố định', async () => {
  const tester = await as('tester');
  const { run, ok } = ctx;
  const item = itemOf(run, ok.id);
  assert.equal(item.tc_version, ok.version);
  await tester.put(`/api/testcases/${ok.id}`).send({ title: 'Tải hóa đơn đúng dung lượng cho phép' }); // về Nháp, phiên bản mới
  const detail = (await tester.get(`/api/runs/${run.id}`)).body;
  assert.ok(itemOf(detail, ok.id).warnings.some((w) => /phiên bản mới/.test(w)));
  const rec = await tester.post(`/api/runs/${run.id}/items/${item.id}/executions`).send({ result: 'PASS' });
  assert.equal(rec.status, 201);
  assert.equal(rec.body.execution.tc_version, ok.version);
});

test('IT-57 YC5 – QĐ5: chỉ người được giao hoặc QA Lead được ghi; Fail/Blocked bắt buộc ghi chú; bằng chứng là đường dẫn', async () => {
  const tester = await as('tester');
  const qa = await as('qalead');
  const run3 = (await tester.get('/api/runs/3')).body;
  const ofQa = run3.items.find((i) => i.assignee_id === UID.qalead);
  assert.equal((await tester.post(`/api/runs/3/items/${ofQa.id}/executions`).send({ result: 'PASS' })).status, 403);
  assert.equal((await qa.post(`/api/runs/3/items/${ofQa.id}/executions`).send({ result: 'PASS' })).status, 201);
  const mine = run3.items.find((i) => i.assignee_id === UID.tester && !i.last_result);
  assert.equal((await tester.post(`/api/runs/3/items/${mine.id}/executions`).send({ result: 'FAIL' })).status, 400);
  assert.equal((await tester.post(`/api/runs/3/items/${mine.id}/executions`).send({ result: 'BLOCKED' })).status, 400);
  assert.equal((await tester.post(`/api/runs/3/items/${mine.id}/executions`).send({ result: 'FAIL', note: 'Lỗi', evidence_url: 'không phải link' })).status, 400);
  const ok = await tester.post(`/api/runs/3/items/${mine.id}/executions`)
    .send({ result: 'FAIL', note: 'Không hiện thông báo lỗi', defect_code: 'SAUCE-99', evidence_url: 'https://drive.example.com/anh-loi.png' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.execution.defect_code, 'SAUCE-99');
});

test('IT-58 QĐ14 [D3]: build và môi trường sửa được khi đợt chưa có kết quả; đã có kết quả thì cố định, muốn chạy build khác phải lập đợt mới', async () => {
  const qa = await as('qalead');
  const fresh = (await newRun(qa, [ctx.onCheck.id, tcId('PETINS-1-TC04')])).body.run;
  assert.equal((await qa.put(`/api/runs/${fresh.id}`).send({ build: '2.0.1', environment: 'UAT' })).status, 200);
  const locked = await qa.put('/api/runs/3').send({ build: 'web-2026.12' });
  assert.equal(locked.status, 409);
  assert.match(locked.body.error, /lập đợt mới/);
  assert.equal((await qa.put('/api/runs/3').send({ environment: 'Khác' })).status, 409);
  assert.equal((await qa.put('/api/runs/3').send({ name: 'Smoke test – đổi tên' })).status, 200);
});

test('IT-59 QĐ14 [A6]: requirement đổi, lưu trữ hoặc Cần kiểm tra khi đợt đang mở thì đợt vẫn chạy phiên bản đã cố định và hiện cảnh báo', async () => {
  const qa = await as('qalead');
  const s = createStory();
  const t = approvedTest(s);
  const run = (await newRun(qa, [t.id])).body.run;
  changeRequirement(s, { title: 'Gửi yêu cầu bồi thường trực tuyến' });
  getDb().prepare("UPDATE user_stories SET check_reason = 'TYPE_EXCLUDED' WHERE id = ?").run(s.id);
  const item = itemOf((await qa.get(`/api/runs/${run.id}`)).body, t.id);
  assert.ok(item.warnings.some((w) => /Cần xem lại/.test(w)));
  assert.ok(item.warnings.some((w) => /Cần kiểm tra/.test(w)));
  assert.equal((await qa.post(`/api/runs/${run.id}/items/${item.id}/executions`).send({ result: 'PASS' })).status, 201);
});

test('IT-60 QĐ14: một test nằm trong nhiều đợt đang mở; kết quả từng đợt tính riêng', async () => {
  const qa = await as('qalead');
  const t = tcId('PETINS-1-TC04');
  const a = (await newRun(qa, [t], { name: 'Đợt A' })).body.run;
  const b = (await newRun(qa, [t], { name: 'Đợt B' })).body.run;
  await qa.post(`/api/runs/${a.id}/items/${a.items[0].id}/executions`).send({ result: 'PASS' });
  await qa.post(`/api/runs/${b.id}/items/${b.items[0].id}/executions`).send({ result: 'FAIL', note: 'Lỗi trên môi trường B' });
  assert.deepEqual((await report(`run_id=${a.id}`)).runs, { PASS: 1, FAIL: 0, BLOCKED: 0 });
  assert.deepEqual((await report(`run_id=${b.id}`)).runs, { PASS: 0, FAIL: 1, BLOCKED: 0 });
});

test('IT-61 QĐ3 [A2]: bỏ test khỏi đợt chỉ khi test chưa có kết quả trong đợt', async () => {
  const qa = await as('qalead');
  const run = (await newRun(qa, [tcId('PETINS-1-TC04'), tcId('PETINS-1-TC03')])).body.run;
  const [x, y] = run.items;
  await qa.post(`/api/runs/${run.id}/items/${x.id}/executions`).send({ result: 'PASS' });
  assert.equal((await qa.delete(`/api/runs/${run.id}/items/${x.id}`)).status, 409);
  assert.equal((await qa.delete(`/api/runs/${run.id}/items/${y.id}`)).status, 200);
});

test('IT-62 QĐ14 [B4]: đóng đợt còn test chưa chạy phải xác nhận, test chưa chạy tính là chưa chạy; đợt đã đóng không ghi, không sửa', async () => {
  const qa = await as('qalead');
  const run = (await newRun(qa, [tcId('PETINS-1-TC04'), tcId('PETINS-1-TC03')])).body.run;
  await qa.post(`/api/runs/${run.id}/items/${run.items[0].id}/executions`).send({ result: 'BLOCKED', note: 'Máy chủ Staging hỏng' });
  const ask = await qa.post(`/api/runs/${run.id}/close`).send({});
  assert.equal(ask.status, 409);
  assert.equal(ask.body.details.notRun, 1);
  const closed = await qa.post(`/api/runs/${run.id}/close`).send({ confirm: true });
  assert.equal(closed.body.run.status, 'CLOSED');
  assert.equal(closed.body.notRun, 1);
  const r = await report(`run_id=${run.id}`);
  assert.equal(r.notRun, 1);
  assert.equal(r.executed, 1); // Blocked tính là đã chạy
  assert.equal(r.passRate, 0); // nhưng không tính là Pass
  assert.equal((await qa.post(`/api/runs/${run.id}/items/${run.items[1].id}/executions`).send({ result: 'PASS' })).status, 409);
  assert.equal((await qa.put(`/api/runs/${run.id}`).send({ name: 'Đổi tên' })).status, 409);
});

test('IT-63 YC14: lập đợt từ Test Suite và phân công lại cho Tester khác vai trò hợp lệ', async () => {
  const qa = await as('qalead');
  const res = await qa.post('/api/runs').send({ project_id: 2, name: 'Smoke từ suite', build: 'web-2026.12', environment: 'Production', suite_id: 2 });
  assert.equal(res.status, 201);
  assert.equal(res.body.run.items.length, 4);
  const item = res.body.run.items[0];
  assert.equal((await qa.put(`/api/runs/${res.body.run.id}/items/${item.id}`).send({ assignee_id: UID.tester })).status, 200);
  assert.equal((await qa.put(`/api/runs/${res.body.run.id}/items/${item.id}`).send({ assignee_id: UID.poba })).status, 400);
  assert.equal((await qa.post('/api/runs').send({ project_id: 1, name: 'Suite sai dự án', build: '1', environment: 'x', suite_id: 2 })).status, 400);
});

test('IT-64 YC14: tiến độ đợt tính theo số test đã có kết quả trên tổng số test trong đợt', async () => {
  const run = (await (await as('tester')).get('/api/runs/3')).body;
  assert.equal(run.progress.total, 4);
  assert.equal(run.progress.executed, 3);
  assert.equal(run.progress.percent, 75);
  assert.equal(run.locked, true);
});
