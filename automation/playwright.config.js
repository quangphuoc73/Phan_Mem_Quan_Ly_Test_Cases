// Cấu hình Playwright cho worker chạy test tự động (YC9).
// Đọc biến môi trường từ file .env (mẫu: .env.example); mọi biến đều có giá trị mặc định.
// Mặc định dùng Google Chrome đã cài trên máy (channel: 'chrome') nên không cần
// tải thêm trình duyệt. Trong Docker/CI dùng Chromium của Playwright (PW_CHANNEL=chromium).
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const { defineConfig, devices } = require('@playwright/test');

const num = (v, def) => (v === undefined || v === '' ? def : Number(v));

module.exports = defineConfig({
  testDir: './specs',
  timeout: num(process.env.TEST_TIMEOUT, 30_000),
  expect: { timeout: num(process.env.EXPECT_TIMEOUT, 5_000) },
  fullyParallel: true,
  retries: num(process.env.RETRIES, 0),
  workers: num(process.env.WORKERS, undefined),
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.BASE_URL || 'https://www.saucedemo.com/',
    headless: !process.env.HEADED,
    launchOptions: { slowMo: num(process.env.SLOW_MO, 0) },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Quay video cần ffmpeg: chạy 'npx playwright install ffmpeg' rồi đặt VIDEO=1
    video: process.env.VIDEO ? 'retain-on-failure' : 'off',
    testIdAttribute: 'data-test',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PW_CHANNEL === 'chromium' ? {} : { channel: 'chrome' }),
      },
    },
  ],
});
