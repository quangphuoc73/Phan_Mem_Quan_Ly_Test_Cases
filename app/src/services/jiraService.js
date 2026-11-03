// Đồng bộ MỘT CHIỀU từ Jira vào hệ thống (Jira là nơi duy nhất tạo và sửa user story).
//   YC13: dự án, module (component), thành viên        – BM12, QĐ13
//   YC1 : user story (mô tả, acceptance criteria, ưu tiên, story point) – BM1, QĐ1
//   YC8 : nhận thay đổi của user story (webhook / định kỳ / nút Đồng bộ), đánh dấu test case cần xem lại – BM7, QĐ8
//   YC14: sprint (tên, mục tiêu, ngày) và story thuộc sprint – BM13, QĐ14
// Thông tin kết nối (địa chỉ, email, API token) chỉ nằm trong app/.env ở backend (SE-08).
// Chưa cấu hình .env thì dùng Jira giả lập (dữ liệu mẫu) – dùng cho kiểm thử tự động và khi demo không có mạng.
const crypto = require('crypto');
const { getDb } = require('../db');
const config = require('../config');
const params = require('./parameterService');
const { AppError, badRequest, notFound, conflict } = require('../utils/errors');

const KEY_REGEX = /^[A-Z][A-Z0-9]{1,9}$/; // mã dự án Jira: 2–10 ký tự in hoa/số, bắt đầu bằng chữ
const STORY_POINTS = [1, 2, 3, 5, 8, 13];
const AC_HEADING = /^(acceptance criteria|tiêu chí nghiệm thu)\s*:?\s*$/i;

// ---------------------------------------------------------------------------
// Jira giả lập: cùng dạng dữ liệu với Jira Cloud REST API (description theo Atlassian Document Format)
// ---------------------------------------------------------------------------
const adf = (desc, criteria) => ({
  type: 'doc', version: 1,
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: desc }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Acceptance criteria', marks: [{ type: 'strong' }] }] },
    { type: 'bulletList', content: criteria.map((c) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: c }] }] })) },
  ],
});
const mockIssue = (key, summary, priority, points, sprintId, component, desc, criteria) => ({
  key,
  fields: {
    summary, priority: { name: priority }, status: { name: 'To Do' },
    components: component ? [{ name: component }] : [],
    description: adf(desc, criteria),
    mock_points: points, mock_sprint: sprintId,
  },
});

