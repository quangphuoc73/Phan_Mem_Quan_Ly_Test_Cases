// YC10 thay đổi quy định, nhật ký AI, YC11 người dùng, YC12 dự án từ Jira, nhật ký hoạt động.
import { state, api, esc, can, pill, fmtDate, toast, toastError, modal, bind, busy, formData, options, LABEL, feature } from '../core.js';
import { refreshProjects } from '../main.js';
import { syncSummary } from './stories.js';

export async function renderParams(page) {
  const list = await api('/parameters');
  const editable = can('param:update');
  page.innerHTML = `
    <div class="page-head"><div><h1>Thay đổi quy định (YC10)</h1>
      <p>Các quy định được lưu trong bảng THAM SỐ nên thay đổi được mà không phải sửa mã nguồn (tính tiến hóa). Độ ưu tiên (High, Medium, Low) và nhãn "Acceptance criteria" cố định;
      cấu hình Jira chỉ đặt ở file .env (QĐ10).</p></div></div>
    ${editable ? '' : '<div class="alert info">Chỉ Admin hoặc QA Lead được thay đổi quy định.</div>'}
    <div class="table-wrap"><table>
      <thead><tr><th>Mã tham số</th><th>Ý nghĩa</th><th>Miền giá trị</th><th style="width:180px">Giá trị</th><th>Cập nhật</th>${editable ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.map((p) => `<tr><td class="mono">${esc(p.key)}</td><td>${esc(p.description)}</td><td class="small">${p.min ?? ''}–${p.max ?? ''}</td>
        <td>${editable ? `<input data-key="${esc(p.key)}" value="${esc(p.value)}" type="number" min="${p.min}" max="${p.max}" aria-label="${esc(p.key)}">` : `<b>${esc(p.value)}</b>`}</td>
        <td class="small muted">${fmtDate(p.updated_at)}</td>
        ${editable ? `<td><button class="btn sm primary" data-save="${esc(p.key)}">Lưu</button></td>` : ''}</tr>`).join('')}</tbody>
    </table></div>`;
  bind(page, '[data-save]', 'click', async (_e, b) => {
    const key = b.dataset.save;
    const value = page.querySelector(`[data-key="${key}"]`).value;
    try {
      const r = await busy(b, () => api(`/parameters/${key}`, { method: 'PUT', body: { value } }));
      toast(`${key}: ${r.old} → ${r.value}`, 'success');
      renderParams(page);
    } catch (e) {
      toastError(e);
    }
  });
}

const TASKS = { GENERATE_TESTCASE: '🧪 Sinh test case (YC2)', ANALYZE_IMPACT: '🔍 Phân tích ảnh hưởng (YC15)', RANK_REGRESSION: '🧭 Xếp ưu tiên regression (YC17)', GENERATE_SCRIPT: '🎭 Sinh script (YC19)' };

export async function renderAiLogs(page) {
  const list = await api('/ai-logs');
  page.innerHTML = `
    <div class="page-head"><div><h1>Nhật ký AI</h1>
      <p>Mỗi lần gọi AI đều được lưu: prompt (đã che dữ liệu nhạy cảm), model, kết quả gốc, số lần thử, thời gian. Dùng để truy vết khi AI sinh sai.</p></div></div>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Thời gian</th><th>Tác vụ</th><th>Requirement</th><th>Provider / model</th><th>Kết quả</th><th>Lần thử</th><th>Thời gian xử lý</th><th>Bảo mật</th></tr></thead>
      <tbody>${list.map((l) => {
        const pii = Object.entries(JSON.parse(l.pii_found || '{}')).map(([k, v]) => `${v} ${k}`).join(', ');
        return `<tr class="clickable" data-id="${l.id}"><td>${l.id}</td><td class="small">${fmtDate(l.created_at)}</td>
          <td>${TASKS[l.task] || esc(l.task)}</td><td>${esc(l.story_code || '')}</td>
          <td>${esc(l.provider)}<div class="small muted">${esc(l.model)}</div></td><td>${pill(l.status)}</td><td>${l.attempts}</td><td>${l.duration_ms ?? ''} ms</td>
          <td class="small">${pii ? `🔒 Che ${esc(pii)}` : ''}${l.injection_flag ? '<div>⚠️ Nghi prompt injection</div>' : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="9" class="empty">Chưa có lượt gọi AI nào</td></tr>'}</tbody>
    </table></div>`;
  bind(page, 'tr[data-id]', 'click', (_e, tr) => {
    const l = list.find((x) => x.id === Number(tr.dataset.id));
    let raw = l.raw_output || '';
    try { raw = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* giữ nguyên */ }
    modal({
      title: `Nhật ký AI #${l.id}`,
      wide: true,
      body: `${l.error ? `<div class="alert danger">${esc(l.error)}</div>` : ''}
        <h3>Prompt đã gửi tới ${esc(l.provider)} (${esc(l.model)})</h3><pre class="block">${esc(l.prompt_masked)}</pre>
        <h3 class="mt">Kết quả gốc từ AI</h3><pre class="block">${esc(raw)}</pre>`,
    });
  });
}

