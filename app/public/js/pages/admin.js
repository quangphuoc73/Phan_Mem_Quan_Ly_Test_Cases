// Kết quả chạy test, thay đổi quy định (YC10), nhật ký AI, quản trị người dùng/dự án, audit log.
import { state, api, esc, can, pill, fmtDate, toast, toastError, modal, bind, busy, formData, options, LABEL } from '../core.js';
import { openTestCase } from './testcases.js';
import { refreshProjects } from '../main.js';

export async function renderRuns(page) {
  const list = await api(`/runs${state.projectId ? `?project_id=${state.projectId}` : ''}`);
  page.innerHTML = `
    <div class="page-head"><div><h1>Kết quả chạy test</h1><p>100 lần chạy gần nhất (thủ công và tự động)</p></div></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Thời gian</th><th>Test case</th><th>User story</th><th>Kết quả</th><th>Hình thức</th><th>Ghi chú</th><th>Người chạy</th></tr></thead>
      <tbody>${list.map((r) => `<tr class="clickable" data-tc="${r.test_case_id}"><td class="small">${fmtDate(r.executed_at)}</td>
        <td><span class="mono">${esc(r.tc_code)}</span><div class="small muted">${esc(r.tc_title)}</div></td><td>${esc(r.story_code)}</td>
        <td>${pill(r.result)}</td><td>${pill(r.run_type)}</td><td class="small">${esc(r.note || '')}</td><td>${esc(r.executed_by_name || '')}</td></tr>`).join('')
        || '<tr><td colspan="7" class="empty">Chưa có lần chạy nào</td></tr>'}</tbody>
    </table></div>`;
  bind(page, 'tr[data-tc]', 'click', (_e, tr) => openTestCase(Number(tr.dataset.tc), () => renderRuns(page)));
}

