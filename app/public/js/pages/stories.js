// YC1: Requirement đồng bộ từ Jira (chỉ đọc), lịch sử phiên bản · YC8: nhận thay đổi, xử lý Cần kiểm tra
// YC2: Sinh test case bằng AI · YC3: Gửi duyệt, Đã xem lại · YC15: Phân tích ảnh hưởng · YC17: Bộ regression
import { state, api, esc, can, pill, fmtDate, toast, toastError, modal, bind, busy, options, LABEL } from '../core.js';
import { openTestCase, testCaseForm, readTestCaseForm, openRecheck, flags } from './testcases.js';
import { proposalCards } from './proposals.js';
import { updateReviewBadge, currentProject } from '../main.js';

const jiraLink = (site, code) => (site ? `<a href="${esc(site)}/browse/${encodeURIComponent(code)}" target="_blank" rel="noopener">${esc(code)} ↗</a>` : esc(code));

// Tóm tắt kết quả một lần đồng bộ (BM7)
export function syncSummary(r) {
  const s = r.stories;
  const parts = [`${s.created} requirement mới`, `${s.updated} cập nhật`];
  if (s.versioned) parts.push(`${s.versioned} phiên bản mới`);
  if (s.flaggedTests) parts.push(`${s.flaggedTests} test bị gắn cờ Cần xem lại`);
  if (s.needsCheck) parts.push(`${s.needsCheck} Cần kiểm tra`);
  if (s.restored) parts.push(`${s.restored} hiện lại`);
  if (s.skippedOlder) parts.push(`${s.skippedOlder} bỏ qua (bản Jira không mới hơn)`);
  return `${r.code}: ${parts.join(', ')}`;
}

export async function syncProject(btn, projectId, onDone) {
  try {
    const r = await busy(btn, () => api(`/projects/${projectId}/jira-sync`, { method: 'POST' }), 'Đang đồng bộ...');
    toast(syncSummary(r), 'success');
    if (r.warnings.length) toast(r.warnings.join(' · '), 'info');
    await onDone();
  } catch (err) {
    toastError(err);
  }
}

const STATES = [['', 'Đang hiệu lực'], ['NORMAL', 'Bình thường'], ['MISSING_AC', 'Thiếu AC'], ['NEEDS_CHECK', 'Cần kiểm tra'], ['ARCHIVED', 'Đã lưu trữ']];

