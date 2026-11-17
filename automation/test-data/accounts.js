// Tài khoản test đọc từ biến môi trường (.env), mặc định là tài khoản công khai của Sauce Demo.
// Không viết cứng tài khoản trong file test: đổi môi trường chỉ cần sửa .env.
module.exports = {
  standard: {
    username: process.env.TEST_USERNAME || 'standard_user',
    password: process.env.TEST_PASSWORD || 'secret_sauce',
  },
  locked: {
    username: process.env.LOCKED_USERNAME || 'locked_out_user',
    password: process.env.TEST_PASSWORD || 'secret_sauce',
  },
};