const MOCK_PROJECTS = {
  HRM: {
    key: 'HRM',
    name: 'Hệ thống quản lý nhân sự',
    description: 'Quản lý hồ sơ nhân viên, chấm công và nghỉ phép.',
    components: [{ name: 'Hồ sơ nhân viên' }, { name: 'Chấm công' }, { name: 'Nghỉ phép' }],
    members: [
      { accountId: 'mock-qalead', displayName: 'Trần Trưởng Nhóm QA', emailAddress: 'qalead@demo.local' },
      { accountId: 'mock-poba', displayName: 'Võ Phân Tích', emailAddress: 'poba@demo.local' },
      { accountId: 'mock-tester', displayName: 'Lê Kiểm Thử', emailAddress: 'tester@demo.local' },
      { accountId: 'mock-dev', displayName: 'Phạm Lập Trình', emailAddress: 'dev@demo.local' },
      { accountId: 'mock-guest', displayName: 'Đỗ Khách Hàng', emailAddress: 'khach.hang@example.com' },
    ],
    sprints: [
      { id: 9001, name: 'HRM Sprint 1', goal: 'Nhân viên tự xin nghỉ phép trên hệ thống', state: 'active', startDate: '2026-11-02T01:00:00.000Z', endDate: '2026-11-15T10:00:00.000Z' },
      { id: 9002, name: 'HRM Sprint 2', state: 'future' }, // chưa có ngày: chưa đồng bộ
    ],
    issues: [
      mockIssue('HRM-1', 'Xin nghỉ phép trực tuyến', 'High', 5, 9001, 'Nghỉ phép',
        'Là nhân viên, tôi muốn gửi đơn xin nghỉ phép trực tuyến, để không phải nộp giấy.',
        ['Chọn ngày bắt đầu, ngày kết thúc và lý do thì gửi được đơn',
          'Ngày kết thúc trước ngày bắt đầu thì báo lỗi "Ngày kết thúc không hợp lệ"',
          'Số ngày nghỉ vượt quá số ngày phép còn lại thì không cho gửi']),
      mockIssue('HRM-2', 'Chấm công bằng nút Check-in', 'Medium', 3, 9001, 'Chấm công',
        'Là nhân viên, tôi muốn bấm Check-in khi đến công ty, để hệ thống ghi giờ làm.',
        ['Bấm Check-in thì lưu giờ vào', 'Mỗi ngày chỉ Check-in một lần']),
      mockIssue('HRM-3', 'Xem hồ sơ cá nhân', 'Lowest', 4, null, 'Hồ sơ nhân viên',
        'Là nhân viên, tôi muốn xem hồ sơ cá nhân, để kiểm tra thông tin đúng chưa.',
        ['Hiển thị họ tên, phòng ban, ngày vào làm']),
    ],
  },
  LIB: {
    key: 'LIB',
    name: 'Thư viện số',
    description: 'Mượn, trả và gia hạn sách trực tuyến.',
    components: [{ name: 'Tìm sách' }, { name: 'Mượn trả' }],
    members: [
      { accountId: 'mock-tester', displayName: 'Lê Kiểm Thử', emailAddress: 'tester@demo.local' },
      { accountId: 'mock-dev', displayName: 'Phạm Lập Trình', emailAddress: 'dev@demo.local' },
    ],
    sprints: [],
    issues: [
      mockIssue('LIB-1', 'Tìm sách theo tên', 'Medium', 2, null, 'Tìm sách',
        'Là bạn đọc, tôi muốn tìm sách theo tên, để biết sách còn hay không.', ['Gõ một phần tên sách thì hiện danh sách sách phù hợp']),
      { key: 'LIB-2', fields: { summary: 'Gia hạn sách', priority: { name: 'Low' }, status: { name: 'To Do' }, components: [],
        description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Là bạn đọc, tôi muốn gia hạn sách đang mượn.' }] }] } } },
    ],
  },
};

const isMock = () => !config.jira.baseUrl;

function info() {
  return { mode: isMock() ? 'mock' : 'jira', site: isMock() ? null : config.jira.baseUrl.replace(/\/+$/, ''), webhook: Boolean(config.jira.webhookSecret) };
}

// ---------------------------------------------------------------------------
// Gọi Jira REST API; lỗi mạng/xác thực đổi thành thông báo tiếng Việt
// ---------------------------------------------------------------------------
async function jira(path, { method = 'GET', body } = {}) {
  const { baseUrl, email, apiToken } = config.jira;
  let res;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new AppError(502, 'Không kết nối được tới Jira, kiểm tra JIRA_BASE_URL và mạng');
  }
  if (res.status === 401 || res.status === 403) throw new AppError(502, 'Jira từ chối xác thực, kiểm tra JIRA_EMAIL và JIRA_API_TOKEN');
  if (res.status === 404) return null;
  if (!res.ok) throw new AppError(502, `Jira trả lỗi ${res.status}`);
  return res.json();
}

async function testConnection() {
  if (isMock()) return { ok: true, ...info(), user: 'Jira giả lập (chưa cấu hình JIRA_BASE_URL)' };
  const me = await jira('/rest/api/3/myself');
  return { ok: true, ...info(), user: me?.displayName || me?.emailAddress || '' };
}

// Dự án, component và thành viên của một mã dự án
async function fetchProject(key) {
  if (isMock()) {
    const p = MOCK_PROJECTS[key];
    return p ? { key: p.key, name: p.name, description: p.description, components: p.components, members: p.members } : null;
  }
  const p = await jira(`/rest/api/3/project/${encodeURIComponent(key)}`);
  if (!p) return null;
  const members = (await jira(`/rest/api/3/user/assignable/search?project=${encodeURIComponent(key)}&maxResults=200`)) || [];
  return {
    key: p.key,
    name: p.name,
    description: typeof p.description === 'string' ? p.description : '',
    components: (p.components || []).map((c) => ({ name: c.name, description: c.description || null })),
    members: members.filter((m) => m.accountType !== 'app'),
  };
}

// Id của trường Story point và Sprint (mỗi site Jira đặt id khác nhau, tìm theo tên)
async function fieldIds() {
  const fields = (await jira('/rest/api/3/field')) || [];
  const find = (...names) => fields.find((f) => names.includes(f.name))?.id;
  return { points: find('Story point estimate', 'Story Points', 'Story points'), sprint: find('Sprint') };
}

// Các sprint của dự án (Jira Software: board → sprint)
async function fetchSprints(key) {
  if (isMock()) return MOCK_PROJECTS[key]?.sprints || [];
  const boards = await jira(`/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(key)}`);
  const board = boards?.values?.[0];
  if (!board) return [];
  const out = [];
  for (let startAt = 0; ; startAt += 50) {
    const page = await jira(`/rest/agile/1.0/board/${board.id}/sprint?startAt=${startAt}&maxResults=50`);
    out.push(...(page?.values || []));
    if (!page || page.isLast !== false) break;
  }
  return out;
}

// Mọi issue loại Story của dự án, đổi về một dạng chung { key, summary, priority, status, component, description(ADF), points, sprintId }
async function fetchStories(key) {
  if (isMock()) {
    return (MOCK_PROJECTS[key]?.issues || []).map((i) => ({
      key: i.key, summary: i.fields.summary, priority: i.fields.priority?.name, status: i.fields.status?.name,
      component: i.fields.components?.[0]?.name || null, description: i.fields.description,
      points: i.fields.mock_points ?? null, sprintId: i.fields.mock_sprint ?? null,
    }));
  }
  const ids = await fieldIds();
  const fields = ['summary', 'description', 'priority', 'status', 'components', ids.points, ids.sprint].filter(Boolean);
  const out = [];
  let nextPageToken;
  do {
    const page = await jira('/rest/api/3/search/jql', {
      method: 'POST',
      body: { jql: `project = "${key}" AND issuetype = Story ORDER BY key ASC`, fields, maxResults: 100, ...(nextPageToken ? { nextPageToken } : {}) },
    });
    for (const i of page?.issues || []) {
      const sprints = ids.sprint ? i.fields[ids.sprint] || [] : [];
      // story có thể đi qua nhiều sprint: lấy sprint chưa đóng, nếu không có thì sprint cuối cùng
      const sp = sprints.find((s) => s.state !== 'closed') || sprints[sprints.length - 1];
      out.push({
        key: i.key, summary: i.fields.summary, priority: i.fields.priority?.name, status: i.fields.status?.name,
        component: i.fields.components?.[0]?.name || null, description: i.fields.description,
        points: ids.points ? i.fields[ids.points] ?? null : null, sprintId: sp?.id ?? null,
      });
    }
    nextPageToken = page?.isLast === false ? page.nextPageToken : undefined;
  } while (nextPageToken);
  return out;
}

// ---------------------------------------------------------------------------
// Chuyển dữ liệu Jira sang dạng nội bộ
// ---------------------------------------------------------------------------
// Atlassian Document Format → các dòng chữ; mỗi mục danh sách một dòng bắt đầu bằng "- "
function adfLines(node, out = [], prefix = '') {
  if (!node) return out;
  if (typeof node === 'string') return out.concat(node.split(/\r?\n/));
  const text = (n) => (n.type === 'text' ? n.text : n.type === 'hardBreak' ? '\n' : (n.content || []).map(text).join(''));
  for (const n of node.content || []) {
    if (n.type === 'bulletList' || n.type === 'orderedList') {
      for (const item of n.content || []) {
        const lines = [];
        adfLines(item, lines);
        if (lines.length) out.push(`- ${lines.join(' ')}`);
      }
    } else if (['paragraph', 'heading', 'blockquote', 'panel'].includes(n.type)) {
      if (n.type === 'blockquote' || n.type === 'panel') adfLines(n, out, prefix);
      else text(n).split('\n').forEach((l) => l.trim() && out.push(prefix + l.trim()));
    } else if (n.content) adfLines(n, out, prefix);
  }
  return out;
}

// QĐ1: mục "Acceptance criteria" trong Description; phần trước là mô tả, mỗi dòng sau là một tiêu chí
function splitDescription(descriptionAdf) {
  const lines = adfLines(descriptionAdf);
  const idx = lines.findIndex((l) => AC_HEADING.test(l.replace(/\*/g, '').trim()));
  const before = idx < 0 ? lines : lines.slice(0, idx);
  const after = idx < 0 ? [] : lines.slice(idx + 1);
  return {
    description: before.join('\n').trim(),
    criteria: after.map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).join('\n'),
  };
}

