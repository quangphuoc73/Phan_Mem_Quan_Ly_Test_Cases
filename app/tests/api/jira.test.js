// IT-15 → IT-30: YC12 đồng bộ dự án, YC1 requirement, YC8 nhận thay đổi từ Jira (QĐ12, QĐ1, QĐ8) – chạy với Jira giả lập
const test = require('node:test');
const assert = require('node:assert/strict');
const { as, getDb, request, app } = require('../helpers');
const jira = require('../../src/services/jiraService');
const config = require('../../src/config');

const story = (code) => getDb().prepare('SELECT * FROM user_stories WHERE code = ?').get(code);
const projectId = (code) => getDb().prepare('SELECT id FROM projects WHERE code = ?').get(code).id;
const testsOf = (code) => getDb().prepare('SELECT t.* FROM test_cases t JOIN user_stories s ON s.id = t.story_id WHERE s.code = ? ORDER BY t.code').all(code);
const linked = (tcId) => getDb().prepare('SELECT ac_text FROM test_case_acs WHERE test_case_id = ?').all(tcId).map((r) => r.ac_text);
const sync = async (code) => (await (await as('qalead')).post(`/api/projects/${projectId(code)}/jira-sync`)).body;

test('IT-15 Chỉ Admin được kiểm tra kết nối Jira', async () => {
  const admin = await as('admin');
  const ok = await admin.post('/api/jira/test');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.ok, true);
  assert.equal(ok.body.mode, 'mock');
  assert.deepEqual(ok.body.issueTypes, ['Story']);
  assert.equal((await (await as('qalead')).post('/api/jira/test')).status, 403);
});

test('IT-16 QĐ12 + QĐ1: QA Lead thêm dự án từ Jira – module, thành viên, requirement nhận diện bằng issue ID, phiên bản 1', async () => {
  const qa = await as('qalead');
  const res = await qa.post('/api/jira/import').send({ key: 'hrm' });
  assert.equal(res.status, 201);
  assert.equal(res.body.code, 'HRM');
  assert.equal(res.body.modules, 3);
  assert.equal(res.body.members, 4);
  assert.deepEqual(res.body.unmapped, ['Đỗ Khách Hàng']);
  assert.equal(res.body.stories.created, 3);
  const s = story('HRM-1');
  assert.equal(s.jira_issue_id, '10001');
  assert.equal(s.issue_type, 'Story');
  assert.equal(s.current_version, 1);
  assert.ok(s.jira_updated_at);
  assert.equal(getDb().prepare('SELECT COUNT(*) n FROM requirement_versions WHERE story_id = ?').get(s.id).n, 1);
  const log = jira.lastSync(projectId('HRM'));
  assert.equal(log.source, 'IMPORT');
  assert.equal(log.status, 'SUCCESS');
});

test('IT-17 Thêm lại dự án đã có → 409; mã không có trên Jira → 404; mã sai định dạng → 400', async () => {
  const admin = await as('admin');
  assert.equal((await admin.post('/api/jira/import').send({ key: 'LIB' })).status, 201);
  assert.equal((await admin.post('/api/jira/import').send({ key: 'LIB' })).status, 409);
  assert.equal((await admin.post('/api/jira/import').send({ key: 'NOPE' })).status, 404);
  assert.equal((await admin.post('/api/jira/import').send({ key: '1-x' })).status, 400);
});

test('IT-18 Tester, PO/BA, Developer không được thêm dự án từ Jira', async () => {
  for (const u of ['tester', 'poba', 'dev']) {
    assert.equal((await (await as(u)).post('/api/jira/import').send({ key: 'HRM' })).status, 403, u);
  }
});

test('IT-19 Đồng bộ lại dự án (nút Đồng bộ ngay) ghi nhật ký lần đồng bộ; dự án mẫu không liên kết Jira thì báo lỗi', async () => {
  const admin = await as('admin');
  const res = await admin.post(`/api/projects/${projectId('LIB')}/jira-sync`);
  assert.equal(res.status, 200);
  assert.equal(res.body.members, 2);
  const logs = (await admin.get(`/api/projects/${projectId('LIB')}/sync-logs`)).body;
  assert.equal(logs[0].source, 'MANUAL');
  assert.equal(logs[0].status, 'SUCCESS');
  assert.equal((await admin.post('/api/projects/1/jira-sync')).status, 400);
});

