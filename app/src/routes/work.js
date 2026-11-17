// API nghiệp vụ kiểm thử: requirement, test case, suite, Test Run, AI, đề xuất, regression, kiểm thử lại, báo cáo, xuất Excel.
const express = require('express');
const ExcelJS = require('exceljs');
const config = require('../config');
const { getDb } = require('../db');
const { requirePermission } = require('../middleware/auth');
const { aiQuota } = require('../middleware/aiQuota');
const audit = require('../services/auditService');
const stories = require('../services/storyService');
const testCases = require('../services/testCaseService');
const suites = require('../services/suiteService');
const runs = require('../services/runService');
const retests = require('../services/retestService');
const impact = require('../services/impactService');
const regression = require('../services/regressionService');
const reports = require('../services/reportService');
const ai = require('../services/ai/aiService');
const { badRequest, notFound } = require('../utils/errors');

const router = express.Router();
const id = (req, name = 'id') => Number(req.params[name]);

// ---------- YC1: Requirement – chỉ đọc; tạo, sửa trên Jira rồi đồng bộ về ----------
router.get('/stories', (req, res) => res.json(stories.list(req.query)));
router.get('/stories/:id', (req, res) => res.json(stories.get(id(req))));
router.get('/stories/:id/versions', (req, res) => res.json(stories.versions(id(req))));
router.get('/stories/:id/versions/:v', (req, res) => res.json(stories.version(id(req), Number(req.params.v))));

// YC8 – QĐ8: xử lý requirement Cần kiểm tra (Lưu trữ / Giữ lại)
router.post('/stories/:id/check-decision', requirePermission('jira:import'), (req, res) => {
  const s = stories.checkDecision(id(req), req.body?.decision, req.user.id);
  audit.log(req, `STORY_CHECK_${req.body.decision}`, 'user_story', s.id, { code: s.code });
  res.json(s);
});

// ---------- YC2: Sinh test case bằng AI ----------
router.post('/stories/:id/generate', requirePermission('ai:use'), aiQuota, async (req, res) => {
  const story = stories.get(id(req));
  stories.assertReady(story);
  const r = await ai.generateTestCases(story, req.user.id);
  const saved = testCases.saveAiResult(story, r.testCases, r.aiLogId, req.user.id);
  audit.log(req, 'AI_GENERATE_TESTCASES', 'user_story', story.id, { count: saved.testCases.length, aiLogId: r.aiLogId });
  res.json({ ...saved, aiLogId: r.aiLogId, piiFound: r.piiFound, injectionWarning: r.injection, durationMs: r.durationMs });
});

// ---------- YC15: AI phân tích ảnh hưởng ----------
router.post('/stories/:id/analyze', requirePermission('ai:use'), aiQuota, async (req, res) => {
  const r = await impact.analyze(id(req), req.user.id);
  audit.log(req, 'AI_ANALYZE_IMPACT', 'user_story', id(req), { analysisId: r.analysis.id, proposals: r.analysis.proposals.length });
  res.json(r);
});

router.get('/ai/info', (_req, res) => res.json({ ...ai.providerInfo(), features: config.features }));

// ---------- YC3, YC7: Test case ----------
router.get('/testcases', (req, res) => res.json(testCases.list(req.query)));
router.get('/testcases/:id', (req, res) => res.json(testCases.get(id(req))));
router.get('/testcases/:id/history', (req, res) => res.json(testCases.history(id(req))));

router.post('/testcases', requirePermission('testcase:write'), (req, res) => {
  const story = stories.get(Number(req.body?.story_id));
  const tc = testCases.create(req.body, story, req.user.id);
  audit.log(req, 'CREATE_TESTCASE', 'test_case', tc.id, { code: tc.code });
  res.status(201).json(tc);
});

router.post('/testcases/submit', requirePermission('testcase:write'), (req, res) => {
  const codes = testCases.submit(req.body?.ids);
  audit.log(req, 'SUBMIT_REVIEW', 'test_case', null, { codes });
  res.json({ submitted: codes });
});

