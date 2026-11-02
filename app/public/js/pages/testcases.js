// YC3: Soạn thảo test case · YC4: Duyệt · YC5: Ghi kết quả · YC7: Tra cứu · YC8: Xuất Excel · YC9: Script Playwright · YC13: Báo đã sửa lỗi
import { state, api, esc, can, pill, fmtDate, toast, toastError, modal, confirmBox, bind, busy, formData, options, download, LABEL, linkLabels } from '../core.js';
import { updateReviewBadge } from '../main.js';

export function testCaseForm(t, { withNote = false } = {}) {
  return `
  <form id="tc-form">
    <div class="field"><label>Tiêu đề *</label><input name="title" required minlength="5" value="${esc(t.title || '')}"></div>
    <div class="grid g3">
      <div class="field"><label>Loại</label><select name="type">${options(['Positive', 'Negative', 'Edge'], t.type)}</select></div>
      <div class="field"><label>Độ ưu tiên</label><select name="priority">${options(['High', 'Medium', 'Low'], t.priority)}</select></div>
      <div class="field"><label>Điều kiện tiên quyết</label><input name="precondition" value="${esc(t.precondition || '')}"></div>
    </div>
    <div class="field"><label>Các bước * <span class="hint">(mỗi dòng 1 bước)</span></label>
      <textarea name="steps" rows="6" required>${esc((t.steps || []).join('\n'))}</textarea></div>
    <div class="field"><label>Kết quả mong đợi *</label><textarea name="expected_result" rows="2" required>${esc(t.expected_result || '')}</textarea></div>
    ${withNote ? '<div class="field"><label>Ghi chú thay đổi</label><input name="change_note" placeholder="VD: Sửa dữ liệu test cho đúng biên"></div>' : ''}
  </form>`;
}

export function readTestCaseForm(root) {
  const form = root.querySelector('#tc-form');
  if (!form.reportValidity()) return null;
  // Dùng form.elements vì form.title là thuộc tính có sẵn của <form>
  const f = form.elements;
  return {
    title: f.title.value.trim(),
    type: f.type.value,
    priority: f.priority.value,
    precondition: f.precondition.value.trim(),
    steps: f.steps.value.split('\n').map((s) => s.trim()).filter(Boolean),
    expected_result: f.expected_result.value.trim(),
    change_note: f.change_note?.value.trim() || undefined,
  };
}

const FIELDS = [['title', 'Tiêu đề'], ['precondition', 'Điều kiện'], ['steps', 'Các bước'], ['expected_result', 'Kết quả mong đợi'], ['priority', 'Ưu tiên'], ['type', 'Loại']];
const show = (v) => (Array.isArray(v) ? v.map((s, i) => `${i + 1}. ${s}`).join('\n') : v ?? '');

function detailView(t) {
  return `
    <dl class="kv">
      <dt>Mã</dt><dd class="mono">${esc(t.code)}</dd>
      <dt>User story</dt><dd><a href="#/stories/${t.story_id}">${esc(t.story_code)}</a> – ${esc(t.story_title)}</dd>
      <dt>Trạng thái</dt><dd>${pill(t.status)} ${pill(t.source)} <span class="small muted">phiên bản ${t.version}</span></dd>
      <dt>Loại / Ưu tiên</dt><dd>${esc(t.type)} · ${pill(t.priority)}</dd>
      <dt>Điều kiện tiên quyết</dt><dd>${esc(t.precondition || '—')}</dd>
      <dt>Các bước</dt><dd><ol class="steps">${t.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></dd>
      <dt>Kết quả mong đợi</dt><dd>${esc(t.expected_result)}</dd>
      <dt>Cập nhật</dt><dd class="small muted">${fmtDate(t.updated_at)}</dd>
    </dl>`;
}

