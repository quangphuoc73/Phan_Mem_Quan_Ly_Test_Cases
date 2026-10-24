const config = require('./config');
const { getDb } = require('./db');
const { seedIfEmpty } = require('./db/seed');
const { createApp } = require('./app');
const ai = require('./services/ai/aiService');

getDb();
seedIfEmpty();

createApp().listen(config.port, () => {
  const info = ai.providerInfo();
  console.log(`\n  AI TestCase Manager đang chạy: http://localhost:${config.port}`);
  console.log(`  AI provider: ${info.provider} (${info.model})${info.error ? ' – ' + info.error : ''}\n`);
});
