// YC3: Soạn thảo test case, liên kết AC, Đã xem lại · YC4: Duyệt · YC7: Tra cứu · YC9: Xuất Excel
// YC19 (ngoài MVP, SCRIPT_ENABLED): tab Script Playwright
import { state, api, esc, can, pill, fmtDate, toast, toastError, modal, confirmBox, bind, busy, options, download, LABEL, linkLabels, feature } from '../core.js';
import { updateReviewBadge } from '../main.js';

// BM2: form test case. acs = danh sách AC của phiên bản hiện tại; linked = AC đang liên kết (QĐ3)
export function testCaseForm(t, { withNote = false, acs = [], linked = [] } = {}) {
  return `
  <form id="tc-form">
    <div class="field"><label>Tiêu đề *</label><input name="title" required minlength="5" maxlength="200" value="${esc(t.title || '')}"></div>
    <div class="grid g3">
      <div class="field"><label>Loại</label><select name="type">${options(['Positive', 'Negative', 'Edge'], t.type)}</select></div>
      <div class="field"><label>Độ ưu tiên</label><select name="priority">${options(['High', 'Medium', 'Low'], t.priority)}</select></div>
      <div class="field"><label>Điều kiện tiên quyết</label><input name="precondition" maxlength="500" value="${esc(t.precondition || '')}"></div>
    </div>
    <div class="field"><label>Các bước * <span class="hint">(mỗi dòng 1 bước, tối đa 15 bước)</span></label>
      <textarea name="steps" rows="6" required>${esc((t.steps || []).join('\n'))}</textarea></div>
    <div class="field"><label>Kết quả mong đợi *</label><textarea name="expected_result" rows="2" required>${esc(t.expected_result || '')}</textarea></div>
    <fieldset class="ac-pick card" style="padding:10px 14px"><legend class="small"><b>AC liên kết</b> <span class="hint">(QĐ3: phải có ít nhất 1 AC mới gửi duyệt được)</span></legend>
      ${acs.length ? acs.map((a, i) => `<label><input type="checkbox" name="acs" value="${esc(a)}" ${linked.includes(a) ? 'checked' : ''}> <span><b>AC${i + 1}.</b> ${esc(a)}</span></label>`).join('')
        : '<p class="muted small" style="margin:0">Requirement chưa có AC (Thiếu AC) – PO/BA bổ sung trên Jira.</p>'}
    </fieldset>
    ${withNote ? '<div class="field mt"><label>Ghi chú thay đổi</label><input name="change_note" maxlength="200" placeholder="VD: Sửa dữ liệu test cho đúng biên"></div>' : ''}
  </form>`;
}

export function readTestCaseForm(root) {
  const form = root.querySelector('#tc-form');
  if (!form.reportValidity()) return null;
  const f = form.elements; // form.title là thuộc tính có sẵn của <form> nên đọc qua elements
  const steps = f.steps.value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (steps.length > 15) {
    toast('Mỗi test case có tối đa 15 bước (QĐ2)', 'error');
    return null;
  }
  return {
    title: f.title.value.trim(),
    type: f.type.value,
    priority: f.priority.value,
    precondition: f.precondition.value.trim(),
    steps,
    expected_result: f.expected_result.value.trim(),
    acs: [...form.querySelectorAll('input[name="acs"]:checked')].map((c) => c.value),
    change_note: f.change_note?.value.trim() || undefined,
  };
}

// Cờ Cần xem lại (QĐ3) và chờ kiểm thử lại (QĐ18) hiển thị cạnh trạng thái
export const flags = (t) =>
  `${t.needs_review ? ` <span class="pill flag" title="Requirement đã đổi: ${esc(LABEL[t.review_reason] || '')}">⚑ Cần xem lại</span>` : ''}${t.needs_retest ? ' <span class="pill WAITING">🔁 Chờ kiểm thử lại</span>' : ''}`;

