// Mỗi file test chạy trong tiến trình riêng với CSDL SQLite trong bộ nhớ (:memory:)
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';

const request = require('supertest');
const { getDb } = require('../src/db');
const { seed } = require('../src/db/seed');
const { createApp } = require('../src/app');

getDb();
seed();
const app = createApp();

const PASSWORDS = { admin: 'Admin@123', qalead: 'QaLead@123', poba: 'PoBa@1234', tester: 'Tester@123', dev: 'Dev@123456' };
// Thứ tự tạo tài khoản trong dữ liệu mẫu
const UID = { admin: 1, qalead: 2, poba: 3, tester: 4, dev: 5 };

const tokens = {};
async function login(username) {
  if (tokens[username]) return tokens[username];
  const res = await request(app).post('/api/auth/login').send({ username, password: PASSWORDS[username] });
  if (res.status !== 200) throw new Error(`Login ${username} thất bại: ${res.status}`);
  return (tokens[username] = res.body.token);
}

// Client gọn: (await as('tester')).post('/api/...').send(...)
async function as(username) {
  const token = await login(username);
  const wrap = (method) => (url) => request(app)[method](url).set('authorization', `Bearer ${token}`);
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete') };
}

let seq = 0;
const newStory = (over = {}) => ({
  code: `TEST-${++seq}${Math.floor(Math.random() * 1e4)}`,
  project_id: 1,
  title: 'Gửi yêu cầu bồi thường',
  description: 'Là chủ thú cưng, tôi muốn gửi yêu cầu bồi thường để được hoàn tiền.',
  acceptance_criteria: '- Tải lên hóa đơn tối đa 10 MB\n- Bắt buộc chọn thú cưng\n- Gửi thành công thì hiển thị mã yêu cầu',
  priority: 'High',
  ...over,
});

// Requirement chỉ đến từ Jira (không có API tạo); test tạo thẳng qua service như dữ liệu đã đồng bộ
const stories = require('../src/services/storyService');
const testCases = require('../src/services/testCaseService');
const createStory = (over = {}) => stories.createForTest(newStory(over), UID.poba);

// Test case đã duyệt, liên kết các AC chỉ định (mặc định AC đầu tiên)
function approvedTest(story, { acs, title = 'Kiểm tra chức năng chính', steps = ['Mở chức năng', 'Thực hiện thao tác'] } = {}) {
  const s = stories.get(story.id);
  const tc = testCases.create(
    { story_id: s.id, title, steps, expected_result: 'Hệ thống xử lý đúng', priority: 'High', type: 'Positive', acs: acs || [s.acs[0]] },
    s,
    UID.tester
  );
  testCases.submit([tc.id]);
  return testCases.review(tc.id, { decision: 'APPROVED' }, UID.qalead);
}

// Mô phỏng PO/BA sửa nội dung requirement trên Jira rồi đồng bộ về (tạo phiên bản mới, gắn cờ test)
function changeRequirement(story, next) {
  const db = getDb();
  const old = db.prepare('SELECT * FROM user_stories WHERE id = ?').get(story.id);
  return db.transaction(() =>
    stories.applyContentChange(old, {
      title: next.title ?? old.title,
      description: next.description ?? old.description,
      acceptance_criteria: next.acceptance_criteria ?? old.acceptance_criteria,
    }, 'MANUAL', null)
  )();
}

module.exports = { app, request, login, as, newStory, createStory, approvedTest, changeRequirement, getDb, UID };
