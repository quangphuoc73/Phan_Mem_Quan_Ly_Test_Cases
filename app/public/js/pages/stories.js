// YC1: Lập user story · YC8: Nhập từ file · YC2: Sinh test case bằng AI · YC3: Gửi duyệt
import { state, api, esc, can, pill, fmtDate, toast, toastError, modal, confirmBox, bind, formData, busy, options } from '../core.js';
import { openTestCase, testCaseForm, readTestCaseForm } from './testcases.js';
import { updateReviewBadge } from '../main.js';

const PRIORITIES = ['High', 'Medium', 'Low'];

function storyForm(s = {}) {
  const projectId = s.project_id || state.projectId || state.projects[0]?.id;
  const project = state.projects.find((p) => p.id === Number(projectId));
  return `
  <form id="story-form">
    <div class="grid g2">
      <div class="field"><label>Mã user story *</label><input name="code" value="${esc(s.code || '')}" placeholder="US-PET-005" ${s.id ? 'disabled' : 'required'}>
        <div class="hint">QĐ1: dạng US-XXX, không trùng</div></div>
      <div class="field"><label>Độ ưu tiên</label><select name="priority">${options(PRIORITIES, s.priority || 'Medium')}</select></div>
      <div class="field"><label>Dự án *</label><select name="project_id" id="sf-project" ${s.id ? 'disabled' : ''}>${options(state.projects, projectId)}</select></div>
      <div class="field"><label>Module</label><select name="module_id" id="sf-module">${options(project?.modules || [], s.module_id, { empty: '(Không chọn)' })}</select></div>
      <div class="field"><label>Sprint</label><select name="sprint_id" id="sf-sprint">${options(project?.sprints || [], s.sprint_id ?? (s.id ? null : state.sprintId), { empty: '(Product backlog)' })}</select></div>
      <div class="field"><label>Story point</label><select name="story_points">${options([1, 2, 3, 5, 8, 13], s.story_points, { empty: '(Chưa ước lượng)' })}</select>
        <div class="hint">Ước lượng độ lớn theo dãy Fibonacci (QĐ12)</div></div>
    </div>
    <div class="field"><label>Tiêu đề *</label><input name="title" value="${esc(s.title || '')}" required placeholder="Gửi yêu cầu bồi thường"></div>
    <div class="field"><label>Mô tả *</label><textarea name="description" required placeholder="Là [vai trò], tôi muốn [chức năng], để [lợi ích].">${esc(s.description || '')}</textarea></div>
    <div class="field"><label>Acceptance criteria * <span class="hint">(mỗi dòng 1 tiêu chí)</span></label>
      <textarea name="acceptance_criteria" rows="6" required placeholder="- Tải lên hóa đơn PDF hoặc ảnh, tối đa 10 MB&#10;- Bắt buộc chọn thú cưng và ngày khám">${esc(s.acceptance_criteria || '')}</textarea></div>
  </form>`;
}

function bindProjectModule(root) {
  const p = root.querySelector('#sf-project');
  p?.addEventListener('change', () => {
    const proj = state.projects.find((x) => x.id === Number(p.value));
    root.querySelector('#sf-module').innerHTML = options(proj?.modules || [], null, { empty: '(Không chọn)' });
    root.querySelector('#sf-sprint').innerHTML = options(proj?.sprints || [], null, { empty: '(Product backlog)' });
  });
}

export function openStoryForm(story, onSaved) {
  const m = modal({
    title: story ? `Sửa user story ${story.code}` : 'Lập user story mới (BM1)',
    body: storyForm(story || {}),
    foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="save-story">Lưu</button>',
  });
  bindProjectModule(m.el);
  m.el.querySelector('#save-story').addEventListener('click', async (e) => {
    const form = m.el.querySelector('#story-form');
    if (!form.reportValidity()) return;
    const d = formData(form);
    d.module_id = d.module_id ? Number(d.module_id) : null;
    d.sprint_id = d.sprint_id ? Number(d.sprint_id) : null;
    d.story_points = d.story_points ? Number(d.story_points) : null;
    try {
      const saved = await busy(e.currentTarget, () =>
        story ? api(`/stories/${story.id}`, { method: 'PUT', body: d }) : api('/stories', { method: 'POST', body: d }));
      m.close();
      toast(story ? 'Đã cập nhật user story' : `Đã tạo user story ${saved.code}`, 'success');
      onSaved(saved);
    } catch (err) {
      toastError(err);
    }
  });
}