// QĐ3 [2.2] [D1]: Đã xem lại – test vẫn đúng. Bắt buộc lý do; nhiều test dùng một lý do chung; một test thì gán lại AC được
export function openRecheck(tests, onDone, { acs = [] } = {}) {
  const single = tests.length === 1 ? tests[0] : null;
  const m = modal({
    title: single ? `Đã xem lại – ${single.code}` : `Đã xem lại ${tests.length} test case`,
    wide: Boolean(single),
    body: `<form id="rc-form">
      <div class="alert info">Dùng khi test <b>vẫn đúng</b> sau khi requirement đổi. Nếu test cần sửa, hãy sửa test rồi gửi duyệt – cờ được gỡ khi bản sửa được duyệt (QĐ3).</div>
      ${single ? '' : `<p class="small">${tests.map((t) => `<span class="mono">${esc(t.code)}</span>`).join(', ')}</p>`}
      <div class="field"><label>Lý do test vẫn đúng * ${single ? '' : '<span class="hint">(một lý do chung cho các test đã chọn)</span>'}</label>
        <textarea name="reason" rows="3" required minlength="3" maxlength="1000" placeholder="VD: Chỉ đổi câu chữ mô tả, không ảnh hưởng các bước"></textarea></div>
      ${single && acs.length ? `<fieldset class="ac-pick card" style="padding:10px 14px"><legend class="small"><b>Gán lại AC</b> <span class="hint">(AC của phiên bản hiện tại)</span></legend>
        ${acs.map((a, i) => `<label><input type="checkbox" name="acs" value="${esc(a)}" ${single.acs.includes(a) ? 'checked' : ''}> <span><b>AC${i + 1}.</b> ${esc(a)}</span></label>`).join('')}</fieldset>` : ''}
    </form>`,
    foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="rc-save">✔ Xác nhận đã xem lại</button>',
  });
  m.el.querySelector('#rc-save').addEventListener('click', async (e) => {
    const f = m.el.querySelector('#rc-form');
    if (!f.reportValidity()) return;
    const body = { ids: tests.map((t) => t.id), reason: f.reason.value.trim() };
    if (single && acs.length) body.acs = [...f.querySelectorAll('input[name="acs"]:checked')].map((c) => c.value);
    try {
      const r = await busy(e.currentTarget, () => api('/testcases/recheck', { method: 'POST', body }));
      m.close();
      toast(`Đã xem lại ${r.rechecked.length} test case – cờ đã được gỡ`, 'success');
      onDone();
    } catch (err) {
      toastError(err);
    }
  });
}

const FIELDS = [['title', 'Tiêu đề'], ['precondition', 'Điều kiện'], ['steps', 'Các bước'], ['expected_result', 'Kết quả mong đợi'], ['priority', 'Ưu tiên'], ['type', 'Loại']];
const show = (v) => (Array.isArray(v) ? v.map((s, i) => `${i + 1}. ${s}`).join('\n') : v ?? '');