test('IT-20 YC1 – QĐ1: tách mô tả và AC, ánh xạ ưu tiên, module; story không có AC được đánh dấu Thiếu AC [A4]', async () => {
  const tester = await as('tester');
  const s = (await tester.get(`/api/stories/${story('HRM-1').id}`)).body;
  assert.match(s.description, /gửi đơn xin nghỉ phép/);
  assert.equal(s.acs.length, 3);
  assert.equal(s.priority, 'High');
  assert.equal(s.module_name, 'Nghỉ phép');
  assert.equal(s.sync_state, 'NORMAL');
  assert.equal(story('HRM-3').priority, 'Low'); // Lowest → Low
  const missing = (await tester.get(`/api/stories?project_id=${projectId('LIB')}&state=MISSING_AC`)).body.map((x) => x.code);
  assert.deepEqual(missing, ['LIB-2']);
  // QĐ1: không có API tạo, sửa, xóa requirement
  assert.equal((await tester.post('/api/stories').send({ code: 'X-1' })).status, 404);
  assert.equal((await tester.put(`/api/stories/${s.id}`).send({ title: 'Sửa tay' })).status, 404);
});

test('IT-21 QĐ8 [A1]: AC đổi trên Jira → phiên bản mới; chỉ test liên kết với AC đó bị gắn cờ Cần xem lại', async () => {
  const tester = await as('tester');
  const hrm1 = story('HRM-1');
  assert.equal((await tester.post(`/api/stories/${hrm1.id}/generate`)).status, 200);
  const oldAc = 'Ngày kết thúc trước ngày bắt đầu thì báo lỗi "Ngày kết thúc không hợp lệ"';
  const newAc = 'Ngày kết thúc trước ngày bắt đầu thì báo lỗi "Khoảng thời gian không hợp lệ"';
  const acs = jira.splitDescription(jira.MOCK_PROJECTS.HRM.issues[0].fields.description).criteria.split('\n');
  jira.mockEditIssue('HRM-1', { criteria: acs.map((a) => (a === oldAc ? newAc : a)) });
  const r = await sync('HRM');
  assert.equal(r.stories.versioned, 1);
  assert.equal(story('HRM-1').current_version, 2);
  const tests = testsOf('HRM-1');
  const onOld = tests.filter((t) => linked(t.id).includes(oldAc));
  assert.ok(onOld.length >= 1);
  assert.ok(onOld.every((t) => t.needs_review === 1 && t.review_reason === 'AC_CHANGED'));
  assert.ok(tests.filter((t) => !linked(t.id).includes(oldAc)).every((t) => t.needs_review === 0));
  const versions = (await tester.get(`/api/stories/${hrm1.id}/versions`)).body;
  assert.equal(versions.length, 2);
  assert.deepEqual(versions[0].changes.ac_added, [newAc]);
  assert.deepEqual(versions[0].changes.ac_removed, [oldAc]);
});

test('IT-22 QĐ8 [D1]: đổi ưu tiên không tạo phiên bản, không gắn cờ; đổi mô tả thì mọi test của requirement bị gắn cờ', async () => {
  const tester = await as('tester');
  const hrm2 = story('HRM-2');
  assert.equal((await tester.post(`/api/stories/${hrm2.id}/generate`)).status, 200);
  jira.mockEditIssue('HRM-2', { priority: 'Highest' });
  await sync('HRM');
  assert.equal(story('HRM-2').priority, 'High');
  assert.equal(story('HRM-2').current_version, 1);
  assert.ok(testsOf('HRM-2').every((t) => t.needs_review === 0));
  jira.mockEditIssue('HRM-2', { description: 'Là nhân viên, tôi muốn Check-in bằng điện thoại khi đến công ty, để hệ thống ghi giờ làm.' });
  const r = await sync('HRM');
  assert.equal(story('HRM-2').current_version, 2);
  assert.equal(r.stories.flaggedTests, testsOf('HRM-2').length);
  assert.ok(testsOf('HRM-2').every((t) => t.needs_review === 1 && t.review_reason === 'CONTENT_CHANGED'));
});

