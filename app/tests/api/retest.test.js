// IT-78 → IT-85: YC18 – Developer báo đã sửa lỗi, Tester kiểm thử lại (QĐ18, [3.1], [3.2], [3.3], [R1])
const test = require('node:test');
const assert = require('node:assert/strict');
const { as, createStory, approvedTest, getDb, UID } = require('../helpers');

const fixRow = (id) => getDb().prepare('SELECT * FROM fix_reports WHERE id = ?').get(id);

// Đợt kiểm thử mới với 1 test đã duyệt; Tester ghi kết quả Fail
async function failedInRun({ build = '2.1.0' } = {}) {
  const qa = await as('qalead');
  const tester = await as('tester');
  const story = createStory();
  const tc = approvedTest(story);
  const run = (await qa.post('/api/runs').send({ project_id: 1, name: `Đợt build ${build}`, build, environment: 'Staging', test_case_ids: [tc.id], assignee_id: UID.tester })).body.run;
  const item = run.items[0];
  const fail = (await tester.post(`/api/runs/${run.id}/items/${item.id}/executions`).send({ result: 'FAIL', note: 'Nút Gửi không phản hồi', defect_code: 'PETINS-77' })).body.execution;
  return { qa, tester, tc, run, item, fail };
}

test('IT-78 YC18 – QĐ18: Developer báo đã sửa lần Fail gần nhất trong Test Run, bắt buộc build 1–50 ký tự; test chuyển Chờ kiểm thử lại', async () => {
  const { tc, fail, tester } = await failedInRun();
  const dev = await as('dev');
  assert.equal((await dev.post(`/api/executions/${fail.id}/fix`).send({ build: '  ' })).status, 400);
  assert.equal((await dev.post(`/api/executions/${fail.id}/fix`).send({ build: 'x'.repeat(51) })).status, 400);
  const res = await dev.post(`/api/executions/${fail.id}/fix`).send({ build: '2.1.1', note: 'Sửa sự kiện click' });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'WAITING');
  assert.equal(res.body.reported_by, UID.dev);
  const waiting = (await tester.get('/api/testcases?needs_retest=true')).body;
  assert.ok(waiting.some((t) => t.id === tc.id && t.needs_retest));
  const overview = (await tester.get('/api/retests?project_id=1')).body;
  assert.ok(overview.waiting.some((f) => f.execution_id === fail.id));
});

test('IT-79 QĐ18: mỗi lần Fail chỉ báo một lần; không báo cho lần Pass, lần Fail đã được chạy lại trong đợt, lần chạy không tồn tại', async () => {
  const { fail } = await failedInRun();
  const dev = await as('dev');
  assert.equal((await dev.post(`/api/executions/${fail.id}/fix`).send({ build: '2.1.1' })).status, 201);
  assert.equal((await dev.post(`/api/executions/${fail.id}/fix`).send({ build: '2.1.2' })).status, 409);
  const again = await failedInRun();
  const pass = (await again.tester.post(`/api/runs/${again.run.id}/items/${again.item.id}/executions`).send({ result: 'PASS' })).body.execution;
  assert.equal((await dev.post(`/api/executions/${pass.id}/fix`).send({ build: '2.1.2' })).status, 409);
  assert.equal((await dev.post(`/api/executions/${again.fail.id}/fix`).send({ build: '2.1.2' })).status, 409); // không phải lần gần nhất
  assert.equal((await dev.post('/api/executions/999999/fix').send({ build: '2.1.2' })).status, 404);
});

test('IT-80 QĐ18: chỉ Developer được báo đã sửa lỗi', async () => {
  const { fail } = await failedInRun();
  for (const u of ['tester', 'qalead', 'poba', 'admin']) {
    assert.equal((await (await as(u)).post(`/api/executions/${fail.id}/fix`).send({ build: '3.0.0' })).status, 403, u);
  }
});

test('IT-81 QĐ18 [R1] [3.1] [3.3]: đợt còn mở và trùng build đã sửa thì chạy lại ngay trong đợt; Pass → Đã đóng, lần chạy lại gắn với lần Fail gốc', async () => {
  const { fail, run, item, tester, tc } = await failedInRun({ build: '2.2.0' });
  const fix = (await (await as('dev')).post(`/api/executions/${fail.id}/fix`).send({ build: '2.2.0' })).body;
  assert.equal(fix.retest_in_same_run, true);
  const res = (await tester.post(`/api/runs/${run.id}/items/${item.id}/executions`).send({ result: 'PASS' })).body;
  assert.equal(res.execution.retest_of, fail.id);
  assert.deepEqual(res.warnings, []);
  assert.equal(fixRow(fix.id).status, 'CLOSED');
  assert.ok(!(await tester.get('/api/testcases?needs_retest=true')).body.some((t) => t.id === tc.id));
});