function detailView(t) {
  return `
    <dl class="kv">
      <dt>Mã</dt><dd class="mono">${esc(t.code)}</dd>
      <dt>Requirement</dt><dd><a href="#/stories/${t.story_id}">${esc(t.story_code)}</a> – ${esc(t.story_title)}
        <div class="small muted">Liên kết phiên bản v${t.req_version} · requirement hiện ở v${t.story_version}</div></dd>
      <dt>Trạng thái</dt><dd>${pill(t.status)} ${pill(t.source)} <span class="small muted">phiên bản ${t.version}</span>${flags(t)}
        ${t.proposal_id ? `<div class="small muted">Tạo/sửa từ đề xuất AI #${t.proposal_id}</div>` : ''}</dd>
      <dt>AC liên kết</dt><dd>${t.acs.length ? `<ul class="ac-list">${t.acs.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '<span class="pill RETURNED">Chưa liên kết AC</span>'}</dd>
      <dt>Loại / Ưu tiên</dt><dd>${esc(t.type)} · ${pill(t.priority)}</dd>
      <dt>Điều kiện tiên quyết</dt><dd>${esc(t.precondition || '—')}</dd>
      <dt>Các bước</dt><dd><ol class="steps">${t.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></dd>
      <dt>Kết quả mong đợi</dt><dd>${esc(t.expected_result)}</dd>
      <dt>Kết quả gần nhất</dt><dd>${t.last_result ? pill(t.last_result) : '<span class="muted">Chưa chạy (phiên bản hiện tại)</span>'}</dd>
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
      <div class="table-wrap mb"><table><thead><tr><th>Trường</th><th>v${first.version}</th><th>v${last.version}</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="muted">Không khác biệt nội dung</td></tr>'}</tbody></table></div>`;
  }
  return `${diff}
    <h3>Các phiên bản</h3>
    <div class="table-wrap mb"><table><thead><tr><th>Phiên bản</th><th>Ghi chú</th><th>Người sửa</th><th>Thời gian</th></tr></thead>
    <tbody>${versions.map((v) => `<tr><td>v${v.version}</td><td>${esc(v.change_note || '')}</td><td>${esc(v.changed_by_name || '')}</td><td class="small">${fmtDate(v.created_at)}</td></tr>`).join('')}</tbody></table></div>
    <h3>Lịch sử duyệt (BM3)</h3>
    ${h.reviews.length ? `<div class="table-wrap mb"><table><thead><tr><th>Quyết định</th><th>Ghi chú</th><th>Người duyệt</th><th>Thời gian</th></tr></thead>
    <tbody>${h.reviews.map((r) => `<tr><td>${pill(r.decision)}</td><td>${esc(r.note || '')}</td><td>${esc(r.reviewer_name)}</td><td class="small">${fmtDate(r.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Chưa được duyệt lần nào.</p>'}
    <h3>Nhật ký Đã xem lại (QĐ3)</h3>
    ${h.rechecks.length ? `<div class="table-wrap"><table><thead><tr><th>Người xác nhận</th><th>Phiên bản requirement</th><th>Lý do</th><th>Thời gian</th></tr></thead>
    <tbody>${h.rechecks.map((r) => `<tr><td>${esc(r.user_name)}</td><td>v${r.req_version}${r.batch_id ? ' <span class="small muted">(hàng loạt)</span>' : ''}</td><td>${esc(r.reason)}</td><td class="small">${fmtDate(r.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Chưa có.</p>'}`;
}

// Các lần chạy theo Test Run (BM4) và phiếu báo sửa lỗi (BM17)
function executionsView(list) {
  if (!list.length) return '<p class="muted">Chưa có lần chạy nào. Kết quả được ghi trong Test Run (QĐ5).</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Kết quả</th><th>Test Run</th><th>Phiên bản test</th><th>Ghi chú / defect</th><th>Người chạy</th><th>Thời gian</th><th>Sửa lỗi</th></tr></thead>
    <tbody>${list.map((e) => `<tr><td>${pill(e.result)}${e.retest_of ? '<div class="small muted">chạy lại</div>' : ''}</td>
      <td><a href="#/runs/${e.run_id}">${esc(e.run_name)}</a><div class="small muted">build ${esc(e.build)} · ${esc(e.environment)}</div></td>
      <td>v${e.tc_version}</td>
      <td>${esc(e.note || '')}${e.defect_code ? `<div class="small mono">${esc(e.defect_code)}</div>` : ''}${e.evidence_url ? `<div class="small"><a href="${esc(e.evidence_url)}" target="_blank" rel="noopener">Bằng chứng ↗</a></div>` : ''}</td>
      <td>${esc(e.executed_by_name || '')}</td><td class="small">${fmtDate(e.executed_at)}</td>
      <td>${e.fix_id ? `${pill(e.fix_status)}<div class="small muted">build ${esc(e.fix_build)} · ${esc(e.fixed_by_name || '')}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

export async function openTestCase(id, onChange = () => {}) {
  const m = modal({ title: 'Test case', wide: true, body: '<div class="empty"><span class="spinner dark"></span></div>' });
  let tab = 'detail';
  const withScript = feature('script');

  async function draw() {
    const [t, h, script] = await Promise.all([
      api(`/testcases/${id}`), api(`/testcases/${id}/history`), withScript ? api(`/testcases/${id}/script`) : null,
    ]);
    const story = await api(`/stories/${t.story_id}`);
    m.el.querySelector('.modal-head h2').textContent = `${t.code} · ${t.title}`;
    const editable = can('testcase:write') && ['DRAFT', 'RETURNED', 'APPROVED'].includes(t.status) && !story.archived;
    const draftLike = ['DRAFT', 'RETURNED'].includes(t.status);
    const lastReturn = t.status === 'RETURNED' ? h.reviews.find((r) => r.decision === 'RETURNED') : null;

    const tabs = [['detail', 'Chi tiết'], ['history', `Lịch sử (${h.versions.length})`], ['runs', `Lần chạy (${h.executions.length})`]];
    if (withScript) tabs.push(['script', '🎭 Script Playwright']);
    let body = `<div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div>`;

    if (tab === 'detail') {
      body += `${lastReturn ? `<div class="alert danger">QA Lead đã trả lại: <b>${esc(lastReturn.note)}</b></div>` : ''}
        ${t.needs_review ? `<div class="alert warn row">⚑ Requirement đã đổi (${esc(LABEL[t.review_reason] || '')}) sau phiên bản test liên kết (v${t.req_version} → v${t.story_version}).
          Test vẫn đúng thì bấm <b>Đã xem lại</b>; cần sửa thì sửa và gửi duyệt lại.<span class="spacer"></span>
          ${can('testcase:write') ? '<button class="btn sm" id="tc-recheck">✔ Đã xem lại</button>' : ''}</div>` : ''}
        ${t.status === 'APPROVED' && editable ? '<div class="alert info">Test case đã duyệt. Nếu sửa, test quay về Nháp và phải duyệt lại; các Test Run đang mở vẫn chạy phiên bản đã cố định.</div>' : ''}
        <div id="tc-detail">${detailView(t)}</div>
        <div class="row mt">
          ${editable ? '<button class="btn" id="tc-edit">✏️ Sửa</button>' : ''}
          ${can('testcase:write') && draftLike ? '<button class="btn primary" id="tc-submit">📤 Gửi duyệt</button><button class="btn danger" id="tc-del">Xóa</button>' : ''}
          ${can('testcase:review') && t.status === 'PENDING_REVIEW' ? `
            <div style="flex-basis:100%"></div>
            <input id="rv-note" placeholder="Ghi chú duyệt (bắt buộc khi trả lại)" style="flex:1;min-width:260px" aria-label="Ghi chú duyệt">
            <button class="btn danger" id="rv-return">↩️ Trả lại</button><button class="btn success" id="rv-approve">✓ Duyệt</button>` : ''}
        </div>`;
    } else if (tab === 'history') {
      body += historyView(h);
    } else if (tab === 'runs') {
      body += executionsView(h.executions);
    } else {
      body += t.status !== 'APPROVED'
        ? '<div class="alert warn">Chỉ sinh script cho test case đã được duyệt.</div>'
        : `<div class="alert info">YC19 (phần mở rộng): AI chuyển các bước thành script <b>Playwright</b>. Kết quả chạy tự động được ghi vào một test trong Test Run (QĐ5).
           ${t.base_url ? `URL cần test: <code>${esc(t.base_url)}</code>` : '<br>⚠️ Dự án chưa khai báo URL ứng dụng cần test.'}</div>
          <div class="row mb">
            ${can('ai:use') ? `<button class="btn ai" id="sc-gen">✨ ${script ? 'Sinh lại script' : 'Sinh script Playwright bằng AI'}</button>` : ''}
            ${script && can('testcase:write') ? '<button class="btn" id="sc-save">💾 Lưu chỉnh sửa</button>' : ''}
            ${script ? '<button class="btn" id="sc-dl">⬇️ Tải file .spec.js</button>' : ''}
          </div>
          ${script?.warnings?.length ? `<div class="alert danger">Script sẽ bị chặn khi chạy: ${esc(script.warnings.join('; '))}</div>` : ''}
          ${script ? `<textarea class="code" id="sc-code" spellcheck="false" aria-label="Mã nguồn script">${esc(script.code)}</textarea>` : '<p class="muted">Chưa có script.</p>'}`;
    }
    m.el.querySelector('.modal-body').innerHTML = body;
    wire(t, story);
  }

  function wire(t, story) {
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
      el.querySelector('#tc-detail').innerHTML = testCaseForm(t, { withNote: true, acs: story.acs, linked: t.acs }) +
        '<div class="row mt"><button class="btn" id="tc-cancel">Hủy</button><button class="btn primary" id="tc-save">Lưu phiên bản mới</button></div>';
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
    act('#tc-recheck', () => openRecheck([t], () => (onChange(), draw().catch(toastError)), { acs: story.acs }));
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
    act('#sc-gen', async (b) => {
      await busy(b, () => api(`/testcases/${id}/script/generate`, { method: 'POST' }), 'AI đang viết script...');
      await changed('AI đã sinh script Playwright');
    });
    act('#sc-save', async (b) => {
      await busy(b, () => api(`/testcases/${id}/script`, { method: 'PUT', body: { code: el.querySelector('#sc-code').value } }));
      await changed('Đã lưu script');
    });
    act('#sc-dl', async () => download(await api(`/testcases/${id}/script/download`, { blob: true }), `${t.code}.spec.js`));
  }

  try {
    await draw();
  } catch (e) {
    m.el.querySelector('.modal-body').innerHTML = `<div class="alert danger">${esc(e.message)}</div>`;
  }
}

// YC7 – BM6, QĐ7: tra cứu, các điều kiện lọc kết hợp AND · YC9: xuất Excel đúng danh sách đang lọc
export async function renderTestCases(page) {
  const q0 = state.projectId ? `?project_id=${state.projectId}` : '';
  const [suites, runs] = await Promise.all([api(`/suites${q0}`), api(`/runs${q0}`)]);
  const project = state.projects.find((p) => p.id === state.projectId);
  page.innerHTML = `
    <div class="page-head">
      <div><h1>Test case</h1><p>Tra cứu (YC7): các điều kiện lọc kết hợp với nhau; "KQ gần nhất" chỉ tính lần chạy của phiên bản hiện tại. Xuất Excel đúng danh sách đang lọc (YC9).</p></div>
      <div class="row">
        ${can('testcase:write') ? '<button class="btn" id="bulk-recheck" disabled>✔ Đã xem lại mục đã chọn</button>' : ''}
        <button class="btn" id="export">⬇️ Xuất Excel</button>
      </div>
    </div>
    <form class="filters" id="tc-filter">
      <input type="search" name="q" placeholder="Tìm mã hoặc tiêu đề..." aria-label="Từ khóa">
      ${project ? `<select name="module_id" aria-label="Module">${options(project.modules, '', { empty: 'Mọi module' })}</select>` : ''}
      <select name="status" aria-label="Trạng thái">${options(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'RETURNED'], '', { empty: 'Mọi trạng thái' })}</select>
      <select name="priority" aria-label="Độ ưu tiên">${options(['High', 'Medium', 'Low'], '', { empty: 'Mọi độ ưu tiên' })}</select>
      <select name="type" aria-label="Loại">${options(['Positive', 'Negative', 'Edge'], '', { empty: 'Mọi loại' })}</select>
      <select name="source" aria-label="Nguồn">${options(['AI', 'MANUAL'], '', { empty: 'Mọi nguồn' })}</select>
      <select name="suite_id" aria-label="Test Suite">${options(suites, '', { empty: 'Mọi suite' })}</select>
      <select name="run_id" aria-label="Test Run">${options(runs, '', { empty: 'Mọi Test Run' })}</select>
      <select name="needs_review" aria-label="Cần xem lại"><option value="">Cờ: mọi test</option><option value="true">⚑ Cần xem lại</option></select>
      <select name="needs_retest" aria-label="Kiểm thử lại"><option value="">Kiểm thử lại: mọi test</option><option value="true">🔁 Chờ kiểm thử lại</option></select>
    </form>
    <div class="table-wrap"><table>
      <thead><tr>${can('testcase:write') ? '<th></th>' : ''}<th>Mã</th><th>Tiêu đề</th><th>Requirement</th><th>Loại</th><th>Ưu tiên</th><th>Nguồn</th><th>Trạng thái</th><th>Phiên bản</th><th>KQ gần nhất</th><th>Suite</th></tr></thead>
      <tbody id="tc-rows"></tbody>
    </table></div>
    <p class="small muted" id="tc-count"></p>`;

  const form = page.querySelector('#tc-filter');
  const query = () => {
    const q = new URLSearchParams([...new FormData(form)].filter(([, v]) => v));
    if (state.projectId) q.set('project_id', state.projectId);
    return q;
  };
  let list = [];
  const bulkBtn = page.querySelector('#bulk-recheck');
  const syncSel = () => bulkBtn && (bulkBtn.disabled = !page.querySelectorAll('.rc-sel:checked').length);
  const load = async () => {
    list = await api(`/testcases?${query()}`);
    const tbody = page.querySelector('#tc-rows');
    tbody.innerHTML = list.map((t) => `
      <tr class="clickable" data-id="${t.id}">${can('testcase:write') ? `<td data-nocl>${t.needs_review ? `<input type="checkbox" class="rc-sel" value="${t.id}" aria-label="Chọn ${esc(t.code)}">` : ''}</td>` : ''}
      <td class="mono">${esc(t.code)}</td><td>${esc(t.title)}</td><td>${esc(t.story_code)}</td>
      <td>${esc(t.type)}</td><td>${pill(t.priority)}</td><td>${pill(t.source)}</td><td>${pill(t.status)}${flags(t)}</td><td>v${t.version}</td>
      <td>${t.last_result ? pill(t.last_result) : '<span class="small muted">Chưa chạy</span>'}</td><td class="small">${esc(t.suites || '')}</td></tr>`).join('')
      || `<tr><td colspan="11" class="empty">Không có test case phù hợp</td></tr>`;
    page.querySelector('#tc-count').textContent = `${list.length} test case`;
    bind(tbody, 'tr[data-id]', 'click', (e, tr) => !e.target.closest('[data-nocl]') && openTestCase(Number(tr.dataset.id), load));
    bind(tbody, '.rc-sel', 'change', syncSel);
    syncSel();
  };
  let timer;
  form.addEventListener('input', () => (clearTimeout(timer), (timer = setTimeout(() => load().catch(toastError), 250))));
  form.addEventListener('submit', (e) => e.preventDefault());
  bulkBtn?.addEventListener('click', () => {
    const ids = [...page.querySelectorAll('.rc-sel:checked')].map((c) => Number(c.value));
    openRecheck(list.filter((t) => ids.includes(t.id)), () => load().catch(toastError));
  });
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

