# Chương 5. Cài đặt

> Sản phẩm của giai đoạn: **phần mềm** chạy được, mã nguồn theo đúng thiết kế ở Chương 4.

## 5.1. Công nghệ sử dụng

| Thành phần | Công nghệ | Lý do chọn |
|---|---|---|
| Ngôn ngữ | JavaScript (Node.js ≥ 20) | Một ngôn ngữ cho cả frontend, backend và Playwright |
| Backend | Express 5 | Gọn nhẹ, phổ biến, tự bắt lỗi async |
| CSDL | SQLite (better-sqlite3) cho demo; thiết kế tương thích PostgreSQL | Không cần cài server CSDL khi demo; SQL chuẩn |
| Kiểm tra dữ liệu | Zod | Một schema dùng cho cả input API và output AI |
| Bảo mật | jsonwebtoken, bcryptjs, helmet, express-rate-limit | Thư viện chuẩn, được kiểm chứng |
| AI | Gemini / Claude / OpenAI qua REST API, MockProvider offline | Không phụ thuộc SDK; đổi model qua cấu hình |
| Frontend | HTML + CSS + JavaScript module (không framework), Chart.js | Không cần build; tuân thủ CSP chặt |
| Xuất Excel | ExcelJS | Tạo .xlsx có định dạng |
| Kiểm thử tự động | `node:test` + supertest (unit, API); **Playwright** (E2E và script do AI sinh) | Playwright: tự chờ phần tử, trace, ảnh chụp, chạy song song |
| Triển khai | Docker (image chính thức của Playwright), docker-compose | Môi trường đồng nhất, có sẵn trình duyệt |
| CI/CD | GitHub Actions | Tự động test và build mỗi lần push |

## 5.2. Cấu trúc thư mục

```text
NhapMonCongNghePhanMem/
├── app/                          # Hệ thống chính
│   ├── src/
│   │   ├── server.js             # Điểm khởi động
│   │   ├── app.js                # Khởi tạo Express, middleware, route
│   │   ├── config.js             # Đọc biến môi trường
│   │   ├── db/                   # schema.sql, kết nối, dữ liệu mẫu
│   │   ├── middleware/           # auth (JWT, RBAC), aiQuota, errorHandler
│   │   ├── routes/               # auth, admin, work (API REST)
│   │   ├── services/             # story, sprint, testCase, run, report, parameter, script, audit
│   │   │   └── ai/               # AI Service: piiMasker, injectionGuard, promptBuilder, schemas, aiService
│   │   │       └── providers/    # LLMProvider + Mock, Gemini, Claude, OpenAI
│   │   └── utils/errors.js
│   ├── public/                   # Giao diện web (index.html, css, js/pages/*)
│   ├── tests/                    # Unit test + API test (node:test + supertest)
│   ├── e2e/                      # E2E test bằng Playwright cho chính hệ thống
│   ├── samples/                  # File CSV mẫu để nhập user story
│   ├── .env.example
│   └── package.json
├── automation/                   # Playwright worker (YC9)
│   ├── playwright.config.js
│   ├── pages/                    # Page Object Model: LoginPage, InventoryPage
│   └── specs/
│       ├── samples/              # Bộ test viết tay mẫu cho Sauce Demo
│       └── generated/            # File tạm khi hệ thống chạy script do AI sinh
├── docs/                         # Tài liệu đồ án (chương 0–9), báo cáo HTML, slide
├── .github/workflows/ci.yml      # CI/CD
├── Dockerfile, docker-compose.yml
└── README.md
```

## 5.3. Ánh xạ yêu cầu – mã nguồn