export async function renderStories(page) {
  const project = currentProject();
  const jira = await api('/jira/info');
  const canSync = project?.jira_key && can('jira:import');
  let filter = '';
  const last = project?.last_sync;
  page.innerHTML = `
    <div class="page-head">
      <div><h1>Requirement</h1><p>Đồng bộ một chiều từ Jira (YC1): PO/BA tạo và sửa trên Jira, hệ thống chỉ đọc. Mỗi lần tiêu đề, mô tả hoặc AC đổi, hệ thống tạo một phiên bản mới.
        ${last ? `<br>Lần đồng bộ gần nhất: ${pill(last.status)} ${esc(LABEL[last.source] || last.source)} · ${esc(fmtDate(last.finished_at || last.started_at))}${last.error ? ` · <span class="small">${esc(last.error)}</span>` : ''}` : ''}</p></div>
      <div class="row">${canSync ? '<button class="btn primary" id="sync-btn">⟳ Đồng bộ ngay</button>' : ''}</div>
    </div>
    ${project && !project.jira_key ? '<div class="alert info mb">Dự án mẫu, không liên kết Jira: requirement là dữ liệu có sẵn để demo.</div>' : ''}
    ${jira.mode === 'mock' && project?.jira_key ? '<div class="alert info mb">Đang dùng <b>Jira giả lập</b>. Mở một requirement và bấm <b>Mô phỏng sửa trên Jira</b> để thử luồng requirement thay đổi.</div>' : ''}
    <div class="filters">
      <div class="tabs" style="margin:0;border:0">${STATES.map(([k, l]) => `<button type="button" data-state="${k}" class="${k === filter ? 'active' : ''}">${l}</button>`).join('')}</div>
      <input type="search" id="story-q" placeholder="Tìm theo mã hoặc tiêu đề..." aria-label="Tìm requirement">
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Dự án / Module</th><th>Ưu tiên</th><th>Phiên bản</th><th>Test case</th><th>Trạng thái đồng bộ</th></tr></thead>
      <tbody id="story-rows"></tbody>
    </table></div>`;

  const tbody = page.querySelector('#story-rows');
  const load = async () => {
    const q = new URLSearchParams();
    if (state.projectId) q.set('project_id', state.projectId);
    if (filter) q.set('state', filter);
    const kw = page.querySelector('#story-q').value.trim();
    if (kw) q.set('q', kw);
    const list = await api(`/stories?${q}`);
    tbody.innerHTML = list.map((s) => `
      <tr class="clickable" data-id="${s.id}">
        <td><b>${esc(s.code)}</b></td>
        <td>${esc(s.title)}
          ${s.tc_needs_review ? ` <span class="pill flag">⚑ ${s.tc_needs_review} test cần xem lại</span>` : ''}
          ${s.proposals_pending ? ` <span class="pill AI">✨ ${s.proposals_pending} đề xuất chờ xử lý</span>` : ''}
          <div class="small muted">${s.jira_status ? `Jira: ${esc(s.jira_status)} · ` : ''}${esc(s.description.slice(0, 110))}${s.description.length > 110 ? '…' : ''}</div></td>
        <td>${esc(s.project_name)}<div class="small muted">${esc(s.module_name || '—')}</div></td>
        <td>${pill(s.priority)}</td>
        <td>v${s.current_version}</td>
        <td>${s.tc_count ? `${s.tc_approved}/${s.tc_count} đã duyệt` : '<span class="muted">Chưa có</span>'}</td>
        <td>${pill(s.sync_state)}${s.check_reason ? `<div class="small muted">${esc(LABEL[s.check_reason])}${s.check_kept_at ? ' · đã chọn Giữ lại' : ''}</div>` : ''}</td>
      </tr>`).join('') || `<tr><td colspan="7" class="empty">Không có requirement${canSync ? ' – bấm <b>⟳ Đồng bộ ngay</b>' : ''}</td></tr>`;
    bind(tbody, 'tr[data-id]', 'click', (_e, tr) => (location.hash = `#/stories/${tr.dataset.id}`));
  };
  bind(page, '[data-state]', 'click', (_e, b) => {
    filter = b.dataset.state;
    page.querySelectorAll('[data-state]').forEach((x) => x.classList.toggle('active', x === b));
    load().catch(toastError);
  });
  let timer;
  page.querySelector('#story-q').addEventListener('input', () => (clearTimeout(timer), (timer = setTimeout(() => load().catch(toastError), 250))));
  page.querySelector('#sync-btn')?.addEventListener('click', (e) => syncProject(e.currentTarget, project.id, async () => {
    const { refreshProjects } = await import('../main.js');
    await refreshProjects();
    return renderStories(page);
  }));
  await load();
}

// So AC giữa hai phiên bản: AC mới (xanh) và AC bị bỏ/sửa (gạch)
function versionCompare(prev, cur) {
  const removed = prev ? prev.acs.filter((a) => !cur.acs.includes(a)) : [];
  return `<div class="compare">
    <div><h4>v${prev ? prev.version : '–'}${prev ? ` · ${esc(LABEL[prev.source] || prev.source)}` : ''}</h4>
      ${prev ? `<div class="small"><b>${esc(prev.title)}</b></div><p class="small" style="white-space:pre-wrap">${esc(prev.description)}</p>
      <ul class="ac-list">${prev.acs.map((a) => `<li class="${removed.includes(a) ? 'removed' : ''}">${esc(a)}</li>`).join('')}</ul>` : '<p class="muted">Phiên bản đầu tiên</p>'}</div>
    <div><h4>v${cur.version} · ${esc(LABEL[cur.source] || cur.source)} · ${esc(fmtDate(cur.created_at))}</h4>
      <div class="small"><b>${esc(cur.title)}</b>${prev && prev.title !== cur.title ? ' <span class="pill flag">đổi</span>' : ''}</div>
      <p class="small" style="white-space:pre-wrap">${esc(cur.description)}${prev && prev.description !== cur.description ? ' <span class="pill flag">đổi</span>' : ''}</p>
      <ul class="ac-list">${cur.acs.map((a) => `<li class="${prev && !prev.acs.includes(a) ? 'added' : ''}">${esc(a)}</li>`).join('')}</ul></div>
  </div>`;
}