// ---- Nhập file CSV/JSON ----
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"', i++);
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') (row.push(cell), cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) (row.push(cell), rows.push(row));
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  const keys = head.map((h) => h.trim().replace(/^﻿/, ''));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] || '').trim()])));
}

function openImport(onDone) {
  const m = modal({
    title: 'Nhập user story từ file (YC8)',
    body: `
      <div class="alert info">Hỗ trợ <b>.csv</b> hoặc <b>.json</b>. Các cột: <code>code, title, description, acceptance_criteria, priority, module, sprint, story_points</code>.
      Trong CSV, các acceptance criteria ngăn cách bằng dấu <code>|</code>. File mẫu: <code>app/samples/user_stories_mau.csv</code>.</div>
      <div class="field"><label>Nhập vào dự án</label><select id="imp-project">${options(state.projects, state.projectId || state.projects[0]?.id)}</select></div>
      <div class="field"><label>Chọn file</label><input type="file" id="imp-file" accept=".csv,.json"></div>
      <div id="imp-result"></div>`,
    foot: '<button class="btn" data-close>Đóng</button><button class="btn primary" id="imp-go">Nhập</button>',
  });
  m.el.querySelector('#imp-go').addEventListener('click', async (e) => {
    const file = m.el.querySelector('#imp-file').files[0];
    if (!file) return toast('Chưa chọn file', 'error');
    const projectId = Number(m.el.querySelector('#imp-project').value);
    const project = state.projects.find((p) => p.id === projectId);
    try {
      const text = await file.text();
      const raw = file.name.endsWith('.json') ? JSON.parse(text) : parseCsv(text);
      const rows = raw.map((r) => ({
        code: r.code,
        title: r.title,
        description: r.description,
        acceptance_criteria: String(r.acceptance_criteria || '').split('|').map((x) => x.trim()).filter(Boolean).join('\n'),
        priority: r.priority || 'Medium',
        project_id: projectId,
        module_id: project.modules.find((x) => x.name.toLowerCase() === String(r.module || '').toLowerCase())?.id || null,
        sprint_id: project.sprints.find((x) => x.name.toLowerCase() === String(r.sprint || '').toLowerCase())?.id || null,
        story_points: r.story_points ? Number(r.story_points) : null,
      }));
      const res = await busy(e.currentTarget, () => api('/stories/import', { method: 'POST', body: { rows } }));
      m.el.querySelector('#imp-result').innerHTML = `
        <div class="alert ${res.errors.length ? 'warn' : 'success'}">Đã nhập <b>${res.created.length}</b> user story${res.created.length ? `: ${esc(res.created.join(', '))}` : ''}.
        ${res.errors.length ? `<br>Lỗi ${res.errors.length} dòng:<ul>${res.errors.map((x) => `<li>Dòng ${x.row} (${esc(x.code)}): ${esc(x.error)}</li>`).join('')}</ul>` : ''}</div>`;
      onDone();
    } catch (err) {
      toastError(err);
    }
  });
}

export async function renderStories(page) {
  const q = new URLSearchParams();
  if (state.projectId) q.set('project_id', state.projectId);
  if (state.sprintId) q.set('sprint_id', state.sprintId);
  const list = await api(`/stories?${q}`);
  page.innerHTML = `
    <div class="page-head">
      <div><h1>User story</h1><p>Yêu cầu nghiệp vụ là đầu vào để AI sinh test case</p></div>
      <div class="row">
        ${can('story:write') ? '<button class="btn" id="import-btn">⬆️ Nhập từ file</button><button class="btn primary" id="new-story">＋ Lập user story</button>' : ''}
      </div>
    </div>
    <div class="filters"><input type="search" id="story-q" placeholder="Tìm theo mã hoặc tiêu đề..."></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Dự án / Module</th><th>Sprint</th><th>Ưu tiên</th><th>Test case</th><th>Ngày tạo</th></tr></thead>
      <tbody id="story-rows"></tbody>
    </table></div>`;

  const rows = (items) => items.map((s) => `
    <tr class="clickable" data-id="${s.id}">
      <td><b>${esc(s.code)}</b></td>
      <td>${esc(s.title)}<div class="small muted">${esc(s.description.slice(0, 110))}${s.description.length > 110 ? '…' : ''}</div></td>
      <td>${esc(s.project_name)}<div class="small muted">${esc(s.module_name || '—')}</div></td>
      <td>${s.sprint_name ? esc(s.sprint_name) : '<span class="muted">Backlog</span>'}${s.story_points ? `<div class="small muted">${s.story_points} SP</div>` : ''}</td>
      <td>${pill(s.priority)}</td>
      <td>${s.tc_count ? `${s.tc_approved}/${s.tc_count} đã duyệt` : '<span class="muted">Chưa có</span>'}</td>
      <td class="small">${fmtDate(s.created_at)}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="empty">Chưa có user story nào</td></tr>';

  const tbody = page.querySelector('#story-rows');
  const draw = (items) => {
    tbody.innerHTML = rows(items);
    bind(tbody, 'tr[data-id]', 'click', (_e, tr) => (location.hash = `#/stories/${tr.dataset.id}`));
  };
  draw(list);
  page.querySelector('#story-q').addEventListener('input', (e) => {
    const k = e.target.value.toLowerCase();
    draw(list.filter((s) => s.code.toLowerCase().includes(k) || s.title.toLowerCase().includes(k)));
  });
  page.querySelector('#new-story')?.addEventListener('click', () => openStoryForm(null, (s) => (location.hash = `#/stories/${s.id}`)));
  page.querySelector('#import-btn')?.addEventListener('click', () => openImport(() => renderStories(page)));
}

