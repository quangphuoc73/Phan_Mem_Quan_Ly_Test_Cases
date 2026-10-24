// Chụp ảnh màn hình hệ thống cho báo cáo và slide.
// Cần server đang chạy ở http://localhost:3000 với dữ liệu mẫu mới (npm run reset).
// Chạy: cd automation && node tools/screenshots.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { chromium } = require('@playwright/test');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const OUT = path.join(__dirname, '..', '..', 'docs', 'images');
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

async function login(page, user, pass) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await page.getByLabel('Tên đăng nhập').fill(user);
  await page.getByLabel('Mật khẩu').fill(pass);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('heading', { name: 'Tổng quan & báo cáo' }).waitFor();
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL === 'chromium' ? undefined : 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  await page.goto(BASE);
  await shot(page, '01_dang_nhap');

  await login(page, 'tester', 'Tester@123');
  await page.waitForTimeout(800);
  await shot(page, '02_tong_quan');

  await page.goto(`${BASE}/#/stories`);
  await page.getByRole('cell', { name: 'US-PET-004', exact: true }).waitFor();
  await shot(page, '03_user_story');

  await page.getByRole('cell', { name: 'US-PET-004', exact: true }).click();
  await page.getByRole('button', { name: /Sinh test case bằng AI/ }).click();
  await page.getByText(/AI đã sinh \d+ test case/).waitFor();
  await shot(page, '04_ai_sinh_test_case');

  await page.getByRole('link', { name: /Xem nhật ký AI/ }).click();
  await page.getByRole('cell', { name: 'US-PET-004', exact: true }).first().click();
  await page.getByRole('dialog').waitFor();
  await shot(page, '05_nhat_ky_ai_che_pii');
  await page.getByRole('button', { name: 'Đóng' }).click();

  await page.goto(`${BASE}/#/stories`);
  await page.getByRole('cell', { name: 'US-PET-004', exact: true }).click();
  await page.getByRole('cell', { name: 'US-PET-004-TC01', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Sửa/ }).click();
  await dialog.getByLabel(/Tiêu đề/).fill('Danh sách yêu cầu bồi thường sắp xếp theo ngày gửi mới nhất');
  await dialog.getByLabel(/Ghi chú thay đổi/).fill('Cụ thể hóa tiêu đề');
  await dialog.getByRole('button', { name: 'Lưu phiên bản mới' }).click();
  await dialog.getByRole('button', { name: /Lịch sử/ }).click();
  await dialog.getByText('So sánh bản đầu').waitFor();
  await shot(page, '06_lich_su_phien_ban');
  await dialog.getByRole('button', { name: 'Đóng' }).click();

  await page.getByLabel('Chọn tất cả').check();
  await page.getByRole('button', { name: /Gửi duyệt mục đã chọn/ }).click();
  await page.getByText(/Đã gửi duyệt/).waitFor();

  await login(page, 'qalead', 'QaLead@123');
  await page.getByRole('link', { name: /Duyệt test case/ }).click();
  await page.getByRole('cell', { name: 'US-PET-004-TC01', exact: true }).waitFor();
  await shot(page, '07_hang_doi_duyet');

  await page.goto(`${BASE}/#/testcases`);
  await page.getByPlaceholder('Tìm mã hoặc tiêu đề...').fill('US-SAU-001-TC01');
  await page.getByRole('cell', { name: 'US-SAU-001-TC01', exact: true }).click();
  await dialog.getByRole('button', { name: /Script Playwright/ }).click();
  await dialog.getByRole('button', { name: /Sinh script Playwright bằng AI/ }).click();
  await dialog.locator('#sc-code').waitFor();
  await dialog.getByRole('button', { name: /Chạy tự động/ }).click();
  await dialog.getByText(/Kết quả: /).waitFor({ timeout: 60000 });
  await shot(page, '08_playwright_chay_tu_dong');
  await dialog.getByRole('button', { name: 'Đóng' }).click();

  await page.getByRole('link', { name: /Thay đổi quy định/ }).click();
  await page.getByLabel('MAX_TC_PER_STORY').waitFor();
  await shot(page, '09_thay_doi_quy_dinh');

  await page.getByRole('link', { name: /Tổng quan/ }).click();
  await page.waitForTimeout(800);
  await shot(page, '10_bao_cao');

  // Trang Sprint (Agile) của dự án PETINS – sprint đang chạy và Sprint 1 đã kết thúc
  await page.getByLabel('Dự án').selectOption({ label: 'PETINS – App bảo hiểm thú cưng' });
  await page.getByRole('link', { name: /Sprint \(Agile\)/ }).click();
  await page.getByRole('button', { name: 'Sprint 1', exact: true }).click();
  await page.getByRole('heading', { name: /Burndown chart – Sprint 1/ }).waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '11_sprint.png'), fullPage: true });

  await browser.close();
  console.log(`Đã lưu ảnh vào ${OUT}`);
})();
