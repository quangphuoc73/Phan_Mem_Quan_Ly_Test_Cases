// YC12: Sprint (Agile/Scrum) – bảng sprint (Kanban), burndown, velocity, product backlog.
import { state, api, esc, can, pill, toast, toastError, modal, bind, busy, formData, safeSet } from '../core.js';
import { refreshProjects, currentProject, activeSprint, renderSprintSwitch } from '../main.js';

const STAGES = [
  ['TODO', 'Cần viết test case', '#94a3b8'],
  ['IN_REVIEW', 'Đang soạn / chờ duyệt', '#f59e0b'],
  ['TESTING', 'Đang kiểm thử', '#2563eb'],
  ['DONE', 'Hoàn thành (DoD)', '#16a34a'],
];
const charts = [];
const fmt = (d) => d.split('-').reverse().slice(0, 2).join('/');

function sprintForm(sp = {}) {
  return `<form id="sp-form">
    <div class="field"><label>Tên sprint *</label><input name="name" required value="${esc(sp.name || '')}" placeholder="Sprint 3"></div>
    <div class="field"><label>Mục tiêu sprint (Sprint Goal)</label><input name="goal" value="${esc(sp.goal || '')}" placeholder="Khách hàng ... được ..."></div>
    <div class="grid g2">
      <div class="field"><label>Ngày bắt đầu *</label><input type="date" name="start_date" required value="${esc(sp.start_date || '')}"></div>
      <div class="field"><label>Ngày kết thúc *</label><input type="date" name="end_date" required value="${esc(sp.end_date || '')}"></div>
    </div>
    <p class="hint">QĐ12: sprint dài tối đa theo tham số SPRINT_MAX_DAYS và không trùng thời gian với sprint khác của dự án.</p>
  </form>`;
}

function openSprintForm(project, sp, onSaved) {
  const m = modal({
    title: sp ? `Sửa ${sp.name}` : `Tạo sprint mới – ${project.name}`,
    body: sprintForm(sp),
    foot: '<button class="btn" data-close>Hủy</button><button class="btn primary" id="sp-save">Lưu</button>',
  });
  m.el.querySelector('#sp-save').addEventListener('click', async (e) => {
    const f = m.el.querySelector('#sp-form');
    if (!f.reportValidity()) return;
    try {
      const saved = await busy(e.currentTarget, () =>
        sp ? api(`/sprints/${sp.id}`, { method: 'PUT', body: formData(f) }) : api(`/projects/${project.id}/sprints`, { method: 'POST', body: formData(f) }));
      m.close();
      toast(`Đã lưu ${saved.name}`, 'success');
      onSaved(saved);
    } catch (err) {
      toastError(err);
    }
  });
}

