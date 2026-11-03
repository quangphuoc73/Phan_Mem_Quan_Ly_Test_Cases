// IT-34 → IT-42: Sprint (Agile/Scrum) – sprint lấy từ Jira (QĐ14), Definition of Done, velocity, burndown
const test = require('node:test');
const assert = require('node:assert/strict');
const { as, getDb } = require('../helpers');
const jira = require('../../src/services/jiraService');

let hrm;
const sprintOf = (code) => getDb().prepare('SELECT sp.name FROM user_stories s LEFT JOIN sprints sp ON sp.id = s.sprint_id WHERE s.code = ?').get(code)?.name ?? null;

test('IT-34 đồng bộ sprint từ Jira: sprint có ngày được thêm, sprint chưa đặt ngày bỏ qua kèm cảnh báo', async () => {
  const qa = await as('qalead');
  hrm = (await qa.post('/api/jira/import').send({ key: 'HRM' })).body;
  assert.equal(hrm.sprints, 1);
  assert.ok(hrm.warnings.some((w) => /HRM Sprint 2: chưa đặt ngày/.test(w)));
  const list = (await qa.get(`/api/projects/${hrm.id}/sprints`)).body;
  assert.deepEqual(list.map((s) => [s.name, s.start_date, s.end_date, s.state]), [['HRM Sprint 1', '2026-11-02', '2026-11-15', 'active']]);
});

test('IT-35 story gắn đúng sprint theo Jira; story không thuộc sprint nằm trong Product backlog', async () => {
  assert.equal(sprintOf('HRM-1'), 'HRM Sprint 1');
  assert.equal(sprintOf('HRM-2'), 'HRM Sprint 1');
  assert.equal(sprintOf('HRM-3'), null);
  const qa = await as('qalead');
  const backlog = (await qa.get(`/api/stories?project_id=${hrm.id}&backlog=1`)).body.map((s) => s.code);
  assert.deepEqual(backlog, ['HRM-3']);
});

test('IT-36 QĐ14: story point ngoài dãy 1, 2, 3, 5, 8, 13 bị bỏ qua kèm cảnh báo', () => {
  const pts = (c) => getDb().prepare('SELECT story_points FROM user_stories WHERE code = ?').get(c).story_points;
  assert.equal(pts('HRM-1'), 5);
  assert.equal(pts('HRM-3'), null);
  assert.ok(hrm.warnings.some((w) => /HRM-3: story point 4/.test(w)));
});

test('IT-37 không có API tạo, sửa, xóa sprint (sprint lập trên Jira)', async () => {
  const admin = await as('admin');
  const sp = getDb().prepare('SELECT id FROM sprints LIMIT 1').get().id;
  assert.equal((await admin.post('/api/projects/1/sprints').send({ name: 'Sprint X' })).status, 404);
  assert.equal((await admin.put(`/api/sprints/${sp}`).send({ name: 'Y' })).status, 404);
  assert.equal((await admin.delete(`/api/sprints/${sp}`)).status, 404);
});

test('IT-38 đồng bộ lại khi sprint đổi trên Jira: cập nhật, không tạo trùng; story chuyển sprint theo Jira', async () => {
  const s1 = jira.MOCK_PROJECTS.HRM.sprints[0];
  s1.goal = 'Mục tiêu mới';
  s1.endDate = '2026-11-16T10:00:00.000Z';
  jira.MOCK_PROJECTS.HRM.issues[2].fields.mock_sprint = 9001;
  const qa = await as('qalead');
  await qa.post(`/api/projects/${hrm.id}/jira-sync`);
  const list = (await qa.get(`/api/projects/${hrm.id}/sprints`)).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].goal, 'Mục tiêu mới');
  assert.equal(list[0].end_date, '2026-11-16');
  assert.equal(sprintOf('HRM-3'), 'HRM Sprint 1');
});

test('IT-39 Product backlog chỉ gồm story chưa thuộc sprint', async () => {
  const tester = await as('tester');
  const backlog = (await tester.get('/api/stories?project_id=1&backlog=1')).body;
  assert.ok(backlog.length >= 1 && backlog.every((s) => s.sprint_id === null));
});

test('IT-40 Definition of Done và velocity: Sprint 1 hoàn thành 5/13 story point', async () => {
  const qa = await as('qalead');
  const list = (await qa.get('/api/projects/1/sprints')).body;
  const s1 = list.find((s) => s.name === 'Sprint 1');
  assert.equal(s1.committed_points, 13);
  assert.equal(s1.completed_points, 5); // US-PET-001 đạt DoD: mọi test case đã duyệt đều PASS
  assert.equal(s1.done_count, 1);
});

test('IT-41 burndown có 1 điểm cho mỗi ngày, đường lý tưởng giảm về 0', async () => {
  const qa = await as('qalead');
  const s1 = getDb().prepare("SELECT id FROM sprints WHERE project_id = 1 AND name = 'Sprint 1'").get().id;
  const bd = (await qa.get(`/api/sprints/${s1}/burndown`)).body;
  assert.equal(bd.points.length, bd.sprint.days);
  assert.equal(bd.points[0].ideal, 13);
  assert.equal(bd.points.at(-1).ideal, 0);
  assert.equal(bd.points.at(-1).remaining, 8);
  assert.equal(bd.stories.find((s) => s.code === 'US-PET-001').stage, 'DONE');
});

test('IT-42 báo cáo lọc theo sprint và trả velocity các sprint', async () => {
  const qa = await as('qalead');
  const s2 = getDb().prepare("SELECT id FROM sprints WHERE project_id = 1 AND name = 'Sprint 2'").get().id;
  const r = (await qa.get(`/api/reports/summary?project_id=1&sprint_id=${s2}`)).body;
  assert.equal(r.sprint.name, 'Sprint 2');
  assert.equal(r.stories, 2);
  assert.ok(r.sprints.length >= 2);
});
