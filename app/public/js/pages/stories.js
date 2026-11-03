// YC1: User story đồng bộ từ Jira (chỉ đọc) · YC8: story đổi trên Jira → xem lại test case · YC2: Sinh test case bằng AI · YC3: Gửi duyệt
import { state, api, esc, can, pill, fmtDate, toast, toastError, modal, confirmBox, bind, busy } from '../core.js';
import { openTestCase, testCaseForm, readTestCaseForm } from './testcases.js';
import { updateReviewBadge, currentProject } from '../main.js';

const jiraLink = (site, code) => (site ? `<a href="${esc(site)}/browse/${encodeURIComponent(code)}" target="_blank" rel="noopener">${esc(code)} ↗</a>` : esc(code));

// YC1, YC8: đồng bộ story của dự án đang chọn từ Jira
async function syncFromJira(btn, project, onDone) {
  try {
    const r = await busy(btn, () => api(`/projects/${project.id}/jira-sync`, { method: 'POST' }), 'Đang đồng bộ...');
    const st = r.stories;
    toast(`Jira ${r.code}: ${st.created} story mới, ${st.updated} cập nhật${st.changed ? `, ${st.changed} cần xem lại test case` : ''}${st.archived ? `, ${st.archived} đã xóa trên Jira` : ''}`, 'success');
    if (r.warnings.length) toast(r.warnings.join(' · '), 'info');
    onDone();
  } catch (err) {
    toastError(err);
  }
}

export async function renderStories(page) {
  const q = new URLSearchParams();
  if (state.projectId) q.set('project_id', state.projectId);
  if (state.sprintId) q.set('sprint_id', state.sprintId);
  const [list, jira] = await Promise.all([api(`/stories?${q}`), api('/jira/info')]);
  const project = currentProject();
  const canSync = project?.jira_key && can('jira:import');
  page.innerHTML = `
    <div class="page-head">
      <div><h1>User story</h1><p>Đồng bộ một chiều từ Jira: PO/BA tạo và sửa story trên Jira, hệ thống chỉ đọc để sinh test case${project?.synced_at ? ` · đồng bộ lần cuối ${esc(fmtDate(project.synced_at))}` : ''}</p></div>
      <div class="row">${canSync ? '<button class="btn primary" id="sync-btn">⟳ Đồng bộ từ Jira</button>' : ''}</div>
    </div>
    ${project && !project.jira_key ? '<div class="alert info mb">Dự án mẫu, không liên kết Jira: user story là dữ liệu có sẵn để demo.</div>' : ''}
    <div class="filters"><input type="search" id="story-q" placeholder="Tìm theo mã hoặc tiêu đề..."></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Dự án / Module</th><th>Sprint</th><th>Ưu tiên</th><th>Test case</th><th>Cập nhật</th></tr></thead>
      <tbody id="story-rows"></tbody>
    </table></div>`;

  const rows = (items) => items.map((s) => `
    <tr class="clickable" data-id="${s.id}">
      <td><b>${esc(s.code)}</b></td>
      <td>${esc(s.title)}${s.changed_at ? ' <span class="pill PENDING_REVIEW" title="Story đổi trên Jira sau khi đã có test case">🔁 Cần xem lại test case</span>' : ''}
        ${s.acceptance_criteria.trim() ? '' : ' <span class="pill RETURNED">Thiếu acceptance criteria</span>'}
        <div class="small muted">${s.jira_status ? `Jira: ${esc(s.jira_status)} · ` : ''}${esc(s.description.slice(0, 110))}${s.description.length > 110 ? '…' : ''}</div></td>
      <td>${esc(s.project_name)}<div class="small muted">${esc(s.module_name || '—')}</div></td>
      <td>${s.sprint_name ? esc(s.sprint_name) : '<span class="muted">Backlog</span>'}${s.story_points ? `<div class="small muted">${s.story_points} SP</div>` : ''}</td>
      <td>${pill(s.priority)}</td>
      <td>${s.tc_count ? `${s.tc_approved}/${s.tc_count} đã duyệt` : '<span class="muted">Chưa có</span>'}</td>
      <td class="small">${fmtDate(s.updated_at)}</td>
    </tr>`).join('') || `<tr><td colspan="7" class="empty">Chưa có user story nào${canSync ? ' – bấm <b>⟳ Đồng bộ từ Jira</b>' : ''}</td></tr>`;

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
  page.querySelector('#sync-btn')?.addEventListener('click', (e) => syncFromJira(e.currentTarget, project, () => renderStories(page)));
}

