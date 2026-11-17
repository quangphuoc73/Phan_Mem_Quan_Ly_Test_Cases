const config = require('./config');
const { getDb, legacyBackup } = require('./db');
const { seedIfEmpty } = require('./db/seed');
const { createApp } = require('./app');
const ai = require('./services/ai/aiService');
const jira = require('./services/jiraService');

getDb();
seedIfEmpty();
if (legacyBackup()) {
  console.log(`\n  CSDL kiểu cũ (trước đặc tả 16/11) đã được sao lưu thành: ${legacyBackup()}`);
  console.log('  Đã tạo CSDL mới kèm dữ liệu mẫu; dữ liệu Jira thật lấy lại bằng nút Đồng bộ.');
}

createApp().listen(config.port, () => {
  const info = ai.providerInfo();
  console.log(`\n  AI TestCase Manager đang chạy: http://localhost:${config.port}`);
  console.log(`  AI provider: ${info.provider} (${info.model})${info.error ? ' – ' + info.error : ''}`);
  console.log(`  Jira: ${jira.isMock() ? 'giả lập (chưa cấu hình JIRA_BASE_URL)' : config.jira.baseUrl}\n`);
});

// YC8: đồng bộ định kỳ các dự án Jira (bù cho trường hợp Jira không gọi được webhook vào máy chạy demo)
if (!jira.isMock() && config.jira.syncMinutes > 0) {
  setInterval(() => {
    jira.syncAll(null, 'SCHEDULE').catch((e) => console.error('Đồng bộ Jira định kỳ lỗi:', e.message));
  }, config.jira.syncMinutes * 60 * 1000).unref();
}
