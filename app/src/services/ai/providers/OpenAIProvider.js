const { LLMProvider, stripFences, postJson } = require('./LLMProvider');

class OpenAIProvider extends LLMProvider {
  constructor({ apiKey, model }) {
    super({ name: 'openai', model });
    if (!apiKey) throw new Error('Thiếu OPENAI_API_KEY trong file .env');
    this.apiKey = apiKey;
  }

  async complete({ system, user, timeoutMs }) {
    const data = await postJson('https://api.openai.com/v1/chat/completions', {
      timeoutMs,
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: {
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
    });
    return stripFences(data?.choices?.[0]?.message?.content || '');
  }
}

module.exports = OpenAIProvider;
