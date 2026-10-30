// IT-46 → IT-49: YC13 – Developer báo đã sửa lỗi, Tester kiểm thử lại (QĐ13)
const test = require('node:test');
const assert = require('node:assert/strict');
const { as } = require('../helpers');

// Test case đã duyệt, vừa được Tester chạy Fail
async function failedRun() {
  const tester = await as('tester');
  const tc = (await tester.get('/api/testcases?status=APPROVED')).body.find((t) => t.code.startsWith('US-PET-001'));
  const run = await tester.post(`/api/testcases/${tc.id}/runs`).send({ result: 'FAIL', note: 'BUG-99: nút Đăng ký không phản hồi' });
  assert.equal(run.status, 201);
  return { tester, tc, run: run.body };
}

test('IT-46 Developer báo đã sửa lần chạy Fail → test case cần kiểm thử lại', async () => {
  const { tester, tc, run } = await failedRun();
  const dev = await as('dev');
  const res = await dev.post(`/api/runs/${run.id}/fix`).send({ build: '1.4.2', note: 'Sửa validate form' });
  assert.equal(res.status, 200);
  assert.equal(res.body.fix_build, '1.4.2');
  assert.ok(res.body.fixed_at);
  const retest = (await tester.get('/api/testcases?needs_retest=1')).body;
  assert.ok(retest.some((t) => t.id === tc.id && t.needs_retest === 1));
});

test('IT-47 Tester chạy lại thì test case hết cần kiểm thử lại', async () => {
  const { tester, tc, run } = await failedRun();
  const dev = await as('dev');
  await dev.post(`/api/runs/${run.id}/fix`).send({ build: '1.4.3' });
  await tester.post(`/api/testcases/${tc.id}/runs`).send({ result: 'PASS' });
  const retest = (await tester.get('/api/testcases?needs_retest=1')).body;
  assert.ok(!retest.some((t) => t.id === tc.id));
});

test('IT-48 QĐ13: không báo sửa khi thiếu bản build, lần chạy Pass, đã chạy lại hoặc đã báo rồi', async () => {
  const { tester, tc, run } = await failedRun();
  const dev = await as('dev');
  assert.equal((await dev.post(`/api/runs/${run.id}/fix`).send({ build: '  ' })).status, 400);
  assert.equal((await dev.post(`/api/runs/${run.id}/fix`).send({ build: '2.0.0' })).status, 200);
  assert.equal((await dev.post(`/api/runs/${run.id}/fix`).send({ build: '2.0.1' })).status, 409);
  const pass = (await tester.post(`/api/testcases/${tc.id}/runs`).send({ result: 'PASS' })).body;
  assert.equal((await dev.post(`/api/runs/${pass.id}/fix`).send({ build: '2.0.2' })).status, 409);
  assert.equal((await dev.post(`/api/runs/${run.id}/fix`).send({ build: '2.0.2' })).status, 409);
  assert.equal((await dev.post('/api/runs/999999/fix').send({ build: '2.0.2' })).status, 404);
});

test('IT-49 chỉ Developer được báo đã sửa lỗi', async () => {
  const { run } = await failedRun();
  for (const u of ['tester', 'qalead', 'poba', 'admin']) {
    assert.equal((await (await as(u)).post(`/api/runs/${run.id}/fix`).send({ build: '3.0.0' })).status, 403);
  }
});
