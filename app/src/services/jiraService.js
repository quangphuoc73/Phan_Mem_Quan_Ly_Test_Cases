// Đồng bộ MỘT CHIỀU từ Jira vào hệ thống (Jira là nơi duy nhất tạo và sửa requirement).
//   YC12: dự án, module (component), thành viên                       – BM11, QĐ12
//   YC1 : requirement (tiêu đề, mô tả, AC, ưu tiên, loại issue)        – BM1, QĐ1
//   YC8 : nhận thay đổi (webhook / định kỳ / nút Đồng bộ ngay)          – BM7, QĐ8
//   YC20 (ngoài MVP, SPRINT_ENABLED): sprint                           – BM19, QĐ20
// Thông tin kết nối (địa chỉ, email, API token) chỉ nằm trong app/.env ở backend.
// Chưa cấu hình JIRA_BASE_URL thì dùng Jira giả lập (dữ liệu mẫu) – dùng cho kiểm thử tự động và demo không có mạng.
const crypto = require('crypto');
const { getDb } = require('../db');
const config = require('../config');
const params = require('./parameterService');
const stories = require('./storyService');
const ac = require('../utils/ac');
const { AppError, badRequest, notFound, conflict } = require('../utils/errors');

const KEY_REGEX = /^[A-Z][A-Z0-9]{1,9}$/; // QĐ12: mã dự án 2–10 ký tự in hoa/số, bắt đầu bằng chữ
const STORY_POINTS = [1, 2, 3, 5, 8, 13];
const AC_HEADING = /^(acceptance criteria|tiêu chí nghiệm thu)\s*:?\s*$/i; // QĐ1: nhãn cố định

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
let mockClock = Date.parse('2026-11-01T08:00:00.000Z');
const mockStamp = () => new Date((mockClock += 60000)).toISOString();
const mockIssue = (id, key, summary, priority, points, sprintId, component, desc, criteria) => ({
  id, key,
  fields: {
    summary, priority: { name: priority }, status: { name: 'To Do' }, issuetype: { name: 'Story' }, updated: mockStamp(),
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
      { id: 9002, name: 'HRM Sprint 2', state: 'future' },
    ],
    issues: [
      mockIssue('10001', 'HRM-1', 'Xin nghỉ phép trực tuyến', 'High', 5, 9001, 'Nghỉ phép',
        'Là nhân viên, tôi muốn gửi đơn xin nghỉ phép trực tuyến, để không phải nộp giấy.',
        ['Chọn ngày bắt đầu, ngày kết thúc và lý do thì gửi được đơn',
          'Ngày kết thúc trước ngày bắt đầu thì báo lỗi "Ngày kết thúc không hợp lệ"',
          'Số ngày nghỉ vượt quá số ngày phép còn lại thì không cho gửi']),
      mockIssue('10002', 'HRM-2', 'Chấm công bằng nút Check-in', 'Medium', 3, 9001, 'Chấm công',
        'Là nhân viên, tôi muốn bấm Check-in khi đến công ty, để hệ thống ghi giờ làm.',
        ['Bấm Check-in thì lưu giờ vào', 'Mỗi ngày chỉ Check-in một lần']),
      mockIssue('10003', 'HRM-3', 'Xem hồ sơ cá nhân', 'Lowest', 4, null, 'Hồ sơ nhân viên',
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
      mockIssue('20001', 'LIB-1', 'Tìm sách theo tên', 'Medium', 2, null, 'Tìm sách',
        'Là bạn đọc, tôi muốn tìm sách theo tên, để biết sách còn hay không.', ['Gõ một phần tên sách thì hiện danh sách sách phù hợp']),
      { id: '20002', key: 'LIB-2', fields: { summary: 'Gia hạn sách', priority: { name: 'Low' }, status: { name: 'To Do' }, issuetype: { name: 'Story' },
        updated: mockStamp(), components: [],
        description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Là bạn đọc, tôi muốn gia hạn sách đang mượn.' }] }] } } },
    ],
  },
};

const mockFind = (idOrKey) => {
  for (const p of Object.values(MOCK_PROJECTS)) {
    const i = p.issues.find((x) => x.id === String(idOrKey) || x.key === idOrKey);
    if (i) return { project: p, issue: i };
  }
  return null;
};

// Giả lập PO/BA sửa issue trên Jira (chỉ chế độ giả lập): dùng cho demo và kiểm thử tự động.
// changes: { summary, description, criteria[], priority, issuetype, key, deleted }
function mockEditIssue(key, changes = {}) {
  if (!isMock()) throw badRequest('Chỉ sửa được issue trên Jira giả lập');
  const found = mockFind(key);
  if (!found) throw notFound(`Jira giả lập không có issue ${key}`);
  const { project, issue } = found;
  if (changes.deleted) {
    project.issues.splice(project.issues.indexOf(issue), 1);
    return { key, deleted: true };
  }
  const cur = splitDescription(issue.fields.description);
  if (changes.summary !== undefined) issue.fields.summary = changes.summary;
  if (changes.description !== undefined || changes.criteria !== undefined) {
    issue.fields.description = adf(changes.description ?? cur.description, changes.criteria ?? ac.parse(cur.criteria));
  }
  if (changes.priority) issue.fields.priority = { name: changes.priority };
  if (changes.issuetype) issue.fields.issuetype = { name: changes.issuetype };
  if (changes.key) issue.key = changes.key;
  issue.fields.updated = mockStamp();
  return { key: issue.key, id: issue.id, updated: issue.fields.updated };
}

function mockRestoreIssue(projectKey, issue) {
  MOCK_PROJECTS[projectKey].issues.push(issue);
  issue.fields.updated = mockStamp();
}

const isMock = () => !config.jira.baseUrl;

function info() {
  return {
    mode: isMock() ? 'mock' : 'jira',
    site: isMock() ? null : config.jira.baseUrl.replace(/\/+$/, ''),
    webhook: Boolean(config.jira.webhookSecret),
    issueTypes: config.jira.issueTypes,
  };
}

// ---------------------------------------------------------------------------
// Gọi Jira REST API; lỗi mạng/xác thực đổi thành thông báo tiếng Việt.
// QĐ8: lỗi kết nối hoặc lỗi máy chủ được thử lại tối đa 2 lần (config.jira.maxRetry)
// ---------------------------------------------------------------------------
async function jiraOnce(path, { method = 'GET', body } = {}) {
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
    throw Object.assign(new AppError(502, 'Không kết nối được tới Jira, kiểm tra JIRA_BASE_URL và mạng'), { retry: true });
  }
  if (res.status === 401 || res.status === 403) throw new AppError(502, 'Jira từ chối xác thực, kiểm tra JIRA_EMAIL và JIRA_API_TOKEN');
  if (res.status === 404) return null;
  if (!res.ok) throw Object.assign(new AppError(502, `Jira trả lỗi ${res.status}`), { retry: res.status >= 500 || res.status === 429 });
  return res.json();
}

let attemptsUsed = 0; // số lần gọi thực tế của lượt đồng bộ đang chạy (ghi vào sync_logs)
async function jira(path, opts) {
  for (let i = 0; ; i++) {
    attemptsUsed += 1;
    try {
      return await jiraOnce(path, opts);
    } catch (e) {
      if (!e.retry || i >= config.jira.maxRetry) throw e;
    }
  }
}

async function testConnection() {
  if (isMock()) return { ok: true, ...info(), user: 'Jira giả lập (chưa cấu hình JIRA_BASE_URL)' };
  const me = await jira('/rest/api/3/myself');
  return { ok: true, ...info(), user: me?.displayName || me?.emailAddress || '' };
}

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

async function fieldIds() {
  const fields = (await jira('/rest/api/3/field')) || [];
  const find = (...names) => fields.find((f) => names.includes(f.name))?.id;
  return { points: find('Story point estimate', 'Story Points', 'Story points'), sprint: find('Sprint') };
}

async function fetchSprints(key) {
  if (!config.features.sprint) return [];
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

const typeAllowed = (name) => config.jira.issueTypes.some((t) => t.toLowerCase() === String(name || '').toLowerCase());

const toIssue = (i, extra = {}) => ({
  id: String(i.id), key: i.key, type: i.fields.issuetype?.name || 'Story', updated: i.fields.updated || null,
  summary: i.fields.summary, priority: i.fields.priority?.name, status: i.fields.status?.name,
  component: i.fields.components?.[0]?.name || null, description: i.fields.description, ...extra,
});

// QĐ1 [B2]: mọi issue thuộc các loại trong JIRA_ISSUE_TYPES của dự án
async function fetchStories(key) {
  if (isMock()) {
    return (MOCK_PROJECTS[key]?.issues || [])
      .filter((i) => typeAllowed(i.fields.issuetype?.name))
      .map((i) => toIssue(i, { points: i.fields.mock_points ?? null, sprintId: i.fields.mock_sprint ?? null }));
  }
  const ids = config.features.sprint ? await fieldIds() : {};
  const fields = ['summary', 'description', 'priority', 'status', 'components', 'issuetype', 'updated', ids.points, ids.sprint].filter(Boolean);
  const types = config.jira.issueTypes.map((t) => `"${t.replace(/"/g, '')}"`).join(', ');
  const out = [];
  let nextPageToken;
  do {
    const page = await jira('/rest/api/3/search/jql', {
      method: 'POST',
      body: { jql: `project = "${key}" AND issuetype in (${types}) ORDER BY key ASC`, fields, maxResults: 100, ...(nextPageToken ? { nextPageToken } : {}) },
    });
    for (const i of page?.issues || []) {
      const sprints = ids.sprint ? i.fields[ids.sprint] || [] : [];
      const sp = sprints.find((s) => s.state !== 'closed') || sprints[sprints.length - 1];
      out.push(toIssue(i, { points: ids.points ? i.fields[ids.points] ?? null : null, sprintId: sp?.id ?? null }));
    }
    nextPageToken = page?.isLast === false ? page.nextPageToken : undefined;
  } while (nextPageToken);
  return out;
}

// QĐ8 [1.4]: hỏi lại Jira theo issue ID; null = Jira báo không tìm thấy (bị xóa hoặc mất quyền đọc, cùng mã 404)
async function fetchIssue(id) {
  if (isMock()) {
    const f = mockFind(id);
    return f ? { id: f.issue.id, type: f.issue.fields.issuetype?.name } : null;
  }
  const i = await jira(`/rest/api/3/issue/${encodeURIComponent(id)}?fields=issuetype`);
  return i ? { id: String(i.id), type: i.fields?.issuetype?.name } : null;
}

// ---------------------------------------------------------------------------
// Chuyển dữ liệu Jira sang dạng nội bộ
// ---------------------------------------------------------------------------
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

// QĐ1: trong Description, phần trước nhãn "Acceptance criteria" là mô tả, mỗi dòng sau là một AC
function splitDescription(descriptionAdf) {
  const lines = adfLines(descriptionAdf);
  const idx = lines.findIndex((l) => AC_HEADING.test(l.replace(/\*/g, '').trim()));
  const before = idx < 0 ? lines : lines.slice(0, idx);
  const after = idx < 0 ? [] : lines.slice(idx + 1);
  return { description: before.join('\n').trim(), criteria: ac.parse(after.join('\n')).join('\n') };
}

// QĐ1: Highest/High → High, Medium → Medium, Low/Lowest → Low; khác thì Medium
function mapPriority(name) {
  const n = String(name || '').toLowerCase();
  return n.includes('high') ? 'High' : n.includes('low') ? 'Low' : 'Medium';
}

// Thời điểm Jira (VD 2026-11-10T10:00:00.000+0700) → ISO UTC để so sánh được [1.2]
function toIso(s) {
  if (!s) return null;
  const t = Date.parse(String(s).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// QĐ12: thành viên Jira → tài khoản: trùng email; Jira ẩn email thì so họ tên, nhiều tài khoản trùng họ tên thì không gán
function mapMembers(members) {
  const users = getDb().prepare('SELECT id, email, full_name FROM users WHERE active = 1').all();
  const mapped = [];
  const unmapped = [];
  for (const m of members) {
    const email = (m.emailAddress || '').toLowerCase();
    const byName = users.filter((x) => x.full_name === m.displayName);
    const u = email ? users.find((x) => (x.email || '').toLowerCase() === email) : byName.length === 1 ? byName[0] : null;
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

// YC20 (ngoài MVP): sprint có ngày bắt đầu, kết thúc thì đồng bộ
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
    if (len > params.get('SPRINT_MAX_DAYS')) warnings.push(`${s.name}: dài ${len} ngày, vượt SPRINT_MAX_DAYS (QĐ20)`);
    const row = db.prepare('SELECT id FROM sprints WHERE project_id = ? AND (jira_id = ? OR (jira_id IS NULL AND name = ?))').get(projectId, s.id, s.name);
    if (row) {
      db.prepare('UPDATE sprints SET name = ?, goal = ?, start_date = ?, end_date = ?, jira_id = ?, state = ? WHERE id = ?')
        .run(s.name, s.goal || null, start, end, s.id, s.state || null, row.id);
      map.set(s.id, row.id);
    } else {
      const r = db.prepare('INSERT INTO sprints (project_id, name, goal, start_date, end_date, jira_id, state) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(projectId, s.name, s.goal || null, start, end, s.id, s.state || null);
      map.set(s.id, Number(r.lastInsertRowid));
    }
  }
  return map;
}

// YC1 + YC8: thêm requirement mới; cập nhật requirement đã có (chỉ khi Jira có bản mới hơn);
// requirement Cần kiểm tra / đã lưu trữ xuất hiện lại thì tự hiện lại; gắn cờ Cần kiểm tra cho requirement biến mất.
function saveStories(projectId, issues, missing, sprintMap, userId, source, warnings) {
  const db = getDb();
  const modules = new Map(db.prepare('SELECT id, name FROM modules WHERE project_id = ?').all(projectId).map((m) => [m.name, m.id]));
  const r = { created: 0, updated: 0, versioned: 0, flaggedTests: 0, skippedOlder: 0, needsCheck: 0, restored: 0, missingCriteria: 0 };
  for (const i of issues) {
    const { description, criteria } = splitDescription(i.description);
    if (!criteria) r.missingCriteria += 1;
    let points = i.points == null ? null : Number(i.points);
    if (points != null && !STORY_POINTS.includes(points)) {
      if (config.features.sprint) warnings.push(`${i.key}: story point ${points} không thuộc 1, 2, 3, 5, 8, 13 nên bỏ qua (QĐ20)`);
      points = null;
    }
    const d = {
      title: String(i.summary || i.key).slice(0, 200), description, acceptance_criteria: criteria,
      priority: mapPriority(i.priority), status: i.status || null, type: i.type,
      module: modules.get(i.component) || null, sprint: i.sprintId != null ? sprintMap.get(i.sprintId) || null : null,
      updated: toIso(i.updated),
    };
    // [1.1] nhận diện bằng issue ID; requirement cũ chưa có issue ID thì nhận theo mã
    let old = db.prepare('SELECT * FROM user_stories WHERE jira_issue_id = ?').get(i.id)
      || db.prepare('SELECT * FROM user_stories WHERE code = ? AND jira_issue_id IS NULL').get(i.key);
    if (old && old.project_id !== projectId) {
      warnings.push(`${i.key}: issue đã thuộc dự án khác trong hệ thống, bỏ qua`);
      continue;
    }
    if (!old) {
      if (db.prepare('SELECT 1 FROM user_stories WHERE code = ?').get(i.key)) {
        warnings.push(`${i.key}: mã đã được dùng cho requirement khác, bỏ qua`);
        continue;
      }
      const id = Number(db.prepare(
        `INSERT INTO user_stories (jira_issue_id, code, project_id, module_id, sprint_id, issue_type, title, description, acceptance_criteria,
           priority, story_points, jira_status, jira_updated_at, synced_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), ?)`
      ).run(i.id, i.key, projectId, d.module, d.sprint, d.type, d.title, d.description, d.acceptance_criteria, d.priority, points,
        d.status, d.updated, userId || null).lastInsertRowid);
      db.prepare(
        `INSERT INTO requirement_versions (story_id, version, title, description, acceptance_criteria, jira_updated_at, source)
         VALUES (?, 1, ?, ?, ?, ?, ?)`
      ).run(id, d.title, d.description, d.acceptance_criteria, d.updated, source);
      r.created += 1;
      continue;
    }
    // Issue có mặt lại trong kết quả đồng bộ: gỡ cờ Cần kiểm tra [D2], hiện lại requirement đã lưu trữ (QĐ8)
    if (old.check_reason || old.archived) {
      db.prepare('UPDATE user_stories SET check_reason = NULL, check_kept_by = NULL, check_kept_at = NULL, archived = 0 WHERE id = ?').run(old.id);
      r.restored += 1;
    }
    db.prepare("UPDATE user_stories SET jira_issue_id = ?, synced_at = datetime('now','localtime') WHERE id = ?").run(i.id, old.id);
    // [1.2] chỉ ghi khi thời điểm cập nhật trên Jira mới hơn bản đã lưu
    if (old.jira_updated_at && d.updated && d.updated <= old.jira_updated_at) {
      r.skippedOlder += 1;
      continue;
    }
    const meta = old.code !== i.key || old.priority !== d.priority || old.jira_status !== d.status || old.issue_type !== d.type
      || old.module_id !== d.module || old.sprint_id !== d.sprint || old.story_points !== points;
    db.prepare(
      `UPDATE user_stories SET code = ?, module_id = ?, sprint_id = ?, issue_type = ?, priority = ?, story_points = ?, jira_status = ?,
         jira_updated_at = ? ${meta ? ", updated_at = datetime('now','localtime')" : ''} WHERE id = ?`
    ).run(i.key, d.module, d.sprint, d.type, d.priority, points, d.status, d.updated, old.id);
    const change = stories.applyContentChange({ ...old, code: i.key }, d, source, d.updated);
    if (change) {
      r.versioned += 1;
      r.flaggedTests += change.flagged;
    }
    if (meta || change) r.updated += 1;
  }
  const setCheck = db.prepare("UPDATE user_stories SET check_reason = ?, updated_at = datetime('now','localtime') WHERE id = ?");
  for (const m of missing) {
    setCheck.run(m.reason, m.story_id);
    r.needsCheck += 1;
  }
  return r;
}

function logSync(projectId, source, userId, status, summary, error) {
  getDb()
    .prepare(
      `INSERT INTO sync_logs (project_id, source, status, attempts, summary, error, user_id, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`
    )
    .run(projectId, source, status, Math.max(attemptsUsed, 1), summary ? JSON.stringify(summary) : null, error || null, userId || null);
}

// Đồng bộ đầy đủ một dự án (nút Đồng bộ ngay, webhook, định kỳ). source: IMPORT | MANUAL | WEBHOOK | SCHEDULE
async function syncProject(projectId, userId, source = 'MANUAL') {
  const db = getDb();
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!p) throw notFound('Dự án không tồn tại');
  if (!p.jira_key) throw badRequest('Dự án mẫu này không liên kết với Jira nên không đồng bộ được');
  attemptsUsed = 0;
  let jp; let sprints; let issues; let missing = [];
  try {
    jp = await fetchProject(p.jira_key);
    if (!jp) throw notFound(`Không tìm thấy dự án ${p.jira_key} trên Jira`);
    sprints = await fetchSprints(p.jira_key);
    issues = await fetchStories(p.jira_key);
    // QĐ8 [1.4]: danh sách rỗng không gắn cờ; còn lại hỏi Jira theo từng issue ID
    if (issues.length) {
      const seen = new Set(issues.map((i) => i.id));
      const gone = db.prepare(
        'SELECT id, jira_issue_id FROM user_stories WHERE project_id = ? AND archived = 0 AND jira_issue_id IS NOT NULL'
      ).all(projectId).filter((s) => !seen.has(s.jira_issue_id));
      for (const s of gone) {
        const found = await fetchIssue(s.jira_issue_id);
        if (!found) missing.push({ story_id: s.id, reason: 'NOT_FOUND' });
        else if (!typeAllowed(found.type)) missing.push({ story_id: s.id, reason: 'TYPE_EXCLUDED' });
      }
    }
  } catch (e) {
    // Lỗi khi gọi Jira (đã thử lại): ghi nhật ký, không thay đổi dữ liệu, chờ lần đồng bộ kế tiếp
    if (source !== 'IMPORT') logSync(projectId, source, userId, 'FAILED', null, e.message);
    throw e;
  }
  const members = mapMembers(jp.members);
  const warnings = [];
  const result = db.transaction(() => {
    db.prepare("UPDATE projects SET name = ?, description = ?, synced_at = datetime('now','localtime') WHERE id = ?")
      .run(jp.name.slice(0, 200), jp.description || '', projectId);
    saveProjectMeta(projectId, jp, members);
    const sprintMap = saveSprints(projectId, sprints, warnings);
    return saveStories(projectId, issues, missing, sprintMap, userId, source, warnings);
  })();
  logSync(projectId, source, userId, 'SUCCESS', result, null);
  return {
    id: Number(projectId), code: p.code, name: jp.name,
    modules: jp.components.length, members: members.mapped.length, unmapped: members.unmapped,
    sprints: sprints.filter((s) => s.startDate && s.endDate).length, stories: result, warnings,
  };
}

// QĐ12: thêm dự án từ Jira (mã chưa có trong hệ thống), rồi đồng bộ requirement
async function importProject(input, userId) {
  const key = String(input?.key || '').trim().toUpperCase();
  if (!KEY_REGEX.test(key)) throw badRequest('Mã dự án Jira gồm 2–10 ký tự in hoa hoặc số, bắt đầu bằng chữ cái');
  const db = getDb();
  if (db.prepare('SELECT 1 FROM projects WHERE code = ?').get(key)) throw conflict(`Dự án ${key} đã có trong hệ thống (QĐ12)`);
  const jp = await fetchProject(key);
  if (!jp) throw notFound(`Không tìm thấy dự án ${key} trên Jira`);
  const id = db.prepare('INSERT INTO projects (code, name, description, jira_key, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(key, jp.name.slice(0, 200), jp.description || '', jp.key, userId).lastInsertRowid;
  try {
    return await syncProject(Number(id), userId, 'IMPORT');
  } catch (e) {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id); // lỗi giữa chừng thì không để lại dự án rỗng
    throw e;
  }
}

async function syncAll(userId, source = 'SCHEDULE') {
  const out = [];
  for (const p of getDb().prepare('SELECT id FROM projects WHERE jira_key IS NOT NULL').all()) {
    try {
      out.push(await syncProject(p.id, userId, source));
    } catch (e) {
      out.push({ id: p.id, error: e.message });
    }
  }
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

// QĐ8: không dùng dữ liệu trong webhook, chỉ lấy mã dự án rồi đồng bộ lại qua Jira API
async function handleWebhook(body) {
  const key = body?.issue?.fields?.project?.key || body?.issue?.key?.split('-')[0];
  if (!key) return { ok: true, ignored: 'không xác định được dự án' };
  const p = getDb().prepare('SELECT id FROM projects WHERE jira_key = ?').get(key);
  if (!p) return { ok: true, ignored: `dự án ${key} chưa được thêm vào hệ thống` };
  const r = await syncProject(p.id, null, 'WEBHOOK');
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

// BM7 [1.3]: lần đồng bộ gần nhất của dự án
function lastSync(projectId) {
  const row = getDb().prepare('SELECT * FROM sync_logs WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(projectId);
  return row && { ...row, summary: row.summary ? JSON.parse(row.summary) : null };
}

module.exports = {
  info, testConnection, importProject, syncProject, syncAll, checkWebhookSecret, handleWebhook, members, lastSync,
  splitDescription, adfLines, mapPriority, mapMembers, toIso, isMock, MOCK_PROJECTS, mockEditIssue, mockRestoreIssue,
};