// Jira giả lập: mô phỏng PO/BA sửa issue rồi đồng bộ về (demo YC8, YC15)
function openMockEdit(story, onDone) {
  const m = modal({
    title: `Mô phỏng PO/BA sửa ${story.code} trên Jira`,
    wide: true,
    body: `<form id="mk-form">
      <div class="alert info">Chỉ có ở chế độ Jira giả lập. Lưu xong hệ thống đồng bộ như khi nhận webhook từ Jira.</div>
      <div class="field"><label>Summary (tiêu đề)</label><input name="summary" value="${esc(story.title)}"></div>
      <div class="field"><label>Mô tả</label><textarea name="description" rows="3">${esc(story.description)}</textarea></div>
      <div class="field"><label>Acceptance criteria <span class="hint">(mỗi dòng một AC)</span></label><textarea name="criteria" rows="5">${esc(story.acs.join('\n'))}</textarea></div>
      <div class="grid g3">
        <div class="field"><label>Priority</label><select name="priority">${options(['Highest', 'High', 'Medium', 'Low', 'Lowest'], story.priority)}</select></div>
        <div class="field"><label>Loại issue</label><select name="issuetype">${options(['Story', 'Task', 'Bug'], story.issue_type)}</select></div>
        <div class="field"><label>Xóa issue trên Jira</label><select name="deleted"><option value="">Không</option><option value="1">Xóa issue</option></select></div>
      </div></form>`,
    foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="mk-save">Lưu trên Jira và đồng bộ</button>',
  });
  m.el.querySelector('#mk-save').addEventListener('click', async (e) => {
    const f = m.el.querySelector('#mk-form').elements;
    const body = f.deleted.value ? { deleted: true } : {
      summary: f.summary.value.trim(), description: f.description.value.trim(),
      criteria: f.criteria.value.split('\n').map((s) => s.trim()).filter(Boolean), priority: f.priority.value, issuetype: f.issuetype.value,
    };
    try {
      await busy(e.currentTarget, async () => {
        await api(`/jira/mock/issues/${encodeURIComponent(story.code)}`, { method: 'PUT', body });
        const r = await api(`/projects/${story.project_id}/jira-sync`, { method: 'POST' });
        toast(syncSummary(r), 'success');
      }, 'Đang đồng bộ...');
      m.close();
      onDone();
    } catch (err) {
      toastError(err);
    }
  });
}

