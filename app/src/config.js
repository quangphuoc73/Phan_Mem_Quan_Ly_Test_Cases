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

  // YC12: đồng bộ dự án từ Jira Cloud. Để trống JIRA_BASE_URL thì dùng Jira giả lập (dữ liệu mẫu)
  jira: {
    baseUrl: isTest ? '' : (process.env.JIRA_BASE_URL || ''),
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    // QĐ8: mã bí mật Jira gửi kèm webhook (?secret=...); để trống thì tắt webhook
    webhookSecret: isTest ? 'test-secret' : (process.env.JIRA_WEBHOOK_SECRET || ''),
    // Đồng bộ định kỳ mọi dự án Jira (phút); 0 = tắt. Chỉ chạy khi đã cấu hình Jira thật
    syncMinutes: Number(process.env.JIRA_SYNC_MINUTES ?? 5),
    // QĐ1 [B2]: các loại issue được đồng bộ, cách nhau dấu phẩy (mặc định Story)
    issueTypes: String(process.env.JIRA_ISSUE_TYPES || 'Story').split(',').map((s) => s.trim()).filter(Boolean),
    // QĐ8: số lần thử lại khi gọi Jira lỗi
    maxRetry: 2,
  },

  // Ngoài MVP (phụ lục đặc tả, [A3]): YC19 script Playwright, YC20 sprint. Mặc định tắt
  features: {
    script: process.env.SCRIPT_ENABLED === 'true',
    sprint: process.env.SPRINT_ENABLED === 'true',
  },

  runner: {
    // Thư mục project Playwright dùng để chạy script tự động (YC19)
    dir: process.env.RUNNER_DIR || path.join(__dirname, '..', '..', 'automation'),
    enabled: process.env.SCRIPT_ENABLED === 'true' && process.env.RUNNER_ENABLED !== 'false',
  },
};