// Highest/High → High, Medium → Medium, Low/Lowest → Low; ngoài danh sách PRIORITIES thì lấy Medium
function mapPriority(name) {
  const n = String(name || '').toLowerCase();
  const p = n.includes('high') ? 'High' : n.includes('low') ? 'Low' : 'Medium';
  return params.get('PRIORITIES').split(',').includes(p) ? p : 'Medium';
}

// Thành viên Jira → tài khoản hệ thống: trùng email, nếu Jira ẩn email thì trùng họ tên
function mapMembers(members) {
  const users = getDb().prepare('SELECT id, email, full_name FROM users WHERE active = 1').all();
  const mapped = [];
  const unmapped = [];
  for (const m of members) {
    const email = (m.emailAddress || '').toLowerCase();
    const u = users.find((x) => (email && (x.email || '').toLowerCase() === email) || (!email && x.full_name === m.displayName));
    if (u) mapped.push({ user_id: u.id, account_id: m.accountId });
    else unmapped.push(m.displayName);
  }
  return { mapped, unmapped };
}

function saveProjectMeta(projectId, jp, members) {
  const db = getDb();
  const insModule = db.prepare('INSERT OR IGNORE INTO modules (project_id, name, description) VALUES (?, ?, ?)');
  jp.components.filter((c) => c.name).forEach((c) => insModule.run(projectId, c.name.slice(0, 100), c.description));
  db.prepare('DELETE FROM project_members WHERE project_id = ?').run(projectId);
  const insMember = db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, jira_account_id) VALUES (?, ?, ?)');
  members.mapped.forEach((m) => insMember.run(projectId, m.user_id, m.account_id));
}

