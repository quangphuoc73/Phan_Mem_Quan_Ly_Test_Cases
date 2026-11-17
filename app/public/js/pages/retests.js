// YC18 – BM17, QĐ18: Developer báo đã sửa lỗi; Tester kiểm thử lại; QA Lead lập đợt Kiểm thử lại [R1]
import { state, api, esc, can, pill, fmtDate, toast, toastError, modal, bind, busy, options } from '../core.js';
import { assignees } from './regression.js';
import { showSkipped } from './runs.js';

function openFix(f, onDone) {
  const m = modal({
    title: `Báo đã sửa lỗi – ${f.tc_code}`,
    body: `<form id="fx-form">
      <p class="small muted">Lần Fail trong đợt <b>${esc(f.run_name)}</b> (build ${esc(f.run_build)}): ${esc(f.note || '')}${f.defect_code ? ` · <span class="mono">${esc(f.defect_code)}</span>` : ''}</p>
      <div class="field"><label>Bản build đã sửa * <span class="hint">(1–50 ký tự, QĐ18)</span></label><input name="build" required maxlength="50" placeholder="VD: 1.4.2"></div>
      <div class="field"><label>Ghi chú cho Tester</label><textarea name="note" rows="3" maxlength="2000" placeholder="Đã sửa gì, cần chú ý gì khi kiểm thử lại"></textarea></div>
    </form>`,
    foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="fx-save">Báo đã sửa</button>',
  });
  m.el.querySelector('#fx-save').addEventListener('click', async (e) => {
    const form = m.el.querySelector('#fx-form');
    if (!form.reportValidity()) return;
    try {
      const r = await busy(e.currentTarget, () => api(`/executions/${f.execution_id}/fix`, { method: 'POST', body: Object.fromEntries(new FormData(form)) }));
      m.close();
      toast(r.retest_in_same_run ? 'Đã báo sửa – Tester chạy lại ngay trong đợt (trùng build)' : 'Đã báo sửa – QA Lead lập đợt Kiểm thử lại với build đã sửa', 'success');
      onDone();
    } catch (err) {
      toastError(err);
    }
  });
}

async function openRetestRun(waiting, onDone) {
  const projectId = waiting[0].project_id || state.projectId;
  const people = await assignees(projectId);
  const builds = [...new Set(waiting.map((f) => f.build))];
  const m = modal({
    title: 'Lập đợt Kiểm thử lại',
    body: `<form id="rr-form">
      <p>${waiting.length} phiếu: ${waiting.map((f) => `<span class="mono">${esc(f.tc_code)}</span>`).join(', ')}</p>
      <div class="grid g2">
        <div class="field"><label>Build đã sửa ${builds.length === 1 ? '' : '*'}</label><input name="build" maxlength="50" value="${builds.length === 1 ? esc(builds[0]) : ''}" ${builds.length === 1 ? '' : 'required'}></div>
        <div class="field"><label>Môi trường *</label><input name="environment" required maxlength="100" placeholder="VD: Staging"></div>
      </div>
      <div class="field"><label>Người được giao</label><select name="assignee_id">${options(people, '', { empty: 'Chưa giao' })}</select></div>
    </form>`,
    foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="rr-save">Lập đợt</button>',
  });
  m.el.querySelector('#rr-save').addEventListener('click', async (e) => {
    const f = m.el.querySelector('#rr-form');
    if (!f.reportValidity()) return;
    const d = Object.fromEntries(new FormData(f));
    const body = { project_id: projectId, environment: d.environment, build: d.build || undefined,
      assignee_id: d.assignee_id ? Number(d.assignee_id) : null, fix_ids: waiting.map((w) => w.id) };
    try {
      const r = await busy(e.currentTarget, () => api('/retests/run', { method: 'POST', body }));
      m.close();
      showSkipped(r.skipped);
      onDone(r.run);
    } catch (err) {
      toastError(err);
    }
  });
}

