// E2E-01 → E2E-11: kịch bản người dùng chính theo đặc tả chốt 16/11, chạy nối tiếp trên cùng dữ liệu (Jira giả lập, AI giả lập).
// Luồng: thêm dự án từ Jira → AI sinh test → duyệt → Test Run → ghi kết quả → báo sửa lỗi →
//        requirement đổi trên Jira → test bị gắn cờ → AI phân tích ảnh hưởng → duyệt đề xuất → bộ regression.
const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe.configure({ mode: 'serial' });

const STORY = 'HRM-1'; // requirement lấy từ dự án HRM trên Jira giả lập
const HRM = 'HRM – Hệ thống quản lý nhân sự';
const RUN = 'Đợt E2E – build 1.0.0';

const openStory = async (page, code = STORY) => {
  await page.goto('/#/stories');
  await page.getByRole('cell', { name: code, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(code);
};

test('E2E-01 đăng nhập sai mật khẩu hiển thị lỗi', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Tên đăng nhập').fill('tester');
  await page.getByLabel('Mật khẩu').fill('sai-mat-khau');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByText('Tên đăng nhập hoặc mật khẩu không đúng')).toBeVisible();
});

test('E2E-02 YC12, YC1: QA Lead thêm dự án từ Jira, requirement được đồng bộ về (chỉ đọc)', async ({ page }) => {
  await login(page, 'qalead');
  await page.getByRole('link', { name: /Dự án & module/ }).click();
  await page.getByRole('button', { name: /Thêm dự án từ Jira/ }).click();
  await page.getByRole('dialog').getByLabel(/Mã dự án/).fill('HRM');
  await page.getByRole('dialog').getByRole('button', { name: 'Thêm dự án' }).click();
  await expect(page.getByText(/HRM: 3 requirement mới/)).toBeVisible();
  await page.waitForLoadState('load');
  await page.getByLabel('Dự án', { exact: true }).selectOption({ label: HRM });
  await page.getByRole('link', { name: /Requirement/ }).click();
  await expect(page.getByRole('cell', { name: STORY, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tạo requirement|Nhập từ file/ })).toHaveCount(0);
});

test('E2E-03 YC2, YC3: Tester sinh test case bằng AI (mỗi test gắn AC) và gửi duyệt', async ({ page }) => {
  await login(page, 'tester');
  await openStory(page);
  await page.getByRole('button', { name: /Sinh test case bằng AI/ }).click();
  await expect(page.getByText(/AI đã sinh \d+ test case/)).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: `${STORY}-TC01` });
  await expect(row).toContainText('Nháp');
  await expect(row).toContainText('AC1');
  await page.getByLabel('Chọn tất cả').check();
  await page.getByRole('button', { name: /Gửi duyệt mục đã chọn/ }).click();
  await expect(page.getByText(/Đã gửi duyệt \d+ test case/)).toBeVisible();
  await expect(row).toContainText('Chờ duyệt');
});

test('E2E-04 YC4: QA Lead trả lại 1 test kèm ghi chú bắt buộc, duyệt phần còn lại', async ({ page }) => {
  await login(page, 'qalead');
  await page.getByRole('link', { name: /Duyệt test case/ }).click();
  await page.getByRole('cell', { name: `${STORY}-TC01`, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Trả lại/ }).click();
  await expect(page.getByText('Trả lại test case bắt buộc phải có ghi chú (QĐ4)')).toBeVisible();
  await dialog.getByLabel('Ghi chú duyệt').fill('Cần ghi rõ ngày bắt đầu và ngày kết thúc cụ thể');
  await dialog.getByRole('button', { name: /Trả lại/ }).click();
  await expect(dialog.getByText('QA Lead đã trả lại')).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await page.getByLabel('Chọn tất cả').check();
  await page.getByRole('button', { name: /Duyệt tất cả mục đã chọn/ }).click();
  await expect(page.getByText('Không có test case nào chờ duyệt')).toBeVisible();
});

test('E2E-05 YC14: QA Lead lập Test Run – chọn test đã duyệt, ghi build, môi trường, giao cho Tester', async ({ page }) => {
  await login(page, 'qalead');
  await page.getByRole('link', { name: /Test Run/ }).click();
  await page.getByRole('button', { name: /Lập Test Run/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Dự án *').selectOption({ label: HRM });
  await expect(dialog.getByLabel(new RegExp(`${STORY}-TC02`))).toBeVisible();
  await expect(dialog.getByLabel(new RegExp(`${STORY}-TC01`))).toHaveCount(0); // test bị trả lại không đủ điều kiện
  await dialog.getByLabel('Tên đợt *').fill(RUN);
  await dialog.getByLabel('Build đang kiểm thử *').fill('1.0.0');
  await dialog.getByLabel('Môi trường *').fill('Staging');
  await dialog.getByLabel(/Người được giao/).selectOption({ label: 'Lê Kiểm Thử (tester)' });
  await dialog.getByLabel(new RegExp(`${STORY}-TC02`)).check();
  await dialog.getByLabel(new RegExp(`${STORY}-TC03`)).check();
  await dialog.getByRole('button', { name: 'Lập đợt' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(RUN) })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: `${STORY}-TC02` })).toContainText('Lê Kiểm Thử');
});