// QĐ3 [2.2] [D1]: Đã xem lại (một hoặc nhiều test, bắt buộc lý do)
router.post('/testcases/recheck', requirePermission('testcase:write'), (req, res) => {
  const codes = testCases.recheck(req.body, req.user.id);
  audit.log(req, 'RECHECK_TESTCASE', 'test_case', null, { codes, reason: req.body.reason });
  res.json({ rechecked: codes });
});

router.put('/testcases/:id', requirePermission('testcase:write'), (req, res) => {
  const tc = testCases.update(id(req), req.body, req.user.id);
  audit.log(req, 'UPDATE_TESTCASE', 'test_case', tc.id, { version: tc.version });
  res.json(tc);
});

router.delete('/testcases/:id', requirePermission('testcase:write'), (req, res) => {
  const tc = testCases.remove(id(req));
  audit.log(req, 'DELETE_TESTCASE', 'test_case', tc.id, { code: tc.code });
  res.status(204).end();
});

// ---------- YC4: Duyệt (QĐ4: chỉ QA Lead) ----------
router.post('/testcases/:id/review', requirePermission('testcase:review'), (req, res) => {
  const tc = testCases.review(id(req), req.body || {}, req.user.id);
  audit.log(req, `REVIEW_${tc.status}`, 'test_case', tc.id, { note: req.body.note });
  res.json(tc);
});

// ---------- YC13: Test Suite ----------
router.get('/suites', (req, res) => res.json(suites.list(req.query)));
router.get('/suites/:id', (req, res) => res.json(suites.get(id(req))));
router.post('/suites', requirePermission('testcase:write'), (req, res) => {
  const s = suites.create(req.body, req.user.id);
  audit.log(req, 'CREATE_SUITE', 'test_suite', s.id, { name: s.name });
  res.status(201).json(s);
});
router.put('/suites/:id', requirePermission('testcase:write'), (req, res) => {
  const s = suites.update(id(req), req.body);
  audit.log(req, 'UPDATE_SUITE', 'test_suite', s.id, { name: s.name });
  res.json(s);
});
router.put('/suites/:id/items', requirePermission('testcase:write'), (req, res) => {
  const s = suites.setItems(id(req), req.body);
  audit.log(req, 'UPDATE_SUITE_ITEMS', 'test_suite', s.id, req.body);
  res.json(s);
});
router.delete('/suites/:id', requirePermission('testcase:write'), (req, res) => {
  const s = suites.remove(id(req));
  audit.log(req, 'DELETE_SUITE', 'test_suite', s.id, { name: s.name });
  res.status(204).end();
});

// ---------- YC14: Test Run ----------
router.get('/runs', (req, res) => res.json(runs.list(req.query)));
router.post('/runs/eligibility', (req, res) => res.json(runs.eligibility((req.body?.ids || []).map(Number))));
router.get('/runs/:id', (req, res) => res.json(runs.get(id(req))));
router.get('/runs/:id/executions', (req, res) => res.json(runs.executions(id(req))));

router.post('/runs', requirePermission('testrun:manage'), (req, res) => {
  const r = runs.create(req.body, req.user.id);
  audit.log(req, 'CREATE_RUN', 'test_run', r.run.id, { name: r.run.name, skipped: r.skipped.length });
  res.status(201).json(r);
});
router.put('/runs/:id', requirePermission('testrun:manage'), (req, res) => {
  const r = runs.update(id(req), req.body);
  audit.log(req, 'UPDATE_RUN', 'test_run', r.id, req.body);
  res.json(r);
});
router.post('/runs/:id/items', requirePermission('testrun:manage'), (req, res) => {
  const r = runs.addTests(id(req), req.body);
  audit.log(req, 'ADD_RUN_ITEMS', 'test_run', id(req), { added: r.added, skipped: r.skipped.length });
  res.json(r);
});
router.put('/runs/:id/items/:itemId', requirePermission('testrun:manage'), (req, res) => {
  const r = runs.assign(id(req), id(req, 'itemId'), req.body?.assignee_id);
  audit.log(req, 'ASSIGN_RUN_ITEM', 'test_run', id(req), { item: id(req, 'itemId'), assignee: req.body?.assignee_id });
  res.json(r);
});
router.delete('/runs/:id/items/:itemId', requirePermission('testrun:manage'), (req, res) => {
  const r = runs.removeItem(id(req), id(req, 'itemId'));
  audit.log(req, 'REMOVE_RUN_ITEM', 'test_run', id(req), { item: id(req, 'itemId') });
  res.json(r);
});
router.post('/runs/:id/close', requirePermission('testrun:manage'), (req, res) => {
  const r = runs.close(id(req), req.body || {}, req.user.id);
  audit.log(req, 'CLOSE_RUN', 'test_run', id(req), { notRun: r.notRun });
  res.json(r);
});

