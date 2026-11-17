// YC13 – BM12, QĐ13: Test Suite dạng phẳng. Tên 3–100 ký tự, không trùng trong dự án; test phải cùng dự án;
// một test thuộc được nhiều suite; xóa suite không xóa test.
import { state, api, esc, can, pill, fmtDate, toast, toastError, modal, confirmBox, bind, busy, options } from '../core.js';
import { openTestCase } from './testcases.js';

function suiteForm(s = {}, projects = []) {
  return `<form id="st-form">
    ${s.id ? '' : `<div class="field"><label>Dự án *</label><select name="project_id" required>${options(projects.map((p) => ({ id: p.id, name: `${p.code} – ${p.name}` })), state.projectId || '')}</select></div>`}
    <div class="field"><label>Tên suite * <span class="hint">(3–100 ký tự, không trùng trong dự án)</span></label><input name="name" required minlength="3" maxlength="100" value="${esc(s.name || '')}"></div>
    <div class="field"><label>Mô tả</label><textarea name="description" rows="2" maxlength="1000">${esc(s.description || '')}</textarea></div>
  </form>`;
}

async function openSuite(id, onChange) {
  const m = modal({ title: 'Test Suite', wide: true, body: '<div class="empty"><span class="spinner dark"></span></div>' });
  const draw = async () => {
    const s = await api(`/suites/${id}`);
    const all = can('testcase:write') ? await api(`/testcases?project_id=${s.project_id}`) : [];
    const inSuite = new Set(s.items.map((i) => i.id));
    m.el.querySelector('.modal-head h2').textContent = `Suite: ${s.name}`;
    m.el.querySelector('.modal-body').innerHTML = `
      <p class="muted">${esc(s.description || '')} · tạo bởi ${esc(s.created_by_name || '')} · ${esc(fmtDate(s.created_at))}</p>
      ${can('testcase:write') ? `<div class="row mb"><select id="st-add" style="flex:1" aria-label="Chọn test để thêm">${options(all.filter((t) => !inSuite.has(t.id)).map((t) => ({ id: t.id, name: `${t.code} – ${t.title}` })), '', { empty: 'Chọn test case cùng dự án để thêm...' })}</select>
        <button class="btn primary" id="st-add-btn">＋ Thêm vào suite</button></div>` : ''}
      <div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tiêu đề</th><th>Requirement</th><th>Trạng thái</th>${can('testcase:write') ? '<th></th>' : ''}</tr></thead>
        <tbody>${s.items.map((t) => `<tr><td class="mono clickable" data-open="${t.id}">${esc(t.code)}</td><td>${esc(t.title)}</td><td>${esc(t.story_code)}</td>
          <td>${pill(t.status)}${t.needs_review ? ' <span class="pill flag">⚑ Cần xem lại</span>' : ''}</td>
          ${can('testcase:write') ? `<td><button class="btn sm" data-rm="${t.id}">Bỏ khỏi suite</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="5" class="empty">Suite chưa có test</td></tr>'}</tbody></table></div>`;
    const setItems = async (body, b) => {
      try {
        await busy(b, () => api(`/suites/${id}/items`, { method: 'PUT', body }));
        onChange();
        await draw();
      } catch (err) {
        toastError(err);
      }
    };
    m.el.querySelector('#st-add-btn')?.addEventListener('click', (e) => {
      const v = Number(m.el.querySelector('#st-add').value);
      if (v) setItems({ add: [v] }, e.currentTarget);
    });
    bind(m.el, '[data-rm]', 'click', (_e, b) => setItems({ remove: [Number(b.dataset.rm)] }, b));
    bind(m.el, '[data-open]', 'click', (_e, td) => openTestCase(Number(td.dataset.open), () => draw().catch(toastError)));
  };
  await draw().catch((e) => (m.el.querySelector('.modal-body').innerHTML = `<div class="alert danger">${esc(e.message)}</div>`));
}

export async function renderSuites(page) {
  const list = await api(`/suites${state.projectId ? `?project_id=${state.projectId}` : ''}`);
  page.innerHTML = `
    <div class="page-head"><div><h1>Test Suite</h1><p>Nhóm test case dạng phẳng (YC13) để lập Test Run nhanh. Một test thuộc được nhiều suite; xóa suite không xóa test.</p></div>
      ${can('testcase:write') ? '<button class="btn primary" id="new-suite">＋ Tạo suite</button>' : ''}</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Tên suite</th><th>Dự án</th><th>Mô tả</th><th>Số test</th><th>Người tạo</th>${can('testcase:write') ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.map((s) => `<tr class="clickable" data-id="${s.id}"><td><b>${esc(s.name)}</b></td><td>${esc(s.project_name)}</td>
        <td class="small">${esc(s.description || '')}</td><td>${s.tc_count}</td><td class="small">${esc(s.created_by_name || '')}</td>
        ${can('testcase:write') ? `<td data-nocl><button class="btn sm" data-edit="${s.id}">Sửa</button> <button class="btn sm danger" data-del="${s.id}">Xóa</button></td>` : ''}</tr>`).join('')
        || '<tr><td colspan="6" class="empty">Chưa có Test Suite</td></tr>'}</tbody>
    </table></div>`;
  const reload = () => renderSuites(page);
  bind(page, 'tr[data-id]', 'click', (e, tr) => !e.target.closest('[data-nocl]') && openSuite(Number(tr.dataset.id), reload));
  const save = (s) => {
    const m = modal({
      title: s ? `Sửa suite ${s.name}` : 'Tạo Test Suite',
      body: suiteForm(s || {}, state.projects),
      foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="st-save">Lưu</button>',
    });
    m.el.querySelector('#st-save').addEventListener('click', async (e) => {
      const f = m.el.querySelector('#st-form');
      if (!f.reportValidity()) return;
      const body = Object.fromEntries(new FormData(f));
      try {
        await busy(e.currentTarget, () => api(s ? `/suites/${s.id}` : '/suites', { method: s ? 'PUT' : 'POST', body }));
        m.close();
        toast(s ? 'Đã lưu suite' : 'Đã tạo suite', 'success');
        reload();
      } catch (err) {
        toastError(err);
      }
    });
  };
  page.querySelector('#new-suite')?.addEventListener('click', () => save(null));
  bind(page, '[data-edit]', 'click', (_e, b) => save(list.find((s) => s.id === Number(b.dataset.edit))));
  bind(page, '[data-del]', 'click', async (_e, b) => {
    const s = list.find((x) => x.id === Number(b.dataset.del));
    if (!(await confirmBox(`Xóa suite "${s.name}"? Các test case vẫn được giữ nguyên.`, { okText: 'Xóa', danger: true }))) return;
    try {
      await api(`/suites/${s.id}`, { method: 'DELETE' });
      toast('Đã xóa suite', 'success');
      reload();
    } catch (err) {
      toastError(err);
    }
  });
}
