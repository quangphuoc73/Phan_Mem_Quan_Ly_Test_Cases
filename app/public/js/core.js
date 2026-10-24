// Tiện ích dùng chung cho frontend. Mọi dữ liệu hiển thị đều qua esc() để chống XSS.
export const state = {
  token: safeGet('token'),
  user: null,
  permissions: [],
  projects: [],
  projectId: Number(safeGet('projectId')) || 0,
  sprintId: Number(safeGet('sprintId')) || 0,
  aiInfo: null,
};

function safeGet(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
export function safeSet(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* bỏ qua */ }
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, blob } = {}) {
  const headers = {};
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 401 && path !== '/auth/login') {
    logout();
    throw new ApiError(401, 'Phiên đăng nhập đã hết hạn');
  }
  if (blob && res.ok) return res.blob();
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || `Lỗi ${res.status}`, data?.details);
  return data;
}

export function logout() {
  state.token = null;
  state.user = null;
  safeSet('token', null);
  location.hash = '#/login';
}

export const can = (p) => state.permissions.includes(p);

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const LABEL = {
  DRAFT: 'Nháp', PENDING_REVIEW: 'Chờ duyệt', APPROVED: 'Đã duyệt', RETURNED: 'Bị trả lại',
  PASS: 'Pass', FAIL: 'Fail', BLOCKED: 'Blocked', AI: 'AI', MANUAL: 'Thủ công', AUTO: 'Tự động',
  SUCCESS: 'Thành công', FAILED: 'Thất bại',
  ADMIN: 'Admin', QA_LEAD: 'QA Lead', TESTER: 'Tester', DEVELOPER: 'Developer',
  High: 'High', Medium: 'Medium', Low: 'Low', Positive: 'Positive', Negative: 'Negative', Edge: 'Edge',
};

export const pill = (v, cls = v) => (v ? `<span class="pill ${esc(cls)}">${esc(LABEL[v] || v)}</span>` : '<span class="muted">—</span>');

export function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d) ? s : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-root').append(el);
  setTimeout(() => el.remove(), type === 'error' ? 5000 : 3000);
}

export const toastError = (e) => toast(e.message || String(e), 'error');

export function modal({ title, body, foot = '', wide = false }) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="btn ghost" data-close aria-label="Đóng">✕</button></div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
    </div>`;
  const close = () => wrap.remove();
  wrap.addEventListener('mousedown', (e) => e.target === wrap && close());
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  root.append(wrap);
  linkLabels(wrap);
  wrap.querySelector('input, textarea, select')?.focus();
  return { el: wrap, close };
}

export function confirmBox(message, { okText = 'Đồng ý', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = modal({
      title: 'Xác nhận',
      body: `<p>${esc(message)}</p>`,
      foot: `<button class="btn" data-close>Hủy</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-ok>${esc(okText)}</button>`,
    });
    m.el.querySelector('[data-ok]').addEventListener('click', () => (m.close(), resolve(true)));
    m.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => resolve(false)));
  });
}

// Gắn sự kiện theo selector trong một vùng
export function bind(root, selector, event, handler) {
  root.querySelectorAll(selector).forEach((el) => el.addEventListener(event, (e) => handler(e, el)));
}

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

// Khóa nút + hiện spinner trong lúc chờ
export async function busy(btn, fn, text) {
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner ${btn.classList.contains('btn') && !/(primary|ai|success|solid)/.test(btn.className) ? 'dark' : ''}"></span> ${esc(text || 'Đang xử lý...')}`;
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.innerHTML = html;
  }
}

export function options(list, selected, { value = 'id', label = 'name', empty } = {}) {
  return (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') +
    list.map((o) => {
      const v = typeof o === 'object' ? o[value] : o;
      const l = typeof o === 'object' ? o[label] : (LABEL[o] || o);
      return `<option value="${esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('');
}

export function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Gắn <label> với ô nhập trong cùng .field (hỗ trợ trình đọc màn hình và test tự động)
let fieldSeq = 0;
export function linkLabels(root) {
  root.querySelectorAll('.field').forEach((f) => {
    const label = f.querySelector('label');
    const input = f.querySelector('input, select, textarea');
    if (!label || !input || label.htmlFor) return;
    input.id ||= `f${++fieldSeq}`;
    label.htmlFor = input.id;
  });
}