test('E2E-06 YC5: Tester ghi kết quả trong Test Run – Fail bắt buộc ghi chú', async ({ page }) => {
  await login(page, 'tester');
  await page.goto('/#/runs');
  await page.getByRole('cell', { name: new RegExp(RUN) }).click();
  await page.getByRole('row').filter({ hasText: `${STORY}-TC02` }).getByRole('button', { name: 'Ghi kết quả' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Kết quả *').selectOption('FAIL');
  await dialog.getByRole('button', { name: 'Lưu kết quả' }).click();
  await expect(page.getByText(/bắt buộc phải có ghi chú/)).toBeVisible();
  await dialog.getByLabel(/Ghi chú/).fill('Không báo lỗi khi ngày kết thúc trước ngày bắt đầu');
  await dialog.getByLabel(/Mã defect/).fill('HRM-99');
  await dialog.getByRole('button', { name: 'Lưu kết quả' }).click();
  await expect(page.getByText('Đã ghi nhận kết quả')).toBeVisible();
  await page.getByRole('row').filter({ hasText: `${STORY}-TC03` }).getByRole('button', { name: 'Ghi kết quả' }).click();
  await dialog.getByRole('button', { name: 'Lưu kết quả' }).click();
  await expect(page.getByText('2/2 test đã có kết quả')).toBeVisible();
});

test('E2E-07 YC18: Developer báo đã sửa lỗi kèm build; test chuyển Chờ kiểm thử lại', async ({ page }) => {
  await login(page, 'dev');
  await page.getByRole('link', { name: /Sửa lỗi & kiểm thử lại/ }).click();
  await page.getByRole('row').filter({ hasText: `${STORY}-TC02` }).getByRole('button', { name: /Báo đã sửa/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Bản build đã sửa/).fill('1.0.1');
  await dialog.getByRole('button', { name: 'Báo đã sửa' }).click();
  await expect(page.getByText(/Đã báo sửa – QA Lead lập đợt Kiểm thử lại/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chờ kiểm thử lại (1)' })).toBeVisible();
});

test('E2E-08 YC8, YC15, YC16: AC đổi trên Jira → test bị gắn cờ → AI phân tích ảnh hưởng → QA Lead chấp nhận đề xuất', async ({ page }) => {
  await login(page, 'qalead');
  await openStory(page);
  await page.getByRole('button', { name: /Mô phỏng sửa trên Jira/ }).click();
  const dialog = page.getByRole('dialog');
  const ac = dialog.getByLabel(/Acceptance criteria/);
  const lines = (await ac.inputValue()).split('\n');
  lines[1] = 'Ngày kết thúc trước ngày bắt đầu thì báo lỗi "Khoảng thời gian không hợp lệ"';
  await ac.fill(lines.join('\n'));
  await dialog.getByRole('button', { name: /Lưu trên Jira và đồng bộ/ }).click();
  await expect(page.getByText(/1 phiên bản mới/)).toBeVisible();
  await expect(page.getByText(/test cần xem lại vì requirement đã đổi/)).toBeVisible();
  await expect(page.getByText(/phiên bản v2/)).toBeVisible();

  await page.getByRole('button', { name: /Phân tích ảnh hưởng/ }).click();
  await expect(page.getByText(/AI đã so v1 → v2/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Đề xuất AI chờ xử lý/ })).toBeVisible();
  const card = page.locator('[data-proposal]').filter({ hasText: 'Cần sửa' }).first();
  await expect(card).toContainText('Lý do');
  await card.getByRole('button', { name: 'Chấp nhận' }).click();
  await expect(page.getByText('Đã chấp nhận đề xuất')).toBeVisible();
});

test('E2E-09 YC17: QA Lead tạo bộ regression – test chưa đủ điều kiện được liệt kê riêng, chưa xác nhận được', async ({ page }) => {
  await login(page, 'qalead');
  await openStory(page);
  await page.getByRole('button', { name: /Tạo bộ regression/ }).click();
  await expect(page.getByRole('heading', { name: /Bộ regression #\d+ · HRM-1 v1 → v2/ })).toBeVisible();
  await expect(page.getByText(/test chưa đủ điều kiện chạy/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Xác nhận và tạo Test Run/ })).toBeDisabled();
});

test('E2E-10 YC10 + QĐ2: QA Lead đổi quy định tối đa 2 test và AI tuân thủ quy định mới', async ({ page }) => {
  await login(page, 'qalead');
  await page.getByRole('link', { name: /Thay đổi quy định/ }).click();
  await page.getByLabel('MAX_TC_PER_STORY').fill('2');
  await page.getByRole('row').filter({ hasText: 'MAX_TC_PER_STORY' }).getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('MAX_TC_PER_STORY: 20 → 2')).toBeVisible();
  await openStory(page, 'PETINS-2');
  await page.getByRole('button', { name: /Sinh test case bằng AI/ }).click();
  await expect(page.getByText('AI đã sinh 2 test case')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Test case (2/2)' })).toBeVisible();
});

test('E2E-11 Phân quyền: PO/BA chỉ xem requirement, báo cáo; không thấy duyệt, đề xuất AI, đồng bộ', async ({ page }) => {
  await login(page, 'poba');
  await expect(page.getByRole('link', { name: /Duyệt test case/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Đề xuất AI/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Sprint/ })).toHaveCount(0); // ngoài MVP, cờ tắt
  await page.getByLabel('Dự án', { exact: true }).selectOption({ label: HRM });
  await page.getByRole('link', { name: /Requirement/ }).click();
  await expect(page.getByRole('heading', { name: 'Requirement' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đồng bộ ngay/ })).toHaveCount(0);
  await openStory(page);
  await expect(page.getByRole('button', { name: /Sinh test case bằng AI|Phân tích ảnh hưởng|Mô phỏng sửa/ })).toHaveCount(0);
});
