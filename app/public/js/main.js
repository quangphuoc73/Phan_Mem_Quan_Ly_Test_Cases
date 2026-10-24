// Khởi động ứng dụng, khung giao diện và điều hướng (hash router).
import { state, api, esc, can, logout, safeSet, toastError, bind, LABEL, busy, linkLabels } from './core.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderSprints } from './pages/sprints.js';
import { renderStories, renderStoryDetail } from './pages/stories.js';
import { renderTestCases } from './pages/testcases.js';
import { renderReview } from './pages/review.js';
import { renderRuns, renderParams, renderAiLogs, renderUsers, renderProjects, renderAudit } from './pages/admin.js';

const app = document.getElementById('app');

const NAV = [
  { group: 'Nghiệp vụ' },
  { hash: '#/dashboard', label: 'Tổng quan & báo cáo', icon: '📊' },
  { hash: '#/sprints', label: 'Sprint (Agile)', icon: '🏃' },
  { hash: '#/stories', label: 'User story', icon: '📝' },
  { hash: '#/testcases', label: 'Tra cứu test case', icon: '🧪' },
  { hash: '#/review', label: 'Duyệt test case', icon: '✅', perm: 'testcase:review', badge: true },
  { hash: '#/runs', label: 'Kết quả chạy test', icon: '▶️' },
  { group: 'AI & quy định' },
  { hash: '#/ai-logs', label: 'Nhật ký AI', icon: '🤖', perm: 'ailog:view' },
  { hash: '#/params', label: 'Thay đổi quy định', icon: '⚙️' },
  { group: 'Quản trị', perm: 'audit:view' },
  { hash: '#/projects', label: 'Dự án & module', icon: '📁', perm: 'project:manage' },
  { hash: '#/users', label: 'Người dùng', icon: '👤', perm: 'user:manage' },
  { hash: '#/audit', label: 'Nhật ký hoạt động', icon: '🛡️', perm: 'audit:view' },
];

