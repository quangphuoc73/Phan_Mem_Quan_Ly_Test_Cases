// User story, test case, AI, duyệt, chạy test, script, báo cáo, xuất Excel.
const express = require('express');
const ExcelJS = require('exceljs');
const { requirePermission } = require('../middleware/auth');
const { aiQuota } = require('../middleware/aiQuota');
const audit = require('../services/auditService');
const stories = require('../services/storyService');
const testCases = require('../services/testCaseService');
const runs = require('../services/runService');
const scripts = require('../services/scriptService');
const reports = require('../services/reportService');
const ai = require('../services/ai/aiService');
const { badRequest } = require('../utils/errors');

const router = express.Router();
const id = (req) => Number(req.params.id);

// ---------- YC1: User story ----------
router.get('/stories', (req, res) => res.json(stories.list(req.query)));
router.get('/stories/:id', (req, res) => res.json(stories.get(id(req))));

router.post('/stories', requirePermission('story:write'), (req, res) => {
  const s = stories.create(req.body, req.user.id);
  audit.log(req, 'CREATE_STORY', 'user_story', s.id, { code: s.code });
  res.status(201).json(s);
});

router.put('/stories/:id', requirePermission('story:write'), (req, res) => {
  const s = stories.update(id(req), req.body);
  audit.log(req, 'UPDATE_STORY', 'user_story', s.id);
  res.json(s);
});

router.delete('/stories/:id', requirePermission('story:write'), (req, res) => {
  stories.remove(id(req));
  audit.log(req, 'DELETE_STORY', 'user_story', id(req));
  res.status(204).end();
});

// YC8: nhập user story từ file (frontend đọc CSV/JSON và gửi mảng dòng)
router.post('/stories/import', requirePermission('story:write'), (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || !rows.length) throw badRequest('File không có dòng dữ liệu nào');
  if (rows.length > 200) throw badRequest('Mỗi lần chỉ nhập tối đa 200 user story');
  const r = stories.importMany(rows, req.user.id);
  audit.log(req, 'IMPORT_STORIES', 'user_story', null, { created: r.created.length, errors: r.errors.length });
  res.json(r);
});

// ---------- YC2: Sinh test case bằng AI ----------
router.post('/stories/:id/generate', requirePermission('ai:use'), aiQuota, async (req, res) => {
  const story = stories.get(id(req));
  const r = await ai.generateTestCases(story, req.user.id);
  const saved = testCases.saveAiResult(story, r.testCases, r.aiLogId, req.user.id);
  audit.log(req, 'AI_GENERATE_TESTCASES', 'user_story', story.id, { count: saved.length, aiLogId: r.aiLogId });
  res.json({
    testCases: saved,
    aiLogId: r.aiLogId,
    piiFound: r.piiFound,
    injectionWarning: r.injection,
    durationMs: r.durationMs,
  });
});

router.get('/ai/info', (_req, res) => res.json({ ...ai.providerInfo(), runnerAvailable: scripts.runnerAvailable() }));

// ---------- YC3, YC7: Test case ----------
router.get('/testcases', (req, res) => res.json(testCases.list(req.query)));
router.get('/testcases/:id', (req, res) => res.json(testCases.get(id(req))));
router.get('/testcases/:id/history', (req, res) => res.json(testCases.history(id(req))));

router.post('/testcases', requirePermission('testcase:write'), (req, res) => {
  const story = stories.get(Number(req.body.story_id));
  const tc = testCases.create(req.body, story, req.user.id);
  audit.log(req, 'CREATE_TESTCASE', 'test_case', tc.id, { code: tc.code });
  res.status(201).json(tc);
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

router.post('/testcases/submit', requirePermission('testcase:write'), (req, res) => {
  const codes = testCases.submit(req.body.ids);
  audit.log(req, 'SUBMIT_REVIEW', 'test_case', null, { codes });
  res.json({ submitted: codes });
});

// ---------- YC4: Duyệt (QĐ4: chỉ QA Lead) ----------
router.post('/testcases/:id/review', requirePermission('testcase:review'), (req, res) => {
  const tc = testCases.review(id(req), req.body, req.user.id);
  audit.log(req, `REVIEW_${tc.status}`, 'test_case', tc.id, { note: req.body.note });
  res.json(tc);
});

// ---------- YC5: Kết quả chạy test ----------
router.get('/runs', (req, res) => res.json(runs.list(req.query)));
router.post('/testcases/:id/runs', requirePermission('run:write'), (req, res) => {
  const r = runs.record(id(req), req.body, req.user.id);
  audit.log(req, 'RECORD_RUN', 'test_case', id(req), { result: r.result });
  res.status(201).json(r);
});

// ---------- YC9: Script Playwright ----------
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
  const r = await scripts.run(id(req), req.user.id);
  audit.log(req, 'AUTO_RUN', 'test_case', id(req), { result: r.result });
  res.json(r);
});

router.get('/testcases/:id/script/download', (req, res) => {
  const s = scripts.getByTestCase(id(req));
  if (!s) throw badRequest('Test case chưa có script');
  const tc = testCases.get(id(req));
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${tc.code}.spec.js"`);
  res.send(s.code);
});

// ---------- YC6: Báo cáo ----------
router.get('/reports/summary', (req, res) =>
  res.json(reports.summary(Number(req.query.project_id) || null, Number(req.query.sprint_id) || null)));

// ---------- YC8: Xuất Excel ----------
router.get('/export/testcases.xlsx', async (req, res) => {
  const list = testCases.list(req.query);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AI TestCase Manager';
  const ws = wb.addWorksheet('Test cases');
  ws.columns = [
    { header: 'Mã TC', key: 'code', width: 20 },
    { header: 'User story', key: 'story_code', width: 16 },
    { header: 'Tiêu đề', key: 'title', width: 45 },
    { header: 'Điều kiện tiên quyết', key: 'precondition', width: 30 },
    { header: 'Các bước', key: 'steps', width: 60 },
    { header: 'Kết quả mong đợi', key: 'expected_result', width: 45 },
    { header: 'Ưu tiên', key: 'priority', width: 10 },
    { header: 'Loại', key: 'type', width: 10 },
    { header: 'Trạng thái', key: 'status', width: 16 },
    { header: 'Nguồn', key: 'source', width: 9 },
    { header: 'KQ gần nhất', key: 'last_result', width: 12 },
  ];
  list.forEach((t) => ws.addRow({ ...t, steps: t.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  ws.eachRow((row) => (row.alignment = { wrapText: true, vertical: 'top' }));
  audit.log(req, 'EXPORT_EXCEL', 'test_case', null, { count: list.length });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="testcases.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