export async function renderSprints(page) {
  await refreshProjects();
  renderSprintSwitch();
  const project = currentProject();
  if (!project) {
    page.innerHTML = `<div class="page-head"><div><h1>Sprint (Agile)</h1><p>Chọn một dự án ở thanh trên cùng để xem các sprint.</p></div></div>
      <div class="grid g2">${state.projects.map((p) => `<div class="card"><h3>${esc(p.code)} – ${esc(p.name)}</h3>
        <p class="muted">${p.sprints.length} sprint${activeSprint(p) ? ` · đang chạy: <b>${esc(activeSprint(p).name)}</b>` : ''}</p>
        <button class="btn primary sm" data-pick="${p.id}">Xem sprint</button></div>`).join('')}</div>`;
    bind(page, '[data-pick]', 'click', (_e, b) => {
      state.projectId = Number(b.dataset.pick);
      safeSet('projectId', state.projectId);
      document.getElementById('project-switch').value = state.projectId;
      renderSprints(page);
    });
    return;
  }

  const sprint = project.sprints.find((s) => s.id === state.sprintId) || activeSprint(project) || project.sprints[project.sprints.length - 1];
  const [bd, backlog] = await Promise.all([
    sprint ? api(`/sprints/${sprint.id}/burndown`) : null,
    api(`/stories?project_id=${project.id}&backlog=1`),
  ]);
  const today = new Date().toLocaleDateString('sv-SE');
  const status = (s) => (today < s.start_date ? 'Sắp tới' : today > s.end_date ? 'Đã kết thúc' : 'Đang chạy');
  const daysLeft = sprint ? Math.max(0, Math.round((new Date(sprint.end_date) - new Date(today)) / 86400000)) : 0;

  page.innerHTML = `
    <div class="page-head">
      <div><h1>Sprint · ${esc(project.name)}</h1><p>Phát triển theo Scrum: mỗi sprint đưa một nhóm user story từ backlog đến trạng thái Hoàn thành.</p></div>
      ${can('sprint:manage') ? '<button class="btn primary" id="new-sprint">＋ Tạo sprint</button>' : ''}
    </div>
    ${sprint ? `
    <div class="card mb">
      <div class="row">
        <div class="row" role="tablist" aria-label="Chọn sprint">${project.sprints.map((s) => `<button class="btn sm ${s.id === sprint.id ? 'primary' : ''}" data-sprint="${s.id}">${esc(s.name)}</button>`).join('')}</div>
        <span class="spacer"></span>
        ${can('sprint:manage') ? '<button class="btn sm" id="edit-sprint">Sửa sprint</button>' : ''}
      </div>
      <div class="grid g4 mt">
        <div><div class="muted small">Mục tiêu sprint</div><b>${esc(sprint.goal || '—')}</b></div>
        <div><div class="muted small">Thời gian</div><b>${fmt(sprint.start_date)} → ${fmt(sprint.end_date)}</b> (${bd.sprint.days} ngày) · ${status(sprint)}${status(sprint) === 'Đang chạy' ? `, còn ${daysLeft} ngày` : ''}</div>
        <div><div class="muted small">Story point hoàn thành</div><b style="font-size:20px">${bd.sprint.completed_points} / ${bd.sprint.committed_points}</b></div>
        <div><div class="muted small">User story đạt DoD</div><b style="font-size:20px">${bd.sprint.done_count} / ${bd.sprint.story_count}</b></div>
      </div>
    </div>
    <div class="grid g4" id="board">
      ${STAGES.map(([key, label, color]) => {
        const items = bd.stories.filter((s) => s.stage === key);
        return `<div class="card" style="background:#f8fafc;border-top:3px solid ${color}">
          <h3>${label} <span class="muted small">(${items.length})</span></h3>
          ${items.map((s) => `<a class="card" href="#/stories/${s.id}" style="display:block;margin-top:8px;background:#fff;color:inherit">
              <div class="row"><b class="mono">${esc(s.code)}</b><span class="spacer"></span>${s.story_points ? `<span class="pill role" title="Story point">${s.story_points} SP</span>` : ''}</div>
              <div style="margin:4px 0">${esc(s.title)}</div>
              <div class="small muted">${s.tc_total} test case · ${s.approved || 0} đã duyệt · ${s.passed || 0} pass</div>
            </a>`).join('') || '<p class="muted small">Trống</p>'}
        </div>`;
      }).join('')}
    </div>
    <div class="grid g2 mt">
      <div class="card"><h3>Burndown chart – ${esc(sprint.name)}</h3><p class="muted small">Story point còn lại theo ngày. Story giảm điểm khi đạt Definition of Done.</p><div class="chart-box"><canvas id="c-burndown"></canvas></div></div>
      <div class="card"><h3>Velocity các sprint</h3><p class="muted small">Story point cam kết so với hoàn thành – dùng để ước lượng khả năng làm của sprint sau.</p><div class="chart-box"><canvas id="c-velocity"></canvas></div></div>
    </div>` : `<div class="alert info">Dự án chưa có sprint nào${can('sprint:manage') ? '. Bấm <b>＋ Tạo sprint</b> để lập kế hoạch sprint đầu tiên.' : '.'}</div>`}
    <div class="card mt">
      <h3>Product backlog (${backlog.length})</h3>
      <p class="muted small">User story chưa thuộc sprint nào. Trong buổi Sprint Planning, nhóm chọn story từ đây đưa vào sprint.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Ưu tiên</th><th>Story point</th>${can('story:write') && project.sprints.length ? '<th>Đưa vào sprint</th>' : ''}</tr></thead>
        <tbody>${backlog.map((s) => `<tr><td><a href="#/stories/${s.id}" class="mono">${esc(s.code)}</a></td><td>${esc(s.title)}</td><td>${pill(s.priority)}</td><td>${s.story_points ?? '—'}</td>
          ${can('story:write') && project.sprints.length ? `<td><div class="row"><select data-plan-sel="${s.id}" style="width:150px" aria-label="Sprint cho ${esc(s.code)}">${project.sprints.filter((x) => x.end_date >= today).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>
          <button class="btn sm" data-plan="${s.id}">Đưa vào</button></div></td>` : ''}</tr>`).join('') || '<tr><td colspan="5" class="empty">Backlog trống – mọi story đã được lên kế hoạch</td></tr>'}</tbody>
      </table></div>
    </div>`;

  const reload = () => renderSprints(page);
  bind(page, '[data-sprint]', 'click', (_e, b) => {
    state.sprintId = Number(b.dataset.sprint);
    safeSet('sprintId', state.sprintId);
    reload();
  });
  page.querySelector('#new-sprint')?.addEventListener('click', () => openSprintForm(project, null, (sp) => ((state.sprintId = sp.id), reload())));
  page.querySelector('#edit-sprint')?.addEventListener('click', () => openSprintForm(project, sprint, reload));
  bind(page, '[data-plan]', 'click', async (_e, b) => {
    const sprintId = Number(page.querySelector(`[data-plan-sel="${b.dataset.plan}"]`).value);
    try {
      await api(`/stories/${b.dataset.plan}`, { method: 'PUT', body: { sprint_id: sprintId } });
      toast('Đã đưa user story vào sprint', 'success');
      reload();
    } catch (e) {
      toastError(e);
    }
  });

  charts.splice(0).forEach((c) => c.destroy());
  if (!window.Chart || !sprint) return;
  charts.push(new Chart(document.getElementById('c-burndown'), {
    type: 'line',
    data: {
      labels: bd.points.map((p) => fmt(p.day)),
      datasets: [
        { label: 'Lý tưởng', data: bd.points.map((p) => p.ideal), borderColor: '#94a3b8', borderDash: [6, 4], pointRadius: 0, tension: 0 },
        { label: 'Thực tế', data: bd.points.map((p) => p.remaining), borderColor: '#2563eb', backgroundColor: '#2563eb', stepped: true, pointRadius: 3 },
      ],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Story point còn lại' } } } },
  }));
  charts.push(new Chart(document.getElementById('c-velocity'), {
    type: 'bar',
    data: {
      labels: project.sprints.map((s) => s.name),
      datasets: [
        { label: 'Cam kết', data: project.sprints.map((s) => s.committed_points), backgroundColor: '#cbd5e1', borderRadius: 5 },
        { label: 'Hoàn thành', data: project.sprints.map((s) => s.completed_points), backgroundColor: '#16a34a', borderRadius: 5 },
      ],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  }));
}
