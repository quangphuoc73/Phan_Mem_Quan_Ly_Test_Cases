// YC17 – BM16, QĐ17: AI đề xuất bộ regression; QA Lead thêm, bớt (bỏ test bắt buộc phải ghi lý do) và xác nhận → Test Run Regression
import { api, esc, can, pill, toast, toastError, modal, bind, busy, options } from '../core.js';
import { openTestCase } from './testcases.js';

// Người được giao trong Test Run: QA Lead hoặc Tester là thành viên dự án (QĐ14)
export async function assignees(projectId) {
  const members = await api(`/projects/${projectId}/members`);
  return members.filter((u) => ['QA_LEAD', 'TESTER'].includes(u.role)).map((u) => ({ id: u.id, name: `${u.full_name} (${u.username})` }));
}

export async function renderRegression(page, id) {
  const set = await api(`/regressions/${id}`);
  const draft = set.status === 'DRAFT';
  const edit = draft && can('proposal:review');
  const items = set.items;
  const kept = items.filter((i) => !i.removed);

  page.innerHTML = `
    <div class="page-head">
      <div><a href="#/stories/${set.story_id}" class="small">← ${esc(set.story_code)}</a>
        <h1>Bộ regression #${set.id} · ${esc(set.story_code)} v${set.from_version} → v${set.to_version}</h1>
        <p>${pill(set.status)} · ${kept.length} test sẽ chạy · lập bởi ${esc(set.created_by_name || '')}
          ${set.run_id ? ` · <a href="#/runs/${set.run_id}">Test Run #${set.run_id}</a>` : ''}</p></div>
      ${edit ? '<button class="btn" id="add-test">＋ Thêm test</button>' : ''}
    </div>
    <div class="alert info">Bộ luôn gồm test liên kết với AC đã đổi; tiêu đề hoặc mô tả đổi thì gồm mọi test của requirement (QĐ17 [R3]).
      AI chỉ xếp ưu tiên và gợi ý thêm. Bỏ test bắt buộc phải ghi lý do.</div>
    ${set.blocked.length ? `<div class="alert warn"><b>${set.blocked.length} test chưa đủ điều kiện chạy</b> – xử lý (duyệt, xem lại) hoặc bỏ khỏi bộ trước khi xác nhận:
      <ul class="warn-list">${set.blocked.map((b) => `<li><span class="mono">${esc(b.code)}</span> – ${esc(b.blocked_reason)}</li>`).join('')}</ul></div>` : ''}
    <div class="table-wrap"><table>
      <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Ưu tiên</th><th>Lý do</th><th>Nguồn</th><th>Điều kiện chạy</th>${edit ? '<th></th>' : ''}</tr></thead>
      <tbody>${items.map((i) => `<tr class="${i.removed ? 'muted' : ''}" data-tc="${i.test_case_id}">
        <td class="mono clickable" data-open>${esc(i.code)}</td><td>${esc(i.title)}${i.mandatory ? ' <span class="pill LINKED">bắt buộc</span>' : ''}</td>
        <td>${pill(i.priority)}</td><td class="small">${esc(i.reason || '')}${i.removed ? `<div><b>Đã bỏ:</b> ${esc(i.remove_reason || '')}</div>` : ''}</td>
        <td>${pill(i.origin)}</td><td>${i.blocked_reason ? `<span class="pill NEEDS_CHECK">${esc(i.blocked_reason)}</span>` : '<span class="pill NORMAL">Đủ điều kiện</span>'}</td>
        ${edit ? `<td>${i.removed ? `<button class="btn sm" data-restore="${i.test_case_id}">Đưa lại</button>` : `<button class="btn sm danger" data-remove="${i.test_case_id}" data-mand="${i.mandatory ? 1 : ''}">Bỏ</button>`}</td>` : ''}
      </tr>`).join('') || `<tr><td colspan="7" class="empty">Không có test</td></tr>`}</tbody>
    </table></div>
    ${edit ? `<div class="card mt"><h3>Xác nhận bộ regression → tạo Test Run loại Regression (YC14)</h3>
      <form id="cf-form" class="grid g4">
        <div class="field"><label>Tên đợt</label><input name="name" value="Regression ${esc(set.story_code)} v${set.from_version}→v${set.to_version}"></div>
        <div class="field"><label>Build *</label><input name="build" required maxlength="50" placeholder="VD: 2.1.0"></div>
        <div class="field"><label>Môi trường *</label><input name="environment" required maxlength="100" placeholder="VD: Staging"></div>
        <div class="field"><label>Người được giao</label><select name="assignee_id" id="cf-assignee"><option value="">Chưa giao</option></select></div>
      </form>
      <button class="btn primary" id="confirm" ${set.blocked.length || !kept.length ? 'disabled' : ''}>✓ Xác nhận và tạo Test Run</button></div>` : ''}`;

  const reload = () => renderRegression(page, id);
  bind(page, '[data-open]', 'click', (_e, td) => openTestCase(Number(td.closest('tr').dataset.tc), reload));
  const update = async (body, b) => {
    try {
      await busy(b, () => api(`/regressions/${id}/items`, { method: 'PUT', body }));
      reload();
    } catch (err) {
      toastError(err);
    }
  };
  bind(page, '[data-restore]', 'click', (_e, b) => update({ restore: [Number(b.dataset.restore)] }, b));
  bind(page, '[data-remove]', 'click', (_e, b) => {
    const m = modal({
      title: 'Bỏ test khỏi bộ regression',
      body: `<form id="rm-form"><div class="field"><label>Lý do ${b.dataset.mand ? '* (test liên kết với phần đã đổi, QĐ17)' : '(không bắt buộc)'}</label>
        <textarea name="reason" rows="3" ${b.dataset.mand ? 'required minlength="3"' : ''}></textarea></div></form>`,
      foot: '<button class="btn" data-close>Hủy</button><button class="btn danger solid" id="rm-ok">Bỏ khỏi bộ</button>',
    });
    m.el.querySelector('#rm-ok').addEventListener('click', async () => {
      const f = m.el.querySelector('#rm-form');
      if (!f.reportValidity()) return;
      m.close();
      await update({ remove: [{ test_case_id: Number(b.dataset.remove), reason: f.reason.value.trim() }] }, b);
    });
  });

  if (edit) {
    const sel = page.querySelector('#cf-assignee');
    sel.innerHTML += options(await assignees(set.project_id), '');
    page.querySelector('#add-test').addEventListener('click', async () => {
      const all = await api(`/testcases?project_id=${set.project_id}&status=APPROVED`);
      const inSet = new Set(items.map((i) => i.test_case_id));
      const m = modal({
        title: 'Thêm test vào bộ regression',
        body: `<div class="field"><label>Test case đã duyệt của dự án</label><select id="add-sel">${options(all.filter((t) => !inSet.has(t.id)).map((t) => ({ id: t.id, name: `${t.code} – ${t.title}` })), '')}</select></div>`,
        foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="add-ok">Thêm</button>',
      });
      m.el.querySelector('#add-ok').addEventListener('click', async (e) => {
        const v = Number(m.el.querySelector('#add-sel').value);
        if (!v) return;
        m.close();
        await update({ add: [v] }, e.currentTarget);
      });
    });
    page.querySelector('#confirm').addEventListener('click', async (e) => {
      const f = page.querySelector('#cf-form');
      if (!f.reportValidity()) return;
      const d = Object.fromEntries(new FormData(f));
      d.assignee_id = d.assignee_id ? Number(d.assignee_id) : null;
      try {
        const r = await busy(e.currentTarget, () => api(`/regressions/${id}/confirm`, { method: 'POST', body: d }));
        toast(`Đã tạo Test Run Regression #${r.run.id} với ${r.run.items.length} test`, 'success');
        location.hash = `#/runs/${r.run.id}`;
      } catch (err) {
        toastError(err);
      }
    });
  }
}