export async function renderParams(page) {
  const list = await api('/parameters');
  const editable = can('param:update');
  page.innerHTML = `
    <div class="page-head"><div><h1>Thay đổi quy định (YC10)</h1>
      <p>Các quy định được lưu trong bảng THAM SỐ nên thay đổi được mà không phải sửa mã nguồn (tính tiến hóa của phần mềm).</p></div></div>
    ${editable ? '' : '<div class="alert info">Chỉ Admin hoặc QA Lead được thay đổi quy định.</div>'}
    <div class="table-wrap"><table>
      <thead><tr><th>Mã tham số</th><th>Ý nghĩa</th><th style="width:220px">Giá trị</th><th>Cập nhật</th>${editable ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.map((p) => `<tr><td class="mono">${esc(p.key)}</td><td>${esc(p.description)}</td>
        <td>${editable ? `<input data-key="${esc(p.key)}" value="${esc(p.value)}" ${p.data_type === 'int' ? 'type="number"' : ''} aria-label="${esc(p.key)}">` : `<b>${esc(p.value)}</b>`}</td>
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

export async function renderAiLogs(page) {
  const list = await api('/ai-logs');
  page.innerHTML = `
    <div class="page-head"><div><h1>Nhật ký AI</h1>
      <p>Mỗi lần gọi AI đều được lưu: prompt (đã che dữ liệu nhạy cảm), model, kết quả gốc, số lần thử, thời gian. Dùng để truy vết khi AI sinh sai.</p></div></div>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Thời gian</th><th>Tác vụ</th><th>User story</th><th>Provider / model</th><th>Kết quả</th><th>Lần thử</th><th>Thời gian xử lý</th><th>Bảo mật</th></tr></thead>
      <tbody>${list.map((l) => {
        const pii = Object.entries(JSON.parse(l.pii_found || '{}')).map(([k, v]) => `${v} ${k}`).join(', ');
        return `<tr class="clickable" data-id="${l.id}"><td>${l.id}</td><td class="small">${fmtDate(l.created_at)}</td>
          <td>${l.task === 'GENERATE_SCRIPT' ? '🎭 Sinh script' : '🧪 Sinh test case'}</td><td>${esc(l.story_code || '')}</td>
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
    <div class="page-head"><div><h1>Người dùng & phân quyền</h1><p>Phân quyền theo vai trò (RBAC). Mật khẩu được băm bằng bcrypt.</p></div>
      <button class="btn primary" id="new-user">＋ Thêm người dùng</button></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>${list.map((u) => `<tr><td class="mono">${esc(u.username)}</td><td>${esc(u.full_name)}</td><td>${esc(u.email || '')}</td>
        <td><span class="pill role">${esc(LABEL[u.role])}</span></td><td>${u.active ? '🟢 Hoạt động' : '🔴 Đã khóa'}</td>
        <td>${u.id !== state.user.id ? `<button class="btn sm" data-toggle="${u.id}" data-active="${u.active}">${u.active ? 'Khóa' : 'Mở khóa'}</button>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="card mt"><h3>Ma trận phân quyền</h3>
      <div class="table-wrap"><table><thead><tr><th>Chức năng</th><th>Admin</th><th>QA Lead</th><th>PO / BA</th><th>Tester</th><th>Developer</th></tr></thead><tbody>
      ${[['Quản lý người dùng, dự án', 1, 0, 0, 0, 0], ['Lập user story', 1, 1, 1, 1, 0], ['Lập kế hoạch sprint', 1, 1, 1, 0, 0],
         ['Sinh test case / script bằng AI', 0, 1, 0, 1, 0], ['Sửa, gửi duyệt test case', 0, 1, 0, 1, 0], ['Duyệt test case (QĐ4)', 0, 1, 0, 0, 0],
         ['Ghi kết quả, chạy tự động', 0, 1, 0, 1, 0], ['Thay đổi quy định', 1, 1, 0, 0, 0], ['Xem báo cáo, tra cứu', 1, 1, 1, 1, 1]]
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
  page.innerHTML = `
    <div class="page-head"><div><h1>Dự án & module</h1></div><button class="btn primary" id="new-proj">＋ Tạo dự án</button></div>
    <div class="grid g2">${state.projects.map((p) => `
      <div class="card"><div class="row"><h2 style="margin:0">${esc(p.code)} · ${esc(p.name)}</h2></div>
        <p class="muted">${esc(p.description || '')}</p>
        <p class="small">URL ứng dụng cần test: ${p.base_url ? `<code>${esc(p.base_url)}</code>` : '<span class="muted">chưa khai báo</span>'} · ${p.story_count} user story</p>
        <h3>Module</h3><div class="row">${p.modules.map((m) => `<span class="pill MANUAL">${esc(m.name)}</span>`).join('') || '<span class="muted">Chưa có</span>'}</div>
        <div class="row mt"><input placeholder="Tên module mới" data-mod-input="${p.id}" style="flex:1"><button class="btn sm" data-mod="${p.id}">＋ Thêm module</button></div>
      </div>`).join('')}</div>`;
  bind(page, '[data-mod]', 'click', async (_e, b) => {
    const name = page.querySelector(`[data-mod-input="${b.dataset.mod}"]`).value;
    try {
      await api(`/projects/${b.dataset.mod}/modules`, { method: 'POST', body: { name } });
      toast('Đã thêm module', 'success');
      renderProjects(page);
    } catch (e) {
      toastError(e);
    }
  });
  page.querySelector('#new-proj').addEventListener('click', () => {
    const m = modal({
      title: 'Tạo dự án',
      body: `<form id="p-form">
        <div class="field"><label>Mã dự án *</label><input name="code" required placeholder="SHOP"></div>
        <div class="field"><label>Tên dự án *</label><input name="name" required></div>
        <div class="field"><label>Mô tả</label><textarea name="description"></textarea></div>
        <div class="field"><label>URL ứng dụng cần test</label><input name="base_url" type="url" placeholder="https://..."></div></form>`,
      foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="p-save">Tạo</button>',
    });
    m.el.querySelector('#p-save').addEventListener('click', async (e) => {
      const f = m.el.querySelector('#p-form');
      if (!f.reportValidity()) return;
      try {
        await busy(e.currentTarget, () => api('/projects', { method: 'POST', body: formData(f) }));
        m.close();
        toast('Đã tạo dự án', 'success');
        location.reload();
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
