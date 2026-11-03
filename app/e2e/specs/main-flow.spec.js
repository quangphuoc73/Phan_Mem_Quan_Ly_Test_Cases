// E2E-01 → E2E-09: kịch bản người dùng chính, chạy nối tiếp trên cùng dữ liệu (Jira giả lập).
const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe.configure({ mode: 'serial' });

const STORY = 'HRM-1'; // user story lấy từ dự án HRM trên Jira giả lập

test('E2E-01 đăng nhập sai mật khẩu hiển thị lỗi', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Tên đăng nhập').fill('tester');
  await page.getByLabel('Mật khẩu').fill('sai-mat-khau');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByText('Tên đăng nhập hoặc mật khẩu không đúng')).toBeVisible();
});

test('E2E-02 QA Lead thêm dự án từ Jira, user story được đồng bộ về', async ({ page }) => {
  await login(page, 'qalead');
  await page.getByRole('link', { name: /Dự án & module/ }).click();
  await page.getByRole('button', { name: /Thêm dự án từ Jira/ }).click();
  await page.getByRole('dialog').getByLabel(/Mã dự án/).fill('HRM');
  await page.getByRole('dialog').getByRole('button', { name: 'Thêm dự án' }).click();
  await expect(page.getByText(/HRM: 3 story mới/)).toBeVisible();
  await page.waitForLoadState('load');
  await page.getByLabel('Dự án').selectOption({ label: 'HRM – Hệ thống quản lý nhân sự' });
  await page.getByRole('link', { name: /User story/ }).click();
  await expect(page.getByRole('cell', { name: STORY, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Lập user story|Nhập từ file/ })).toHaveCount(0);
});

test('E2E-03 Tester sinh test case bằng AI và gửi duyệt', async ({ page }) => {
  await login(page, 'tester');
  await page.goto('/#/stories');
  await page.getByRole('cell', { name: STORY, exact: true }).click();
  await page.getByRole('button', { name: /Sinh test case bằng AI/ }).click();
  await expect(page.getByText(/AI đã sinh \d+ test case/)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: `${STORY}-TC01` })).toContainText('Nháp');

  await page.getByLabel('Chọn tất cả').check();
  await page.getByRole('button', { name: /Gửi duyệt mục đã chọn/ }).click();
  await expect(page.getByText(/Đã gửi duyệt \d+ test case/)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: `${STORY}-TC01` })).toContainText('Chờ duyệt');
});

test('E2E-04 QA Lead trả lại 1 test case kèm ghi chú, duyệt phần còn lại', async ({ page }) => {
  await login(page, 'qalead');
  await page.getByRole('link', { name: /Duyệt test case/ }).click();
  await page.getByRole('cell', { name: `${STORY}-TC01`, exact: true }).click();
  const dialog = page.getByRole('dialog');
  // Trả lại mà không ghi chú → bị chặn
  await dialog.getByRole('button', { name: /Trả lại/ }).click();
  await expect(page.getByText('Trả lại test case bắt buộc phải có ghi chú')).toBeVisible();
  await dialog.getByPlaceholder(/Ghi chú duyệt/).fill('Cần ghi rõ số ngày hiệu lực');
  await dialog.getByRole('button', { name: /Trả lại/ }).click();
  await expect(dialog.getByText('QA Lead đã trả lại')).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng' }).click();

  await page.getByLabel('Chọn tất cả').check();
  await page.getByRole('button', { name: /Duyệt tất cả mục đã chọn/ }).click();
  await expect(page.getByText('Không có test case nào chờ duyệt')).toBeVisible();
});

test('E2E-05 Tester ghi kết quả chạy test cho test case đã duyệt', async ({ page }) => {
  await login(page, 'tester');
  await page.goto('/#/testcases');
  await page.getByPlaceholder('Tìm mã hoặc tiêu đề...').fill(`${STORY}-TC02`);
  await page.getByRole('cell', { name: `${STORY}-TC02`, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Chạy test/ }).click();
  await dialog.locator('#run-result').selectOption('FAIL');
  await dialog.getByRole('button', { name: 'Lưu kết quả' }).click();
  await expect(page.getByText(/bắt buộc phải có ghi chú/)).toBeVisible();
  await dialog.getByPlaceholder(/Ghi chú/).fill('BUG-21: không gửi email xác nhận');
  await dialog.getByRole('button', { name: 'Lưu kết quả' }).click();
  await expect(dialog.getByRole('cell', { name: 'BUG-21: không gửi email xác nhận', exact: true })).toBeVisible();
});

test('E2E-06 QA Lead đổi quy định QĐ2 và AI tuân thủ quy định mới', async ({ page }) => {
  await login(page, 'qalead');
  await page.getByRole('link', { name: /Thay đổi quy định/ }).click();
  await page.getByLabel('MAX_TC_PER_STORY').fill('2');
  await page.getByRole('row').filter({ hasText: 'MAX_TC_PER_STORY' }).getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('MAX_TC_PER_STORY: 20 → 2')).toBeVisible();

  await page.goto('/#/stories');
  await page.getByRole('cell', { name: 'US-PET-002', exact: true }).click();
  await page.getByRole('button', { name: /Sinh test case bằng AI/ }).click();
  await expect(page.getByText('AI đã sinh 2 test case')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Test case (2/2)' })).toBeVisible();
});

test('E2E-07 Developer chỉ được xem, không thấy chức năng ghi', async ({ page }) => {
  await login(page, 'dev');
  await expect(page.getByRole('link', { name: /Duyệt test case/ })).toHaveCount(0);
  await page.getByRole('link', { name: /User story/ }).click();
  await expect(page.getByRole('heading', { name: 'User story' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đồng bộ từ Jira/ })).toHaveCount(0);
});

test('E2E-08 QA Lead xem sprint đồng bộ từ Jira: bảng sprint, Product backlog, không có nút tạo sprint', async ({ page }) => {
  await login(page, 'qalead');
  await page.getByLabel('Dự án').selectOption({ label: 'HRM – Hệ thống quản lý nhân sự' });
  await page.getByRole('link', { name: /Sprint \(Agile\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Sprint · Hệ thống quản lý nhân sự' })).toBeVisible();
  await expect(page.locator('#board')).toContainText('HRM-1');
  await expect(page.getByRole('heading', { name: 'Product backlog (1)' })).toBeVisible(); // HRM-3 chưa thuộc sprint nào trên Jira
  await expect(page.getByRole('button', { name: /Tạo sprint|Sửa sprint|Đưa vào/ })).toHaveCount(0);
});

test('E2E-09 Tester xem được sprint của dự án mẫu nhưng không sửa được', async ({ page }) => {
  await login(page, 'tester');
  await page.getByLabel('Dự án').selectOption({ label: 'PETINS – App bảo hiểm thú cưng' });
  await page.getByRole('link', { name: /Sprint \(Agile\)/ }).click();
  await expect(page.getByRole('heading', { name: /Burndown chart/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tạo sprint|Đưa vào/ })).toHaveCount(0);
});
