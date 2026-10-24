// Bộ test mẫu viết tay theo Page Object Model, tương ứng US-SAU-001.
// Dùng để so sánh với script do AI sinh (script AI viết "phẳng", bộ này có cấu trúc).
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../../pages/LoginPage');
const { InventoryPage } = require('../../pages/InventoryPage');
const accounts = require('../../test-data/accounts');

test.describe('US-SAU-001 Đăng nhập vào cửa hàng', () => {
  let login;

  test.beforeEach(async ({ page }) => {
    login = new LoginPage(page);
    await login.open();
  });

  test('TC01 - Đăng nhập thành công với tài khoản chuẩn', async ({ page }) => {
    await login.login(accounts.standard.username, accounts.standard.password);
    await expect(page).toHaveURL(/inventory/);
    await expect(new InventoryPage(page).title).toHaveText('Products');
  });

  test('TC02 - Đăng nhập sai mật khẩu', async () => {
    await login.login(accounts.standard.username, 'wrong_password');
    await expect(login.error).toContainText('Username and password do not match');
  });

  test('TC03 - Đăng nhập bằng tài khoản bị khóa', async () => {
    await login.login(accounts.locked.username, accounts.locked.password);
    await expect(login.error).toContainText('Sorry, this user has been locked out');
  });

  // Data-driven: kiểm tra các trường bắt buộc
  for (const [user, pass, message] of [
    ['', accounts.standard.password, 'Username is required'],
    [accounts.standard.username, '', 'Password is required'],
  ]) {
    test(`TC04 - Bỏ trống trường bắt buộc: "${message}"`, async () => {
      await login.login(user, pass);
      await expect(login.error).toContainText(message);
    });
  }
});
