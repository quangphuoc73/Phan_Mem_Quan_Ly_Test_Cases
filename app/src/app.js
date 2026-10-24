// Khởi tạo Express app (tách khỏi server.js để kiểm thử API bằng supertest).
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { authenticate } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  // Header bảo mật + Content-Security-Policy chống XSS
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api', authenticate, require('./routes/admin'));
  app.use('/api', authenticate, require('./routes/work'));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API không tồn tại' }));

  // Ảnh chụp màn hình lỗi khi chạy test tự động (tên file ngẫu nhiên)
  app.use('/screenshots', express.static(path.join(__dirname, '..', 'data', 'screenshots')));
  app.use('/vendor', express.static(path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist')));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
