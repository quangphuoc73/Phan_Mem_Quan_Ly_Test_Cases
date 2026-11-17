// EXT-01 → EXT-11: phần ngoài MVP (phụ lục đặc tả) – YC20 sprint (QĐ20), YC19 script Playwright (QĐ19).
// Hai phần này giữ code nhưng ẩn bằng cờ; file test tự bật cờ trước khi nạp ứng dụng [A3].
process.env.SPRINT_ENABLED = 'true';
process.env.SCRIPT_ENABLED = 'true';
process.env.RUNNER_ENABLED = 'false';
const test = require('node:test');
const assert = require('node:assert/strict');
const { as, getDb, createStory } = require('../helpers');
const jira = require('../../src/services/jiraService');

let hrm;
const sprintOf = (code) => getDb().prepare('SELECT sp.name FROM user_stories s LEFT JOIN sprints sp ON sp.id = s.sprint_id WHERE s.code = ?').get(code)?.name ?? null;

test('EXT-01 YC20: đồng bộ sprint từ Jira – sprint có ngày được thêm, sprint chưa đặt ngày bỏ qua kèm cảnh báo', async () => {
  const qa = await as('qalead');
  hrm = (await qa.post('/api/jira/import').send({ key: 'HRM' })).body;
  assert.equal(hrm.sprints, 1);
  assert.ok(hrm.warnings.some((w) => /HRM Sprint 2: chưa đặt ngày/.test(w)));
  const list = (await qa.get(`/api/projects/${hrm.id}/sprints`)).body;
  assert.deepEqual(list.map((s) => [s.name, s.start_date, s.end_date, s.state]), [['HRM Sprint 1', '2026-11-02', '2026-11-15', 'active']]);
});

test('EXT-02 YC20: story gắn đúng sprint theo Jira; story không thuộc sprint nằm trong Product backlog', async () => {
  assert.equal(sprintOf('HRM-1'), 'HRM Sprint 1');
  assert.equal(sprintOf('HRM-2'), 'HRM Sprint 1');
  assert.equal(sprintOf('HRM-3'), null);
  const backlog = (await (await as('qalead')).get(`/api/stories?project_id=${hrm.id}&backlog=1`)).body.map((s) => s.code);
  assert.deepEqual(backlog, ['HRM-3']);
});

test('EXT-03 QĐ20: story point ngoài dãy 1, 2, 3, 5, 8, 13 bị bỏ qua kèm cảnh báo', () => {
  const pts = (c) => getDb().prepare('SELECT story_points FROM user_stories WHERE code = ?').get(c).story_points;
  assert.equal(pts('HRM-1'), 5);
  assert.equal(pts('HRM-3'), null);
  assert.ok(hrm.warnings.some((w) => /HRM-3: story point 4/.test(w)));
});

test('EXT-04 QĐ20: không có API tạo, sửa, xóa sprint (sprint lập trên Jira)', async () => {
  const admin = await as('admin');
  const sp = getDb().prepare('SELECT id FROM sprints LIMIT 1').get().id;
  assert.equal((await admin.post('/api/projects/1/sprints').send({ name: 'Sprint X' })).status, 404);
  assert.equal((await admin.put(`/api/sprints/${sp}`).send({ name: 'Y' })).status, 404);
  assert.equal((await admin.delete(`/api/sprints/${sp}`)).status, 404);
});

test('EXT-05 YC20: đồng bộ lại khi sprint đổi trên Jira – cập nhật, không tạo trùng; story chuyển sprint theo Jira', async () => {
  const s1 = jira.MOCK_PROJECTS.HRM.sprints[0];
  s1.goal = 'Mục tiêu mới';
  s1.endDate = '2026-11-16T10:00:00.000Z';
  jira.MOCK_PROJECTS.HRM.issues[2].fields.mock_sprint = 9001;
  jira.mockEditIssue('HRM-3', {}); // Jira cập nhật thời điểm sửa của issue
  const qa = await as('qalead');
  await qa.post(`/api/projects/${hrm.id}/jira-sync`);
  const list = (await qa.get(`/api/projects/${hrm.id}/sprints`)).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].goal, 'Mục tiêu mới');
  assert.equal(list[0].end_date, '2026-11-16');
  assert.equal(sprintOf('HRM-3'), 'HRM Sprint 1');
});

test('EXT-06 YC20: Product backlog chỉ gồm story chưa thuộc sprint', async () => {
  const backlog = (await (await as('tester')).get('/api/stories?project_id=1&backlog=1')).body;
  assert.deepEqual(backlog.map((s) => s.code), ['PETINS-5']);
});

test('EXT-07 YC20: Definition of Done và velocity – Sprint 1 hoàn thành 5/13 story point', async () => {
  const s1 = (await (await as('qalead')).get('/api/projects/1/sprints')).body.find((s) => s.name === 'Sprint 1');
  assert.equal(s1.committed_points, 13);
  assert.equal(s1.completed_points, 5); // PETINS-1 đạt DoD: mọi test Đã duyệt đều PASS
  assert.equal(s1.done_count, 1);
});

test('EXT-08 YC20: burndown có 1 điểm cho mỗi ngày, đường lý tưởng giảm về 0', async () => {
  const s1 = getDb().prepare("SELECT id FROM sprints WHERE project_id = 1 AND name = 'Sprint 1'").get().id;
  const bd = (await (await as('qalead')).get(`/api/sprints/${s1}/burndown`)).body;
  assert.equal(bd.points.length, bd.sprint.days);
  assert.equal(bd.points[0].ideal, 13);
  assert.equal(bd.points.at(-1).ideal, 0);
  assert.equal(bd.points.at(-1).remaining, 8);
  assert.equal(bd.stories.find((s) => s.code === 'PETINS-1').stage, 'DONE');
});

test('EXT-09 YC10: khi bật phần mở rộng thì tham số RUN_TIMEOUT_SEC, SPRINT_MAX_DAYS hiện ở BM9', async () => {
  const keys = (await (await as('qalead')).get('/api/parameters')).body.map((p) => p.key);
  assert.ok(keys.includes('RUN_TIMEOUT_SEC') && keys.includes('SPRINT_MAX_DAYS'));
});

test('EXT-10 YC19: chỉ sinh script cho test case đã duyệt; script sinh ra qua kiểm tra tĩnh', async () => {
  const tester = await as('tester');
  const s = createStory();
  const draft = (await tester.post('/api/testcases').send({ story_id: s.id, title: 'Test nháp', steps: ['a'], expected_result: 'b', priority: 'Low', type: 'Edge', acs: [s.acs[0]] })).body;
  assert.equal((await tester.post(`/api/testcases/${draft.id}/script/generate`)).status, 409);
  const approved = getDb().prepare("SELECT id FROM test_cases WHERE code = 'SAUCE-1-TC01'").get().id;
  const res = await tester.post(`/api/testcases/${approved}/script/generate`);
  assert.equal(res.status, 200);
  assert.match(res.body.code, /@playwright\/test/);
  assert.deepEqual(res.body.warnings, []);
});

test('EXT-11 YC19 – QĐ5: chạy script tự động phải ghi vào một test trong Test Run (không ghi ngoài đợt)', async () => {
  const tester = await as('tester');
  const approved = getDb().prepare("SELECT id FROM test_cases WHERE code = 'SAUCE-1-TC01'").get().id;
  assert.equal((await tester.post(`/api/testcases/${approved}/script/run`).send({})).status, 400);
});