export async function renderStoryDetail(page, id) {
  const [story, tcs, params, jira, versions, regressions] = await Promise.all([
    api(`/stories/${id}`), api(`/testcases?story_id=${id}&include_archived=1`), api('/parameters'), api('/jira/info'),
    api(`/stories/${id}/versions`), can('ai:use') ? api(`/regressions?story_id=${id}`) : [],
  ]);
  const max = Number(params.find((p) => p.key === 'MAX_TC_PER_STORY')?.value);
  const minAc = Number(params.find((p) => p.key === 'MIN_AC_PER_STORY')?.value);
  const acs = story.acs;
  const active = !story.archived;
  const canGenerate = active && !story.check_reason && acs.length >= minAc;
  const changed = story.current_version >= 2;
  const flagged = tcs.filter((t) => t.needs_review);
  const draftLike = (t) => ['DRAFT', 'RETURNED'].includes(t.status);
  const draftRegression = regressions.find((r) => r.status === 'DRAFT');

  page.innerHTML = `
    <div class="page-head">
      <div><a href="#/stories" class="small">← Danh sách requirement</a><h1>${story.project_jira_key ? jiraLink(jira.site, story.code) : esc(story.code)} · ${esc(story.title)}</h1>
        <p>${esc(story.project_name)}${story.module_name ? ' / ' + esc(story.module_name) : ''} · ${pill(story.priority)} · ${esc(story.issue_type)}
          · phiên bản <b>v${story.current_version}</b> · ${pill(story.sync_state)}
          ${story.jira_status ? ` · Jira: <b>${esc(story.jira_status)}</b>` : ''}${story.synced_at ? ` · đồng bộ ${esc(fmtDate(story.synced_at))}` : ''}</p></div>
      <div class="row">
        ${jira.mode === 'mock' && story.project_jira_key && can('jira:import') ? '<button class="btn" id="mock-edit">✎ Mô phỏng sửa trên Jira</button>' : ''}
      </div>
    </div>
    ${story.archived ? '<div class="alert danger mb">🗄 Requirement đã lưu trữ: ẩn khỏi danh sách, giữ test, lịch sử phiên bản và kết quả chạy; không sinh thêm test. Xuất hiện lại trên Jira thì tự hiện lại (QĐ8).</div>' : ''}
    ${story.check_reason ? `<div class="alert warn mb row">⚠️ <span><b>Cần kiểm tra:</b> ${esc(LABEL[story.check_reason])}. ${story.check_kept_at ? `${esc(story.check_kept_by_name || '')} đã chọn <b>Giữ lại</b> lúc ${esc(fmtDate(story.check_kept_at))} – cờ còn tới khi đồng bộ lấy lại được issue (D2).` : 'Hệ thống không tự lưu trữ (QĐ8).'}
      Test của requirement này chưa được đưa vào Test Run.</span><span class="spacer"></span>
      ${can('jira:import') ? `${story.check_kept_at ? '' : '<button class="btn sm" data-decide="KEEP">Giữ lại</button>'}<button class="btn sm danger" data-decide="ARCHIVE">🗄 Lưu trữ</button>` : ''}</div>` : ''}
    ${active && acs.length < minAc ? `<div class="alert warn mb">Requirement ${acs.length ? `chưa đủ ${minAc} AC` : '<b>Thiếu AC</b>'}: AI chưa sinh test (QĐ2). PO/BA bổ sung mục <b>Acceptance criteria</b> trong Description trên Jira.</div>` : ''}
    ${flagged.length ? `<div class="alert warn mb">⚑ ${flagged.length} test cần xem lại vì requirement đã đổi. Test vẫn đúng thì chọn rồi bấm <b>Đã xem lại</b>; cần sửa thì sửa và gửi duyệt lại${changed && can('ai:use') ? ', hoặc bấm <b>Phân tích ảnh hưởng</b> để AI đề xuất' : ''}.</div>` : ''}
    <div class="grid g2">
      <div class="card"><h3>Mô tả</h3><p style="white-space:pre-wrap;margin:0">${esc(story.description) || '<span class="muted">—</span>'}</p></div>
      <div class="card"><h3>Acceptance criteria (${acs.length})</h3>${acs.length ? `<ol class="steps">${acs.map((a) => `<li>${esc(a)}</li>`).join('')}</ol>` : '<p class="muted">Chưa có AC</p>'}</div>
    </div>
    <div class="card mt">
      <div class="row"><h3 style="margin:0">Lịch sử phiên bản (${versions.length})</h3><span class="spacer"></span>
        ${versions.length > 1 ? `<select id="ver-pick" aria-label="Chọn phiên bản" style="width:220px">${versions.map((v) => `<option value="${v.version}">v${v.version} · ${esc(fmtDate(v.created_at))}</option>`).join('')}</select>` : ''}</div>
      <div id="ver-view" class="mt"></div>
    </div>
    <div class="row mt">
      ${can('ai:use') ? `<button class="btn ai" id="gen-btn" ${canGenerate ? '' : 'disabled'}>✨ Sinh test case bằng AI</button>
        <button class="btn ai" id="analyze-btn" ${changed && active ? '' : 'disabled title="Cần ít nhất 2 phiên bản (QĐ15)"'}>🔍 Phân tích ảnh hưởng (AI)</button>
        ${draftRegression ? `<a class="btn" href="#/regressions/${draftRegression.id}">🧭 Mở bộ regression đang lập</a>` : `<button class="btn" id="reg-btn" ${changed && active ? '' : 'disabled'}>🧭 Tạo bộ regression</button>`}` : ''}
    </div>
    <div id="ai-banner" class="mt"></div>
    <div id="proposal-box"></div>
    <div class="card mt">
      <div class="row mb">
        <h2 style="margin:0">Test case (${tcs.length}/${max})</h2>
        <span class="muted small">QĐ2: tối đa ${max} test cho mỗi requirement</span>
        <span class="spacer"></span>
        ${can('testcase:write') ? `<button class="btn" id="recheck-sel" disabled>✔ Đã xem lại mục đã chọn</button><button class="btn" id="submit-sel" disabled>📤 Gửi duyệt mục đã chọn</button>
          ${active ? '<button class="btn" id="add-tc">＋ Thêm thủ công</button>' : ''}` : ''}
      </div>
      <div class="table-wrap"><table>
        <thead><tr>${can('testcase:write') ? '<th><input type="checkbox" id="sel-all" aria-label="Chọn tất cả"></th>' : ''}<th>Mã</th><th>Tiêu đề</th><th>AC</th><th>Loại</th><th>Nguồn</th><th>Trạng thái</th><th>Liên kết</th><th>KQ gần nhất</th></tr></thead>
        <tbody>${tcs.map((t) => `
          <tr class="clickable" data-id="${t.id}">
            ${can('testcase:write') ? `<td data-nocl>${draftLike(t) || t.needs_review ? `<input type="checkbox" class="sel" value="${t.id}" data-draft="${draftLike(t) ? 1 : ''}" data-flag="${t.needs_review ? 1 : ''}" aria-label="Chọn ${esc(t.code)}">` : ''}</td>` : ''}
            <td class="mono">${esc(t.code)}</td><td>${esc(t.title)}</td>
            <td class="small">${t.acs.map((a) => `AC${acs.indexOf(a) + 1 || '?'}`).join(', ') || '<span class="pill RETURNED">chưa gán</span>'}</td>
            <td>${esc(t.type)}</td><td>${pill(t.source)}</td><td>${pill(t.status)}${flags(t)}</td>
            <td class="small">v${t.req_version}</td><td>${t.last_result ? pill(t.last_result) : '<span class="small muted">Chưa chạy</span>'}</td>
          </tr>`).join('') || `<tr><td colspan="9" class="empty">Chưa có test case. ${can('ai:use') && canGenerate ? 'Bấm <b>✨ Sinh test case bằng AI</b> để bắt đầu.' : ''}</td></tr>`}
        </tbody>
      </table></div>
    </div>
    ${regressions.length ? `<div class="card mt"><h3>Bộ regression (YC17)</h3><div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Thay đổi</th><th>Số test</th><th>Trạng thái</th><th>Test Run</th></tr></thead>
      <tbody>${regressions.map((r) => `<tr class="clickable" data-reg="${r.id}"><td>#${r.id}</td><td>v${r.from_version} → v${r.to_version}</td><td>${r.tc_count}</td><td>${pill(r.status)}</td>
        <td>${r.run_id ? `<a href="#/runs/${r.run_id}">Đợt #${r.run_id}</a>` : '—'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;

  const reload = () => renderStoryDetail(page, id);

  // Lịch sử phiên bản: so phiên bản chọn với phiên bản liền trước
  const verView = page.querySelector('#ver-view');
  const showVersion = (v) => {
    const i = versions.findIndex((x) => x.version === v);
    verView.innerHTML = versionCompare(versions[i + 1], versions[i]);
  };
  showVersion(story.current_version);
  page.querySelector('#ver-pick')?.addEventListener('change', (e) => showVersion(Number(e.target.value)));

  if (can('ai:use')) proposalCards(page.querySelector('#proposal-box'), { story_id: id, status: 'PENDING' }, reload, { title: 'Đề xuất AI chờ xử lý (YC16)', hideEmpty: true });

  bind(page, 'tr[data-id]', 'click', (e, tr) => !e.target.closest('[data-nocl]') && openTestCase(Number(tr.dataset.id), reload));
  bind(page, 'tr[data-reg]', 'click', (e, tr) => !e.target.closest('a') && (location.hash = `#/regressions/${tr.dataset.reg}`));

  const submitBtn = page.querySelector('#submit-sel');
  const recheckBtn = page.querySelector('#recheck-sel');
  const selected = () => [...page.querySelectorAll('.sel:checked')];
  const syncSel = () => {
    if (submitBtn) submitBtn.disabled = !selected().some((c) => c.dataset.draft);
    if (recheckBtn) recheckBtn.disabled = !selected().some((c) => c.dataset.flag);
  };
  bind(page, '.sel', 'change', syncSel);
  page.querySelector('#sel-all')?.addEventListener('change', (e) => {
    page.querySelectorAll('.sel').forEach((c) => (c.checked = e.target.checked));
    syncSel();
  });
  submitBtn?.addEventListener('click', async () => {
    const ids = selected().filter((c) => c.dataset.draft).map((c) => Number(c.value));
    try {
      const r = await api('/testcases/submit', { method: 'POST', body: { ids } });
      toast(`Đã gửi duyệt ${r.submitted.length} test case`, 'success');
      updateReviewBadge();
      reload();
    } catch (e) {
      toastError(e);
    }
  });
  recheckBtn?.addEventListener('click', () => {
    const ids = selected().filter((c) => c.dataset.flag).map((c) => Number(c.value));
    openRecheck(tcs.filter((t) => ids.includes(t.id)), reload, { acs });
  });

  page.querySelectorAll('[data-decide]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const s = await busy(b, () => api(`/stories/${id}/check-decision`, { method: 'POST', body: { decision: b.dataset.decide } }));
      toast(s.archived ? 'Đã lưu trữ requirement' : 'Đã ghi nhận Giữ lại – cờ Cần kiểm tra vẫn còn', 'success');
      reload();
    } catch (e) {
      toastError(e);
    }
  }));

  page.querySelector('#mock-edit')?.addEventListener('click', () => openMockEdit(story, reload));

  page.querySelector('#gen-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const banner = page.querySelector('#ai-banner');
    banner.innerHTML = `<div class="alert ai"><span class="spinner dark"></span> AI đang phân tích ${acs.length} AC và sinh test case...</div>`;
    try {
      const r = await busy(btn, () => api(`/stories/${id}/generate`, { method: 'POST' }), 'AI đang sinh...');
      await reload();
      const pii = Object.entries(r.piiFound || {}).map(([k, v]) => `${v} ${k}`).join(', ');
      page.querySelector('#ai-banner').innerHTML = `
        <div class="alert ai">✨ AI đã sinh <b>${r.testCases.length}</b> test case trong ${(r.durationMs / 1000).toFixed(1)} giây, trạng thái <b>Nháp</b>, mỗi test đã gắn AC liên quan. Bản nháp cũ được giữ nguyên (QĐ2).
        ${r.truncated ? `<br>Đã bỏ ${r.truncated} test vượt giới hạn ${max} test.` : ''}
        ${pii ? `<br>🔒 Đã che dữ liệu nhạy cảm trước khi gửi cho AI: <b>${esc(pii)}</b>.` : ''}
        ${r.injectionWarning ? '<br>⚠️ Phát hiện nội dung giống <b>prompt injection</b> – AI đã được chỉ dẫn bỏ qua, kết quả vẫn qua kiểm tra schema.' : ''}
        <br><a href="#/ai-logs">Xem nhật ký AI #${r.aiLogId} →</a></div>`;
    } catch (err) {
      page.querySelector('#ai-banner').innerHTML = `<div class="alert danger">${esc(err.message)}</div>`;
    }
  });

  page.querySelector('#analyze-btn')?.addEventListener('click', async (e) => {
    const banner = page.querySelector('#ai-banner');
    banner.innerHTML = '<div class="alert ai"><span class="spinner dark"></span> AI đang so các phiên bản requirement với các test đã liên kết...</div>';
    try {
      const r = await busy(e.currentTarget, () => api(`/stories/${id}/analyze`, { method: 'POST' }), 'AI đang phân tích...');
      await reload();
      const a = r.analysis;
      page.querySelector('#ai-banner').innerHTML = `<div class="alert ai">🔍 AI đã so <b>v${a.from_version} → v${a.to_version}</b> và đưa ra <b>${a.proposals.length}</b> đề xuất.
        Phân tích không tự đổi test: QA Lead chấp nhận hoặc từ chối từng đề xuất bên dưới (QĐ15, QĐ16).</div>`;
    } catch (err) {
      page.querySelector('#ai-banner').innerHTML = `<div class="alert danger">${esc(err.message)}</div>`;
    }
  });

  page.querySelector('#reg-btn')?.addEventListener('click', async (e) => {
    try {
      const r = await busy(e.currentTarget, () => api('/regressions', { method: 'POST', body: { story_id: Number(id) } }), 'AI đang lập bộ...');
      location.hash = `#/regressions/${r.id}`;
    } catch (err) {
      toastError(err);
    }
  });

  page.querySelector('#add-tc')?.addEventListener('click', () => {
    const m = modal({
      title: `Thêm test case thủ công cho ${story.code}`,
      wide: true,
      body: testCaseForm({ priority: 'Medium', type: 'Positive', steps: [''] }, { acs }),
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
}
