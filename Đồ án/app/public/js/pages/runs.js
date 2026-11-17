// YC14 – BM13, QĐ14: Test Run và phân công · YC5 – BM4, QĐ5: ghi kết quả chạy test trong Test Run
import { state, api, esc, can, pill, fmtDate, toast, toastError, modal, bind, busy, options, runTypeLabel, linkLabels } from '../core.js';
import { openTestCase } from './testcases.js';
import { assignees } from './regression.js';

const progressBar = (p) => `<div class="row" style="gap:8px"><div class="progress"><span style="width:${p.percent}%"></span></div><span class="small">${p.executed}/${p.total}</span></div>`;
const typePill = (t) => `<span class="pill ${t === 'NORMAL' ? 'OPEN' : t}">${esc(runTypeLabel(t))}</span>`;

// Hiện danh sách test bị bỏ qua vì không đủ điều kiện chạy (QĐ14 [2.1])
export function showSkipped(skipped) {
  if (!skipped?.length) return;
  modal({
    title: `${skipped.length} test không được đưa vào đợt`,
    body: `<p>Chỉ test <b>Đã duyệt</b>, không có cờ <b>Cần xem lại</b>, requirement không lưu trữ và không <b>Cần kiểm tra</b> mới đủ điều kiện chạy (QĐ14).</p>
      <div class="table-wrap"><table><thead><tr><th>Test</th><th>Lý do</th></tr></thead>
      <tbody>${skipped.map((s) => `<tr><td class="mono">${esc(s.code || s.id)}</td><td>${esc(s.reason)}</td></tr>`).join('')}</tbody></table></div>`,
    foot: '<button class="btn primary" data-close>Đã hiểu</button>',
  });
}

