// YC15 – BM14, QĐ15: AI phân tích ảnh hưởng khi requirement đổi.
// YC16 – BM15, QĐ16: QA Lead rà soát và áp dụng đề xuất AI.
const { getDb } = require('../db');
const stories = require('./storyService');
const testCases = require('./testCaseService');
const regression = require('./regressionService');
const ai = require('./ai/aiService');
const { maskPII } = require('./ai/piiMasker');
const ac = require('../utils/ac');
const { badRequest, conflict, notFound } = require('../utils/errors');

function storyTests(storyId) {
  return getDb()
    .prepare('SELECT * FROM test_cases WHERE story_id = ? ORDER BY code')
    .all(storyId)
    .map((t) => ({ ...t, steps: JSON.parse(t.steps), acs: getDb().prepare('SELECT ac_text FROM test_case_acs WHERE test_case_id = ?').all(t.id).map((r) => r.ac_text) }));
}

// QĐ15 [A5]: mốc so = phiên bản cũ nhất mà các test đã liên kết; requirement chưa có test thì so phiên bản liền trước.
// Mốc được nâng lên khi test được xem lại hoặc sửa xong (QĐ3 [R5])
function baseline(story, tests) {
  const linked = tests.map((t) => t.req_version).filter((v) => v < story.current_version);
  if (linked.length) return Math.min(...linked);
  return tests.length ? story.current_version : story.current_version - 1;
}

