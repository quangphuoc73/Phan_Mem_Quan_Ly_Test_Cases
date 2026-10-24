// JSON schema bắt buộc cho kết quả LLM. Kết quả sai schema -> thử lại.
const { z } = require('zod');

const testCaseSchema = z.object({
  title: z.string().min(5).max(200),
  precondition: z.string().max(500).optional().default(''),
  steps: z.array(z.string().min(1).max(300)).min(1).max(15),
  expected_result: z.string().min(1).max(500),
  priority: z.enum(['High', 'Medium', 'Low']),
  type: z.enum(['Positive', 'Negative', 'Edge']),
});

const generateResultSchema = z.object({
  test_cases: z.array(testCaseSchema).min(1),
});

const scriptResultSchema = z.object({
  code: z.string().min(20),
});

// Dạng JSON Schema thuần để gửi kèm cho LLM (structured output)
const generateJsonSchema = {
  type: 'object',
  properties: {
    test_cases: {
      type: 'array',
      items: {
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
      },
    },
  },
  required: ['test_cases'],
};

const scriptJsonSchema = {
  type: 'object',
  properties: { code: { type: 'string' } },
  required: ['code'],
};

module.exports = {
  testCaseSchema,
  generateResultSchema,
  scriptResultSchema,
  generateJsonSchema,
  scriptJsonSchema,
};