| Yêu cầu | Service / module | Route | Màn hình |
|---|---|---|---|
| YC1 | `storyService.create/update/remove` | `/api/stories` | `pages/stories.js` |
| YC2 | `ai/aiService.generateTestCases` + `testCaseService.saveAiResult` | `/api/stories/:id/generate` | Chi tiết user story |
| YC3 | `testCaseService.create/update/remove/submit/history` | `/api/testcases` | Hộp thoại test case |
| YC4 | `testCaseService.review` | `/api/testcases/:id/review` | `pages/review.js` |
| YC5 | `runService.record` | `/api/testcases/:id/runs` | Tab "Chạy test" |
| YC6 | `reportService.summary` | `/api/reports/summary` | `pages/dashboard.js` |
| YC7 | `testCaseService.list` | `/api/testcases?…` | `pages/testcases.js` |
| YC8 | `storyService.importMany`, ExcelJS | `/api/stories/import`, `/api/export/testcases.xlsx` | Nhập file, Xuất Excel |
| YC9 | `scriptService.generate/save/run/staticCheck` | `/api/testcases/:id/script/*` | Tab "Script Playwright" |
| YC10 | `parameterService.update` | `/api/parameters/:key` | `pages/admin.js → renderParams` |
| YC11 | `routes/admin.js` | `/api/users`, `/api/projects` | Người dùng, Dự án |
| YC12 | `sprintService.list/create/update/burndown/storyProgress` | `/api/projects/:id/sprints`, `/api/sprints/:id/*` | `pages/sprints.js` |

## 5.4. Một số điểm cài đặt đáng chú ý

**Strategy pattern cho LLM** – `src/services/ai/providers/`:

```js
class LLMProvider {
  async complete(req) { throw new Error('complete() chưa được hiện thực'); }
}
class GeminiProvider extends LLMProvider { /* gọi Gemini REST API */ }
// Đổi model: AI_PROVIDER=gemini | claude | openai | mock trong file .env
```

**Gọi AI có kiểm tra schema và thử lại** – `aiService.callWithRetry`:

```js
while (attempts <= maxRetry) {
  attempts += 1;
  try {
    raw = await provider.complete({ ...prompt, timeoutMs });
    const parsed = zodSchema.parse(JSON.parse(raw));   // sai định dạng → ném lỗi → thử lại
    return { ok: true, data: parsed, attempts };
  } catch (err) { lastError = err.message; }
}
```

**Giao dịch khi lưu kết quả AI** – xóa test case AI Nháp cũ, kiểm tra QĐ2 và thêm mới trong **một transaction**, tránh dữ liệu dở dang.

**Chạy script do AI sinh an toàn** – `scriptService.run`: kiểm tra tĩnh → ghi file tên ngẫu nhiên → `spawn('playwright test --reporter=json')` với `env` chỉ gồm `PATH, HOME, CI` → `SIGKILL` khi quá `RUN_TIMEOUT_SEC` → xóa file tạm → lưu kết quả và ảnh chụp lỗi.

**MockProvider** – sinh test case theo luật (mỗi acceptance criterion một case Positive; tiêu chí có từ khóa "bắt buộc/tối đa/hết hạn…" sinh thêm case Negative; tiêu chí có số + đơn vị như "10 MB" sinh case biên). Giúp demo chạy được khi không có mạng hoặc API key, và giúp test tự động ổn định.

## 5.5. Quy ước và quản lý mã nguồn

- Đặt tên: `camelCase` cho biến/hàm, `PascalCase` cho lớp, `snake_case` cho cột CSDL, `UPPER_CASE` cho tham số quy định.
- Comment tiếng Việt, ghi rõ YC/QĐ liên quan ngay tại chỗ hiện thực.
- Git flow: nhánh `main` luôn chạy được; mỗi user story của Product Backlog một nhánh `feature/pb-xx-...` (ví dụ `feature/pb-06-ai-sinh-test-case`); tạo Pull Request, CI phải xanh mới merge.
- Commit theo dạng: `feat(yc2): sinh test case bằng AI`, `fix(qd4): bắt buộc ghi chú khi trả lại`, `test(e2e): luồng duyệt`.
- Không commit `.env`, CSDL, báo cáo test (`.gitignore`).

## 5.6. Hướng dẫn cài đặt môi trường phát triển

```bash
cd app
npm install
cp .env.example .env      # chỉnh AI_PROVIDER, API key nếu muốn dùng AI thật
npm run reset             # tạo CSDL và dữ liệu mẫu
npm run dev               # chạy và tự khởi động lại khi sửa mã
```

```bash
cd automation
npm install               # Playwright worker dùng Chrome có sẵn trên máy
```