test('IT-23 QĐ8 [1.2]: chỉ ghi khi Jira có bản mới hơn – bản cũ đến sau (đồng bộ chồng nhau) không ghi đè', async () => {
  const issue = jira.MOCK_PROJECTS.HRM.issues.find((i) => i.key === 'HRM-3');
  const keep = { summary: issue.fields.summary, updated: issue.fields.updated };
  issue.fields.summary = 'Tiêu đề của bản cũ';
  issue.fields.updated = '2026-10-01T00:00:00.000+0700';
  const r = await sync('HRM');
  assert.ok(r.stories.skippedOlder >= 1);
  assert.equal(story('HRM-3').title, keep.summary);
  Object.assign(issue.fields, keep);
});

test('IT-24 QĐ1 [1.1]: Jira đổi mã issue thì giữ nguyên requirement (nhận diện bằng issue ID), chỉ cập nhật mã hiển thị', async () => {
  const before = story('HRM-3');
  jira.mockEditIssue('HRM-3', { key: 'HRM-30' });
  await sync('HRM');
  const after = story('HRM-30');
  assert.equal(after.id, before.id);
  assert.equal(after.jira_issue_id, '10003');
  assert.equal(story('HRM-3'), undefined);
});

let deletedIssue;
test('IT-25 QĐ8 [1.4]: issue biến mất → hỏi Jira theo issue ID, gắn cờ Cần kiểm tra kèm lý do, không tự lưu trữ', async () => {
  deletedIssue = jira.MOCK_PROJECTS.HRM.issues.find((i) => i.key === 'HRM-2');
  jira.mockEditIssue('HRM-2', { deleted: true });
  jira.mockEditIssue('HRM-1', { issuetype: 'Task' });
  const r = await sync('HRM');
  assert.equal(r.stories.needsCheck, 2);
  assert.equal(story('HRM-2').check_reason, 'NOT_FOUND');
  assert.equal(story('HRM-1').check_reason, 'TYPE_EXCLUDED');
  assert.equal(story('HRM-2').archived, 0);
  assert.ok(testsOf('HRM-2').length > 0, 'test được giữ nguyên');
  const tester = await as('tester');
  const list = (await tester.get(`/api/stories?project_id=${projectId('HRM')}&state=NEEDS_CHECK`)).body.map((s) => s.code).sort();
  assert.deepEqual(list, ['HRM-1', 'HRM-2']);
  assert.equal((await tester.post(`/api/stories/${story('HRM-2').id}/generate`)).status, 409);
});

test('IT-26 QĐ8: Jira trả danh sách rỗng thì không gắn cờ; lỗi kết nối được thử lại 2 lần, ghi nhật ký FAILED và không đổi dữ liệu', async () => {
  const saved = jira.MOCK_PROJECTS.LIB.issues.splice(0);
  const r = await sync('LIB');
  assert.equal(r.stories.needsCheck, 0);
  assert.equal(getDb().prepare("SELECT COUNT(*) n FROM user_stories WHERE code LIKE 'LIB-%' AND check_reason IS NOT NULL").get().n, 0);
  jira.MOCK_PROJECTS.LIB.issues.push(...saved);

  const before = getDb().prepare('SELECT COUNT(*) n FROM requirement_versions').get().n;
  config.jira.baseUrl = 'http://127.0.0.1:9'; // cổng đóng: kết nối bị từ chối
  const res = await (await as('qalead')).post(`/api/projects/${projectId('LIB')}/jira-sync`);
  config.jira.baseUrl = '';
  assert.equal(res.status, 502);
  const log = jira.lastSync(projectId('LIB'));
  assert.equal(log.status, 'FAILED');
  assert.equal(log.attempts, 3); // 1 lần + thử lại 2 lần
  assert.equal(getDb().prepare('SELECT COUNT(*) n FROM requirement_versions').get().n, before);
});

