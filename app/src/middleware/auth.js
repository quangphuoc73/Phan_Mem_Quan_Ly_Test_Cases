// Xác thực JWT và phân quyền theo vai trò (RBAC).
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db');
const { AppError, forbidden } = require('../utils/errors');

const ROLES = {
  ADMIN: 'ADMIN',
  QA_LEAD: 'QA_LEAD',
  PO_BA: 'PO_BA', // Product Owner / Business Analyst: viết story, lập sprint trên Jira; trong hệ thống chỉ xem
  TESTER: 'TESTER',
  DEVELOPER: 'DEVELOPER',
};

// Ma trận phân quyền: quyền -> các vai trò được phép
const PERMISSIONS = {
  'user:manage': ['ADMIN'],
  'project:manage': ['ADMIN'], // khai báo URL ứng dụng cần test của dự án
  'jira:connect': ['ADMIN'], // YC13: chỉ Admin kiểm tra kết nối Jira
  'jira:import': ['ADMIN', 'QA_LEAD'], // YC13: thêm dự án từ Jira; YC1, YC8, YC14: đồng bộ story, sprint
  'param:update': ['ADMIN', 'QA_LEAD'],
  'audit:view': ['ADMIN', 'QA_LEAD'],
  'testcase:write': ['QA_LEAD', 'TESTER'],
  'testcase:review': ['QA_LEAD'], // QĐ4: chỉ QA Lead được duyệt
  'ai:use': ['QA_LEAD', 'TESTER'],
  'run:write': ['QA_LEAD', 'TESTER'],
  'bug:fix': ['DEVELOPER'], // YC15: báo đã sửa lỗi để Tester kiểm thử lại
  'ailog:view': ['ADMIN', 'QA_LEAD', 'TESTER'],
};

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, username: user.username }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError(401, 'Vui lòng đăng nhập'));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = getDb()
      .prepare('SELECT id, username, full_name, email, role, active FROM users WHERE id = ?')
      .get(payload.sub);
    if (!user || !user.active) return next(new AppError(401, 'Tài khoản không tồn tại hoặc đã bị khóa'));
    req.user = user;
    next();
  } catch {
    next(new AppError(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'));
  }
}

function can(role, permission) {
  return (PERMISSIONS[permission] || []).includes(role);
}

function requirePermission(permission) {
  return (req, _res, next) => (can(req.user?.role, permission) ? next() : next(forbidden()));
}

module.exports = { ROLES, PERMISSIONS, signToken, authenticate, requirePermission, can };
