// YC14: Theo dõi sprint (Agile/Scrum) – sprint và story point lấy từ Jira; bảng sprint, burndown, velocity tính trong hệ thống.
import { state, api, esc, pill, bind, safeSet } from '../core.js';
import { refreshProjects, currentProject, activeSprint, renderSprintSwitch } from '../main.js';

const STAGES = [
  ['TODO', 'Cần viết test case', '#94a3b8'],
  ['IN_REVIEW', 'Đang soạn / chờ duyệt', '#f59e0b'],
  ['TESTING', 'Đang kiểm thử', '#2563eb'],
  ['DONE', 'Hoàn thành (DoD)', '#16a34a'],
];
const charts = [];
const fmt = (d) => d.split('-').reverse().slice(0, 2).join('/');

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
      <div><h1>Sprint · ${esc(project.name)}</h1><p>Sprint, story point và việc đưa story vào sprint làm trên Jira; hệ thống tự tính trạng thái DoD, velocity, burndown từ kết quả kiểm thử.</p></div>
    </div>
    ${sprint ? `
    <div class="card mb">
      <div class="row">
        <div class="row" role="tablist" aria-label="Chọn sprint">${project.sprints.map((s) => `<button class="btn sm ${s.id === sprint.id ? 'primary' : ''}" data-sprint="${s.id}">${esc(s.name)}</button>`).join('')}</div>
        <span class="spacer"></span>${sprint.state ? `<span class="pill role">Jira: ${esc(sprint.state)}</span>` : ''}
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
    </div>` : `<div class="alert info">Dự án chưa có sprint nào. Tạo sprint (có ngày bắt đầu, kết thúc) trên Jira rồi đồng bộ lại.</div>`}
    <div class="card mt">
      <h3>Product backlog (${backlog.length})</h3>
      <p class="muted small">User story chưa thuộc sprint nào trên Jira. Trong buổi Sprint Planning, nhóm kéo story vào sprint trên Jira.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Ưu tiên</th><th>Story point</th></tr></thead>
        <tbody>${backlog.map((s) => `<tr><td><a href="#/stories/${s.id}" class="mono">${esc(s.code)}</a></td><td>${esc(s.title)}</td><td>${pill(s.priority)}</td><td>${s.story_points ?? '—'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Backlog trống – mọi story đã được lên kế hoạch</td></tr>'}</tbody>
      </table></div>
    </div>`;

  const reload = () => renderSprints(page);
  bind(page, '[data-sprint]', 'click', (_e, b) => {
    state.sprintId = Number(b.dataset.sprint);
    safeSet('sprintId', state.sprintId);
    reload();
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
