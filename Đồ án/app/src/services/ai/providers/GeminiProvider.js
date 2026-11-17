const { LLMProvider, stripFences, postJson } = require('./LLMProvider');

class GeminiProvider extends LLMProvider {
  constructor({ apiKey, model }) {
    super({ name: 'gemini', model });
    if (!apiKey) throw new Error('Thiếu GEMINI_API_KEY trong file .env');
    this.apiKey = apiKey;
  }

  async complete({ system, user, timeoutMs }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const data = await postJson(url, {
      timeoutMs,
      headers: { 'x-goog-api-key': this.apiKey },
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      },
    });
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    return stripFences(text);
  }
}

module.exports = GeminiProvider;
