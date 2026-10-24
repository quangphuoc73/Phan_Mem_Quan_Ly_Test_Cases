// AI Service: module DUY NHẤT làm việc với LLM.
// Trách nhiệm: che PII -> ghép prompt -> gọi LLM -> kiểm tra schema -> thử lại
// -> ghi nhật ký ai_logs. Các tầng khác không biết đang dùng model nào.
const { getDb } = require('../../db');
const params = require('../parameterService');
const { maskPII } = require('./piiMasker');
const { detectInjection } = require('./injectionGuard');
const { buildTestCasePrompt, buildScriptPrompt } = require('./promptBuilder');
const {
  generateResultSchema,
  scriptResultSchema,
  generateJsonSchema,
  scriptJsonSchema,
} = require('./schemas');
const { createProvider } = require('./providers');
const { AppError } = require('../../utils/errors');

let provider;
function getProvider() {
  if (!provider) provider = createProvider();
  return provider;
}
// Cho phép test/cấu hình thay provider lúc chạy
function setProvider(p) {
  provider = p;
}

function maskFields(obj, fields) {
  const found = {};
  const out = { ...obj };
  for (const f of fields) {
    const r = maskPII(obj[f]);
    out[f] = r.masked;
    for (const [k, v] of Object.entries(r.found)) found[k] = (found[k] || 0) + v;
  }
  return { out, found };
}

function insertLog(entry) {
  const info = getDb()
    .prepare(
      `INSERT INTO ai_logs (story_id, test_case_id, user_id, task, provider, model, prompt_masked,
        pii_found, injection_flag, raw_output, status, attempts, duration_ms, error)
       VALUES (@story_id, @test_case_id, @user_id, @task, @provider, @model, @prompt_masked,
        @pii_found, @injection_flag, @raw_output, @status, @attempts, @duration_ms, @error)`
    )
    .run(entry);
  return info.lastInsertRowid;
}

// Gọi LLM có thử lại khi kết quả không đúng schema hoặc lỗi mạng
async function callWithRetry({ task, prompt, context, jsonSchema, zodSchema, refine }) {
  const p = getProvider();
  const maxRetry = params.get('AI_MAX_RETRY');
  const timeoutMs = params.get('AI_TIMEOUT_SEC') * 1000;
  let attempts = 0;
  let raw = null;
  let lastError;
  const started = Date.now();

  while (attempts <= maxRetry) {
    attempts += 1;
    try {
      raw = await p.complete({ ...prompt, task, context, jsonSchema, timeoutMs });
      const parsed = zodSchema.parse(JSON.parse(raw));
      return { ok: true, data: refine ? refine(parsed) : parsed, raw, attempts, durationMs: Date.now() - started, p };
    } catch (err) {
      lastError = err.name === 'ZodError' ? `Kết quả AI sai định dạng: ${err.issues?.[0]?.message}` : err.message;
    }
  }
  return { ok: false, raw, attempts, durationMs: Date.now() - started, error: lastError, p };
}

async function generateTestCases(story, userId) {
  const maxTestCases = params.get('MAX_TC_PER_STORY');
  const { out: masked, found } = maskFields(story, ['title', 'description', 'acceptance_criteria']);
  const injection = detectInjection(`${story.title}\n${story.description}\n${story.acceptance_criteria}`);
  const prompt = buildTestCasePrompt({ story: masked, maxTestCases });

  const r = await callWithRetry({
    task: 'GENERATE_TESTCASE',
    prompt,
    context: { story: masked, maxTestCases },
    jsonSchema: generateJsonSchema,
    zodSchema: generateResultSchema,
    // QĐ2: nếu model vẫn sinh quá số lượng thì hệ thống tự cắt bớt
    refine: (d) => ({ test_cases: d.test_cases.slice(0, maxTestCases) }),
  });

  const logId = insertLog({
    story_id: story.id,
    test_case_id: null,
    user_id: userId,
    task: 'GENERATE_TESTCASE',
    provider: r.p.name,
    model: r.p.model,
    prompt_masked: `[SYSTEM]\n${prompt.system}\n\n[USER]\n${prompt.user}`,
    pii_found: JSON.stringify(found),
    injection_flag: injection ? 1 : 0,
    raw_output: r.raw,
    status: r.ok ? 'SUCCESS' : 'FAILED',
    attempts: r.attempts,
    duration_ms: r.durationMs,
    error: r.ok ? null : r.error,
  });

  if (!r.ok) {
    throw new AppError(502, 'AI chưa sinh được test case hợp lệ, vui lòng thử lại hoặc viết thủ công.', {
      aiLogId: logId,
      reason: r.error,
    });
  }
  return { testCases: r.data.test_cases, aiLogId: logId, piiFound: found, injection, durationMs: r.durationMs };
}

async function generateScript(testCase, baseUrl, userId) {
  const { out: masked, found } = maskFields(testCase, ['title', 'precondition', 'expected_result']);
  masked.steps = testCase.steps.map((s) => maskPII(s).masked);
  const injection = detectInjection(JSON.stringify(testCase));
  const prompt = buildScriptPrompt({ testCase: masked, baseUrl });

  const r = await callWithRetry({
    task: 'GENERATE_SCRIPT',
    prompt,
    context: { testCase: masked, baseUrl },
    jsonSchema: scriptJsonSchema,
    zodSchema: scriptResultSchema,
  });

  const logId = insertLog({
    story_id: testCase.story_id,
    test_case_id: testCase.id,
    user_id: userId,
    task: 'GENERATE_SCRIPT',
    provider: r.p.name,
    model: r.p.model,
    prompt_masked: `[SYSTEM]\n${prompt.system}\n\n[USER]\n${prompt.user}`,
    pii_found: JSON.stringify(found),
    injection_flag: injection ? 1 : 0,
    raw_output: r.raw,
    status: r.ok ? 'SUCCESS' : 'FAILED',
    attempts: r.attempts,
    duration_ms: r.durationMs,
    error: r.ok ? null : r.error,
  });

  if (!r.ok) throw new AppError(502, 'AI chưa sinh được script hợp lệ, vui lòng thử lại.', { aiLogId: logId });
  return { code: r.data.code, aiLogId: logId };
}

function providerInfo() {
  try {
    const p = getProvider();
    return { provider: p.name, model: p.model };
  } catch (e) {
    return { provider: 'unavailable', model: '-', error: e.message };
  }
}

module.exports = { generateTestCases, generateScript, setProvider, providerInfo };
