const { LLMProvider, stripFences, postJson } = require('./LLMProvider');

class GeminiProvider extends LLMProvider {
  constructor({ apiKey, model }) {
    super({ name: 'gemini', model });
    if (!apiKey) throw new Error('Thiếu GEMINI_API_KEY trong file .env');
    this.apiKey = apiKey;
  }

  async complete({ system, user, jsonSchema, timeoutMs }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    // Structured output: gửi kèm JSON Schema để Gemini buộc trả đúng cấu trúc (VD steps là mảng, type đúng enum)
    const generationConfig = { responseMimeType: 'application/json', temperature: 0.4 };
    if (jsonSchema) generationConfig.responseJsonSchema = jsonSchema;
    const data = await postJson(url, {
      timeoutMs,
      headers: { 'x-goog-api-key': this.apiKey },
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig,
      },
    });
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    return stripFences(text);
  }
}

module.exports = GeminiProvider;