export async function renderRetests(page) {
  const data = await api(`/retests${state.projectId ? `?project_id=${state.projectId}` : ''}`);
  page.innerHTML = `
    <div class="page-head"><div><h1>Sửa lỗi & kiểm thử lại</h1>
      <p>YC18: Developer báo đã sửa lần Fail gần nhất của test trong Test Run (bắt buộc build). Đợt còn mở và trùng build thì Tester chạy lại ngay trong đợt;
      ngược lại QA Lead lập đợt Kiểm thử lại với build đã sửa. Pass → Đã đóng · Fail → Mở lại · Blocked → vẫn chờ.</p></div></div>
    <div class="card"><h3>Lần Fail chưa báo sửa (${data.fails.length})</h3>
      ${data.fails.length ? `<div class="table-wrap"><table><thead><tr><th>Test</th><th>Test Run</th><th>Ghi chú / defect</th><th>Người chạy</th><th>Thời gian</th><th></th></tr></thead>
      <tbody>${data.fails.map((f) => `<tr><td><span class="mono">${esc(f.tc_code)}</span><div class="small muted">${esc(f.tc_title)}</div></td>
        <td><a href="#/runs/${f.run_id}">${esc(f.run_name)}</a><div class="small muted">build ${esc(f.run_build)} · ${pill(f.run_status)}</div></td>
        <td class="small">${esc(f.note || '')}${f.defect_code ? ` <span class="mono">${esc(f.defect_code)}</span>` : ''}</td>
        <td>${esc(f.executed_by_name || '')}</td><td class="small">${esc(fmtDate(f.executed_at))}</td>
        <td>${can('bug:fix') ? `<button class="btn sm primary" data-fix="${f.execution_id}">🔧 Báo đã sửa</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted">Không có lần Fail nào đang chờ Developer.</p>'}</div>
    <div class="card mt"><div class="row"><h3 style="margin:0">Chờ kiểm thử lại (${data.waiting.length})</h3><span class="spacer"></span>
      ${can('testrun:manage') && data.waiting.length ? '<button class="btn primary" id="mk-retest" disabled>▶️ Lập đợt Kiểm thử lại cho mục đã chọn</button>' : ''}</div>
      ${data.waiting.length ? `<div class="table-wrap mt"><table><thead><tr>${can('testrun:manage') ? '<th></th>' : ''}<th>Test</th><th>Build đã sửa</th><th>Lần Fail trong đợt</th><th>Người báo</th><th>Cách kiểm thử lại</th></tr></thead>
      <tbody>${data.waiting.map((f) => `<tr>${can('testrun:manage') ? `<td><input type="checkbox" class="wf" value="${f.id}" aria-label="Chọn ${esc(f.tc_code)}"></td>` : ''}
        <td><span class="mono">${esc(f.tc_code)}</span><div class="small muted">${esc(f.tc_title)}</div></td><td class="mono">${esc(f.build)}</td>
        <td><a href="#/runs/${f.run_id}">${esc(f.run_name)}</a><div class="small muted">build ${esc(f.run_build)} · ${pill(f.run_status)}</div></td>
        <td>${esc(f.reported_by_name || '')}<div class="small muted">${esc(fmtDate(f.reported_at))}${f.note ? ` · ${esc(f.note)}` : ''}</div></td>
        <td class="small">${f.retest_in_same_run ? `Chạy lại ngay trong <a href="#/runs/${f.run_id}">đợt cũ</a> (trùng build)` : 'Cần đợt Kiểm thử lại với build đã sửa'}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted mt">Không có test nào chờ kiểm thử lại.</p>'}</div>
    <div class="card mt"><h3>Đã xử lý (${data.done.length})</h3>
      ${data.done.length ? `<div class="table-wrap"><table><thead><tr><th>Test</th><th>Build đã sửa</th><th>Trạng thái</th><th>Người báo</th></tr></thead>
      <tbody>${data.done.map((f) => `<tr><td class="mono">${esc(f.tc_code)}</td><td class="mono">${esc(f.build)}</td><td>${pill(f.status)}</td>
        <td>${esc(f.reported_by_name || '')} <span class="small muted">${esc(fmtDate(f.reported_at))}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Chưa có.</p>'}</div>`;

  const reload = () => renderRetests(page);
  bind(page, '[data-fix]', 'click', (_e, b) => openFix(data.fails.find((f) => f.execution_id === Number(b.dataset.fix)), reload));
  const btn = page.querySelector('#mk-retest');
  bind(page, '.wf', 'change', () => (btn.disabled = !page.querySelectorAll('.wf:checked').length));
  btn?.addEventListener('click', () => {
    const ids = [...page.querySelectorAll('.wf:checked')].map((c) => Number(c.value));
    const chosen = data.waiting.filter((f) => ids.includes(f.id));
    if (new Set(chosen.map((f) => f.project_id)).size > 1) return toast('Chọn các phiếu cùng một dự án', 'error');
    openRetestRun(chosen, (run) => (location.hash = `#/runs/${run.id}`)).catch(toastError);
  });
}
