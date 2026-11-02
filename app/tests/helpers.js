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

async function login(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: PASSWORDS[username] });
  if (res.status !== 200) throw new Error(`Login ${username} thất bại: ${res.status}`);
  return res.body.token;
}

// Client gọn: as('tester').post('/api/...').send(...)
async function as(username) {
  const token = await login(username);
  const wrap = (method) => (url) => request(app)[method](url).set('authorization', `Bearer ${token}`);
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete') };
}

const newStory = (over = {}) => ({
  code: `US-T-${Math.floor(Math.random() * 1e6)}`,
  project_id: 1,
  title: 'Gửi yêu cầu bồi thường',
  description: 'Là chủ thú cưng, tôi muốn gửi yêu cầu bồi thường để được hoàn tiền.',
  acceptance_criteria: '- Tải lên hóa đơn tối đa 10 MB\n- Bắt buộc chọn thú cưng\n- Gửi thành công thì hiển thị mã yêu cầu',
  priority: 'High',
  ...over,
});

module.exports = { app, request, login, as, newStory, getDb };
