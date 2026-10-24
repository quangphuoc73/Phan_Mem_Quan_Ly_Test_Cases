// YC9: Sinh script Playwright bằng AI và chạy tự động.
// Bảo mật khi chạy mã do AI sinh:
//   1. Kiểm tra tĩnh: chặn các API nguy hiểm (child_process, fs, process.env, eval...).
//   2. Chạy trong tiến trình riêng, biến môi trường tối thiểu (không có API key, JWT secret).
//   3. Giới hạn thời gian (RUN_TIMEOUT_SEC), quá hạn thì kill.
//   4. Môi trường production: chạy trong container Docker cô lập (xem docker-compose.yml).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { getDb } = require('../db');
const config = require('../config');
const params = require('./parameterService');
const ai = require('./ai/aiService');
const testCases = require('./testCaseService');
const runs = require('./runService');
const { badRequest, conflict, notFound, AppError } = require('../utils/errors');

const FORBIDDEN = [
  { re: /require\(\s*['"](?:node:)?(child_process|fs|fs\/promises|net|http|https|os|cluster|worker_threads|vm)['"]\s*\)/, msg: 'không được dùng module hệ thống' },
  { re: /\bprocess\.(env|exit|kill|binding)/, msg: 'không được truy cập process' },
  { re: /\beval\s*\(|new\s+Function\s*\(/, msg: 'không được dùng eval/Function' },
  { re: /\bimport\s*\(/, msg: 'không được import động' },
];

function staticCheck(code) {
  const problems = FORBIDDEN.filter((f) => f.re.test(code)).map((f) => f.msg);
  if (!/require\(['"]@playwright\/test['"]\)/.test(code)) problems.push('phải dùng @playwright/test');
  if (!/\btest\s*\(/.test(code)) problems.push('phải có ít nhất 1 khối test()');
  return problems;
}

function getByTestCase(tcId) {
  return getDb().prepare('SELECT * FROM automation_scripts WHERE test_case_id = ?').get(tcId);
}

async function generate(tcId, userId) {
  const tc = testCases.get(tcId);
  if (tc.status !== 'APPROVED') throw conflict('Chỉ sinh script cho test case đã được duyệt');
  const { code, aiLogId } = await ai.generateScript(tc, tc.base_url, userId);
  const existing = getByTestCase(tcId);
  if (existing) {
    getDb()
      .prepare("UPDATE automation_scripts SET code = ?, ai_log_id = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(code, aiLogId, existing.id);
  } else {
    getDb()
      .prepare('INSERT INTO automation_scripts (test_case_id, code, ai_log_id, created_by) VALUES (?, ?, ?, ?)')
      .run(tcId, code, aiLogId, userId);
  }
  return { ...getByTestCase(tcId), warnings: staticCheck(code) };
}

function save(tcId, code) {
  const s = getByTestCase(tcId);
  if (!s) throw notFound('Test case chưa có script');
  if (typeof code !== 'string' || code.length > 50000) throw badRequest('Script không hợp lệ');
  getDb().prepare("UPDATE automation_scripts SET code = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(code, s.id);
  return { ...getByTestCase(tcId), warnings: staticCheck(code) };
}

function runnerAvailable() {
  return config.runner.enabled && fs.existsSync(path.join(config.runner.dir, 'node_modules', '@playwright', 'test'));
}

function spawnPlaywright(specRelPath, timeoutMs) {
  return new Promise((resolve) => {
    const bin = path.join(config.runner.dir, 'node_modules', '.bin', 'playwright');
    // Biến môi trường tối thiểu: KHÔNG truyền API key, JWT secret... cho script
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, CI: '1' };
    for (const k of ['PW_CHANNEL', 'PLAYWRIGHT_BROWSERS_PATH']) if (process.env[k]) env[k] = process.env[k];
    const child = spawn(bin, ['test', specRelPath, '--reporter=json'], { cwd: config.runner.dir, env });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (codeExit, signal) => {
      clearTimeout(timer);
      resolve({ out, err, codeExit, killed: signal === 'SIGKILL' });
    });
  });
}

function parseReport(out) {
  try {
    const report = JSON.parse(out);
    const results = [];
    const walk = (suite) => {
      (suite.specs || []).forEach((sp) => sp.tests.forEach((t) => t.results.forEach((r) => results.push(r))));
      (suite.suites || []).forEach(walk);
    };
    (report.suites || []).forEach(walk);
    return results;
  } catch {
    return null;
  }
}

async function run(tcId, userId) {
  const tc = testCases.get(tcId);
  if (tc.status !== 'APPROVED') throw conflict('Chỉ chạy test case đã được duyệt (QĐ5)');
  const script = getByTestCase(tcId);
  if (!script) throw notFound('Test case chưa có script, hãy sinh script trước');
  const problems = staticCheck(script.code);
  if (problems.length) throw badRequest(`Script bị chặn vì lý do an toàn: ${problems.join('; ')}`);
  if (!runnerAvailable()) {
    throw new AppError(503, 'Worker chạy test chưa được cài. Chạy: cd automation && npm install');
  }

  const genDir = path.join(config.runner.dir, 'specs', 'generated');
  fs.mkdirSync(genDir, { recursive: true });
  const file = `${tc.code}-${crypto.randomBytes(4).toString('hex')}.spec.js`;
  fs.writeFileSync(path.join(genDir, file), script.code);

  const timeoutMs = params.get('RUN_TIMEOUT_SEC') * 1000;
  const started = Date.now();
  const r = await spawnPlaywright(`specs/generated/${file}`, timeoutMs);
  const duration = Date.now() - started;
  fs.rmSync(path.join(genDir, file), { force: true });

  const results = parseReport(r.out);
  let result = 'BLOCKED';
  let log = '';
  let screenshot = null;
  if (r.killed) {
    log = `Quá thời gian cho phép (${timeoutMs / 1000}s), tiến trình đã bị dừng`;
  } else if (!results || !results.length) {
    log = `Không chạy được script.\n${(r.err || r.out).slice(0, 3000)}`;
  } else {
    const failed = results.find((x) => x.status !== 'passed');
    result = failed ? 'FAIL' : 'PASS';
    log = failed
      ? (failed.error?.message || failed.errors?.[0]?.message || 'Thất bại').replace(/\u001b\[[0-9;]*m/g, '').slice(0, 3000)
      : `Tất cả bước đều đạt (${results[0].duration} ms)`;
    const shot = (failed?.attachments || []).find((a) => a.contentType === 'image/png' && a.path);
    if (shot && fs.existsSync(shot.path)) {
      const shotDir = path.join(__dirname, '..', '..', 'data', 'screenshots');
      fs.mkdirSync(shotDir, { recursive: true });
      const name = `${crypto.randomUUID()}.png`;
      fs.copyFileSync(shot.path, path.join(shotDir, name));
      screenshot = `/screenshots/${name}`;
    }
  }
  return runs.record(tcId, { result, note: `Chạy tự động bằng Playwright` }, userId, {
    run_type: 'AUTO',
    log,
    screenshot,
    duration_ms: duration,
  });
}

module.exports = { generate, save, run, getByTestCase, staticCheck, runnerAvailable };
