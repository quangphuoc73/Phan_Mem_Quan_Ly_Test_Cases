const { expect } = require('@playwright/test');

const ACCOUNTS = {
  admin: 'Admin@123',
  qalead: 'QaLead@123',
  tester: 'Tester@123',
  dev: 'Dev@123456',
};

async function login(page, username) {
  await page.goto('/');
  await page.getByLabel('Tên đăng nhập').fill(username);
  await page.getByLabel('Mật khẩu').fill(ACCOUNTS[username]);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan & báo cáo' })).toBeVisible();
}

module.exports = { login, ACCOUNTS };