async function analyze(storyId, userId) {
  const story = stories.get(storyId);
  if (story.archived) throw conflict('Requirement đã lưu trữ, không phân tích được');
  if (story.current_version < 2) throw conflict('Requirement cần có ít nhất 2 phiên bản mới phân tích được (QĐ15)');
  const tests = storyTests(storyId);
  const from = baseline(story, tests);
  if (from >= story.current_version) throw conflict('Mọi test đã được xem lại theo phiên bản hiện tại, không còn thay đổi để phân tích (QĐ15)');
  const before = stories.version(storyId, from);
  const after = stories.version(storyId, story.current_version);

  // Với từng test chỉ xét thay đổi sau phiên bản mà test đó đã liên kết (QĐ15)
  const input = tests.map((t) => {
    const base = stories.version(storyId, Math.max(t.req_version, from));
    const d = ac.diff(base.acceptance_criteria, after.acceptance_criteria);
    return {
      code: t.code, title: t.title, steps: t.steps, expected_result: t.expected_result, priority: t.priority, type: t.type,
      req_version: t.req_version, acs: t.acs,
      since: { removed: d.removed, added: d.added, content: base.title !== after.title || base.description !== after.description },
    };
  });
  const r = await ai.analyzeImpact({
    story,
    before: { version: before.version, title: before.title, description: before.description, acs: before.acs },
    after: { version: after.version, title: after.title, description: after.description, acs: after.acs },
    tests: input,
  }, userId);

  // AC trong kết quả AI có thể là bản đã che dữ liệu: đổi lại nguyên văn AC thật
  const realAcs = [...new Set([...after.acs, ...before.acs])];
  const realAc = (text) => (text ? realAcs.find((a) => a === text || maskPII(a).masked === text) || ac.normalize(text) : null);
  const byCode = new Map(tests.map((t) => [t.code, t]));
  const dropped = [];
  const db = getDb();
  const analysisId = db.transaction(() => {
    const id = Number(
      db.prepare('INSERT INTO impact_analyses (story_id, from_version, to_version, user_id, ai_log_id) VALUES (?, ?, ?, ?, ?)')
        .run(storyId, from, story.current_version, userId, r.aiLogId).lastInsertRowid
    );
    const ins = db.prepare(
      `INSERT INTO ai_proposals (analysis_id, story_id, type, test_case_id, source_part, source_ac, content, reason, req_version, tc_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of r.proposals) {
      const tc = p.test_code ? byCode.get(p.test_code) : null;
      if (p.test_code && !tc) {
        dropped.push({ ...p, why: 'Test không thuộc requirement' });
        continue;
      }
      ins.run(id, storyId, p.type, tc?.id ?? null, p.source_part, p.source_part === 'AC' ? realAc(p.source_ac) : null,
        p.test_case ? JSON.stringify(p.test_case) : null, p.reason, story.current_version, tc?.version ?? null);
    }
    return id;
  })();
  return { analysis: getAnalysis(analysisId), dropped, piiFound: r.piiFound, injectionWarning: r.injection };
}

function getAnalysis(id) {
  const a = getDb()
    .prepare(
      `SELECT a.*, u.full_name user_name, s.code story_code FROM impact_analyses a JOIN users u ON u.id = a.user_id
       JOIN user_stories s ON s.id = a.story_id WHERE a.id = ?`
    )
    .get(id);
  if (!a) throw notFound('Không tìm thấy lần phân tích');
  return { ...a, proposals: list({ analysis_id: id }) };
}

function list({ story_id, status, analysis_id, project_id } = {}) {
  const where = [];
  const args = [];
  if (story_id) (where.push('p.story_id = ?'), args.push(story_id));
  if (status) (where.push('p.status = ?'), args.push(status));
  if (analysis_id) (where.push('p.analysis_id = ?'), args.push(analysis_id));
  if (project_id) (where.push('s.project_id = ?'), args.push(project_id));
  return getDb()
    .prepare(
      `SELECT p.*, t.code tc_code, t.title tc_title, t.steps tc_steps, t.expected_result tc_expected, t.precondition tc_precondition,
        t.priority tc_priority, t.type tc_type, s.code story_code, u.full_name decided_by_name, rt.code result_tc_code
       FROM ai_proposals p JOIN user_stories s ON s.id = p.story_id LEFT JOIN test_cases t ON t.id = p.test_case_id
       LEFT JOIN users u ON u.id = p.decided_by LEFT JOIN test_cases rt ON rt.id = p.result_test_case_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.id DESC`
    )
    .all(...args)
    .map((p) => ({
      ...p,
      content: p.content ? JSON.parse(p.content) : null,
      // BM15: nội dung trước (test hiện tại) và sau (đề xuất)
      before: p.tc_code ? { title: p.tc_title, precondition: p.tc_precondition, steps: JSON.parse(p.tc_steps), expected_result: p.tc_expected, priority: p.tc_priority, type: p.tc_type } : null,
    }));
}

function getProposal(id) {
  const p = list({}).find((x) => x.id === Number(id));
  if (!p) throw notFound('Không tìm thấy đề xuất');
  return p;
}

// YC16 – QĐ16: chỉ QA Lead (middleware). Từ chối bắt buộc ghi chú. Trước khi áp dụng kiểm tra phiên bản requirement
// và test; đã đổi so với lúc phân tích thì đề xuất chuyển Lỗi thời và không áp dụng được.
async function decide(id, { decision, note } = {}, userId) {
  const p = getProposal(id);
  if (p.status !== 'PENDING') throw conflict('Đề xuất đã được xử lý');
  const db = getDb();
  const done = (status, resultTc) =>
    db.prepare("UPDATE ai_proposals SET status = ?, decided_by = ?, decided_at = datetime('now','localtime'), note = ?, result_test_case_id = ? WHERE id = ?")
      .run(status, userId, note || null, resultTc ?? null, id);

  if (decision === 'REJECT') {
    if (!String(note || '').trim()) throw badRequest('Từ chối đề xuất bắt buộc có ghi chú (QĐ16)');
    done('REJECTED');
    return getProposal(id);
  }
  if (decision !== 'ACCEPT') throw badRequest('Quyết định phải là ACCEPT hoặc REJECT');

  const story = stories.get(p.story_id);
  const tc = p.test_case_id ? db.prepare('SELECT * FROM test_cases WHERE id = ?').get(p.test_case_id) : null;
  if (story.current_version !== p.req_version || (p.tc_version != null && (!tc || tc.version !== p.tc_version))) {
    done('OUTDATED');
    throw conflict('Requirement hoặc test đã đổi so với lúc phân tích; đề xuất chuyển sang Lỗi thời (QĐ16)');
  }

  let resultTc = null;
  if (p.type === 'UPDATE') {
    // Cần sửa: sửa test theo đề xuất, test quay về Nháp như khi sửa thủ công (QĐ3) [R4]
    const keep = testCases.get(tc.id).acs.filter((a) => story.acs.includes(a));
    const acs = [...new Set([...keep, ...(p.source_ac && story.acs.includes(p.source_ac) ? [p.source_ac] : [])])];
    resultTc = testCases.update(tc.id, { ...p.content, acs, change_note: `Sửa theo đề xuất AI #${p.id}` }, userId, { proposalId: p.id }).id;
  } else if (p.type === 'MISSING') {
    // Còn thiếu: tạo test nháp mới nguồn AI trong giới hạn QĐ2, liên kết AC nguồn
    const acs = p.source_ac && story.acs.includes(p.source_ac) ? [p.source_ac] : [];
    resultTc = testCases.create({ ...p.content, story_id: story.id, acs }, story, userId,
      { source: 'AI', proposalId: p.id, note: `Tạo từ đề xuất AI #${p.id}` }).id;
  } else if (p.type === 'RERUN') {
    await regression.addFromProposal(p, userId);
  }
  // CLARIFY: chỉ ghi nhận để trao đổi với PO/BA trên Jira
  done('ACCEPTED', resultTc);
  return getProposal(id);
}

module.exports = { analyze, getAnalysis, list, getProposal, decide };
