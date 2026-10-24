// YC6: Báo cáo – tỷ lệ pass, độ bao phủ, tiến độ chạy, thống kê AI.
import { state, api, esc } from '../core.js';

const COLORS = { pass: '#16a34a', fail: '#dc2626', blocked: '#f59e0b', idle: '#cbd2e1', ai: '#6d28d9', manual: '#64708a' };
const charts = [];

function stat(label, value, sub = '') {
  return `<div class="card stat"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;
}

export async function renderDashboard(page) {
  const q = new URLSearchParams();
  if (state.projectId) q.set('project_id', state.projectId);
  if (state.sprintId) q.set('sprint_id', state.sprintId);
  const r = await api(`/reports/summary?${q}`);
  const tc = r.testCases;
  const totalTc = Object.values(tc).reduce((a, b) => a + b, 0);
  const project = state.projects.find((p) => p.id === state.projectId);
  const aiEditRate = r.ai.ai_total ? Math.round((r.ai.ai_edited / r.ai.ai_total) * 100) : 0;

  page.innerHTML = `
    <div class="page-head">
      <div><h1>Tổng quan & báo cáo</h1><p>${project ? esc(project.name) : 'Tất cả dự án'}${r.sprint ? ` · ${esc(r.sprint.name)} (${esc(r.sprint.start_date)} → ${esc(r.sprint.end_date)})` : ''} · Số liệu tính theo lần chạy gần nhất của mỗi test case</p></div>
    </div>
    <div class="grid g4">
      ${stat('Tỷ lệ Pass', `${r.passRate}%`, `${r.runs.PASS}/${r.executed} test case đã chạy`)}
      ${stat('Độ bao phủ yêu cầu', `${r.coverage}%`, `${r.covered}/${r.stories} user story có test case đã duyệt`)}
      ${stat('Tiến độ thực thi', `${r.executionProgress}%`, `${r.executed}/${r.approved} test case đã duyệt được chạy`)}
      ${stat('Tổng test case', totalTc, `${tc.APPROVED || 0} đã duyệt · ${tc.PENDING_REVIEW || 0} chờ duyệt`)}
    </div>
    <div class="grid g3 mt">
      <div class="card"><h3>Kết quả chạy test</h3><div class="chart-box"><canvas id="c-result"></canvas></div></div>
      <div class="card"><h3>Trạng thái test case</h3><div class="chart-box"><canvas id="c-status"></canvas></div></div>
      <div class="card"><h3>Xu hướng chạy test theo ngày</h3><div class="chart-box"><canvas id="c-trend"></canvas></div></div>
    </div>
    <div class="grid g2 mt">
      <div class="card">
        <h3>Kết quả theo module</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Module</th><th>Test case</th><th>Pass</th><th>Fail</th><th>Blocked</th><th>Chưa chạy</th></tr></thead>
          <tbody>${r.byModule.map((m) => `<tr><td>${esc(m.module)}</td><td>${m.total}</td><td>${m.pass}</td><td>${m.fail}</td><td>${m.blocked}</td><td>${m.total - m.pass - m.fail - m.blocked}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Chưa có dữ liệu</td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="card">
        <h3>User story chưa được bao phủ</h3>
        <p class="muted small">Chưa có test case nào được duyệt – rủi ro bỏ sót kiểm thử.</p>
        ${r.uncovered.length ? `<ul>${r.uncovered.map((s) => `<li><a href="#/stories/${s.id}"><b>${esc(s.code)}</b></a> – ${esc(s.title)}</li>`).join('')}</ul>` : '<div class="alert success">Tất cả user story đều đã có test case được duyệt.</div>'}
      </div>
    </div>
    ${r.sprints.length ? `<div class="card mt">
      <h3>Tiến độ theo sprint (Agile)</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Sprint</th><th>Mục tiêu</th><th>Thời gian</th><th>User story đạt DoD</th><th>Velocity (SP hoàn thành / cam kết)</th></tr></thead>
        <tbody>${r.sprints.map((s) => `<tr${r.sprint?.id === s.id ? ' style="background:var(--primary-soft)"' : ''}><td><a href="#/sprints"><b>${esc(s.name)}</b></a></td><td>${esc(s.goal || '')}</td>
          <td class="small">${esc(s.start_date)} → ${esc(s.end_date)}</td><td>${s.done_count}/${s.story_count}</td><td><b>${s.completed_points}</b> / ${s.committed_points}</td></tr>`).join('')}</tbody>
      </table></div></div>` : ''}
    <div class="card mt">
      <h3>Hiệu quả AI</h3>
      <div class="grid g4">
        ${stat('Test case do AI sinh', r.ai.ai_total || 0, `${r.ai.manual_total || 0} test case viết thủ công`)}
        ${stat('Tỷ lệ AI phải sửa', `${aiEditRate}%`, `${r.ai.ai_edited || 0} test case AI được người chỉnh lại`)}
        ${stat('Lượt gọi AI', r.ai.calls || 0, `${r.ai.ok || 0} thành công · TB ${r.ai.avg_ms || 0} ms`)}
        ${stat('Cảnh báo prompt injection', r.ai.injections || 0, 'Số lần phát hiện nội dung đáng ngờ')}
      </div>
    </div>`;

  charts.splice(0).forEach((c) => c.destroy());
  if (!window.Chart) return;
  const notRun = Math.max(r.approved - r.executed, 0);
  charts.push(new Chart(document.getElementById('c-result'), {
    type: 'doughnut',
    data: { labels: ['Pass', 'Fail', 'Blocked', 'Chưa chạy'], datasets: [{ data: [r.runs.PASS, r.runs.FAIL, r.runs.BLOCKED, notRun], backgroundColor: [COLORS.pass, COLORS.fail, COLORS.blocked, COLORS.idle], borderWidth: 2 }] },
    options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom' } } },
  }));
  charts.push(new Chart(document.getElementById('c-status'), {
    type: 'bar',
    data: {
      labels: ['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Bị trả lại'],
      datasets: [{ data: [tc.DRAFT || 0, tc.PENDING_REVIEW || 0, tc.APPROVED || 0, tc.RETURNED || 0], backgroundColor: ['#94a3b8', '#f59e0b', '#16a34a', '#dc2626'], borderRadius: 6 }],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  }));
  charts.push(new Chart(document.getElementById('c-trend'), {
    type: 'bar',
    data: {
      labels: r.trend.map((t) => t.day.slice(5)),
      datasets: [
        { label: 'Pass', data: r.trend.map((t) => t.pass), backgroundColor: COLORS.pass, borderRadius: 4 },
        { label: 'Fail', data: r.trend.map((t) => t.fail), backgroundColor: COLORS.fail, borderRadius: 4 },
        { label: 'Blocked', data: r.trend.map((t) => t.blocked), backgroundColor: COLORS.blocked, borderRadius: 4 },
      ],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } },
  }));
}
