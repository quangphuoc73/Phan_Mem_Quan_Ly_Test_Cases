// IT-50 → IT-58: YC13 đồng bộ dự án, YC1 user story, YC8 thay đổi từ Jira (QĐ13, QĐ1, QĐ8) – chạy với Jira giả lập
const test = require('node:test');
const assert = require('node:assert/strict');
const { as, getDb } = require('../helpers');
const jira = require('../../src/services/jiraService');

test('IT-50 Chỉ Admin được kiểm tra kết nối Jira', async () => {
  const admin = await as('admin');
  const ok = await admin.post('/api/jira/test');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.ok, true);
  assert.equal(ok.body.mode, 'mock');
  const qa = await as('qalead');
  assert.equal((await qa.post('/api/jira/test')).status, 403);
});

test('IT-51 QA Lead thêm dự án từ Jira: lấy module và gán thành viên theo email', async () => {
  const qa = await as('qalead');
  const res = await qa.post('/api/jira/import').send({ key: 'hrm' });
  assert.equal(res.status, 201);
  assert.equal(res.body.code, 'HRM');
  assert.equal(res.body.modules, 3);
  assert.equal(res.body.members, 4);
  assert.deepEqual(res.body.unmapped, ['Đỗ Khách Hàng']);
  const project = (await qa.get('/api/projects')).body.find((p) => p.code === 'HRM');
  assert.equal(project.jira_key, 'HRM');
  assert.equal(project.member_count, 4);
  assert.equal(project.modules.length, 3);
  const members = (await qa.get(`/api/projects/${project.id}/members`)).body.map((m) => m.username);
  assert.ok(members.includes('tester') && members.includes('dev'));
});

test('IT-52 Thêm lại dự án đã đồng bộ → 409; mã không có trên Jira → 404; mã sai định dạng → 400', async () => {
  const admin = await as('admin');
  await admin.post('/api/jira/import').send({ key: 'LIB' });
  assert.equal((await admin.post('/api/jira/import').send({ key: 'LIB' })).status, 409);
  assert.equal((await admin.post('/api/jira/import').send({ key: 'NOPE' })).status, 404);
  assert.equal((await admin.post('/api/jira/import').send({ key: '1-x' })).status, 400);
});

test('IT-53 Tester, PO/BA, Developer không được thêm dự án từ Jira', async () => {
  for (const u of ['tester', 'poba', 'dev']) {
    const c = await as(u);
    assert.equal((await c.post('/api/jira/import').send({ key: 'HRM' })).status, 403, u);
  }
});

test('IT-54 Đồng bộ lại dự án Jira; dự án tạo thủ công thì báo lỗi', async () => {
  const admin = await as('admin');
  const list = (await admin.get('/api/projects')).body;
  let lib = list.find((p) => p.code === 'LIB');
  if (!lib) {
    await admin.post('/api/jira/import').send({ key: 'LIB' });
    lib = (await admin.get('/api/projects')).body.find((p) => p.code === 'LIB');
  }
  const res = await admin.post(`/api/projects/${lib.id}/jira-sync`);
  assert.equal(res.status, 200);
  assert.equal(res.body.members, 2);
  const manual = list.find((p) => !p.jira_key);
  assert.equal((await admin.post(`/api/projects/${manual.id}/jira-sync`)).status, 400);
});

test('IT-55 YC1: đồng bộ user story từ Jira – mô tả, acceptance criteria, ưu tiên, module, story point, trạng thái', async () => {
  const s = getDb().prepare("SELECT s.*, m.name module FROM user_stories s LEFT JOIN modules m ON m.id = s.module_id WHERE code = 'HRM-1'").get();
  assert.match(s.description, /gửi đơn xin nghỉ phép/);
  assert.equal(s.acceptance_criteria.split('\n').length, 3);
  assert.equal(s.priority, 'High');
  assert.equal(s.module, 'Nghỉ phép');
  assert.equal(s.story_points, 5);
  assert.equal(s.jira_status, 'To Do');
  assert.ok(s.synced_at);
});

test('IT-56 QĐ8: story đổi acceptance criteria trên Jira khi đã có test case → cần xem lại; Tester bấm Đã xem lại', async () => {
  const tester = await as('tester');
  const qa = await as('qalead');
  const hrm = getDb().prepare("SELECT id FROM projects WHERE code = 'HRM'").get().id;
  const story = getDb().prepare("SELECT id FROM user_stories WHERE code = 'HRM-2'").get();
  assert.equal((await tester.post(`/api/stories/${story.id}/generate`)).status, 200);
  const issue = jira.MOCK_PROJECTS.HRM.issues[1];
  issue.fields.description.content[2].content.push({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quên Check-in thì được bổ sung trong ngày' }] }] });
  const r = (await qa.post(`/api/projects/${hrm}/jira-sync`)).body;
  assert.equal(r.stories.changed, 1);
  const changed = (await tester.get(`/api/stories/${story.id}`)).body;
  assert.ok(changed.changed_at);
  assert.equal(changed.acceptance_criteria.split('\n').length, 3);
  assert.equal((await tester.post(`/api/stories/${story.id}/reviewed`)).status, 200);
  assert.equal((await tester.get(`/api/stories/${story.id}`)).body.changed_at, null);
  assert.equal((await tester.post(`/api/stories/${story.id}/reviewed`)).status, 409);
});

test('IT-57 QĐ8: story không đổi nội dung thì đồng bộ lại không đánh dấu; story chưa có test case đổi nội dung cũng không đánh dấu', async () => {
  const qa = await as('qalead');
  const hrm = getDb().prepare("SELECT id FROM projects WHERE code = 'HRM'").get().id;
  jira.MOCK_PROJECTS.HRM.issues[0].fields.summary = 'Xin nghỉ phép trực tuyến (bản mới)';
  const r = (await qa.post(`/api/projects/${hrm}/jira-sync`)).body;
  assert.equal(r.stories.changed, 0);
  assert.equal(getDb().prepare("SELECT changed_at FROM user_stories WHERE code = 'HRM-1'").get().changed_at, null);
});

test('IT-58 QĐ8: story bị xóa trên Jira thì lưu trữ, giữ test case, không sinh thêm; có lại trên Jira thì hiện lại', async () => {
  const qa = await as('qalead');
  const tester = await as('tester');
  const hrm = getDb().prepare("SELECT id FROM projects WHERE code = 'HRM'").get().id;
  const removed = jira.MOCK_PROJECTS.HRM.issues.splice(1, 1)[0];
  assert.equal((await qa.post(`/api/projects/${hrm}/jira-sync`)).body.stories.archived, 1);
  const s = getDb().prepare("SELECT id, archived FROM user_stories WHERE code = 'HRM-2'").get();
  assert.equal(s.archived, 1);
  assert.ok(getDb().prepare('SELECT COUNT(*) n FROM test_cases WHERE story_id = ?').get(s.id).n > 0);
  assert.ok(!(await tester.get(`/api/stories?project_id=${hrm}`)).body.some((x) => x.code === 'HRM-2'));
  assert.equal((await tester.post(`/api/stories/${s.id}/generate`)).status, 409);
  jira.MOCK_PROJECTS.HRM.issues.splice(1, 0, removed);
  await qa.post(`/api/projects/${hrm}/jira-sync`);
  assert.equal(getDb().prepare("SELECT archived FROM user_stories WHERE code = 'HRM-2'").get().archived, 0);
});