async function openCreateRun(onCreated) {
  const projectId = state.projectId || state.projects[0]?.id;
  const m = modal({ title: 'Lập Test Run', wide: true, body: '<div class="empty"><span class="spinner dark"></span></div>',
    foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="rn-save">Lập đợt</button>' });
  const draw = async (pid) => {
    const [suites, tests, people] = await Promise.all([api(`/suites?project_id=${pid}`), api(`/testcases?project_id=${pid}&status=APPROVED`), assignees(pid)]);
    m.el.querySelector('.modal-body').innerHTML = `<form id="rn-form">
      <div class="grid g2">
        <div class="field"><label>Dự án *</label><select name="project_id" id="rn-project">${options(state.projects.map((p) => ({ id: p.id, name: `${p.code} – ${p.name}` })), pid)}</select></div>
        <div class="field"><label>Tên đợt *</label><input name="name" required minlength="3" maxlength="200" placeholder="VD: Sprint 3 – build 1.2.0"></div>
        <div class="field"><label>Build đang kiểm thử *</label><input name="build" required maxlength="50" placeholder="VD: 1.2.0"></div>
        <div class="field"><label>Môi trường *</label><input name="environment" required maxlength="100" placeholder="VD: Staging"></div>
        <div class="field"><label>Hạn hoàn thành</label><input name="due_date" type="date"></div>
        <div class="field"><label>Người được giao <span class="hint">(QA Lead hoặc Tester)</span></label><select name="assignee_id">${options(people, '', { empty: 'Chưa giao' })}</select></div>
      </div>
      <div class="field"><label>Lấy test từ Test Suite</label><select name="suite_id">${options(suites.map((s) => ({ id: s.id, name: `${s.name} (${s.tc_count} test)` })), '', { empty: 'Không dùng suite' })}</select></div>
      <fieldset class="ac-pick card" style="padding:10px 14px;max-height:260px;overflow:auto"><legend class="small"><b>Hoặc chọn từng test đã duyệt</b></legend>
        ${tests.map((t) => `<label><input type="checkbox" name="tc" value="${t.id}"> <span><span class="mono">${esc(t.code)}</span> – ${esc(t.title)}${t.needs_review ? ' <span class="pill flag">⚑ Cần xem lại</span>' : ''}</span></label>`).join('') || '<p class="muted small">Dự án chưa có test đã duyệt</p>'}
      </fieldset>
      <p class="small muted">Phiên bản test được cố định khi đưa vào đợt. Build và môi trường chỉ sửa được khi đợt chưa có kết quả (D3).</p></form>`;
    linkLabels(m.el); // nội dung vẽ lại sau khi mở hộp thoại nên phải gắn lại nhãn cho ô nhập
    m.el.querySelector('#rn-project').addEventListener('change', (e) => draw(Number(e.target.value)).catch(toastError));
  };
  await draw(projectId);
  m.el.querySelector('#rn-save').addEventListener('click', async (e) => {
    const f = m.el.querySelector('#rn-form');
    if (!f.reportValidity()) return;
    const d = Object.fromEntries(new FormData(f));
    const body = {
      project_id: Number(d.project_id), name: d.name, build: d.build, environment: d.environment, due_date: d.due_date || null,
      assignee_id: d.assignee_id ? Number(d.assignee_id) : null, suite_id: d.suite_id ? Number(d.suite_id) : undefined,
      test_case_ids: [...f.querySelectorAll('input[name="tc"]:checked')].map((c) => Number(c.value)),
    };
    try {
      const r = await busy(e.currentTarget, () => api('/runs', { method: 'POST', body }));
      m.close();
      toast(`Đã lập Test Run với ${r.run.items.length} test`, 'success');
      showSkipped(r.skipped);
      onCreated(r.run);
    } catch (err) {
      toastError(err);
    }
  });
}

export async function renderRuns(page) {
  let status = 'OPEN';
  page.innerHTML = `
    <div class="page-head"><div><h1>Test Run</h1><p>Đợt kiểm thử (YC14): mỗi đợt ghi build và môi trường; phiên bản test cố định khi đưa vào đợt; kết quả ghi trong đợt đang mở (YC5).</p></div>
      ${can('testrun:manage') ? '<button class="btn primary" id="new-run">＋ Lập Test Run</button>' : ''}</div>
    <div class="tabs">${[['OPEN', 'Đang mở'], ['CLOSED', 'Đã đóng'], ['', 'Tất cả']].map(([k, l]) => `<button data-st="${k}" class="${k === status ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Tên đợt</th><th>Loại</th><th>Dự án</th><th>Build / môi trường</th><th>Tiến độ</th><th>Hạn</th><th>Trạng thái</th></tr></thead>
      <tbody id="run-rows"></tbody>
    </table></div>`;
  const tbody = page.querySelector('#run-rows');
  const load = async () => {
    const q = new URLSearchParams();
    if (state.projectId) q.set('project_id', state.projectId);
    if (status) q.set('status', status);
    const list = await api(`/runs?${q}`);
    tbody.innerHTML = list.map((r) => `<tr class="clickable" data-id="${r.id}"><td>#${r.id}</td><td><b>${esc(r.name)}</b><div class="small muted">${esc(r.created_by_name || '')} · ${esc(fmtDate(r.created_at))}</div></td>
      <td>${typePill(r.run_type)}</td><td>${esc(r.project_name)}</td><td><span class="mono">${esc(r.build)}</span><div class="small muted">${esc(r.environment)}${r.locked ? ' · 🔒 đã cố định' : ''}</div></td>
      <td>${progressBar(r.progress)}</td><td class="small">${esc(r.due_date || '')}</td><td>${pill(r.status)}</td></tr>`).join('')
      || '<tr><td colspan="8" class="empty">Không có Test Run</td></tr>';
    bind(tbody, 'tr[data-id]', 'click', (_e, tr) => (location.hash = `#/runs/${tr.dataset.id}`));
  };
  bind(page, '[data-st]', 'click', (_e, b) => {
    status = b.dataset.st;
    page.querySelectorAll('[data-st]').forEach((x) => x.classList.toggle('active', x === b));
    load().catch(toastError);
  });
  page.querySelector('#new-run')?.addEventListener('click', () => openCreateRun((run) => (location.hash = `#/runs/${run.id}`)).catch(toastError));
  await load();
}

// BM4: ghi kết quả – Fail/Blocked bắt buộc ghi chú; mã defect không bắt buộc; bằng chứng là đường dẫn
function openRecord(run, item, onSaved) {
  const m = modal({
    title: `Ghi kết quả – ${item.code}`,
    wide: true,
    body: `<form id="ex-form">
      ${item.current_version > item.tc_version ? `<div class="alert warn">Test đã có phiên bản mới (v${item.current_version}); đợt vẫn chạy phiên bản đã cố định v${item.tc_version} (QĐ14).</div>` : ''}
      ${item.waiting_fix_build ? `<div class="alert info">🔁 Test đang chờ kiểm thử lại: Developer đã báo sửa ở build <b>${esc(item.waiting_fix_build)}</b>. Kết quả lần này được gắn với lần Fail gốc (QĐ18).</div>` : ''}
      <p class="small muted">Build <b>${esc(run.build)}</b> · ${esc(run.environment)}</p>
      <ol class="steps">${item.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <p><b>Kết quả mong đợi:</b> ${esc(item.expected_result)}</p>
      <div class="grid g2">
        <div class="field"><label>Kết quả *</label><select name="result">${options(['PASS', 'FAIL', 'BLOCKED'], 'PASS')}</select></div>
        <div class="field"><label>Mã defect <span class="hint">(VD mã issue Jira)</span></label><input name="defect_code" maxlength="50"></div>
      </div>
      <div class="field"><label>Ghi chú <span class="hint">(bắt buộc khi Fail hoặc Blocked)</span></label><textarea name="note" rows="2" maxlength="2000"></textarea></div>
      <div class="field"><label>Liên kết bằng chứng <span class="hint">(đường dẫn ảnh, video – không tải file lên hệ thống)</span></label><input name="evidence_url" type="url" placeholder="https://..."></div>
    </form>`,
    foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="ex-save">Lưu kết quả</button>',
  });
  m.el.querySelector('#ex-save').addEventListener('click', async (e) => {
    const f = m.el.querySelector('#ex-form');
    if (!f.reportValidity()) return;
    const body = Object.fromEntries(new FormData(f));
    if (body.result !== 'PASS' && !body.note.trim()) return toast('Kết quả Fail/Blocked bắt buộc phải có ghi chú (QĐ5)', 'error');
    try {
      const r = await busy(e.currentTarget, () => api(`/runs/${run.id}/items/${item.id}/executions`, { method: 'POST', body }));
      m.close();
      toast('Đã ghi nhận kết quả', 'success');
      r.warnings.forEach((w) => toast(w, 'info'));
      onSaved();
    } catch (err) {
      toastError(err);
    }
  });
}

export async function renderRunDetail(page, id) {
  const [run, executions] = await Promise.all([api(`/runs/${id}`), api(`/runs/${id}/executions`)]);
  const open = run.status === 'OPEN';
  const manage = can('testrun:manage') && open;
  const people = manage ? await assignees(run.project_id) : [];
  const canRecord = (i) => open && can('run:write') && (state.user.role === 'QA_LEAD' || i.assignee_id === state.user.id);

  page.innerHTML = `
    <div class="page-head">
      <div><a href="#/runs" class="small">← Danh sách Test Run</a>
        <h1>#${run.id} · ${esc(run.name)}</h1>
        <p>${typePill(run.run_type)} ${pill(run.status)} · ${esc(run.project_name)} · build <b class="mono">${esc(run.build)}</b> · ${esc(run.environment)}
          ${run.locked ? ' · 🔒 build và môi trường đã cố định (đã có kết quả)' : ''}${run.due_date ? ` · hạn ${esc(run.due_date)}` : ''}
          · lập bởi ${esc(run.created_by_name || '')}${run.closed_at ? ` · đóng bởi ${esc(run.closed_by_name || '')} ${esc(fmtDate(run.closed_at))}` : ''}</p></div>
      <div class="row">
        <a class="btn" href="#/dashboard" id="run-report">📊 Báo cáo đợt</a>
        ${manage ? `<button class="btn" id="run-edit">✏️ Sửa thông tin</button><button class="btn" id="run-add">＋ Thêm test</button><button class="btn danger" id="run-close">Đóng đợt</button>` : ''}
      </div>
    </div>
    <div class="grid g4">
      <div class="card stat"><div class="label">Tiến độ</div><div class="value">${run.progress.percent}%</div><div class="sub">${run.progress.executed}/${run.progress.total} test đã có kết quả</div></div>
      <div class="card stat"><div class="label">Pass</div><div class="value">${run.progress.PASS}</div></div>
      <div class="card stat"><div class="label">Fail</div><div class="value">${run.progress.FAIL}</div></div>
      <div class="card stat"><div class="label">Blocked</div><div class="value">${run.progress.BLOCKED}</div></div>
    </div>
    <div class="table-wrap mt"><table>
      <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Phiên bản chạy</th><th>Người được giao</th><th>Kết quả gần nhất trong đợt</th><th>Cảnh báo</th><th></th></tr></thead>
      <tbody>${run.items.map((i) => `<tr data-item="${i.id}">
        <td class="mono clickable" data-open="${i.test_case_id}">${esc(i.code)}</td><td style="min-width:200px">${esc(i.title)}<div class="small muted">${esc(i.story_code)}</div></td>
        <td>v${i.tc_version}${i.current_version > i.tc_version ? ` <span class="small muted">(hiện v${i.current_version})</span>` : ''}</td>
        <td>${manage ? `<select data-assign="${i.id}" style="width:160px" aria-label="Người được giao ${esc(i.code)}">${options(people, i.assignee_id, { empty: 'Chưa giao' })}</select>` : esc(i.assignee_name || '—')}</td>
        <td>${i.last_result ? `${pill(i.last_result)}<div class="small muted">${esc(fmtDate(i.last_executed_at))}</div>` : '<span class="muted small">Chưa chạy</span>'}</td>
        <td>${i.warnings.length ? `<ul class="warn-list">${i.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}</td>
        <td class="row" style="gap:4px">${canRecord(i) ? `<button class="btn sm primary" data-record="${i.id}">Ghi kết quả</button>` : ''}
          ${manage && !i.last_result ? `<button class="btn sm" data-remove="${i.id}" title="Chỉ bỏ được test chưa có kết quả (QĐ3)">Bỏ</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="7" class="empty">Đợt chưa có test</td></tr>'}</tbody>
    </table></div>
    <div class="card mt"><h3>Các lần ghi kết quả (${executions.length})</h3>
      ${executions.length ? `<div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Test</th><th>Phiên bản</th><th>Kết quả</th><th>Ghi chú / defect</th><th>Người chạy</th></tr></thead>
      <tbody>${executions.map((e) => `<tr><td class="small">${esc(fmtDate(e.executed_at))}</td><td class="mono">${esc(e.tc_code)}</td><td>v${e.tc_version}</td>
        <td>${pill(e.result)}${e.retest_of ? '<div class="small muted">kiểm thử lại</div>' : ''}</td>
        <td class="small">${esc(e.note || '')}${e.defect_code ? ` <span class="mono">${esc(e.defect_code)}</span>` : ''}${e.evidence_url ? ` · <a href="${esc(e.evidence_url)}" target="_blank" rel="noopener">bằng chứng ↗</a>` : ''}</td>
        <td>${esc(e.executed_by_name || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Chưa có kết quả.</p>'}</div>`;

  const reload = () => renderRunDetail(page, id);
  page.querySelector('#run-report').addEventListener('click', () => (state.runId = run.id));
  bind(page, '[data-open]', 'click', (_e, td) => openTestCase(Number(td.dataset.open), reload));
  bind(page, '[data-record]', 'click', (_e, b) => openRecord(run, run.items.find((i) => i.id === Number(b.dataset.record)), reload));
  bind(page, '[data-assign]', 'change', async (_e, s) => {
    try {
      await api(`/runs/${id}/items/${s.dataset.assign}`, { method: 'PUT', body: { assignee_id: s.value ? Number(s.value) : null } });
      toast('Đã phân công', 'success');
    } catch (err) {
      toastError(err);
      reload();
    }
  });
  bind(page, '[data-remove]', 'click', async (_e, b) => {
    try {
      await busy(b, () => api(`/runs/${id}/items/${b.dataset.remove}`, { method: 'DELETE' }));
      reload();
    } catch (err) {
      toastError(err);
    }
  });
  page.querySelector('#run-edit')?.addEventListener('click', () => {
    const m = modal({
      title: 'Sửa thông tin đợt',
      body: `<form id="re-form">
        <div class="field"><label>Tên đợt</label><input name="name" required minlength="3" value="${esc(run.name)}"></div>
        ${run.locked ? '<div class="alert info">Đợt đã có kết quả nên build và môi trường đã cố định; muốn chạy build hoặc môi trường khác thì lập đợt mới (D3).</div>' : ''}
        <div class="grid g2"><div class="field"><label>Build</label><input name="build" maxlength="50" value="${esc(run.build)}" ${run.locked ? 'disabled' : ''}></div>
        <div class="field"><label>Môi trường</label><input name="environment" maxlength="100" value="${esc(run.environment)}" ${run.locked ? 'disabled' : ''}></div></div>
        <div class="field"><label>Hạn hoàn thành</label><input name="due_date" type="date" value="${esc(run.due_date || '')}"></div></form>`,
      foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="re-save">Lưu</button>',
    });
    m.el.querySelector('#re-save').addEventListener('click', async (e) => {
      const f = m.el.querySelector('#re-form');
      if (!f.reportValidity()) return;
      const d = Object.fromEntries(new FormData(f)); // ô bị khóa không có trong FormData
      d.due_date = d.due_date || null;
      try {
        await busy(e.currentTarget, () => api(`/runs/${id}`, { method: 'PUT', body: d }));
        m.close();
        reload();
      } catch (err) {
        toastError(err);
      }
    });
  });
  page.querySelector('#run-add')?.addEventListener('click', async () => {
    const [suites, tests] = await Promise.all([api(`/suites?project_id=${run.project_id}`), api(`/testcases?project_id=${run.project_id}&status=APPROVED`)]);
    const inRun = new Set(run.items.map((i) => i.test_case_id));
    const m = modal({
      title: 'Thêm test vào đợt',
      body: `<form id="ra-form"><div class="field"><label>Test Suite</label><select name="suite_id">${options(suites, '', { empty: 'Không dùng suite' })}</select></div>
        <fieldset class="ac-pick card" style="padding:10px 14px;max-height:260px;overflow:auto"><legend class="small"><b>Hoặc chọn test</b></legend>
        ${tests.filter((t) => !inRun.has(t.id)).map((t) => `<label><input type="checkbox" name="tc" value="${t.id}"> <span class="mono">${esc(t.code)}</span> – ${esc(t.title)}</label>`).join('') || '<p class="muted small">Không còn test đã duyệt để thêm</p>'}
        </fieldset></form>`,
      foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="ra-save">Thêm</button>',
    });
    m.el.querySelector('#ra-save').addEventListener('click', async (e) => {
      const f = m.el.querySelector('#ra-form');
      const body = { suite_id: f.suite_id.value ? Number(f.suite_id.value) : undefined, test_case_ids: [...f.querySelectorAll('input[name="tc"]:checked')].map((c) => Number(c.value)) };
      try {
        const r = await busy(e.currentTarget, () => api(`/runs/${id}/items`, { method: 'POST', body }));
        m.close();
        toast(`Đã thêm ${r.added.length} test`, 'success');
        showSkipped(r.skipped);
        reload();
      } catch (err) {
        toastError(err);
      }
    });
  });
  page.querySelector('#run-close')?.addEventListener('click', async (e) => {
    const close = (confirm) => api(`/runs/${id}/close`, { method: 'POST', body: { confirm } });
    try {
      await busy(e.currentTarget, () => close(false));
      toast('Đã đóng đợt', 'success');
      reload();
    } catch (err) {
      if (err.status !== 409 || !err.details?.notRun) return toastError(err);
      // QĐ14 [B4]: còn test chưa chạy thì phải xác nhận
      const m = modal({
        title: 'Đóng đợt khi còn test chưa chạy',
        body: `<p>${esc(err.message)}</p>`,
        foot: '<button class="btn" data-close>Hủy</button><button class="btn danger solid" id="cl-ok">Vẫn đóng đợt</button>',
      });
      m.el.querySelector('#cl-ok').addEventListener('click', async (ev) => {
        try {
          await busy(ev.currentTarget, () => close(true));
          m.close();
          toast('Đã đóng đợt', 'success');
          reload();
        } catch (e2) {
          toastError(e2);
        }
      });
    }
  });
}