export async function renderUsers(page) {
  const list = await api('/users');
  page.innerHTML = `
    <div class="page-head"><div><h1>Người dùng & phân quyền</h1><p>5 vai trò toàn cục, áp dụng cho mọi dự án (QĐ11). Mật khẩu băm bằng bcrypt; Admin không tự khóa hoặc tự hạ quyền chính mình.</p></div>
      <button class="btn primary" id="new-user">＋ Thêm người dùng</button></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>${list.map((u) => `<tr><td class="mono">${esc(u.username)}</td><td>${esc(u.full_name)}</td><td>${esc(u.email || '')}</td>
        <td><span class="pill role">${esc(LABEL[u.role])}</span></td><td>${u.active ? '🟢 Hoạt động' : '🔴 Đã khóa'}</td>
        <td>${u.id !== state.user.id ? `<button class="btn sm" data-toggle="${u.id}" data-active="${u.active}">${u.active ? 'Khóa' : 'Mở khóa'}</button>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="card mt"><h3>Ma trận phân quyền</h3>
      <div class="table-wrap"><table><thead><tr><th>Chức năng</th><th>Admin</th><th>QA Lead</th><th>PO / BA</th><th>Tester</th><th>Developer</th></tr></thead><tbody>
      ${[['Quản lý người dùng (user:manage)', 1, 0, 0, 0, 0], ['Kiểm tra kết nối Jira (jira:connect)', 1, 0, 0, 0, 0],
         ['Thêm dự án, đồng bộ từ Jira; xử lý requirement Cần kiểm tra (jira:import)', 1, 1, 0, 0, 0],
         ['Thay đổi quy định (param:update)', 1, 1, 0, 0, 0], ['Xem nhật ký hoạt động (audit:view)', 1, 1, 0, 0, 0],
         ['Soạn test case, quản lý Test Suite, Đã xem lại (testcase:write)', 0, 1, 0, 1, 0], ['Duyệt test case (testcase:review)', 0, 1, 0, 0, 0],
         ['Lập Test Run, phân công, đóng đợt (testrun:manage)', 0, 1, 0, 0, 0], ['Ghi kết quả chạy test (run:write)', 0, 1, 0, 1, 0],
         ['Sinh test bằng AI, phân tích ảnh hưởng, xem đề xuất (ai:use)', 0, 1, 0, 1, 0],
         ['Chấp nhận, từ chối đề xuất; xác nhận regression (proposal:review)', 0, 1, 0, 0, 0], ['Xem nhật ký AI (ailog:view)', 1, 1, 0, 1, 0],
         ['Báo đã sửa lỗi (bug:fix)', 0, 0, 0, 0, 1], ['Xem requirement, báo cáo; tra cứu, xuất Excel', 1, 1, 1, 1, 1]]
        .map(([n, ...r]) => `<tr><td>${n}</td>${r.map((x) => `<td>${x ? '✅' : '—'}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></div>`;
  bind(page, '[data-toggle]', 'click', async (_e, b) => {
    try {
      await api(`/users/${b.dataset.toggle}`, { method: 'PATCH', body: { active: b.dataset.active !== '1' } });
      renderUsers(page);
    } catch (e) {
      toastError(e);
    }
  });
  page.querySelector('#new-user').addEventListener('click', () => {
    const m = modal({
      title: 'Thêm người dùng',
      body: `<form id="u-form">
        <div class="field"><label>Tên đăng nhập *</label><input name="username" required></div>
        <div class="field"><label>Họ tên *</label><input name="full_name" required></div>
        <div class="field"><label>Email</label><input name="email" type="email"></div>
        <div class="field"><label>Vai trò</label><select name="role">${options(['TESTER', 'QA_LEAD', 'PO_BA', 'DEVELOPER', 'ADMIN'], 'TESTER')}</select></div>
        <div class="field"><label>Mật khẩu * <span class="hint">(tối thiểu 8 ký tự)</span></label><input name="password" type="password" minlength="8" required autocomplete="new-password"></div></form>`,
      foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="u-save">Tạo</button>',
    });
    m.el.querySelector('#u-save').addEventListener('click', async (e) => {
      const f = m.el.querySelector('#u-form');
      if (!f.reportValidity()) return;
      try {
        await busy(e.currentTarget, () => api('/users', { method: 'POST', body: formData(f) }));
        m.close();
        toast('Đã tạo người dùng', 'success');
        renderUsers(page);
      } catch (err) {
        toastError(err);
      }
    });
  });
}

export async function renderProjects(page) {
  await refreshProjects();
  const jira = await api('/jira/info');
  const manage = can('project:manage') && feature('script'); // URL ứng dụng cần test chỉ dùng cho YC19 (ngoài MVP)
  page.innerHTML = `
    <div class="page-head"><div><h1>Dự án & module</h1>
      <p>YC12 – Dự án, module, thành viên và requirement đồng bộ một chiều từ Jira · ${jira.mode === 'mock' ? 'Đang dùng <b>Jira giả lập</b> (chưa cấu hình JIRA_BASE_URL)' : `Jira: <code>${esc(jira.site)}</code>`}
      · Webhook: ${jira.webhook ? 'đã bật' : 'chưa bật'} · Loại issue: <b>${esc((jira.issueTypes || []).join(', '))}</b></p></div>
      <div class="row">
        ${can('jira:connect') ? '<button class="btn" id="jira-test">🔌 Kiểm tra kết nối Jira</button>' : ''}
        <button class="btn primary" id="jira-import">⬇ Thêm dự án từ Jira</button>
      </div></div>
    <div class="grid g2">${state.projects.map((p) => `
      <div class="card"><div class="row"><h2 style="margin:0">${esc(p.code)} · ${esc(p.name)}</h2>
        ${p.jira_key ? `<span class="pill AI" title="Đồng bộ lần cuối ${esc(fmtDate(p.synced_at))}">Jira</span><button class="btn sm" data-sync="${p.id}">⟳ Đồng bộ ngay</button>` : '<span class="pill MANUAL">Dữ liệu mẫu</span>'}</div>
        <p class="muted">${esc(p.description || '')}</p>
        <p class="small">${p.story_count} requirement${p.needs_check_count ? ` · <span class="pill NEEDS_CHECK">${p.needs_check_count} Cần kiểm tra</span>` : ''} · ${p.member_count} thành viên
          ${feature('sprint') ? ` · ${p.sprints.length} sprint` : ''}${p.synced_at ? ` · đồng bộ thành công ${esc(fmtDate(p.synced_at))}` : ''}</p>
        ${p.last_sync ? `<p class="small">Lần đồng bộ gần nhất: ${pill(p.last_sync.status)} ${esc(LABEL[p.last_sync.source] || p.last_sync.source)} · ${esc(fmtDate(p.last_sync.finished_at || p.last_sync.started_at))} · ${p.last_sync.attempts} lần gọi
          ${p.last_sync.error ? `<br><span class="muted">${esc(p.last_sync.error)}</span>` : ''}</p>` : ''}
        ${manage ? `<p class="small">URL ứng dụng cần test (YC19): ${p.base_url ? `<code>${esc(p.base_url)}</code>` : '<span class="muted">chưa khai báo</span>'} <button class="btn sm" data-url="${p.id}">Sửa URL</button></p>` : ''}
        <h3>Module</h3><div class="row">${p.modules.map((m) => `<span class="pill MANUAL">${esc(m.name)}</span>`).join('') || '<span class="muted">Chưa có</span>'}</div>
      </div>`).join('')}</div>`;
  const report = (r) => {
    toast(`${syncSummary(r)} · ${r.modules} module · ${r.members} thành viên${r.unmapped.length ? ` · chưa có tài khoản: ${r.unmapped.join(', ')}` : ''}`, 'success');
    if (r.warnings.length) toast(r.warnings.join(' · '), 'info');
  };
  page.querySelector('#jira-test')?.addEventListener('click', async (e) => {
    try {
      const r = await busy(e.currentTarget, () => api('/jira/test', { method: 'POST' }));
      toast(`Kết nối Jira thành công – ${r.user}`, 'success');
    } catch (err) {
      toastError(err);
    }
  });
  bind(page, '[data-sync]', 'click', async (e, b) => {
    try {
      report(await busy(e.currentTarget, () => api(`/projects/${b.dataset.sync}/jira-sync`, { method: 'POST' }), 'Đang đồng bộ...'));
      renderProjects(page);
    } catch (err) {
      toastError(err);
    }
  });
  bind(page, '[data-url]', 'click', (_e, b) => {
    const p = state.projects.find((x) => x.id === Number(b.dataset.url));
    const m = modal({
      title: `URL ứng dụng cần test – ${p.code}`,
      body: `<form id="u-form"><div class="field"><label>URL (Playwright mở trang này khi chạy script, YC19)</label>
        <input name="base_url" type="url" value="${esc(p.base_url || '')}" placeholder="https://www.saucedemo.com/"></div></form>`,
      foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="u-save">Lưu</button>',
    });
    m.el.querySelector('#u-save').addEventListener('click', async (e) => {
      const f = m.el.querySelector('#u-form');
      if (!f.reportValidity()) return;
      try {
        await busy(e.currentTarget, () => api(`/projects/${p.id}`, { method: 'PUT', body: formData(f) }));
        m.close();
        toast('Đã lưu URL ứng dụng cần test', 'success');
        renderProjects(page);
      } catch (err) {
        toastError(err);
      }
    });
  });
  page.querySelector('#jira-import').addEventListener('click', () => {
    const m = modal({
      title: 'Thêm dự án từ Jira',
      body: `<form id="j-form">
        <div class="field"><label>Mã dự án (space key) trên Jira *</label><input name="key" required maxlength="10" placeholder="${jira.mode === 'mock' ? 'HRM hoặc LIB' : 'VD: SHOP'}"></div>
        <p class="small muted">Hệ thống lấy tên, mô tả, module (component), thành viên và mọi issue thuộc loại <b>${esc((jira.issueTypes || []).join(', '))}</b> (JIRA_ISSUE_TYPES).
        Thành viên gán theo email trùng với tài khoản; Jira ẩn email thì so họ tên, trùng nhiều tài khoản thì không gán (QĐ12).
        AC lấy từ mục <b>Acceptance criteria</b> trong Description (QĐ1).</p></form>`,
      foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="j-save">Thêm dự án</button>',
    });
    m.el.querySelector('#j-save').addEventListener('click', async (e) => {
      const f = m.el.querySelector('#j-form');
      if (!f.reportValidity()) return;
      try {
        const r = await busy(e.currentTarget, () => api('/jira/import', { method: 'POST', body: formData(f) }), 'Đang đồng bộ...');
        m.close();
        report(r);
        setTimeout(() => location.reload(), 1500); // tải lại để ô chọn dự án trên thanh trên có dự án mới
      } catch (err) {
        toastError(err);
      }
    });
  });
}

export async function renderAudit(page) {
  const list = await api('/audit-logs');
  page.innerHTML = `
    <div class="page-head"><div><h1>Nhật ký hoạt động</h1><p>Ai làm gì, lúc nào – phục vụ truy vết và bảo mật (300 bản ghi gần nhất)</p></div></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th><th>IP</th></tr></thead>
      <tbody>${list.map((a) => `<tr><td class="small">${fmtDate(a.created_at)}</td><td>${esc(a.username || '—')}</td><td class="mono">${esc(a.action)}</td>
        <td>${esc(a.entity || '')}${a.entity_id ? ` #${a.entity_id}` : ''}</td><td class="small mono" style="max-width:380px;word-break:break-all">${esc(a.detail || '')}</td><td class="small">${esc(a.ip || '')}</td></tr>`).join('')}</tbody>
    </table></div>`;
}
