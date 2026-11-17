// Page Object Model: gom locator và thao tác của trang Đăng nhập vào một chỗ.
// Khi giao diện đổi, chỉ cần sửa file này thay vì sửa từng test.
class LoginPage {
  constructor(page) {
    this.page = page;
    this.username = page.getByTestId('username');
    this.password = page.getByTestId('password');
    this.loginButton = page.getByTestId('login-button');
    this.error = page.getByTestId('error');
  }

  async open() {
    await this.page.goto('/');
  }

  async login(username, password) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }
}

module.exports = { LoginPage };
