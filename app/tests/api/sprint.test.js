// IT-34 → IT-42: Sprint (Agile/Scrum) – QĐ12, Definition of Done, velocity, burndown
const test = require('node:test');
const assert = require('node:assert/strict');
const { as, newStory, getDb } = require('../helpers');

const day = (o) => new Date(Date.now() + o * 86400000).toLocaleDateString('sv-SE');

test('IT-34 QA Lead tạo sprint mới cho dự án', async () => {
  const qa = await as('qalead');
  const res = await qa.post('/api/projects/1/sprints').send({ name: 'Sprint 3', goal: 'Đổi gói', start_date: day(14), end_date: day(27) });
  assert.equal(res.status, 201);
  assert.equal(res.body.days, 14);
  assert.equal(res.body.committed_points, 0);
});

test('IT-35 QĐ12: sprint trùng thời gian với sprint khác bị từ chối', async () => {
  const qa = await as('qalead');
  const res = await qa.post('/api/projects/1/sprints').send({ name: 'Sprint X', start_date: day(5), end_date: day(10) });
  assert.equal(res.status, 409);
});

test('IT-36 QĐ12: sprint dài quá SPRINT_MAX_DAYS hoặc kết thúc trước khi bắt đầu bị từ chối', async () => {
  const qa = await as('qalead');
  assert.equal((await qa.post('/api/projects/1/sprints').send({ name: 'Dài', start_date: day(40), end_date: day(80) })).status, 400);
  assert.equal((await qa.post('/api/projects/1/sprints').send({ name: 'Ngược', start_date: day(90), end_date: day(85) })).status, 400);
});

test('IT-37 Tester không được tạo sprint (chỉ Admin, QA Lead)', async () => {
  const tester = await as('tester');
  const res = await tester.post('/api/projects/1/sprints').send({ name: 'Sprint T', start_date: day(100), end_date: day(110) });
  assert.equal(res.status, 403);
});

test('IT-38 story chỉ được gắn vào sprint của chính dự án; story point theo Fibonacci', async () => {
  const tester = await as('tester');
  const sauceSprint = getDb().prepare('SELECT id FROM sprints WHERE project_id = 2').get().id;
  assert.equal((await tester.post('/api/stories').send(newStory({ sprint_id: sauceSprint }))).status, 400);
  assert.equal((await tester.post('/api/stories').send(newStory({ story_points: 4 }))).status, 400);
  const ok = await tester.post('/api/stories').send(newStory({ story_points: 8 }));
  assert.equal(ok.status, 201);
  assert.equal(ok.body.sprint_id, null); // không chọn sprint → nằm trong Product backlog
});

test('IT-39 Product backlog chỉ gồm story chưa thuộc sprint; Sprint Planning đưa story vào sprint', async () => {
  const tester = await as('tester');
  const backlog = (await tester.get('/api/stories?project_id=1&backlog=1')).body;
  assert.ok(backlog.length >= 1 && backlog.every((s) => s.sprint_id === null));
  const sprint3 = getDb().prepare("SELECT id FROM sprints WHERE project_id = 1 AND name = 'Sprint 3'").get().id;
  const moved = await tester.put(`/api/stories/${backlog[0].id}`).send({ sprint_id: sprint3 });
  assert.equal(moved.body.sprint_id, sprint3);
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
