// Factory chọn provider theo cấu hình AI_PROVIDER.
const config = require('../../../config');
const MockProvider = require('./MockProvider');
const GeminiProvider = require('./GeminiProvider');
const ClaudeProvider = require('./ClaudeProvider');
const OpenAIProvider = require('./OpenAIProvider');

function createProvider(name = config.ai.provider) {
  const ai = config.ai;
  switch (name) {
    case 'gemini':
      return new GeminiProvider({ apiKey: ai.geminiKey, model: ai.geminiModel });
    case 'claude':
      return new ClaudeProvider({ apiKey: ai.claudeKey, model: ai.claudeModel });
    case 'openai':
      return new OpenAIProvider({ apiKey: ai.openaiKey, model: ai.openaiModel });
    case 'mock':
      return new MockProvider({ delayMs: ai.mockDelayMs });
    default:
      throw new Error(`AI_PROVIDER không hợp lệ: ${name}`);
  }
}

module.exports = { createProvider };
