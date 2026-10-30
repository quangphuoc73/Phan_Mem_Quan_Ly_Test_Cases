// Xác thực JWT và phân quyền theo vai trò (RBAC).
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db');
const { AppError, forbidden } = require('../utils/errors');

const ROLES = {
  ADMIN: 'ADMIN',
  QA_LEAD: 'QA_LEAD',
  PO_BA: 'PO_BA', // Product Owner / Business Analyst: viết user story, lập kế hoạch sprint
  TESTER: 'TESTER',
  DEVELOPER: 'DEVELOPER',
};

// Ma trận phân quyền: quyền -> các vai trò được phép
const PERMISSIONS = {
  'user:manage': ['ADMIN'],
  'project:manage': ['ADMIN'],
  'sprint:manage': ['ADMIN', 'QA_LEAD', 'PO_BA'], // lập kế hoạch sprint (Product Owner, Scrum Master)
  'param:update': ['ADMIN', 'QA_LEAD'],
  'audit:view': ['ADMIN', 'QA_LEAD'],
  'story:write': ['ADMIN', 'QA_LEAD', 'TESTER', 'PO_BA'],
  'testcase:write': ['QA_LEAD', 'TESTER'],
  'testcase:review': ['QA_LEAD'], // QĐ4: chỉ QA Lead được duyệt
  'ai:use': ['QA_LEAD', 'TESTER'],
  'run:write': ['QA_LEAD', 'TESTER'],
  'bug:fix': ['DEVELOPER'], // YC13: báo đã sửa lỗi để Tester kiểm thử lại
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
