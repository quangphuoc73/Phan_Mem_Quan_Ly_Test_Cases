// IT-01 → IT-10: Đăng nhập, xác thực, phân quyền (RBAC)
const test = require('node:test');
const assert = require('node:assert/strict');
const { app, request, as, newStory } = require('../helpers');

test('IT-01 đăng nhập đúng trả về JWT, không trả về mật khẩu băm', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'tester', password: 'Tester@123' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token.split('.').length === 3);
  assert.equal(res.body.user.role, 'TESTER');
  assert.equal(res.body.user.password_hash, undefined);
});

test('IT-02 sai mật khẩu trả 401 với thông báo chung', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'tester', password: 'sai' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Tên đăng nhập hoặc mật khẩu không đúng');
});

test('IT-03 gọi API không có token trả 401', async () => {
  const res = await request(app).get('/api/stories');
  assert.equal(res.status, 401);
});

test('IT-04 token giả mạo trả 401', async () => {
  const res = await request(app).get('/api/stories').set('authorization', 'Bearer abc.def.ghi');
  assert.equal(res.status, 401);
});

test('IT-05 QĐ4: Tester không được duyệt test case', async () => {
  const tester = await as('tester');
  const res = await tester.post('/api/testcases/1/review').send({ decision: 'APPROVED' });
  assert.equal(res.status, 403);
});

test('IT-06 Developer chỉ được xem, không được lập user story', async () => {
  const dev = await as('dev');
  assert.equal((await dev.get('/api/stories')).status, 200);
  assert.equal((await dev.post('/api/stories').send(newStory())).status, 403);
  assert.equal((await dev.post('/api/stories/1/generate')).status, 403);
});

test('IT-07 Tester không được thay đổi quy định', async () => {
  const tester = await as('tester');
  const res = await tester.put('/api/parameters/MAX_TC_PER_STORY').send({ value: 5 });
  assert.equal(res.status, 403);
});

test('IT-08 chỉ Admin quản lý người dùng', async () => {
  const qa = await as('qalead');
  assert.equal((await qa.get('/api/users')).status, 403);
  const admin = await as('admin');
  const res = await admin.get('/api/users');
  assert.equal(res.status, 200);
  assert.ok(res.body.every((u) => u.password_hash === undefined));
});

test('IT-09 tài khoản bị khóa không đăng nhập được', async () => {
  const admin = await as('admin');
  const created = await admin.post('/api/users').send({ username: 'tmp.user', full_name: 'Tạm', role: 'TESTER', password: 'Matkhau123' });
  assert.equal(created.status, 201);
  await admin.patch(`/api/users/${created.body.id}`).send({ active: false });
  const res = await request(app).post('/api/auth/login').send({ username: 'tmp.user', password: 'Matkhau123' });
  assert.equal(res.status, 401);
});

test('IT-10 header bảo mật (helmet) và CSP được bật', async () => {
  const res = await request(app).get('/');
  assert.match(res.headers['content-security-policy'], /script-src 'self'/);
  assert.equal(res.headers['x-powered-by'], undefined);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
});
