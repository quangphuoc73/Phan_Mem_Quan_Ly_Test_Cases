// Quản lý người dùng, dự án, module, tham số (quy định), nhật ký.
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { getDb } = require('../db');
const { requirePermission } = require('../middleware/auth');
const audit = require('../services/auditService');
const params = require('../services/parameterService');
const sprints = require('../services/sprintService');
const { notFound, badRequest } = require('../utils/errors');

const router = express.Router();
const id = (req) => Number(req.params.id);

// ---------- Người dùng ----------
const userSchema = z.object({
  username: z.string().trim().regex(/^[a-z0-9_.]{3,30}$/, 'Tên đăng nhập 3–30 ký tự: a-z, 0-9, _ .'),
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email('Email không hợp lệ').optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'QA_LEAD', 'TESTER', 'DEVELOPER']),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(100),
});

router.get('/users', requirePermission('user:manage'), (_req, res) => {
  res.json(getDb().prepare('SELECT id, username, full_name, email, role, active, created_at FROM users ORDER BY id').all());
});

router.post('/users', requirePermission('user:manage'), (req, res) => {
  const d = userSchema.parse(req.body);
  const info = getDb()
    .prepare('INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)')
    .run(d.username, bcrypt.hashSync(d.password, 10), d.full_name, d.email || null, d.role);
  audit.log(req, 'CREATE_USER', 'user', info.lastInsertRowid, { username: d.username, role: d.role });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch('/users/:id', requirePermission('user:manage'), (req, res) => {
  const d = userSchema.partial().extend({ active: z.boolean().optional() }).parse(req.body);
  const u = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id(req));
  if (!u) throw notFound();
  if (u.id === req.user.id && (d.active === false || (d.role && d.role !== 'ADMIN'))) {
    throw badRequest('Không thể tự khóa hoặc tự hạ quyền tài khoản của chính mình');
  }
  getDb()
    .prepare('UPDATE users SET full_name = ?, email = ?, role = ?, active = ?, password_hash = ? WHERE id = ?')
    .run(
      d.full_name ?? u.full_name,
      d.email ?? u.email,
      d.role ?? u.role,
      d.active === undefined ? u.active : d.active ? 1 : 0,
      d.password ? bcrypt.hashSync(d.password, 10) : u.password_hash,
      u.id
    );
  const { password, ...logged } = d;
  audit.log(req, 'UPDATE_USER', 'user', u.id, { ...logged, password_changed: Boolean(password) });
  res.json({ ok: true });
});

// ---------- Dự án & module ----------
const projectSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,10}$/, 'Mã dự án 2–10 ký tự in hoa/số'),
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional().default(''),
  base_url: z.string().trim().url('URL không hợp lệ').optional().or(z.literal('')),
});

router.get('/projects', (_req, res) => {
  const db = getDb();
  const projects = db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM user_stories s WHERE s.project_id = p.id) story_count
       FROM projects p ORDER BY p.id`
    )
    .all();
  const modules = db.prepare('SELECT * FROM modules ORDER BY name').all();
  const sprintList = sprints.list();
  res.json(projects.map((p) => ({
    ...p,
    modules: modules.filter((m) => m.project_id === p.id),
    sprints: sprintList.filter((s) => s.project_id === p.id),
  })));
});

router.post('/projects', requirePermission('project:manage'), (req, res) => {
  const d = projectSchema.parse(req.body);
  const info = getDb()
    .prepare('INSERT INTO projects (code, name, description, base_url, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(d.code, d.name, d.description, d.base_url || null, req.user.id);
  audit.log(req, 'CREATE_PROJECT', 'project', info.lastInsertRowid, { code: d.code });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/projects/:id', requirePermission('project:manage'), (req, res) => {
  const d = projectSchema.omit({ code: true }).parse(req.body);
  const r = getDb()
    .prepare('UPDATE projects SET name = ?, description = ?, base_url = ? WHERE id = ?')
    .run(d.name, d.description, d.base_url || null, id(req));
  if (!r.changes) throw notFound();
  audit.log(req, 'UPDATE_PROJECT', 'project', id(req));
  res.json({ ok: true });
});

router.post('/projects/:id/modules', requirePermission('project:manage'), (req, res) => {
  const d = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(500).optional() }).parse(req.body);
  const info = getDb()
    .prepare('INSERT INTO modules (project_id, name, description) VALUES (?, ?, ?)')
    .run(id(req), d.name, d.description || null);
  audit.log(req, 'CREATE_MODULE', 'module', info.lastInsertRowid, { name: d.name });
  res.status(201).json({ id: info.lastInsertRowid });
});

// ---------- Sprint (YC12 – Agile/Scrum) ----------
router.get('/projects/:id/sprints', (req, res) => res.json(sprints.list(id(req))));

router.post('/projects/:id/sprints', requirePermission('sprint:manage'), (req, res) => {
  const sp = sprints.create(id(req), req.body);
  audit.log(req, 'CREATE_SPRINT', 'sprint', sp.id, { name: sp.name });
  res.status(201).json(sp);
});

router.put('/sprints/:id', requirePermission('sprint:manage'), (req, res) => {
  const sp = sprints.update(id(req), req.body);
  audit.log(req, 'UPDATE_SPRINT', 'sprint', sp.id);
  res.json(sp);
});

router.delete('/sprints/:id', requirePermission('sprint:manage'), (req, res) => {
  sprints.remove(id(req));
  audit.log(req, 'DELETE_SPRINT', 'sprint', id(req));
  res.status(204).end();
});

router.get('/sprints/:id/burndown', (req, res) => res.json(sprints.burndown(id(req))));

// ---------- Tham số / quy định (YC10) ----------
router.get('/parameters', (_req, res) => res.json(params.getAll()));

router.put('/parameters/:key', requirePermission('param:update'), (req, res) => {
  const r = params.update(req.params.key, req.body.value, req.user.id);
  audit.log(req, 'UPDATE_PARAMETER', 'parameter', null, r);
  res.json(r);
});

// ---------- Nhật ký ----------
router.get('/audit-logs', requirePermission('audit:view'), (_req, res) => {
  res.json(
    getDb()
      .prepare(
        `SELECT a.*, u.username FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300`
      )
      .all()
  );
});

router.get('/ai-logs', requirePermission('ailog:view'), (_req, res) => {
  res.json(
    getDb()
      .prepare(
        `SELECT l.*, u.username, s.code story_code FROM ai_logs l LEFT JOIN users u ON u.id = l.user_id
         LEFT JOIN user_stories s ON s.id = l.story_id ORDER BY l.id DESC LIMIT 200`
      )
      .all()
  );
});

module.exports = router;
