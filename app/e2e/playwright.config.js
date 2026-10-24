// E2E test cho CHÍNH hệ thống AI TestCase Manager (giai đoạn Kiểm chứng).
// Playwright tự khởi động server với CSDL riêng (data/e2e.db) và dữ liệu mẫu mới.
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const PORT = 3100;
const root = path.join(__dirname, '..');
// Nạp app/.env để đọc HEADED, PW_CHANNEL (process Playwright không tự đọc .env).
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });

module.exports = defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1, // các kịch bản nối tiếp nhau trên cùng dữ liệu
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(root, 'e2e-report') }]],
  outputDir: path.join(root, 'e2e-results'),
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'vi-VN',
    headless: !process.env.HEADED,
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], ...(process.env.PW_CHANNEL === 'chromium' ? {} : { channel: 'chrome' }) },
    },
  ],
  webServer: {
    command: 'node src/db/seed.js --reset && node src/server.js',
    cwd: root,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    env: { PORT: String(PORT), DB_FILE: path.join(root, 'data', 'e2e.db'), AI_PROVIDER: 'mock', MOCK_DELAY_MS: '300', RUNNER_ENABLED: 'false' },
  },
});
