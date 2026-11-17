const { LLMProvider, stripFences, postJson } = require('./LLMProvider');

class ClaudeProvider extends LLMProvider {
  constructor({ apiKey, model }) {
    super({ name: 'claude', model });
    if (!apiKey) throw new Error('Thiếu ANTHROPIC_API_KEY trong file .env');
    this.apiKey = apiKey;
  }

  async complete({ system, user, timeoutMs }) {
    const data = await postJson('https://api.anthropic.com/v1/messages', {
      timeoutMs,
      headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: {
        model: this.model,
        max_tokens: 8000,
        system,
        messages: [{ role: 'user', content: user }],
      },
    });
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    return stripFences(text);
  }
}

module.exports = ClaudeProvider;
