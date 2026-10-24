class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new AppError(400, msg, details);
const forbidden = (msg = 'Bạn không có quyền thực hiện thao tác này') => new AppError(403, msg);
const notFound = (msg = 'Không tìm thấy dữ liệu') => new AppError(404, msg);
const conflict = (msg) => new AppError(409, msg);

module.exports = { AppError, badRequest, forbidden, notFound, conflict };
