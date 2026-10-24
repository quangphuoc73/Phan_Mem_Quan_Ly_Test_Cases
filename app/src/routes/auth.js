const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { getDb } = require('../db');
const { signToken, authenticate, PERMISSIONS } = require('../middleware/auth');
const audit = require('../services/auditService');
const { AppError } = require('../utils/errors');

const router = express.Router();

// Chống dò mật khẩu: tối đa 10 lần đăng nhập / 15 phút / IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút' },
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(100),
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const user = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
  // Thông báo chung, không tiết lộ tài khoản có tồn tại hay không
  if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) {
    audit.log(req, 'LOGIN_FAILED', 'user', null, { username });
    throw new AppError(401, 'Tên đăng nhập hoặc mật khẩu không đúng');
  }
  req.user = user;
  audit.log(req, 'LOGIN', 'user', user.id);
  res.json({
    token: signToken(user),
    user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
  });
});

router.get('/me', authenticate, (req, res) => {
  const permissions = Object.entries(PERMISSIONS)
    .filter(([, roles]) => roles.includes(req.user.role))
    .map(([p]) => p);
  res.json({ user: req.user, permissions });
});

router.post('/change-password', authenticate, (req, res) => {
  const { old_password, new_password } = z
    .object({ old_password: z.string(), new_password: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự').max(100) })
    .parse(req.body);
  const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(old_password, user.password_hash)) throw new AppError(400, 'Mật khẩu cũ không đúng');
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), user.id);
  audit.log(req, 'CHANGE_PASSWORD', 'user', user.id);
  res.json({ ok: true });
});

module.exports = router;