// ---------- YC5: Ghi kết quả chạy test trong Test Run ----------
router.post('/runs/:id/items/:itemId/executions', requirePermission('run:write'), (req, res) => {
  const r = runs.record(id(req), id(req, 'itemId'), req.body || {}, req.user);
  audit.log(req, 'RECORD_EXECUTION', 'test_run', id(req), { item: id(req, 'itemId'), result: r.execution.result });
  res.status(201).json(r);
});

// ---------- YC16: Đề xuất AI ----------
router.get('/proposals', requirePermission('ai:use'), (req, res) => res.json(impact.list(req.query)));
router.get('/proposals/:id', requirePermission('ai:use'), (req, res) => res.json(impact.getProposal(id(req))));
router.get('/analyses/:id', requirePermission('ai:use'), (req, res) => res.json(impact.getAnalysis(id(req))));
router.post('/proposals/:id/decision', requirePermission('proposal:review'), async (req, res) => {
  const p = await impact.decide(id(req), req.body || {}, req.user.id);
  audit.log(req, `PROPOSAL_${p.status}`, 'ai_proposal', p.id, { type: p.type, note: req.body.note });
  res.json(p);
});

// ---------- YC17: Bộ regression ----------
router.get('/regressions', requirePermission('ai:use'), (req, res) => res.json(regression.list(req.query)));
router.get('/regressions/:id', requirePermission('ai:use'), (req, res) => res.json(regression.get(id(req))));
router.post('/regressions', requirePermission('ai:use'), aiQuota, async (req, res) => {
  const storyId = Number(req.body?.story_id);
  if (!storyId) throw badRequest('Thiếu story_id');
  const r = await regression.create(storyId, req.user.id);
  audit.log(req, 'AI_REGRESSION', 'regression_set', r.id, { story: r.story_code, items: r.items.length });
  res.status(201).json(r);
});
router.put('/regressions/:id/items', requirePermission('proposal:review'), (req, res) => {
  const r = regression.updateItems(id(req), req.body || {});
  audit.log(req, 'UPDATE_REGRESSION', 'regression_set', r.id, req.body);
  res.json(r);
});
router.post('/regressions/:id/confirm', requirePermission('proposal:review'), (req, res) => {
  const r = regression.confirm(id(req), req.body || {}, req.user.id);
  audit.log(req, 'CONFIRM_REGRESSION', 'regression_set', r.set.id, { run: r.run.id });
  res.json(r);
});

// ---------- YC18: Báo đã sửa lỗi và kiểm thử lại ----------
router.get('/retests', (req, res) => res.json(retests.overview(req.query)));
router.post('/executions/:id/fix', requirePermission('bug:fix'), (req, res) => {
  const f = retests.reportFix(id(req), req.body || {}, req.user.id);
  audit.log(req, 'REPORT_FIX', 'test_execution', f.execution_id, { build: f.build });
  res.status(201).json(f);
});
router.post('/retests/run', requirePermission('testrun:manage'), (req, res) => {
  const r = retests.createRetestRun(req.body || {}, req.user.id);
  audit.log(req, 'CREATE_RETEST_RUN', 'test_run', r.run.id, { tests: r.run.items.length });
  res.status(201).json(r);
});

