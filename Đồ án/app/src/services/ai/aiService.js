// AI Service: module DUY NHẤT làm việc với LLM.
// Trách nhiệm: che dữ liệu nhạy cảm -> ghép prompt -> gọi LLM -> kiểm tra schema -> thử lại
// -> ghi nhật ký ai_logs. Các tầng khác không biết đang dùng model nào.
// Tác vụ: GENERATE_TESTCASE (YC2), ANALYZE_IMPACT (YC15), RANK_REGRESSION (YC17), GENERATE_SCRIPT (YC19, ngoài MVP)
const { getDb } = require('../../db');
const params = require('../parameterService');
const { maskPII } = require('./piiMasker');
const { detectInjection } = require('./injectionGuard');
const prompts = require('./promptBuilder');
const S = require('./schemas');
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

// Che dữ liệu nhạy cảm trong mọi chuỗi của một đối tượng (đệ quy), đếm loại dữ liệu đã che
function maskDeep(value, found = {}) {
  if (typeof value === 'string') {
    const r = maskPII(value);
    for (const [k, v] of Object.entries(r.found)) found[k] = (found[k] || 0) + v;
    return r.masked;
  }
  if (Array.isArray(value)) return value.map((v) => maskDeep(v, found));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskDeep(v, found)]));
  return value;
}

function insertLog(entry) {
  return Number(
    getDb()
      .prepare(
        `INSERT INTO ai_logs (story_id, test_case_id, user_id, task, provider, model, prompt_masked,
          pii_found, injection_flag, raw_output, status, attempts, duration_ms, error)
         VALUES (@story_id, @test_case_id, @user_id, @task, @provider, @model, @prompt_masked,
          @pii_found, @injection_flag, @raw_output, @status, @attempts, @duration_ms, @error)`
      )
      .run(entry).lastInsertRowid
  );
}

// Gọi LLM có thử lại khi kết quả không đúng schema hoặc lỗi mạng (QĐ2)
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
      const issue = err.issues?.[0];
      lastError = err.name === 'ZodError'
        ? `Kết quả AI sai định dạng (${issue?.path?.join('.') || 'gốc'}): ${issue?.message}`
        : err.message;
    }
  }
  return { ok: false, raw, attempts, durationMs: Date.now() - started, error: lastError, p };
}

// Khung chung: che dữ liệu, dò prompt injection, gọi LLM, ghi nhật ký (mọi lần chạy đều được ghi – QĐ15)
async function run({ task, storyId, testCaseId, userId, input, injectionText, buildPrompt, jsonSchema, zodSchema, refine }) {
  const found = {};
  const masked = maskDeep(input, found);
  const injection = detectInjection(injectionText);
  const prompt = buildPrompt(masked);
  const r = await callWithRetry({ task, prompt, context: masked, jsonSchema, zodSchema, refine });
  const aiLogId = insertLog({
    story_id: storyId ?? null,
    test_case_id: testCaseId ?? null,
    user_id: userId,
    task,
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
  return { ...r, aiLogId, piiFound: found, injection };
}

// YC2 – QĐ2
async function generateTestCases(story, userId) {
  const maxTestCases = params.get('MAX_TC_PER_STORY');
  const r = await run({
    task: 'GENERATE_TESTCASE',
    storyId: story.id,
    userId,
    input: { story: { code: story.code, title: story.title, description: story.description, acceptance_criteria: story.acceptance_criteria, acs: story.acs }, maxTestCases },
    injectionText: `${story.title}\n${story.description}\n${story.acceptance_criteria}`,
    buildPrompt: (m) => prompts.buildTestCasePrompt(m),
    jsonSchema: S.generateJsonSchema,
    zodSchema: S.generateResultSchema,
    refine: (d) => ({ test_cases: d.test_cases.slice(0, maxTestCases) }), // model sinh quá số lượng thì cắt bớt
  });
  if (!r.ok) {
    throw new AppError(502, 'AI chưa sinh được test case hợp lệ, vui lòng thử lại hoặc viết thủ công.', { aiLogId: r.aiLogId, reason: r.error });
  }
  return { testCases: r.data.test_cases, aiLogId: r.aiLogId, piiFound: r.piiFound, injection: r.injection, durationMs: r.durationMs };
}

// YC15 – QĐ15: input { story, before, after, tests[] } (tests có acs, req_version, since)
async function analyzeImpact(input, userId) {
  const r = await run({
    task: 'ANALYZE_IMPACT',
    storyId: input.story.id,
    userId,
    input: { before: input.before, after: input.after, tests: input.tests },
    injectionText: JSON.stringify([input.before, input.after]),
    buildPrompt: (m) => prompts.buildImpactPrompt(m),
    jsonSchema: S.impactJsonSchema,
    zodSchema: S.impactResultSchema,
  });
  if (!r.ok) throw new AppError(502, 'AI chưa phân tích được ảnh hưởng, vui lòng thử lại.', { aiLogId: r.aiLogId, reason: r.error });
  return { proposals: r.data.proposals, aiLogId: r.aiLogId, piiFound: r.piiFound, injection: r.injection };
}

// YC17 – QĐ17: lỗi AI không chặn nghiệp vụ, trả ok=false để hệ thống vẫn đưa ra danh sách test liên kết
async function rankRegression(input, userId) {
  try {
    const r = await run({
      task: 'RANK_REGRESSION',
      storyId: input.story.id,
      userId,
      input: { after: input.after, mandatory: input.mandatory, candidates: input.candidates },
      injectionText: JSON.stringify(input.after),
      buildPrompt: (m) => prompts.buildRegressionPrompt(m),
      jsonSchema: S.regressionJsonSchema,
      zodSchema: S.regressionResultSchema,
    });
    return r.ok ? { ok: true, ...r.data, aiLogId: r.aiLogId } : { ok: false, aiLogId: r.aiLogId, error: r.error };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// YC19 (ngoài MVP)
async function generateScript(testCase, baseUrl, userId) {
  const r = await run({
    task: 'GENERATE_SCRIPT',
    storyId: testCase.story_id,
    testCaseId: testCase.id,
    userId,
    input: { testCase: { code: testCase.code, title: testCase.title, precondition: testCase.precondition, steps: testCase.steps, expected_result: testCase.expected_result }, baseUrl },
    injectionText: JSON.stringify(testCase),
    buildPrompt: (m) => prompts.buildScriptPrompt(m),
    jsonSchema: S.scriptJsonSchema,
    zodSchema: S.scriptResultSchema,
  });
  if (!r.ok) throw new AppError(502, 'AI chưa sinh được script hợp lệ, vui lòng thử lại.', { aiLogId: r.aiLogId });
  return { code: r.data.code, aiLogId: r.aiLogId };
}

function providerInfo() {
  try {
    const p = getProvider();
    return { provider: p.name, model: p.model };
  } catch (e) {
    return { provider: 'unavailable', model: '-', error: e.message };
  }
}

module.exports = { generateTestCases, analyzeImpact, rankRegression, generateScript, setProvider, providerInfo };
