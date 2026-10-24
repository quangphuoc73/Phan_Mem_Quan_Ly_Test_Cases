// YC4: Duyệt test case – hàng đợi của QA Lead (QĐ4: chỉ QA Lead được duyệt).
import { state, api, esc, pill, fmtDate, toast, toastError, bind } from '../core.js';
import { openTestCase } from './testcases.js';
import { updateReviewBadge } from '../main.js';

export async function renderReview(page) {
  const q = new URLSearchParams({ status: 'PENDING_REVIEW' });
  if (state.projectId) q.set('project_id', state.projectId);
  if (state.sprintId) q.set('sprint_id', state.sprintId);
  const list = await api(`/testcases?${q}`);

  page.innerHTML = `
    <div class="page-head">
      <div><h1>Duyệt test case</h1><p>${list.length} test case đang chờ duyệt. Bấm vào dòng để xem chi tiết, duyệt hoặc trả lại kèm ghi chú.</p></div>
      ${list.length ? '<button class="btn success" id="approve-all">✓ Duyệt tất cả mục đã chọn</button>' : ''}
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th><input type="checkbox" id="rv-all" aria-label="Chọn tất cả"></th><th>Mã</th><th>Tiêu đề</th><th>User story</th><th>Loại</th><th>Ưu tiên</th><th>Nguồn</th><th>Gửi lúc</th></tr></thead>
      <tbody>${list.map((t) => `
        <tr class="clickable" data-id="${t.id}"><td data-nocl><input type="checkbox" class="rv-sel" value="${t.id}" aria-label="Chọn ${esc(t.code)}"></td>
        <td class="mono">${esc(t.code)}</td><td>${esc(t.title)}<div class="small muted">${esc(t.steps.length)} bước · ${esc(t.expected_result.slice(0, 90))}</div></td>
        <td>${esc(t.story_code)}</td><td>${esc(t.type)}</td><td>${pill(t.priority)}</td><td>${pill(t.source)}</td><td class="small">${fmtDate(t.updated_at)}</td></tr>`).join('')
        || '<tr><td colspan="8" class="empty">🎉 Không có test case nào chờ duyệt</td></tr>'}
      </tbody>
    </table></div>`;

  const reload = () => renderReview(page);
  bind(page, 'tr[data-id]', 'click', (e, tr) => !e.target.closest('[data-nocl]') && openTestCase(Number(tr.dataset.id), reload));
  page.querySelector('#rv-all')?.addEventListener('change', (e) => page.querySelectorAll('.rv-sel').forEach((c) => (c.checked = e.target.checked)));
  page.querySelector('#approve-all')?.addEventListener('click', async () => {
    const ids = [...page.querySelectorAll('.rv-sel:checked')].map((c) => Number(c.value));
    if (!ids.length) return toast('Chưa chọn test case nào', 'error');
    try {
      for (const id of ids) await api(`/testcases/${id}/review`, { method: 'POST', body: { decision: 'APPROVED', note: 'Duyệt hàng loạt' } });
      toast(`Đã duyệt ${ids.length} test case`, 'success');
      updateReviewBadge();
      reload();
    } catch (e) {
      toastError(e);
    }
  });
}
