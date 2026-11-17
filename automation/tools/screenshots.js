// Chụp ảnh màn hình hệ thống cho báo cáo và slide (theo đặc tả chốt 16/11/2026).
// Cần server đang chạy với dữ liệu mẫu mới (npm run reset), Jira giả lập và AI giả lập.
// Chạy: cd automation && APP_URL=http://localhost:3000 node tools/screenshots.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { chromium } = require('@playwright/test');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const OUT = path.join(__dirname, '..', '..', 'docs', 'images');
const HRM = 'HRM – Hệ thống quản lý nhân sự';
const PASS = { admin: 'Admin@123', qalead: 'QaLead@123', tester: 'Tester@123', dev: 'Dev@123456' };
const shot = async (page, name, fullPage = false, clean = false) => {
  if (clean) await page.evaluate(() => document.querySelectorAll('#toast-root .toast').forEach((t) => t.remove()));
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
};

async function login(page, user) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await page.getByLabel('Tên đăng nhập').fill(user);
  await page.getByLabel('Mật khẩu').fill(PASS[user]);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('heading', { name: 'Tổng quan & báo cáo' }).waitFor();
}

async function openStory(page, code) {
  await page.goto(`${BASE}/#/stories`);
  await page.getByRole('cell', { name: code, exact: true }).click();
  await page.getByRole('heading', { level: 1 }).filter({ hasText: code }).waitFor();
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL === 'chromium' ? undefined : 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const dialog = page.getByRole('dialog');

  await page.goto(BASE);
  await shot(page, '01_dang_nhap');

  // Admin thêm dự án HRM từ Jira giả lập
  await login(page, 'admin');
  await page.getByRole('link', { name: /Dự án & module/ }).click();
  await page.getByRole('button', { name: /Thêm dự án từ Jira/ }).click();
  await dialog.getByLabel(/Mã dự án/).fill('HRM');
  await dialog.getByRole('button', { name: 'Thêm dự án' }).click();
  await page.getByText(/HRM: \d+ requirement mới/).waitFor();
  await page.waitForTimeout(600);
  await shot(page, '12_du_an_jira');

  // Tester: requirement, AI sinh test, nhật ký AI
  await login(page, 'tester');
  await page.getByLabel('Dự án', { exact: true }).selectOption({ label: HRM });
  await page.getByRole('link', { name: /Requirement/ }).click();
  await page.getByRole('cell', { name: 'HRM-1', exact: true }).waitFor();
  await shot(page, '03_requirement');
  await openStory(page, 'HRM-1');
  await page.getByRole('button', { name: /Sinh test case bằng AI/ }).click();
  await page.getByText(/AI đã sinh \d+ test case/).waitFor();
  await shot(page, '04_ai_sinh_test_case');
  await page.goto(`${BASE}/#/ai-logs`);
  await page.getByRole('cell', { name: 'HRM-1', exact: true }).first().click();
  await dialog.waitFor();
  await shot(page, '05_nhat_ky_ai_che_pii');
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await openStory(page, 'HRM-1');
  await page.getByLabel('Chọn tất cả').check();
  await page.getByRole('button', { name: /Gửi duyệt mục đã chọn/ }).click();
  await page.getByText(/Đã gửi duyệt/).waitFor();

  // QA Lead: hàng đợi duyệt, duyệt, lập Test Run
  await login(page, 'qalead');
  await page.getByRole('link', { name: /Duyệt test case/ }).click();
  await page.getByRole('cell', { name: 'HRM-1-TC01', exact: true }).waitFor();
  await shot(page, '07_hang_doi_duyet');
  await page.getByLabel('Chọn tất cả').check();
  await page.getByRole('button', { name: /Duyệt tất cả mục đã chọn/ }).click();
  await page.getByText('Không có test case nào chờ duyệt').waitFor();

  await page.getByRole('link', { name: /Test Run/ }).click();
  await page.getByRole('button', { name: /Lập Test Run/ }).click();
  await dialog.getByLabel('Dự án *').selectOption({ label: HRM });
  await dialog.getByLabel(/HRM-1-TC01/).waitFor();
  await dialog.getByLabel('Tên đợt *').fill('Nghỉ phép – build 1.0.0');
  await dialog.getByLabel('Build đang kiểm thử *').fill('1.0.0');
  await dialog.getByLabel('Môi trường *').fill('Staging');
  await dialog.getByLabel(/Người được giao/).selectOption({ label: 'Lê Kiểm Thử (tester)' });
  for (const n of ['01', '02', '03']) await dialog.getByLabel(new RegExp(`HRM-1-TC${n}`)).check().catch(() => {});
  await dialog.getByRole('button', { name: 'Lập đợt' }).click();
  await page.getByRole('heading', { name: /Nghỉ phép – build 1.0.0/ }).waitFor();

  // Tester ghi kết quả: 1 Fail, còn lại Pass
  await login(page, 'tester');
  await page.goto(`${BASE}/#/runs`);
  await page.getByRole('cell', { name: /Nghỉ phép – build 1.0.0/ }).click();
  const codes = ['HRM-1-TC01', 'HRM-1-TC02', 'HRM-1-TC03'];
  for (let i = 0; i < codes.length; i += 1) {
    await page.getByRole('row').filter({ hasText: codes[i] }).getByRole('button', { name: 'Ghi kết quả' }).click();
    if (i === 1) {
      await dialog.getByLabel('Kết quả *').selectOption('FAIL');
      await dialog.getByLabel(/Ghi chú/).fill('Không báo lỗi khi ngày kết thúc trước ngày bắt đầu');
      await dialog.getByLabel(/Mã defect/).fill('HRM-99');
    }
    await dialog.getByRole('button', { name: 'Lưu kết quả' }).click();
    await page.getByText('Đã ghi nhận kết quả').first().waitFor();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
  await shot(page, '08_test_run');

  // Developer báo đã sửa
  await login(page, 'dev');
  await page.getByRole('link', { name: /Sửa lỗi & kiểm thử lại/ }).click();
  await page.getByRole('button', { name: /Báo đã sửa/ }).first().click();
  await dialog.getByLabel(/Bản build đã sửa/).fill('1.0.1');
  await dialog.getByLabel(/Ghi chú/).fill('Thêm kiểm tra ngày kết thúc ở backend').catch(() => {});
  await dialog.getByRole('button', { name: 'Báo đã sửa' }).click();
  await page.getByRole('heading', { name: /Chờ kiểm thử lại/ }).waitFor();
  await page.waitForTimeout(400);
  await shot(page, '11_kiem_thu_lai');

  // QA Lead: requirement đổi trên Jira → so sánh phiên bản → phân tích ảnh hưởng → đề xuất → regression
  await login(page, 'qalead');
  await openStory(page, 'HRM-1');
  await page.getByRole('button', { name: /Mô phỏng sửa trên Jira/ }).click();
  const ac = dialog.getByLabel(/Acceptance criteria/);
  const lines = (await ac.inputValue()).split('\n');
  lines[1] = 'Ngày kết thúc trước ngày bắt đầu thì báo lỗi "Khoảng thời gian không hợp lệ"';
  await ac.fill(lines.join('\n'));
  await dialog.getByRole('button', { name: /Lưu trên Jira và đồng bộ/ }).click();
  await page.getByText(/phiên bản v2/).first().waitFor();
  await page.waitForTimeout(500);
  await shot(page, '06_so_sanh_phien_ban', true);

  await page.getByRole('button', { name: /Phân tích ảnh hưởng/ }).click();
  await page.getByText(/AI đã so v1 → v2/).waitFor();
  await page.goto(`${BASE}/#/proposals`);
  await page.locator('[data-proposal]').first().waitFor();
  await page.waitForTimeout(400);
  await shot(page, '09_de_xuat_ai', false, true);

  await openStory(page, 'HRM-1');
  await page.getByRole('button', { name: /Tạo bộ regression/ }).click();
  await page.getByRole('heading', { name: /Bộ regression #\d+/ }).waitFor();
  await page.waitForTimeout(400);
  await shot(page, '10_bo_regression', false, true);

  await page.getByRole('link', { name: /Thay đổi quy định/ }).click();
  await page.getByLabel('MAX_TC_PER_STORY').waitFor();
  await shot(page, '13_thay_doi_quy_dinh', false, true);

  await page.getByRole('link', { name: /Tổng quan/ }).click();
  await page.waitForTimeout(900);
  await shot(page, '02_tong_quan', false, true);

  await browser.close();
  console.log(`Đã lưu ảnh vào ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