// YC14: sprint có ngày bắt đầu, kết thúc thì đồng bộ; sprint chưa đặt ngày thì bỏ qua (story của nó nằm ở backlog)
function saveSprints(projectId, sprints, warnings) {
  const db = getDb();
  const map = new Map();
  for (const s of sprints) {
    if (!s.startDate || !s.endDate) {
      warnings.push(`${s.name}: chưa đặt ngày trên Jira, chưa đồng bộ`);
      continue;
    }
    const start = s.startDate.slice(0, 10);
    const end = s.endDate.slice(0, 10) < start ? start : s.endDate.slice(0, 10);
    const len = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
    if (len > params.get('SPRINT_MAX_DAYS')) warnings.push(`${s.name}: dài ${len} ngày, vượt SPRINT_MAX_DAYS (QĐ14)`);
    const row = db.prepare('SELECT id FROM sprints WHERE project_id = ? AND (jira_id = ? OR (jira_id IS NULL AND name = ?))').get(projectId, s.id, s.name);
    if (row) {
      db.prepare('UPDATE sprints SET name = ?, goal = ?, start_date = ?, end_date = ?, jira_id = ?, state = ? WHERE id = ?')
        .run(s.name, s.goal || null, start, end, s.id, s.state || null, row.id);
      map.set(s.id, row.id);
    } else {
      const info = db.prepare('INSERT INTO sprints (project_id, name, goal, start_date, end_date, jira_id, state) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(projectId, s.name, s.goal || null, start, end, s.id, s.state || null);
      map.set(s.id, Number(info.lastInsertRowid));
    }
  }
  return map;
}

// YC1 + YC8: thêm story mới, cập nhật story đã có, đánh dấu cần xem lại, lưu trữ story đã xóa trên Jira
function saveStories(projectId, issues, sprintMap, userId, warnings) {
  const db = getDb();
  const modules = new Map(db.prepare('SELECT id, name FROM modules WHERE project_id = ?').all(projectId).map((m) => [m.name, m.id]));
  const minAc = params.get('MIN_AC_PER_STORY');
  const r = { created: 0, updated: 0, changed: 0, archived: 0, missingCriteria: 0 };
  const seen = new Set();
  for (const i of issues) {
    seen.add(i.key);
    const { description, criteria } = splitDescription(i.description);
    if (criteria.split('\n').filter(Boolean).length < minAc) r.missingCriteria += 1;
    let points = i.points == null ? null : Number(i.points);
    if (points != null && !STORY_POINTS.includes(points)) {
      warnings.push(`${i.key}: story point ${points} không thuộc 1, 2, 3, 5, 8, 13 nên bỏ qua (QĐ14)`);
      points = null;
    }
    const d = {
      title: String(i.summary || i.key).slice(0, 200), description, criteria,
      priority: mapPriority(i.priority), points, status: i.status || null,
      module: modules.get(i.component) || null, sprint: i.sprintId != null ? sprintMap.get(i.sprintId) || null : null,
    };
    const old = db.prepare('SELECT * FROM user_stories WHERE code = ?').get(i.key);
    if (old && old.project_id !== projectId) {
      warnings.push(`${i.key}: mã đã thuộc dự án khác, bỏ qua`);
      continue;
    }
    if (!old) {
      db.prepare(
        `INSERT INTO user_stories (code, project_id, module_id, sprint_id, title, description, acceptance_criteria, priority, story_points,
           jira_status, synced_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), ?)`
      ).run(i.key, projectId, d.module, d.sprint, d.title, d.description, d.criteria, d.priority, d.points, d.status, userId || null);
      r.created += 1;
      continue;
    }
    // QĐ8: tiêu đề, mô tả hoặc acceptance criteria đổi khi story đã có test case → test case cần xem lại
    const contentChanged = old.title !== d.title || old.description !== d.description || old.acceptance_criteria !== d.criteria;
    const hasTc = db.prepare('SELECT 1 FROM test_cases WHERE story_id = ? LIMIT 1').get(old.id);
    const changedAt = contentChanged && hasTc ? "datetime('now','localtime')" : 'changed_at';
    const differs = contentChanged || old.priority !== d.priority || old.story_points !== d.points || old.module_id !== d.module
      || old.sprint_id !== d.sprint || old.jira_status !== d.status || old.archived;
    db.prepare(
      `UPDATE user_stories SET module_id = ?, sprint_id = ?, title = ?, description = ?, acceptance_criteria = ?, priority = ?, story_points = ?,
         jira_status = ?, archived = 0, synced_at = datetime('now','localtime'), changed_at = ${changedAt}
         ${differs ? ", updated_at = datetime('now','localtime')" : ''} WHERE id = ?`
    ).run(d.module, d.sprint, d.title, d.description, d.criteria, d.priority, d.points, d.status, old.id);
    if (differs) r.updated += 1;
    if (contentChanged && hasTc) r.changed += 1;
  }
  // Story không còn trên Jira: lưu trữ, không xóa test case đã viết
  for (const s of db.prepare('SELECT id, code FROM user_stories WHERE project_id = ? AND archived = 0').all(projectId)) {
    if (!seen.has(s.code)) {
      db.prepare("UPDATE user_stories SET archived = 1, updated_at = datetime('now','localtime') WHERE id = ?").run(s.id);
      r.archived += 1;
    }
  }
  return r;
}

// Đồng bộ đầy đủ một dự án đã liên kết Jira (dùng chung cho nút Đồng bộ, webhook và đồng bộ định kỳ)
async function syncProject(projectId, userId) {
  const db = getDb();
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!p) throw notFound('Dự án không tồn tại');
  if (!p.jira_key) throw badRequest('Dự án mẫu này không liên kết với Jira nên không đồng bộ được');
  const jp = await fetchProject(p.jira_key);
  if (!jp) throw notFound(`Không tìm thấy dự án ${p.jira_key} trên Jira`);
  const [sprints, issues] = [await fetchSprints(p.jira_key), await fetchStories(p.jira_key)];
  const members = mapMembers(jp.members);
  const warnings = [];
  const stories = db.transaction(() => {
    db.prepare("UPDATE projects SET name = ?, description = ?, synced_at = datetime('now','localtime') WHERE id = ?")
      .run(jp.name.slice(0, 200), jp.description || '', projectId);
    saveProjectMeta(projectId, jp, members);
    const sprintMap = saveSprints(projectId, sprints, warnings);
    return saveStories(projectId, issues, sprintMap, userId, warnings);
  })();
  return {
    id: Number(projectId), code: p.code, name: jp.name,
    modules: jp.components.length, members: members.mapped.length, unmapped: members.unmapped,
    sprints: sprints.filter((s) => s.startDate && s.endDate).length, stories, warnings,
  };
}

