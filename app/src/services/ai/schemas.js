// JSON schema bắt buộc cho kết quả LLM (QĐ2). Kết quả sai schema -> thử lại tối đa AI_MAX_RETRY lần.
const { z } = require('zod');

// Nội dung một test case (BM2) – dùng chung cho test thủ công và test do AI sinh/đề xuất
const testCaseSchema = z.object({
  title: z.string().trim().min(5).max(200),
  precondition: z.string().max(500).optional().default(''),
  steps: z.array(z.string().trim().min(1).max(300)).min(1).max(15), // QĐ2: 1–15 bước
  expected_result: z.string().trim().min(1).max(500),
  priority: z.enum(['High', 'Medium', 'Low']),
  type: z.enum(['Positive', 'Negative', 'Edge']),
});

// YC2: test do AI sinh phải chỉ rõ AC liên quan (số thứ tự AC, bắt đầu từ 1)
const AC_REFS_MSG = 'Test do AI sinh phải chỉ rõ AC liên quan (QĐ2)';
const aiTestCaseSchema = testCaseSchema.extend({
  ac_refs: z.array(z.number().int().min(1), { error: AC_REFS_MSG }).min(1, AC_REFS_MSG),
});

const generateResultSchema = z.object({ test_cases: z.array(aiTestCaseSchema).min(1) });

// YC15 – QĐ15: mỗi đề xuất bắt buộc có loại, lý do và phần thay đổi nguồn [R2]
const proposalSchema = z
  .object({
    type: z.enum(['UPDATE', 'MISSING', 'RERUN', 'CLARIFY']),
    test_code: z.string().trim().min(1).nullable().optional(),
    source_part: z.enum(['AC', 'TITLE', 'DESCRIPTION']),
    source_ac: z.string().trim().max(500).nullable().optional(),
    reason: z.string().trim().min(5).max(1000),
    test_case: testCaseSchema.nullable().optional(),
  })
  .refine((p) => !['UPDATE', 'RERUN'].includes(p.type) || p.test_code, { message: 'Đề xuất Cần sửa / Nên chạy lại phải chỉ ra test liên quan' })
  .refine((p) => !['UPDATE', 'MISSING'].includes(p.type) || p.test_case, { message: 'Đề xuất Cần sửa / Còn thiếu phải có nội dung test đề xuất' })
  .refine((p) => p.source_part !== 'AC' || p.source_ac, { message: 'Đề xuất có nguồn là AC phải ghi rõ AC' });

const impactResultSchema = z.object({ proposals: z.array(proposalSchema) });

// YC17 – QĐ17: AI xếp ưu tiên kèm lý do và gợi ý thêm test
const regressionResultSchema = z.object({
  items: z.array(z.object({
    test_code: z.string().trim().min(1),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    reason: z.string().trim().min(3).max(500),
  })),
  suggestions: z.array(z.object({ test_code: z.string().trim().min(1), reason: z.string().trim().min(3).max(500) })).default([]),
});

// YC19 (ngoài MVP)
const scriptResultSchema = z.object({ code: z.string().min(20) });

// Dạng JSON Schema thuần gửi kèm cho LLM (structured output)
const tcJson = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    precondition: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    expected_result: { type: 'string' },
    priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
    type: { type: 'string', enum: ['Positive', 'Negative', 'Edge'] },
  },
  required: ['title', 'precondition', 'steps', 'expected_result', 'priority', 'type'],
};

const generateJsonSchema = {
  type: 'object',
  properties: {
    test_cases: {
      type: 'array',
      items: { ...tcJson, properties: { ...tcJson.properties, ac_refs: { type: 'array', items: { type: 'integer' } } }, required: [...tcJson.required, 'ac_refs'] },
    },
  },
  required: ['test_cases'],
};

const impactJsonSchema = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['UPDATE', 'MISSING', 'RERUN', 'CLARIFY'] },
          test_code: { type: ['string', 'null'] },
          source_part: { type: 'string', enum: ['AC', 'TITLE', 'DESCRIPTION'] },
          source_ac: { type: ['string', 'null'] },
          reason: { type: 'string' },
          test_case: { anyOf: [tcJson, { type: 'null' }] },
        },
        required: ['type', 'source_part', 'reason'],
      },
    },
  },
  required: ['proposals'],
};

const regressionJsonSchema = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'object', properties: { test_code: { type: 'string' }, priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] }, reason: { type: 'string' } }, required: ['test_code', 'priority', 'reason'] } },
    suggestions: { type: 'array', items: { type: 'object', properties: { test_code: { type: 'string' }, reason: { type: 'string' } }, required: ['test_code', 'reason'] } },
  },
  required: ['items', 'suggestions'],
};

const scriptJsonSchema = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] };

module.exports = {
  testCaseSchema,
  aiTestCaseSchema,
  generateResultSchema,
  impactResultSchema,
  regressionResultSchema,
  scriptResultSchema,
  generateJsonSchema,
  impactJsonSchema,
  regressionJsonSchema,
  scriptJsonSchema,
};