function historyView(h) {
  const versions = h.versions;
  const first = versions[versions.length - 1];
  const last = versions[0];
  let diff = '';
  if (versions.length > 1) {
    const rows = FIELDS.filter(([k]) => JSON.stringify(first.snapshot[k]) !== JSON.stringify(last.snapshot[k]))
      .map(([k, l]) => `<tr><td>${l}</td><td class="diff-old" style="white-space:pre-wrap">${esc(show(first.snapshot[k]))}</td><td class="diff-new" style="white-space:pre-wrap">${esc(show(last.snapshot[k]))}</td></tr>`).join('');
    diff = `<h3>So sánh bản đầu (v${first.version}) và bản hiện tại (v${last.version})</h3>
      <p class="small muted">Cặp "AI sinh – người sửa" này là dữ liệu đánh giá chất lượng AI.</p>
      <div class="table-wrap mb"><table><thead><tr><th>Trường</th><th>v${first.version}</th><th>v${last.version}</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="muted">Không khác biệt nội dung</td></tr>'}</tbody></table></div>`;
  }
  return `${diff}
    <h3>Các phiên bản</h3>
    <div class="table-wrap mb"><table><thead><tr><th>Phiên bản</th><th>Ghi chú</th><th>Người sửa</th><th>Thời gian</th></tr></thead>
    <tbody>${versions.map((v) => `<tr><td>v${v.version}</td><td>${esc(v.change_note || '')}</td><td>${esc(v.changed_by_name || '')}</td><td class="small">${fmtDate(v.created_at)}</td></tr>`).join('')}</tbody></table></div>
    <h3>Lịch sử duyệt</h3>
    ${h.reviews.length ? `<div class="table-wrap"><table><thead><tr><th>Quyết định</th><th>Ghi chú</th><th>Người duyệt</th><th>Thời gian</th></tr></thead>
    <tbody>${h.reviews.map((r) => `<tr><td>${pill(r.decision)}</td><td>${esc(r.note || '')}</td><td>${esc(r.reviewer_name)}</td><td class="small">${fmtDate(r.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Chưa được duyệt lần nào.</p>'}`;
}

// YC13: cột Sửa lỗi – Developer báo đã sửa lần chạy Fail gần nhất (QĐ13)
export function fixCell(r) {
  if (r.fixed_at) return `<span class="pill PASS">🔧 Đã sửa · bản ${esc(r.fix_build)}</span><div class="small muted">${esc(r.fixed_by_name || '')} · ${fmtDate(r.fixed_at)}</div>`;
  if (r.result === 'FAIL' && r.is_latest && can('bug:fix')) return `<button class="btn sm" data-fix="${r.id}">🔧 Báo đã sửa</button>`;
  return '';
}

export function openFixForm(run, onSaved) {
  const m = modal({
    title: `Báo đã sửa lỗi – ${run.tc_code || 'test case'}`,
    body: `<form id="fix-form">
      <p class="small muted">Lần chạy Fail: ${esc(run.note || '')}</p>
      <div class="field"><label>Bản build đã sửa (bắt buộc, QĐ13)</label><input name="build" required maxlength="50" placeholder="VD: 1.4.2"></div>
      <div class="field"><label>Ghi chú cho Tester</label><textarea name="note" rows="3" maxlength="2000" placeholder="Đã sửa gì, cần chú ý gì khi kiểm thử lại"></textarea></div>
    </form>`,
    foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="fix-save">Báo đã sửa</button>',
  });
  m.el.querySelector('#fix-save').addEventListener('click', async (e) => {
    const f = m.el.querySelector('#fix-form');
    if (!f.reportValidity()) return;
    try {
      await busy(e.currentTarget, () => api(`/runs/${run.id}/fix`, { method: 'POST', body: formData(f) }));
      m.close();
      toast('Đã báo sửa lỗi – test case chuyển sang Cần kiểm thử lại', 'success');
      onSaved();
    } catch (err) {
      toastError(err);
    }
  });
}

function runsTable(runs) {
  if (!runs.length) return '<p class="muted">Chưa có lần chạy nào.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Kết quả</th><th>Hình thức</th><th>Ghi chú / log</th><th>Người chạy</th><th>Thời gian</th><th>Sửa lỗi</th></tr></thead>
    <tbody>${runs.map((r) => `<tr><td>${pill(r.result)}</td><td>${pill(r.run_type)}${r.duration_ms ? `<div class="small muted">${(r.duration_ms / 1000).toFixed(1)}s</div>` : ''}</td>
      <td>${esc(r.note || '')}${r.log ? `<pre class="block small" style="margin:6px 0 0;max-height:160px">${esc(r.log)}</pre>` : ''}
      ${r.screenshot ? `<a href="${esc(r.screenshot)}" target="_blank" rel="noopener"><img src="${esc(r.screenshot)}" alt="Ảnh chụp lỗi" style="max-width:260px;border:1px solid var(--border);border-radius:6px;margin-top:6px"></a>` : ''}</td>
      <td>${esc(r.executed_by_name || '')}</td><td class="small">${fmtDate(r.executed_at)}</td>
      <td>${fixCell({ ...r, is_latest: r.id === runs[0].id })}${r.fix_note ? `<div class="small">${esc(r.fix_note)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

// YC13: lần chạy gần nhất là Fail và Developer đã báo sửa
const retestOf = (runs) => (runs[0]?.result === 'FAIL' && runs[0].fixed_at ? runs[0] : null);

export async function openTestCase(id, onChange = () => {}) {
  const m = modal({ title: 'Test case', wide: true, body: '<div class="empty"><span class="spinner dark"></span></div>' });
  let tab = 'detail';

  async function draw() {
    const [t, h, script] = await Promise.all([api(`/testcases/${id}`), api(`/testcases/${id}/history`), api(`/testcases/${id}/script`)]);
    m.el.querySelector('.modal-head h2').textContent = `${t.code} · ${t.title}`;
    const editable = can('testcase:write') && ['DRAFT', 'RETURNED', 'APPROVED'].includes(t.status);
    const draftLike = ['DRAFT', 'RETURNED'].includes(t.status);
    const lastReturn = t.status === 'RETURNED' ? h.reviews.find((r) => r.decision === 'RETURNED') : null;

    const tabs = [['detail', 'Chi tiết'], ['history', `Lịch sử (${h.versions.length})`], ['runs', `Chạy test (${h.runs.length})`], ['script', '🎭 Script Playwright']];
    let body = `<div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div>`;

    if (tab === 'detail') {
      body += `${lastReturn ? `<div class="alert danger">QA Lead đã trả lại: <b>${esc(lastReturn.note)}</b></div>` : ''}
        ${t.status === 'APPROVED' && editable ? '<div class="alert info">Test case đã duyệt. Nếu sửa, test case sẽ quay về trạng thái Nháp và phải duyệt lại.</div>' : ''}
        <div id="tc-detail">${detailView(t)}</div>
        <div class="row mt">
          ${editable ? '<button class="btn" id="tc-edit">✏️ Sửa</button>' : ''}
          ${can('testcase:write') && draftLike ? '<button class="btn primary" id="tc-submit">📤 Gửi duyệt</button><button class="btn danger" id="tc-del">Xóa</button>' : ''}
          ${can('testcase:review') && t.status === 'PENDING_REVIEW' ? `
            <div style="flex-basis:100%"></div>
            <input id="rv-note" placeholder="Ghi chú duyệt (bắt buộc khi trả lại)" style="flex:1;min-width:260px">
            <button class="btn danger" id="rv-return">↩️ Trả lại</button><button class="btn success" id="rv-approve">✓ Duyệt</button>` : ''}
        </div>`;
    } else if (tab === 'history') {
      body += historyView(h);
    } else if (tab === 'runs') {
      const fixed = retestOf(h.runs);
      if (fixed) body += `<div class="alert warn">🔁 <b>Cần kiểm thử lại:</b> ${esc(fixed.fixed_by_name || 'Developer')} đã sửa lỗi ở bản build <b>${esc(fixed.fix_build)}</b>${fixed.fix_note ? ` – ${esc(fixed.fix_note)}` : ''}. Chạy lại test case trên bản build này.</div>`;
      body += t.status !== 'APPROVED'
        ? '<div class="alert warn">QĐ5: chỉ ghi nhận kết quả cho test case đã được duyệt.</div>'
        : can('run:write') ? `
          <div class="card mb"><h3>Ghi nhận kết quả chạy thủ công (BM4)</h3>
            <div class="row"><select id="run-result" style="width:160px">${options(['PASS', 'FAIL', 'BLOCKED'], 'PASS')}</select>
            <input id="run-note" placeholder="Ghi chú (bắt buộc khi Fail/Blocked), VD: mã bug" style="flex:1;min-width:240px">
            <button class="btn primary" id="run-save">Lưu kết quả</button></div></div>` : '';
      body += runsTable(h.runs);
    } else {
      const autoRuns = h.runs.filter((r) => r.run_type === 'AUTO');
      body += t.status !== 'APPROVED'
        ? '<div class="alert warn">Chỉ sinh script cho test case đã được duyệt, để AI không tự động hóa một kịch bản sai.</div>'
        : `<div class="alert info">AI chuyển các bước test case thành script <b>Playwright</b>. Tester xem lại, chỉnh sửa rồi bấm Chạy.
           Script chạy trong tiến trình riêng, có giới hạn thời gian và bị kiểm tra tĩnh để chặn mã nguy hiểm.
           ${t.base_url ? `URL cần test: <code>${esc(t.base_url)}</code>` : '<br>⚠️ Dự án chưa khai báo URL ứng dụng cần test.'}</div>
          <div class="row mb">
            ${can('ai:use') ? `<button class="btn ai" id="sc-gen">✨ ${script ? 'Sinh lại script' : 'Sinh script Playwright bằng AI'}</button>` : ''}
            ${script && can('testcase:write') ? '<button class="btn" id="sc-save">💾 Lưu chỉnh sửa</button>' : ''}
            ${script ? `<button class="btn" id="sc-dl">⬇️ Tải file .spec.js</button>` : ''}
            <span class="spacer"></span>
            ${script && can('run:write') ? `<button class="btn success" id="sc-run" ${state.aiInfo?.runnerAvailable ? '' : 'title="Chưa cài Playwright worker"'}>▶️ Chạy tự động</button>` : ''}
          </div>
          ${script?.warnings?.length ? `<div class="alert danger">Script sẽ bị chặn khi chạy: ${esc(script.warnings.join('; '))}</div>` : ''}
          ${script ? `<textarea class="code" id="sc-code" spellcheck="false" aria-label="Mã nguồn script">${esc(script.code)}</textarea>` : '<p class="muted">Chưa có script.</p>'}
          <div id="sc-result" class="mt"></div>
          ${autoRuns.length ? `<h3 class="mt">Các lần chạy tự động</h3>${runsTable(autoRuns)}` : ''}`;
    }
    m.el.querySelector('.modal-body').innerHTML = body;
    wire(t);
  }

  function wire(t) {
    const el = m.el;
    bind(el, '[data-tab]', 'click', (_e, b) => ((tab = b.dataset.tab), draw().catch(toastError)));
    const act = (sel, fn) => el.querySelector(sel)?.addEventListener('click', async (e) => {
      try {
        await fn(e.currentTarget);
      } catch (err) {
        toastError(err);
      }
    });
    const changed = async (msg) => {
      toast(msg, 'success');
      onChange();
      updateReviewBadge();
      await draw();
    };

    act('#tc-edit', () => {
      el.querySelector('#tc-detail').innerHTML = testCaseForm(t, { withNote: true }) +
        '<div class="row"><button class="btn" id="tc-cancel">Hủy</button><button class="btn primary" id="tc-save">Lưu phiên bản mới</button></div>';
      el.querySelector('#tc-edit').remove();
      linkLabels(el);
      act('#tc-cancel', draw);
      act('#tc-save', async (b) => {
        const d = readTestCaseForm(el);
        if (!d) return;
        await busy(b, () => api(`/testcases/${id}`, { method: 'PUT', body: d }));
        await changed('Đã lưu phiên bản mới');
      });
    });
    act('#tc-submit', async (b) => {
      await busy(b, () => api('/testcases/submit', { method: 'POST', body: { ids: [id] } }));
      await changed('Đã gửi duyệt');
    });
    act('#tc-del', async () => {
      if (!(await confirmBox(`Xóa test case ${t.code}?`, { okText: 'Xóa', danger: true }))) return;
      await api(`/testcases/${id}`, { method: 'DELETE' });
      m.close();
      toast('Đã xóa test case', 'success');
      onChange();
    });
    const review = (decision) => async (b) => {
      await busy(b, () => api(`/testcases/${id}/review`, { method: 'POST', body: { decision, note: el.querySelector('#rv-note').value } }));
      await changed(decision === 'APPROVED' ? 'Đã duyệt test case' : 'Đã trả lại test case');
    };
    act('#rv-approve', review('APPROVED'));
    act('#rv-return', review('RETURNED'));
    bind(el, '[data-fix]', 'click', (_e, b) => openFixForm({ ...h.runs.find((r) => r.id === Number(b.dataset.fix)), tc_code: t.code },
      () => (onChange(), draw().catch(toastError))));
    act('#run-save', async (b) => {
      await busy(b, () => api(`/testcases/${id}/runs`, { method: 'POST', body: { result: el.querySelector('#run-result').value, note: el.querySelector('#run-note').value } }));
      await changed('Đã ghi nhận kết quả');
    });
    act('#sc-gen', async (b) => {
      await busy(b, () => api(`/testcases/${id}/script/generate`, { method: 'POST' }), 'AI đang viết script...');
      await changed('AI đã sinh script Playwright');
    });
    act('#sc-save', async (b) => {
      await busy(b, () => api(`/testcases/${id}/script`, { method: 'PUT', body: { code: el.querySelector('#sc-code').value } }));
      await changed('Đã lưu script');
    });
    act('#sc-dl', async () => download(await api(`/testcases/${id}/script/download`, { blob: true }), `${t.code}.spec.js`));
    act('#sc-run', async (b) => {
      const code = el.querySelector('#sc-code');
      if (code && can('testcase:write')) await api(`/testcases/${id}/script`, { method: 'PUT', body: { code: code.value } });
      el.querySelector('#sc-result').innerHTML = '<div class="alert info"><span class="spinner dark"></span> Playwright đang mở Chrome và chạy script...</div>';
      try {
        const r = await busy(b, () => api(`/testcases/${id}/script/run`, { method: 'POST' }), 'Đang chạy...');
        onChange();
        await draw();
        m.el.querySelector('#sc-result').innerHTML = `<div class="alert ${r.result === 'PASS' ? 'success' : 'danger'}">Kết quả: <b>${esc(LABEL[r.result])}</b> trong ${(r.duration_ms / 1000).toFixed(1)}s – đã tự động lưu vào kết quả chạy test.</div>`;
      } catch (err) {
        el.querySelector('#sc-result').innerHTML = `<div class="alert danger">${esc(err.message)}</div>`;
      }
    });
  }

  try {
    await draw();
  } catch (e) {
    m.el.querySelector('.modal-body').innerHTML = `<div class="alert danger">${esc(e.message)}</div>`;
  }
}

export async function renderTestCases(page) {
  page.innerHTML = `
    <div class="page-head">
      <div><h1>Tra cứu test case</h1><p>Lọc theo trạng thái, độ ưu tiên, loại, nguồn sinh (YC7) và xuất Excel (YC8)</p></div>
      <button class="btn" id="export">⬇️ Xuất Excel</button>
    </div>
    <form class="filters" id="tc-filter">
      <input type="search" name="q" placeholder="Tìm mã hoặc tiêu đề...">
      <select name="status">${options(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'RETURNED'], '', { empty: 'Mọi trạng thái' })}</select>
      <select name="priority">${options(['High', 'Medium', 'Low'], '', { empty: 'Mọi độ ưu tiên' })}</select>
      <select name="type">${options(['Positive', 'Negative', 'Edge'], '', { empty: 'Mọi loại' })}</select>
      <select name="source">${options(['AI', 'MANUAL'], '', { empty: 'Mọi nguồn' })}</select>
      <select name="needs_retest" aria-label="Kiểm thử lại"><option value="">Mọi kết quả</option><option value="1">🔁 Cần kiểm thử lại</option></select>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>Mã</th><th>Tiêu đề</th><th>User story</th><th>Loại</th><th>Ưu tiên</th><th>Nguồn</th><th>Trạng thái</th><th>KQ gần nhất</th><th>Script</th></tr></thead>
      <tbody id="tc-rows"></tbody>
    </table></div>
    <p class="small muted" id="tc-count"></p>`;

  const form = page.querySelector('#tc-filter');
  const query = () => {
    const q = new URLSearchParams([...new FormData(form)].filter(([, v]) => v));
    if (state.projectId) q.set('project_id', state.projectId);
    if (state.sprintId) q.set('sprint_id', state.sprintId);
    return q;
  };
  const load = async () => {
    const list = await api(`/testcases?${query()}`);
    const tbody = page.querySelector('#tc-rows');
    tbody.innerHTML = list.map((t) => `
      <tr class="clickable" data-id="${t.id}"><td class="mono">${esc(t.code)}</td><td>${esc(t.title)}</td><td>${esc(t.story_code)}</td>
      <td>${esc(t.type)}</td><td>${pill(t.priority)}</td><td>${pill(t.source)}</td><td>${pill(t.status)}</td><td>${pill(t.last_result)}${t.needs_retest ? '<div class="small" title="Developer đã báo sửa lỗi">🔁 Cần kiểm thử lại</div>' : ''}</td>
      <td>${t.has_script ? '🎭' : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Không có test case phù hợp</td></tr>';
    page.querySelector('#tc-count').textContent = `${list.length} test case`;
    bind(tbody, 'tr[data-id]', 'click', (_e, tr) => openTestCase(Number(tr.dataset.id), load));
  };
  let timer;
  form.addEventListener('input', () => (clearTimeout(timer), (timer = setTimeout(() => load().catch(toastError), 250))));
  form.addEventListener('submit', (e) => e.preventDefault());
  page.querySelector('#export').addEventListener('click', async (e) => {
    try {
      const blob = await busy(e.currentTarget, () => api(`/export/testcases.xlsx?${query()}`, { blob: true }));
      download(blob, 'testcases.xlsx');
    } catch (err) {
      toastError(err);
    }
  });
  await load();
}