export async function renderStoryDetail(page, id) {
  const [story, tcs, params] = await Promise.all([api(`/stories/${id}`), api(`/testcases?story_id=${id}`), api('/parameters')]);
  const max = Number(params.find((p) => p.key === 'MAX_TC_PER_STORY')?.value);
  const acs = story.acceptance_criteria.split('\n').map((x) => x.replace(/^\s*[-*•]\s*/, '')).filter(Boolean);
  const selectable = (t) => ['DRAFT', 'RETURNED'].includes(t.status);

  page.innerHTML = `
    <div class="page-head">
      <div><a href="#/stories" class="small">← Danh sách user story</a><h1>${esc(story.code)} · ${esc(story.title)}</h1>
        <p>${esc(story.project_name)}${story.module_name ? ' / ' + esc(story.module_name) : ''} · ${pill(story.priority)}
          · ${story.sprint_name ? `🏃 ${esc(story.sprint_name)}` : 'Product backlog'}${story.story_points ? ` · ${story.story_points} story point` : ''}</p></div>
      <div class="row">
        ${can('story:write') ? '<button class="btn" id="edit-story">Sửa</button><button class="btn danger" id="del-story">Xóa</button>' : ''}
      </div>
    </div>
    <div class="grid g2">
      <div class="card"><h3>Mô tả</h3><p style="white-space:pre-wrap;margin:0">${esc(story.description)}</p></div>
      <div class="card"><h3>Acceptance criteria (${acs.length})</h3><ol class="steps">${acs.map((a) => `<li>${esc(a)}</li>`).join('')}</ol></div>
    </div>
    <div id="ai-banner" class="mt"></div>
    <div class="card mt">
      <div class="row mb">
        <h2 style="margin:0">Test case (${tcs.length}/${max})</h2>
        <span class="muted small">QĐ2: tối đa ${max} test case cho mỗi user story</span>
        <span class="spacer"></span>
        ${can('testcase:write') ? '<button class="btn" id="submit-sel" disabled>📤 Gửi duyệt mục đã chọn</button><button class="btn" id="add-tc">＋ Thêm thủ công</button>' : ''}
        ${can('ai:use') ? `<button class="btn ai" id="gen-btn">✨ Sinh test case bằng AI</button>` : ''}
      </div>
      <div class="table-wrap"><table>
        <thead><tr>${can('testcase:write') ? '<th><input type="checkbox" id="sel-all" aria-label="Chọn tất cả"></th>' : ''}<th>Mã</th><th>Tiêu đề</th><th>Loại</th><th>Ưu tiên</th><th>Nguồn</th><th>Trạng thái</th><th>KQ gần nhất</th></tr></thead>
        <tbody>${tcs.map((t) => `
          <tr class="clickable" data-id="${t.id}">
            ${can('testcase:write') ? `<td data-nocl>${selectable(t) ? `<input type="checkbox" class="sel" value="${t.id}" aria-label="Chọn ${esc(t.code)}">` : ''}</td>` : ''}
            <td class="mono">${esc(t.code)}</td><td>${esc(t.title)}</td><td>${esc(t.type)}</td><td>${pill(t.priority)}</td>
            <td>${pill(t.source)}${t.version > 1 ? ` <span class="small muted">v${t.version}</span>` : ''}</td><td>${pill(t.status)}</td><td>${pill(t.last_result)}</td>
          </tr>`).join('') || `<tr><td colspan="8" class="empty">Chưa có test case. ${can('ai:use') ? 'Bấm <b>✨ Sinh test case bằng AI</b> để bắt đầu.' : ''}</td></tr>`}
        </tbody>
      </table></div>
    </div>`;

  const reload = () => renderStoryDetail(page, id);
  bind(page, 'tr[data-id]', 'click', (e, tr) => {
    if (e.target.closest('[data-nocl]')) return;
    openTestCase(Number(tr.dataset.id), reload);
  });

  const submitBtn = page.querySelector('#submit-sel');
  const syncSel = () => submitBtn && (submitBtn.disabled = !page.querySelectorAll('.sel:checked').length);
  bind(page, '.sel', 'change', syncSel);
  page.querySelector('#sel-all')?.addEventListener('change', (e) => {
    page.querySelectorAll('.sel').forEach((c) => (c.checked = e.target.checked));
    syncSel();
  });
  submitBtn?.addEventListener('click', async () => {
    const ids = [...page.querySelectorAll('.sel:checked')].map((c) => Number(c.value));
    try {
      const r = await api('/testcases/submit', { method: 'POST', body: { ids } });
      toast(`Đã gửi duyệt ${r.submitted.length} test case`, 'success');
      updateReviewBadge();
      reload();
    } catch (e) {
      toastError(e);
    }
  });

  page.querySelector('#gen-btn')?.addEventListener('click', async (e) => {
    if (tcs.some((t) => t.source === 'AI' && t.status === 'DRAFT') &&
      !(await confirmBox('Sinh lại sẽ thay thế các test case AI đang ở trạng thái Nháp. Tiếp tục?'))) return;
    const banner = page.querySelector('#ai-banner');
    banner.innerHTML = `<div class="alert ai"><span class="spinner dark"></span> AI đang phân tích ${acs.length} acceptance criteria và sinh test case...</div>`;
    try {
      const r = await busy(e.currentTarget, () => api(`/stories/${id}/generate`, { method: 'POST' }), 'AI đang sinh...');
      await reload();
      const pii = Object.entries(r.piiFound || {}).map(([k, v]) => `${v} ${k}`).join(', ');
      page.querySelector('#ai-banner').innerHTML = `
        <div class="alert ai">✨ AI đã sinh <b>${r.testCases.length}</b> test case trong ${(r.durationMs / 1000).toFixed(1)} giây, trạng thái <b>Nháp</b> – cần Tester xem lại trước khi gửi duyệt.
        ${pii ? `<br>🔒 Đã che dữ liệu nhạy cảm trước khi gửi cho AI: <b>${esc(pii)}</b>.` : ''}
        ${r.injectionWarning ? '<br>⚠️ Phát hiện nội dung giống <b>prompt injection</b> trong user story – AI đã được chỉ dẫn bỏ qua, kết quả vẫn qua kiểm tra schema.' : ''}
        <br><a href="#/ai-logs">Xem nhật ký AI #${r.aiLogId} (prompt đã gửi đi) →</a></div>`;
    } catch (err) {
      page.querySelector('#ai-banner').innerHTML = `<div class="alert danger">${esc(err.message)}</div>`;
    }
  });

  page.querySelector('#add-tc')?.addEventListener('click', () => {
    const m = modal({
      title: `Thêm test case thủ công cho ${story.code}`,
      wide: true,
      body: testCaseForm({ priority: 'Medium', type: 'Positive', steps: [''] }),
      foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="save-new-tc">Lưu</button>',
    });
    m.el.querySelector('#save-new-tc').addEventListener('click', async (e) => {
      const d = readTestCaseForm(m.el);
      if (!d) return;
      try {
        await busy(e.currentTarget, () => api('/testcases', { method: 'POST', body: { ...d, story_id: Number(id) } }));
        m.close();
        toast('Đã thêm test case', 'success');
        reload();
      } catch (err) {
        toastError(err);
      }
    });
  });

  page.querySelector('#edit-story')?.addEventListener('click', () => openStoryForm(story, reload));
  page.querySelector('#del-story')?.addEventListener('click', async () => {
    if (!(await confirmBox(`Xóa user story ${story.code} và toàn bộ test case của nó?`, { okText: 'Xóa', danger: true }))) return;
    try {
      await api(`/stories/${id}`, { method: 'DELETE' });
      toast('Đã xóa user story', 'success');
      location.hash = '#/stories';
    } catch (e) {
      toastError(e);
    }
  });
}