export async function renderStoryDetail(page, id) {
  const [story, tcs, params, jira] = await Promise.all([api(`/stories/${id}`), api(`/testcases?story_id=${id}`), api('/parameters'), api('/jira/info')]);
  const max = Number(params.find((p) => p.key === 'MAX_TC_PER_STORY')?.value);
  const minAc = Number(params.find((p) => p.key === 'MIN_AC_PER_STORY')?.value);
  const acs = story.acceptance_criteria.split('\n').map((x) => x.replace(/^\s*[-*•]\s*/, '')).filter(Boolean);
  const selectable = (t) => ['DRAFT', 'RETURNED'].includes(t.status);

  page.innerHTML = `
    <div class="page-head">
      <div><a href="#/stories" class="small">← Danh sách user story</a><h1>${story.project_jira_key ? jiraLink(jira.site, story.code) : esc(story.code)} · ${esc(story.title)}</h1>
        <p>${esc(story.project_name)}${story.module_name ? ' / ' + esc(story.module_name) : ''} · ${pill(story.priority)}
          · ${story.sprint_name ? `🏃 ${esc(story.sprint_name)}` : 'Product backlog'}${story.story_points ? ` · ${story.story_points} story point` : ''}
          ${story.jira_status ? ` · Jira: <b>${esc(story.jira_status)}</b>` : ''}${story.synced_at ? ` · đồng bộ ${esc(fmtDate(story.synced_at))}` : ''}</p></div>
    </div>
    ${story.archived ? '<div class="alert danger mb">🗄 Story đã bị xóa trên Jira. Hệ thống giữ lại để xem test case đã viết, không sinh thêm test case.</div>' : ''}
    ${story.changed_at ? `<div class="alert warn mb row">🔁 Story đã thay đổi trên Jira lúc ${esc(fmtDate(story.changed_at))} sau khi đã có test case – xem lại các test case bên dưới cho khớp acceptance criteria mới.
      <span class="spacer"></span>${can('testcase:write') ? '<button class="btn sm" id="reviewed-btn">✔ Đã xem lại</button>' : ''}</div>` : ''}
    ${acs.length < minAc ? `<div class="alert warn mb">Story chưa có đủ ${minAc} acceptance criteria. PO/BA bổ sung mục <b>Acceptance criteria</b> trong Description trên Jira rồi đồng bộ lại (QĐ1).</div>` : ''}
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
        ${can('ai:use') ? `<button class="btn ai" id="gen-btn" ${story.archived || acs.length < minAc ? 'disabled' : ''}>✨ Sinh test case bằng AI</button>` : ''}
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
    const btn = e.currentTarget; // lấy trước mọi await: sau await, e.currentTarget đã là null
    if (tcs.some((t) => t.source === 'AI' && t.status === 'DRAFT') &&
      !(await confirmBox('Sinh lại sẽ thay thế các test case AI đang ở trạng thái Nháp. Tiếp tục?'))) return;
    const banner = page.querySelector('#ai-banner');
    banner.innerHTML = `<div class="alert ai"><span class="spinner dark"></span> AI đang phân tích ${acs.length} acceptance criteria và sinh test case...</div>`;
    try {
      const r = await busy(btn, () => api(`/stories/${id}/generate`, { method: 'POST' }), 'AI đang sinh...');
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

  page.querySelector('#reviewed-btn')?.addEventListener('click', async (e) => {
    try {
      await busy(e.currentTarget, () => api(`/stories/${id}/reviewed`, { method: 'POST' }));
      toast('Đã đánh dấu xem lại test case', 'success');
      reload();
    } catch (err) {
      toastError(err);
    }
  });
}
