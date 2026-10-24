// Tương ứng US-SAU-002 Thêm sản phẩm vào giỏ hàng.
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../../pages/LoginPage');
const { InventoryPage } = require('../../pages/InventoryPage');
const accounts = require('../../test-data/accounts');

test.describe('US-SAU-002 Giỏ hàng', () => {
  let inventory;

  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.login(accounts.standard.username, accounts.standard.password);
    inventory = new InventoryPage(page);
  });

  test('TC01 - Thêm 1 sản phẩm thì giỏ hàng hiển thị số 1', async () => {
    await inventory.addToCart('Sauce Labs Backpack');
    await expect(inventory.cartBadge).toHaveText('1');
  });

  test('TC02 - Giỏ hàng hiển thị đúng sản phẩm đã chọn', async ({ page }) => {
    await inventory.addToCart('Sauce Labs Backpack');
    await inventory.addToCart('Sauce Labs Bike Light');
    await inventory.cartLink.click();
    await expect(page.getByTestId('inventory-item-name')).toHaveText(['Sauce Labs Backpack', 'Sauce Labs Bike Light']);
  });

  test('TC03 - Bỏ sản phẩm khỏi giỏ thì số lượng giảm', async () => {
    await inventory.addToCart('Sauce Labs Backpack');
    await inventory.addToCart('Sauce Labs Bike Light');
    await inventory.removeFromCart('Sauce Labs Backpack');
    await expect(inventory.cartBadge).toHaveText('1');
  });
});