// QĐ13: thêm dự án từ Jira (mã chưa có trong hệ thống), rồi đồng bộ story và sprint
async function importProject(input, userId) {
  const key = String(input?.key || '').trim().toUpperCase();
  if (!KEY_REGEX.test(key)) throw badRequest('Mã dự án Jira gồm 2–10 ký tự in hoa hoặc số, bắt đầu bằng chữ cái');
  const db = getDb();
  if (db.prepare('SELECT 1 FROM projects WHERE code = ?').get(key)) throw conflict(`Dự án ${key} đã có trong hệ thống (QĐ13)`);
  const jp = await fetchProject(key);
  if (!jp) throw notFound(`Không tìm thấy dự án ${key} trên Jira`);
  const id = db.prepare('INSERT INTO projects (code, name, description, jira_key, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(key, jp.name.slice(0, 200), jp.description || '', jp.key, userId).lastInsertRowid;
  try {
    return await syncProject(Number(id), userId);
  } catch (e) {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id); // lỗi giữa chừng thì không để lại dự án rỗng
    throw e;
  }
}

async function syncAll(userId) {
  const out = [];
  for (const p of getDb().prepare('SELECT id FROM projects WHERE jira_key IS NOT NULL').all()) out.push(await syncProject(p.id, userId));
  return out;
}