test('IT-82 QĐ18 [R1] [3.1]: đợt đã đóng thì QA Lead lập đợt Kiểm thử lại với build đã sửa; lần chạy ở đợt khác vẫn truy được lần Fail gốc', async () => {
  const { qa, tester, fail, run, tc } = await failedInRun({ build: '2.3.0' });
  await qa.post(`/api/runs/${run.id}/close`).send({ confirm: true });
  const fix = (await (await as('dev')).post(`/api/executions/${fail.id}/fix`).send({ build: '2.3.1' })).body;
  assert.equal(fix.retest_in_same_run, false);
  assert.equal((await tester.post('/api/retests/run').send({ project_id: 1, environment: 'Staging', fix_ids: [fix.id] })).status, 403);
  const res = await qa.post('/api/retests/run').send({ project_id: 1, environment: 'Staging', fix_ids: [fix.id], assignee_id: UID.tester });
  assert.equal(res.status, 201);
  const retestRun = res.body.run;
  assert.equal(retestRun.run_type, 'RETEST');
  assert.equal(retestRun.build, '2.3.1');
  const item = retestRun.items.find((i) => i.test_case_id === tc.id);
  const r = (await tester.post(`/api/runs/${retestRun.id}/items/${item.id}/executions`).send({ result: 'PASS' })).body;
  assert.equal(r.execution.retest_of, fail.id);
  assert.equal(fixRow(fix.id).status, 'CLOSED');
  const history = (await tester.get(`/api/testcases/${tc.id}/history`)).body.executions;
  assert.equal(history.find((e) => e.id === fail.id).fix_status, 'CLOSED');
});

test('IT-83 QĐ18 [3.3]: chạy lại Blocked thì vẫn Chờ kiểm thử lại; Fail thì Mở lại và Developer báo sửa lần nữa trên lần Fail mới', async () => {
  const { fail, run, item, tester } = await failedInRun({ build: '2.4.0' });
  const dev = await as('dev');
  const fix = (await dev.post(`/api/executions/${fail.id}/fix`).send({ build: '2.4.0' })).body;
  await tester.post(`/api/runs/${run.id}/items/${item.id}/executions`).send({ result: 'BLOCKED', note: 'Máy chủ hỏng' });
  assert.equal(fixRow(fix.id).status, 'WAITING');
  const again = (await tester.post(`/api/runs/${run.id}/items/${item.id}/executions`).send({ result: 'FAIL', note: 'Vẫn lỗi' })).body.execution;
  assert.equal(fixRow(fix.id).status, 'REOPENED');
  assert.equal(again.retest_of, fail.id);
  const second = await dev.post(`/api/executions/${again.id}/fix`).send({ build: '2.4.0' });
  assert.equal(second.status, 201);
  assert.equal(second.body.status, 'WAITING');
});

test('IT-84 QĐ18 [3.2]: build của đợt khác build Developer đã báo thì cảnh báo nhưng không chặn ghi kết quả', async () => {
  const { fail, run, item, tester } = await failedInRun({ build: '2.5.0' });
  await (await as('dev')).post(`/api/executions/${fail.id}/fix`).send({ build: '2.5.1' });
  const res = await tester.post(`/api/runs/${run.id}/items/${item.id}/executions`).send({ result: 'PASS' });
  assert.equal(res.status, 201);
  assert.match(res.body.warnings[0], /khác build Developer đã báo sửa/);
});

test('IT-85 QĐ18 [3.1]: lần Fail của cùng test ở các đợt khác nhau được theo dõi riêng', async () => {
  const qa = await as('qalead');
  const tester = await as('tester');
  const dev = await as('dev');
  const tc = approvedTest(createStory());
  const mk = async (name) => (await qa.post('/api/runs').send({ project_id: 1, name, build: '2.6.0', environment: 'Staging', test_case_ids: [tc.id], assignee_id: UID.tester })).body.run;
  const [a, b] = [await mk('Đợt A'), await mk('Đợt B')];
  const failA = (await tester.post(`/api/runs/${a.id}/items/${a.items[0].id}/executions`).send({ result: 'FAIL', note: 'Lỗi A' })).body.execution;
  const failB = (await tester.post(`/api/runs/${b.id}/items/${b.items[0].id}/executions`).send({ result: 'FAIL', note: 'Lỗi B' })).body.execution;
  const fixA = (await dev.post(`/api/executions/${failA.id}/fix`).send({ build: '2.6.0' })).body;
  const fixB = (await dev.post(`/api/executions/${failB.id}/fix`).send({ build: '2.6.0' })).body;
  const r = (await tester.post(`/api/runs/${a.id}/items/${a.items[0].id}/executions`).send({ result: 'PASS' })).body;
  assert.equal(r.execution.retest_of, failA.id);
  assert.equal(fixRow(fixA.id).status, 'CLOSED');
  assert.equal(fixRow(fixB.id).status, 'WAITING');
});
