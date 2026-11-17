// YC6 – BM5, QĐ6: báo cáo kiểm thử theo dự án hoặc Test Run, tính ngay khi mở.
import { state, api, esc, pill, feature, runTypeLabel } from '../core.js';

const COLORS = { pass: '#16a34a', fail: '#dc2626', blocked: '#f59e0b', idle: '#cbd2e1' };
const charts = [];

function stat(label, value, sub = '') {
  return `<div class="card stat"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;
}

export async function renderDashboard(page) {
  const project = state.projects.find((p) => p.id === state.projectId);
  const runs = await api(`/runs${state.projectId ? `?project_id=${state.projectId}` : ''}`);
  if (state.runId && !runs.some((r) => r.id === state.runId)) state.runId = 0;
  const q = new URLSearchParams();
  if (state.runId) q.set('run_id', state.runId);
  else if (state.projectId) q.set('project_id', state.projectId);
  const r = await api(`/reports/summary?${q}`);
  const tc = r.testCases;
  const totalTc = Object.values(tc).reduce((a, b) => a + b, 0);
  const run = r.scope.type === 'RUN' ? r.scope.run : null;
  const sprints = feature('sprint') && project ? await api(`/projects/${project.id}/sprints`) : [];

  page.innerHTML = `
    <div class="page-head">
      <div><h1>Tổng quan & báo cáo</h1>
        <p>${project ? esc(project.name) : 'Tất cả dự án'}${run ? ` · Test Run <b>${esc(run.name)}</b> (build ${esc(run.build)}, ${esc(run.environment)}) ${pill(run.status)}` : ''}
        · Tính ngay khi mở theo lần chạy gần nhất của từng test${run ? ' trong đợt' : ' (phiên bản hiện tại)'}; chỉ tính requirement chưa lưu trữ (QĐ6)</p></div>
      <div class="row"><label for="rep-run" class="muted" style="margin:0">Phạm vi</label>
        <select id="rep-run" style="width:300px"><option value="0">Toàn ${project ? 'dự án' : 'bộ dự án'}</option>
          ${runs.map((x) => `<option value="${x.id}" ${x.id === state.runId ? 'selected' : ''}>#${x.id} ${esc(x.name)} · ${esc(runTypeLabel(x.run_type))}</option>`).join('')}</select></div>
    </div>
    <div class="grid g4">
      ${stat('Tỷ lệ Pass', `${r.passRate}%`, `${r.runs.PASS}/${r.executed} test đã chạy (Blocked tính đã chạy)`)}
      ${stat('Tiến độ thực thi', `${r.executionProgress}%`, `${r.executed}/${r.inScope} test trong phạm vi · ${r.notRun} chưa chạy`)}
      ${stat('Bao phủ requirement', `${r.coverage}%`, `${r.covered}/${r.storiesWithAc} requirement có AC đã có test được duyệt`)}
      ${stat('Bao phủ AC', `${r.acCoverage}%`, `${r.acCovered}/${r.acTotal} AC có test được duyệt`)}
    </div>
    <div class="grid g4 mt">
      ${stat('Tổng test case', totalTc, `${tc.APPROVED || 0} đã duyệt · ${tc.PENDING_REVIEW || 0} chờ duyệt`)}
      ${stat('Test cần xem lại', r.needsReview, 'Requirement đã đổi sau phiên bản test liên kết')}
      ${stat('Chờ kiểm thử lại', r.needsRetest, 'Developer đã báo sửa lỗi')}
      ${stat('Đề xuất AI chờ xử lý', r.proposals.PENDING, `${r.proposals.ACCEPTED} chấp nhận · ${r.proposals.REJECTED} từ chối · ${r.proposals.OUTDATED} lỗi thời`)}
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
          <thead><tr><th>Module</th><th>Test</th><th>Pass</th><th>Fail</th><th>Blocked</th><th>Chưa chạy</th></tr></thead>
          <tbody>${r.byModule.map((m) => `<tr><td>${esc(m.module)}</td><td>${m.total}</td><td>${m.pass}</td><td>${m.fail}</td><td>${m.blocked}</td><td>${m.not_run}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Chưa có dữ liệu</td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="card">
        <h3>Requirement chưa được bao phủ</h3>
        ${r.uncovered.length ? `<ul>${r.uncovered.map((s) => `<li><a href="#/stories/${s.id}"><b>${esc(s.code)}</b></a> – ${esc(s.title)}</li>`).join('')}</ul>` : '<div class="alert success">Mọi requirement có AC đều đã có test được duyệt.</div>'}
        <h3 class="mt">AC chưa có test (${r.uncoveredAcs.length})</h3>
        ${r.uncoveredAcs.length ? `<ul class="small">${r.uncoveredAcs.slice(0, 12).map((a) => `<li><a href="#/stories/${a.story_id}">${esc(a.code)}</a>: ${esc(a.ac)}</li>`).join('')}${r.uncoveredAcs.length > 12 ? `<li class="muted">… và ${r.uncoveredAcs.length - 12} AC khác</li>` : ''}</ul>` : '<p class="muted">Không có.</p>'}
        <h3 class="mt">Requirement Thiếu AC (${r.missingAc.length})</h3>
        ${r.missingAc.length ? `<p class="small muted">Không tính vào mẫu số bao phủ; PO/BA cần bổ sung AC trên Jira [B1].</p><ul>${r.missingAc.map((s) => `<li><a href="#/stories/${s.id}"><b>${esc(s.code)}</b></a> – ${esc(s.title)}</li>`).join('')}</ul>` : '<p class="muted">Không có.</p>'}
      </div>
    </div>
    ${sprints.length ? `<div class="card mt">
      <h3>Tiến độ theo sprint (phần mở rộng YC20)</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Sprint</th><th>Thời gian</th><th>Requirement đạt DoD</th><th>Velocity (SP hoàn thành / cam kết)</th></tr></thead>
        <tbody>${sprints.map((s) => `<tr><td><a href="#/sprints"><b>${esc(s.name)}</b></a></td><td class="small">${esc(s.start_date)} → ${esc(s.end_date)}</td>
          <td>${s.done_count}/${s.story_count}</td><td><b>${s.completed_points}</b> / ${s.committed_points}</td></tr>`).join('')}</tbody>
      </table></div></div>` : ''}
    <div class="card mt">
      <h3>Hiệu quả AI</h3>
      <div class="grid g4">
        ${stat('Test case do AI sinh', r.ai.ai_total || 0, `${r.ai.manual_total || 0} test viết thủ công`)}
        ${stat('Tỷ lệ AI phải sửa', `${r.ai.ai_edit_rate || 0}%`, `${r.ai.ai_edited || 0} test AI bị đổi các bước hoặc kết quả mong đợi`)}
        ${stat('Lượt gọi AI', r.ai.calls || 0, `${r.ai.ok || 0} thành công · TB ${r.ai.avg_ms || 0} ms`)}
        ${stat('Cảnh báo prompt injection', r.ai.injections || 0, 'Số lần phát hiện nội dung đáng ngờ')}
      </div>
    </div>`;

  page.querySelector('#rep-run').addEventListener('change', (e) => {
    state.runId = Number(e.target.value);
    renderDashboard(page);
  });

  charts.splice(0).forEach((c) => c.destroy());
  if (!window.Chart) return;
  charts.push(new Chart(document.getElementById('c-result'), {
    type: 'doughnut',
    data: { labels: ['Pass', 'Fail', 'Blocked', 'Chưa chạy'], datasets: [{ data: [r.runs.PASS, r.runs.FAIL, r.runs.BLOCKED, r.notRun], backgroundColor: [COLORS.pass, COLORS.fail, COLORS.blocked, COLORS.idle], borderWidth: 2 }] },
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
