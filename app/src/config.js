// Cấu hình đọc từ biến môi trường. API key LLM CHỈ nằm ở đây (backend),
// không bao giờ gửi xuống frontend và không commit lên GitHub (.env bị .gitignore).
require('dotenv').config({ quiet: true });
const path = require('path');

const isTest = process.env.NODE_ENV === 'test';

module.exports = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  dbFile: isTest ? ':memory:' : (process.env.DB_FILE || path.join(__dirname, '..', 'data', 'app.db')),

  ai: {
    // mock | gemini | claude | openai
    provider: process.env.AI_PROVIDER || 'mock',
    geminiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    claudeKey: process.env.ANTHROPIC_API_KEY,
    claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
    openaiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    // Độ trễ giả lập của mock (ms) để demo giống gọi API thật
    mockDelayMs: isTest ? 0 : Number(process.env.MOCK_DELAY_MS || 1500),
  },

  // YC13: đồng bộ dự án từ Jira Cloud. Để trống JIRA_BASE_URL thì dùng Jira giả lập (dữ liệu mẫu)
  jira: {
    baseUrl: isTest ? '' : (process.env.JIRA_BASE_URL || ''),
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    // QĐ8: mã bí mật Jira gửi kèm webhook (?secret=...); để trống thì tắt webhook
    webhookSecret: isTest ? 'test-secret' : (process.env.JIRA_WEBHOOK_SECRET || ''),
    // Đồng bộ định kỳ mọi dự án Jira (phút); 0 = tắt. Chỉ chạy khi đã cấu hình Jira thật
    syncMinutes: Number(process.env.JIRA_SYNC_MINUTES ?? 5),
  },

  runner: {
    // Thư mục project Playwright dùng để chạy script tự động (YC10)
    dir: process.env.RUNNER_DIR || path.join(__dirname, '..', '..', 'automation'),
    enabled: process.env.RUNNER_ENABLED !== 'false',
  },
};