// QĐ8: webhook chỉ nhận khi đúng mã bí mật (JIRA_WEBHOOK_SECRET), so sánh an toàn theo thời gian
function checkWebhookSecret(given) {
  const secret = config.jira.webhookSecret;
  if (!secret) throw new AppError(503, 'Chưa bật webhook Jira (thiếu JIRA_WEBHOOK_SECRET)');
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new AppError(401, 'Sai mã bí mật webhook');
}

// Webhook jira:issue_created / updated / deleted, sprint_*: đồng bộ lại dự án chứa issue đó
async function handleWebhook(body) {
  const key = body?.issue?.fields?.project?.key || body?.issue?.key?.split('-')[0];
  if (!key) {
    // sự kiện sprint không kèm mã dự án: đồng bộ lại mọi dự án Jira
    if (String(body?.webhookEvent || '').startsWith('sprint_')) return { ok: true, event: body.webhookEvent, projects: (await syncAll(null)).length };
    return { ok: true, ignored: 'không xác định được dự án' };
  }
  const p = getDb().prepare('SELECT id FROM projects WHERE jira_key = ?').get(key);
  if (!p) return { ok: true, ignored: `dự án ${key} chưa được thêm vào hệ thống` };
  const r = await syncProject(p.id, null);
  return { ok: true, event: body.webhookEvent || null, project: key, stories: r.stories };
}

function members(projectId) {
  return getDb()
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role FROM project_members pm JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ? ORDER BY u.full_name`
    )
    .all(projectId);
}

module.exports = {
  info, testConnection, importProject, syncProject, syncAll, checkWebhookSecret, handleWebhook, members,
  splitDescription, adfLines, mapPriority, isMock, MOCK_PROJECTS,
};
