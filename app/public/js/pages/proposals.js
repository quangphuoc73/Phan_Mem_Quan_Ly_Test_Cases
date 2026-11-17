// YC16 – BM14, BM15, QĐ16: rà soát và áp dụng đề xuất AI. Tester và QA Lead xem; chỉ QA Lead chấp nhận hoặc từ chối.
import { state, api, esc, can, pill, fmtDate, toast, toastError, modal, bind, busy, LABEL } from '../core.js';
import { updateReviewBadge } from '../main.js';

const TC_FIELDS = [['title', 'Tiêu đề'], ['precondition', 'Điều kiện tiên quyết'], ['steps', 'Các bước'], ['expected_result', 'Kết quả mong đợi'], ['priority', 'Ưu tiên'], ['type', 'Loại']];
const val = (v) => (Array.isArray(v) ? v.map((s, i) => `${i + 1}. ${s}`).join('\n') : v ?? '');

// BM15: nội dung trước (test hiện tại) và sau (đề xuất)
function compare(p) {
  if (!p.content) return '';
  const rows = TC_FIELDS.map(([k, l]) => {
    const before = p.before ? val(p.before[k]) : '';
    const after = val(p.content[k]);
    const same = p.before && before === after;
    return `<tr><td>${l}</td>${p.before ? `<td class="${same ? '' : 'diff-old'}" style="white-space:pre-wrap">${esc(before)}</td>` : ''}
      <td class="${same ? '' : 'diff-new'}" style="white-space:pre-wrap">${esc(after)}</td></tr>`;
  }).join('');
  return `<div class="table-wrap mt"><table><thead><tr><th>Trường</th>${p.before ? '<th>Trước (test hiện tại)</th>' : ''}<th>Sau (đề xuất)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function card(p) {
  const source = p.source_part === 'AC' ? `AC: <i>${esc(p.source_ac)}</i>` : esc(LABEL[p.source_part]);
  return `<div class="card mt" data-proposal="${p.id}">
    <div class="row">
      ${pill(p.type)} <b>#${p.id}</b>
      ${p.tc_code ? `<span class="mono">${esc(p.tc_code)}</span> – ${esc(p.tc_title || '')}` : '<span class="muted">(test mới)</span>'}
      <span class="small muted">· ${esc(p.story_code)} · phân tích ở v${p.req_version}</span>
      <span class="spacer"></span>${pill(p.status)}
    </div>
    <p class="mt" style="margin-bottom:4px"><b>Lý do:</b> ${esc(p.reason)}</p>
    <p class="small muted" style="margin:0">Phần thay đổi nguồn: ${source}</p>
    ${compare(p)}
    ${p.status !== 'PENDING' ? `<p class="small muted mt">${esc(p.decided_by_name || '')} · ${esc(fmtDate(p.decided_at))}${p.note ? ` · Ghi chú: ${esc(p.note)}` : ''}
      ${p.result_tc_code ? ` · Kết quả: <span class="mono">${esc(p.result_tc_code)}</span> (bản nháp phải qua duyệt YC4)` : ''}</p>` : ''}
    ${p.status === 'PENDING' && can('proposal:review') ? `<div class="row mt">
      <button class="btn success sm" data-accept="${p.id}">✓ Chấp nhận</button>
      <button class="btn danger sm" data-reject="${p.id}">✕ Từ chối</button>
      <span class="small muted">${{ UPDATE: 'Chấp nhận: test về Nháp theo nội dung đề xuất, phải duyệt lại.', MISSING: 'Chấp nhận: tạo test nháp mới nguồn AI.', RERUN: 'Chấp nhận: thêm test vào bộ regression của thay đổi này.', CLARIFY: 'Chấp nhận: ghi nhận để trao đổi với PO/BA trên Jira.' }[p.type]}</span>
    </div>` : ''}
  </div>`;
}

// Danh sách thẻ đề xuất dùng chung cho màn hình Đề xuất AI và chi tiết requirement
export async function proposalCards(box, filter, onChange, { title = '', hideEmpty = false } = {}) {
  const list = await api(`/proposals?${new URLSearchParams(Object.entries(filter).filter(([, v]) => v))}`);
  if (!list.length && hideEmpty) return (box.innerHTML = '');
  box.innerHTML = `${title ? `<h2 class="mt">${esc(title)} (${list.length})</h2>` : ''}${list.map(card).join('') || '<div class="empty card mt">Không có đề xuất nào</div>'}`;
  bind(box, '[data-accept]', 'click', async (_e, b) => {
    try {
      await busy(b, () => api(`/proposals/${b.dataset.accept}/decision`, { method: 'POST', body: { decision: 'ACCEPT' } }));
      toast('Đã chấp nhận đề xuất', 'success');
      updateReviewBadge();
    } catch (err) {
      toastError(err); // VD Lỗi thời: requirement hoặc test đã đổi sau khi phân tích
    }
    onChange();
  });
  bind(box, '[data-reject]', 'click', (_e, b) => {
    const m = modal({
      title: `Từ chối đề xuất #${b.dataset.reject}`,
      body: '<form id="rj-form"><div class="field"><label>Ghi chú (bắt buộc, QĐ16)</label><textarea name="note" rows="3" required minlength="2"></textarea></div></form>',
      foot: '<button class="btn" data-close>Hủy</button><button class="btn danger solid" id="rj-save">Từ chối</button>',
    });
    m.el.querySelector('#rj-save').addEventListener('click', async (e) => {
      const f = m.el.querySelector('#rj-form');
      if (!f.reportValidity()) return;
      try {
        await busy(e.currentTarget, () => api(`/proposals/${b.dataset.reject}/decision`, { method: 'POST', body: { decision: 'REJECT', note: f.note.value } }));
        m.close();
        toast('Đã từ chối đề xuất', 'success');
        onChange();
      } catch (err) {
        toastError(err);
      }
    });
  });
}

export async function renderProposals(page) {
  let status = 'PENDING';
  page.innerHTML = `
    <div class="page-head"><div><h1>Đề xuất AI</h1>
      <p>Kết quả phân tích ảnh hưởng (YC15) khi requirement đổi trên Jira. 4 loại: Cần sửa, Còn thiếu, Nên chạy lại, Cần làm rõ.
      Requirement hoặc test đã đổi sau lúc phân tích thì đề xuất chuyển <b>Lỗi thời</b> (QĐ16).</p></div></div>
    ${can('proposal:review') ? '' : '<div class="alert info">Bạn xem được đề xuất; chỉ QA Lead được chấp nhận hoặc từ chối.</div>'}
    <div class="tabs">${['PENDING', 'ACCEPTED', 'REJECTED', 'OUTDATED', ''].map((s) => `<button data-st="${s}" class="${s === status ? 'active' : ''}">${s ? esc(LABEL[s]) : 'Tất cả'}</button>`).join('')}</div>
    <div id="pp-box"></div>`;
  const box = page.querySelector('#pp-box');
  const load = () => proposalCards(box, { status, project_id: state.projectId || '' }, () => load().catch(toastError));
  bind(page, '[data-st]', 'click', (_e, b) => {
    status = b.dataset.st;
    page.querySelectorAll('[data-st]').forEach((x) => x.classList.toggle('active', x === b));
    load().catch(toastError);
  });
  await load();
}