const ROUTES = [
  [/^#\/dashboard$/, renderDashboard],
  [/^#\/sprints$/, renderSprints],
  [/^#\/stories$/, renderStories],
  [/^#\/stories\/(\d+)$/, renderStoryDetail],
  [/^#\/testcases$/, renderTestCases],
  [/^#\/review$/, renderReview],
  [/^#\/runs$/, renderRuns],
  [/^#\/params$/, renderParams],
  [/^#\/ai-logs$/, renderAiLogs],
  [/^#\/users$/, renderUsers],
  [/^#\/projects$/, renderProjects],
  [/^#\/audit$/, renderAudit],
];

export async function refreshProjects() {
  state.projects = await api('/projects');
  if (state.projectId && !state.projects.some((p) => p.id === state.projectId)) state.projectId = 0;
  if (!currentProject()?.sprints.some((s) => s.id === state.sprintId)) state.sprintId = 0;
}

export const currentProject = () => state.projects.find((p) => p.id === state.projectId);

// Sprint đang chạy (theo ngày hôm nay) của dự án đang chọn
export function activeSprint(project = currentProject()) {
  const today = new Date().toLocaleDateString('sv-SE');
  return project?.sprints.find((s) => s.start_date <= today && today <= s.end_date);
}

export function renderSprintSwitch() {
  const el = document.getElementById('sprint-switch');
  if (!el) return;
  const p = currentProject();
  el.hidden = !p;
  el.innerHTML = `<option value="0">Mọi sprint</option>` + (p?.sprints || [])
    .map((s) => `<option value="${s.id}" ${s.id === state.sprintId ? 'selected' : ''}>${esc(s.name)}${s === activeSprint(p) ? ' (đang chạy)' : ''}</option>`).join('');
}

async function loadSession() {
  const me = await api('/auth/me');
  state.user = me.user;
  state.permissions = me.permissions;
  const [, aiInfo] = await Promise.all([refreshProjects(), api('/ai/info')]);
  state.aiInfo = aiInfo;
}

function renderLogin() {
  app.innerHTML = `
  <div class="login-wrap">
    <section class="login-hero">
      <div class="brand"><div class="brand-logo">✓</div> AI TestCase Manager</div>
      <h1>Quản lý test case<br>có hỗ trợ trí tuệ nhân tạo</h1>
      <p>Từ user story và acceptance criteria, AI sinh test case trong vài giây. Con người xem lại, chỉnh sửa và duyệt.
      Test case đã duyệt được chuyển thành script Playwright và chạy tự động.</p>
      <div class="flow"><span>📝 User story</span><span>🤖 AI sinh test case</span><span>✍️ Tester chỉnh sửa</span><span>✅ QA Lead duyệt</span><span>▶️ Chạy test</span><span>📊 Báo cáo</span></div>
      <p class="small" style="margin-top:32px">Đồ án môn SE104 – Nhập môn Công nghệ phần mềm · Trường ĐH Công nghệ Thông tin – ĐHQG-HCM</p>
    </section>
    <section class="login-form">
      <form class="card" id="login-form" autocomplete="on">
        <h2>Đăng nhập</h2>
        <div class="field"><label for="username">Tên đăng nhập</label><input id="username" name="username" required autocomplete="username"></div>
        <div class="field"><label for="password">Mật khẩu</label><input id="password" name="password" type="password" required autocomplete="current-password"></div>
        <div id="login-error"></div>
        <button class="btn primary" style="width:100%;justify-content:center" type="submit" id="login-btn">Đăng nhập</button>
        <p class="hint mt">Tài khoản demo (bấm để điền nhanh):</p>
        <div class="demo-accounts">
          ${[['admin', 'Admin@123', 'Admin'], ['qalead', 'QaLead@123', 'QA Lead'], ['tester', 'Tester@123', 'Tester'], ['dev', 'Dev@123456', 'Developer']]
            .map(([u, p, r]) => `<button type="button" class="btn sm" data-u="${u}" data-p="${p}"><b>${r}</b>&nbsp;<span class="muted">${u}</span></button>`).join('')}
        </div>
      </form>
    </section>
  </div>`;
  const form = document.getElementById('login-form');
  bind(form, '[data-u]', 'click', (_e, b) => {
    form.username.value = b.dataset.u;
    form.password.value = b.dataset.p;
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    try {
      await busy(btn, async () => {
        const r = await api('/auth/login', { method: 'POST', body: { username: form.username.value, password: form.password.value } });
        state.token = r.token;
        safeSet('token', r.token);
        await loadSession();
      }, 'Đang đăng nhập...');
      if (location.hash === '#/dashboard') route();
      else location.hash = '#/dashboard';
    } catch (err) {
      document.getElementById('login-error').innerHTML = `<div class="alert danger">${esc(err.message)}</div>`;
    }
  });
}

function renderLayout() {
  const u = state.user;
  const navHtml = NAV.filter((n) => !n.perm || can(n.perm))
    .map((n) => n.group
      ? `<div class="nav-group">${esc(n.group)}</div>`
      : `<a href="${n.hash}" data-nav="${n.hash}"><span>${n.icon}</span>${esc(n.label)}${n.badge ? '<span class="badge" id="review-badge" hidden></span>' : ''}</a>`)
    .join('');
  const ai = state.aiInfo || {};
  app.innerHTML = `
  <div class="layout">
    <aside class="sidebar">
      <div class="brand"><div class="brand-logo">✓</div> AI TestCase Manager</div>
      <nav class="nav">${navHtml}</nav>
      <div class="nav-group">Mô hình AI</div>
      <div class="small" style="padding:0 10px">
        <div>Provider: <b style="color:#fff">${esc(ai.provider)}</b></div>
        <div>Model: ${esc(ai.model)}</div>
        <div>Playwright worker: ${ai.runnerAvailable ? '🟢 sẵn sàng' : '⚪ chưa cài'}</div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="row">
          <label for="project-switch" class="muted" style="margin:0">Dự án</label>
          <select id="project-switch" style="width:260px">
            <option value="0">Tất cả dự án</option>
            ${state.projects.map((p) => `<option value="${p.id}" ${p.id === state.projectId ? 'selected' : ''}>${esc(p.code)} – ${esc(p.name)}</option>`).join('')}
          </select>
          <select id="sprint-switch" style="width:190px" aria-label="Sprint"></select>
        </div>
        <div class="user-chip">
          <div style="text-align:right"><div><b>${esc(u.full_name)}</b></div><div class="small muted">${esc(LABEL[u.role])} · ${esc(u.username)}</div></div>
          <div class="avatar">${esc(u.full_name.split(' ').pop()[0])}</div>
          <button class="btn sm" id="logout-btn">Đăng xuất</button>
        </div>
      </header>
      <main class="content" id="page"></main>
    </div>
  </div>`;
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('project-switch').addEventListener('change', (e) => {
    state.projectId = Number(e.target.value);
    state.sprintId = 0;
    safeSet('projectId', state.projectId || null);
    safeSet('sprintId', null);
    renderSprintSwitch();
    route();
  });
  document.getElementById('sprint-switch').addEventListener('change', (e) => {
    state.sprintId = Number(e.target.value);
    safeSet('sprintId', state.sprintId || null);
    route();
  });
  renderSprintSwitch();
}

export async function updateReviewBadge() {
  const badge = document.getElementById('review-badge');
  if (!badge) return;
  const list = await api('/testcases?status=PENDING_REVIEW');
  badge.textContent = list.length;
  badge.hidden = !list.length;
}

async function route() {
  const hash = location.hash || '#/dashboard';
  if (!state.token) return renderLogin();
  if (!state.user) {
    try {
      await loadSession();
    } catch {
      return renderLogin();
    }
  }
  if (hash === '#/login') return (location.hash = '#/dashboard');
  if (!document.getElementById('page')) renderLayout();
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', hash.startsWith(a.dataset.nav)));
  const page = document.getElementById('page');
  const match = ROUTES.find(([re]) => re.test(hash));
  if (!match) return (location.hash = '#/dashboard');
  page.innerHTML = '<div class="empty"><span class="spinner dark"></span></div>';
  try {
    await match[1](page, ...hash.match(match[0]).slice(1));
    linkLabels(page);
  } catch (e) {
    page.innerHTML = `<div class="alert danger">${esc(e.message)}</div>`;
    if (e.status !== 403) toastError(e);
  }
  updateReviewBadge().catch(() => {});
}

window.addEventListener('hashchange', () => {
  if (!state.token) document.getElementById('page')?.remove();
  route();
});
route();