test('IT-27 QĐ8 [D2]: Giữ lại vẫn giữ cờ Cần kiểm tra; đồng bộ lấy lại được issue thì cờ tự gỡ', async () => {
  const id = story('HRM-2').id;
  assert.equal((await (await as('tester')).post(`/api/stories/${id}/check-decision`).send({ decision: 'KEEP' })).status, 403);
  const qa = await as('qalead');
  const kept = (await qa.post(`/api/stories/${id}/check-decision`).send({ decision: 'KEEP' })).body;
  assert.equal(kept.check_reason, 'NOT_FOUND');
  assert.equal(kept.sync_state, 'NEEDS_CHECK');
  assert.equal(kept.check_kept_by, 2);
  jira.mockRestoreIssue('HRM', deletedIssue);
  const r = await sync('HRM');
  assert.ok(r.stories.restored >= 1);
  const s = story('HRM-2');
  assert.equal(s.check_reason, null);
  assert.equal(s.check_kept_by, null);
});

test('IT-28 QĐ8: Lưu trữ thì ẩn khỏi danh sách, giữ test và lịch sử; xuất hiện lại trên Jira thì tự hiện lại', async () => {
  const qa = await as('qalead');
  const s = story('HRM-1');
  const n = testsOf('HRM-1').length;
  assert.equal((await qa.post(`/api/stories/${s.id}/check-decision`).send({ decision: 'ARCHIVE' })).body.sync_state, 'ARCHIVED');
  assert.ok(!(await qa.get(`/api/stories?project_id=${projectId('HRM')}`)).body.some((x) => x.id === s.id));
  assert.ok((await qa.get(`/api/stories?project_id=${projectId('HRM')}&state=ARCHIVED`)).body.some((x) => x.id === s.id));
  assert.equal(testsOf('HRM-1').length, n);
  assert.equal((await qa.post(`/api/stories/${s.id}/check-decision`).send({ decision: 'KEEP' })).status, 409);
  jira.mockEditIssue('HRM-1', { issuetype: 'Story' });
  await sync('HRM');
  assert.equal(story('HRM-1').archived, 0);
});

test('IT-29 QĐ8: webhook sai mã bí mật bị từ chối; đúng mã thì đồng bộ lại dự án qua Jira API (nguồn WEBHOOK)', async () => {
  const body = { webhookEvent: 'jira:issue_updated', issue: { key: 'LIB-1', fields: { project: { key: 'LIB' } } } };
  assert.equal((await request(app).post('/api/jira/webhook?secret=sai').send(body)).status, 401);
  const ok = await request(app).post('/api/jira/webhook?secret=test-secret').send(body);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.project, 'LIB');
  assert.equal(jira.lastSync(projectId('LIB')).source, 'WEBHOOK');
  const other = await request(app).post('/api/jira/webhook?secret=test-secret').send({ issue: { key: 'ABC-1', fields: { project: { key: 'ABC' } } } });
  assert.match(other.body.ignored, /chưa được thêm/);
});

test('IT-30 QĐ12: gán thành viên theo email; Jira ẩn email thì so họ tên; nhiều tài khoản trùng họ tên thì không gán', async () => {
  const admin = await as('admin');
  for (const u of ['trung.ten1', 'trung.ten2']) {
    await admin.post('/api/users').send({ username: u, full_name: 'Trùng Tên', role: 'TESTER', password: 'Matkhau123' });
  }
  const r = jira.mapMembers([
    { accountId: 'a', displayName: 'X', emailAddress: 'tester@demo.local' },
    { accountId: 'b', displayName: 'Phạm Lập Trình' },
    { accountId: 'c', displayName: 'Trùng Tên' },
  ]);
  assert.deepEqual(r.mapped.map((m) => m.user_id), [4, 5]);
  assert.deepEqual(r.unmapped, ['Trùng Tên']);
});