// ---------- YC6: Báo cáo ----------
router.get('/reports/summary', (req, res) =>
  res.json(reports.summary({ project_id: Number(req.query.project_id) || null, run_id: Number(req.query.run_id) || null })));

// ---------- YC9: Xuất Excel (QĐ9: đúng danh sách đang lọc ở BM6) ----------
router.get('/export/testcases.xlsx', async (req, res) => {
  const list = testCases.list(req.query);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AI TestCase Manager';
  const ws = wb.addWorksheet('Test cases');
  ws.columns = [
    { header: 'Mã TC', key: 'code', width: 20 },
    { header: 'Requirement (Jira)', key: 'story_code', width: 16 },
    { header: 'Tiêu đề', key: 'title', width: 45 },
    { header: 'Điều kiện tiên quyết', key: 'precondition', width: 30 },
    { header: 'Các bước', key: 'steps', width: 60 },
    { header: 'Kết quả mong đợi', key: 'expected_result', width: 45 },
    { header: 'AC liên kết', key: 'acs', width: 45 },
    { header: 'Ưu tiên', key: 'priority', width: 10 },
    { header: 'Loại', key: 'type', width: 10 },
    { header: 'Trạng thái', key: 'status', width: 16 },
    { header: 'Nguồn', key: 'source', width: 9 },
    { header: 'Phiên bản', key: 'version', width: 10 },
    { header: 'Test Suite', key: 'suites', width: 25 },
    { header: 'Test Run', key: 'runs', width: 30 },
    { header: 'KQ gần nhất', key: 'last_result', width: 12 },
    { header: 'Cần xem lại', key: 'flag', width: 12 },
  ];
  const runNames = getDb().prepare(
    'SELECT GROUP_CONCAT(r.name, \', \') n FROM test_run_items i JOIN test_runs r ON r.id = i.run_id WHERE i.test_case_id = ?'
  );
  list.forEach((t) =>
    ws.addRow({
      ...t,
      steps: t.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      acs: t.acs.map((a) => `- ${a}`).join('\n'),
      runs: runNames.get(t.id).n || '',
      last_result: t.last_result || 'Chưa chạy',
      flag: t.needs_review ? 'Có' : '',
    })
  );
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  ws.eachRow((row) => (row.alignment = { wrapText: true, vertical: 'top' }));
  audit.log(req, 'EXPORT_EXCEL', 'test_case', null, { count: list.length });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="testcases.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

// ---------- YC19 (ngoài MVP, SCRIPT_ENABLED): script Playwright ----------
if (config.features.script) {
  const scripts = require('../services/scriptService');
  router.get('/testcases/:id/script', (req, res) => {
    const s = scripts.getByTestCase(id(req));
    res.json(s ? { ...s, warnings: scripts.staticCheck(s.code) } : null);
  });
  router.post('/testcases/:id/script/generate', requirePermission('ai:use'), aiQuota, async (req, res) => {
    const s = await scripts.generate(id(req), req.user.id);
    audit.log(req, 'AI_GENERATE_SCRIPT', 'test_case', id(req), { aiLogId: s.ai_log_id });
    res.json(s);
  });
  router.put('/testcases/:id/script', requirePermission('testcase:write'), (req, res) => {
    const s = scripts.save(id(req), req.body.code);
    audit.log(req, 'UPDATE_SCRIPT', 'test_case', id(req));
    res.json(s);
  });
  router.post('/testcases/:id/script/run', requirePermission('run:write'), async (req, res) => {
    const r = await scripts.run(id(req), req.user, req.body || {});
    audit.log(req, 'AUTO_RUN', 'test_case', id(req), { result: r.execution.result });
    res.json(r);
  });
  router.get('/testcases/:id/script/download', (req, res) => {
    const s = scripts.getByTestCase(id(req));
    if (!s) throw notFound('Test case chưa có script');
    const tc = testCases.get(id(req));
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${tc.code}.spec.js"`);
    res.send(s.code);
  });
}

module.exports = router;
