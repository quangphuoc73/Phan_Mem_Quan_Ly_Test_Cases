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
| Kiểm thử tự động | `node:test` + supertest (unit, API); **Playwright** (E2E; script do AI sinh ở phần mở rộng YC19) | Playwright: tự chờ phần tử, trace, ảnh chụp, chạy song song |
| Tài liệu, mô hình | draw.io (sơ đồ), DB Browser for SQLite (xem CSDL), OpenAPI 3.1 (API) | Công cụ chuyên dụng, file gốc mở và sửa được |
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
│   │   ├── services/             # story, jira, testCase, suite, run, impact, regression, retest, report, parameter, audit
│   │   │                         # (sprint, script: phần mở rộng, bật bằng cờ)
│   │   │   └── ai/               # AI Service: piiMasker, injectionGuard, promptBuilder, schemas, aiService
│   │   │       └── providers/    # LLMProvider + Mock, Gemini, Claude, OpenAI
│   │   └── utils/                # ac.js (so sánh AC theo nội dung dòng), errors.js
│   ├── public/                   # Giao diện web (index.html, css, js/core.js, main.js, js/pages/*)
│   ├── tests/                    # Unit test + API test (node:test + supertest)
│   ├── e2e/                      # E2E test bằng Playwright cho chính hệ thống
│   ├── samples/                  # Nội dung user story mẫu (chép sang Jira khi tạo story thử)
│   ├── .env.example
│   └── package.json
├── automation/                   # Playwright worker (YC19, phần mở rộng)
│   ├── playwright.config.js
│   ├── pages/                    # Page Object Model: LoginPage, InventoryPage
│   └── specs/
│       ├── samples/              # Bộ test viết tay mẫu cho Sauce Demo
│       └── generated/            # File tạm khi hệ thống chạy script do AI sinh
├── docs/                         # Tài liệu đồ án (chương 0–9), đặc tả bản chốt, thiết kế MVP,
│                                 # api/openapi.yaml, sơ đồ draw.io (usecase, dfd, erd, sodo), báo cáo, slide
├── .github/workflows/ci.yml      # CI/CD
├── Dockerfile, docker-compose.yml
└── README.md
```

## 5.3. Ánh xạ yêu cầu – mã nguồn

| Yêu cầu | Service / module | Route | Màn hình (`public/js/pages/`) |
|---|---|---|---|
| YC1 | `jiraService.syncProject/splitDescription/saveStories`, `storyService.list/get/versions` | `/api/stories`, `/api/stories/:id/versions` | `stories.js` |
| YC2 | `ai/aiService.generateTestCases`, `testCaseService.saveAiResult` | `/api/stories/:id/generate` | `stories.js` (chi tiết requirement) |
| YC3 | `testCaseService.create/update/remove/submit/recheck/history`, `utils/ac.js` | `/api/testcases`, `/api/testcases/submit`, `/api/testcases/recheck` | `testcases.js` (hộp thoại test case) |
| YC4 | `testCaseService.review` | `/api/testcases/:id/review` | `review.js` |
| YC5 | `runService.record` | `/api/runs/:id/items/:itemId/executions` | `runs.js` |
| YC6 | `reportService.summary` | `/api/reports/summary` | `dashboard.js` |
| YC7 | `testCaseService.list` | `/api/testcases?…` | `testcases.js` |
| YC8 | `jiraService.handleWebhook/syncProject`, `storyService.applyContentChange/checkDecision` | `/api/jira/webhook`, `/api/projects/:id/jira-sync`, `/api/stories/:id/check-decision` | `stories.js` (tab Cần kiểm tra, so sánh phiên bản) |
| YC9 | ExcelJS trong `routes/work.js` | `/api/export/testcases.xlsx` | `testcases.js` |
| YC10 | `parameterService.update` | `/api/parameters/:key` | `admin.js → renderParams` |
| YC11 | `routes/admin.js` | `/api/users` | `admin.js → renderUsers` |
| YC12 | `jiraService.testConnection/importProject/syncProject` (Jira REST API v3, giả lập khi chưa cấu hình) | `/api/jira/*`, `/api/projects` | `admin.js → renderProjects` |
| YC13 | `suiteService` | `/api/suites` | `suites.js` |
| YC14 | `runService.create/addTests/assign/update/close/eligibility` | `/api/runs` | `runs.js` |
| YC15 | `impactService.analyze`, `ai/aiService.analyzeImpact` | `/api/stories/:id/analyze`, `/api/analyses/:id` | `stories.js`, `proposals.js` |
| YC16 | `impactService.decide` | `/api/proposals/:id/decision` | `proposals.js` |
| YC17 | `regressionService.create/updateItems/confirm`, `ai/aiService.rankRegression` | `/api/regressions` | `regression.js` |
| YC18 | `retestService.reportFix/overview/createRetestRun` | `/api/executions/:id/fix`, `/api/retests` | `retests.js` |
| YC19 (mở rộng) | `scriptService.generate/save/run/staticCheck` | `/api/testcases/:id/script/*` | Tab Script (khi `SCRIPT_ENABLED=true`) |
| YC20 (mở rộng) | `jiraService.fetchSprints/saveSprints`, `sprintService` | `/api/projects/:id/sprints`, `/api/sprints/:id/burndown` | `sprints.js` (khi `SPRINT_ENABLED=true`) |

## 5.4. Một số điểm cài đặt đáng chú ý

**Strategy pattern cho LLM** – `src/services/ai/providers/`:

```js
class LLMProvider {
  async complete(req) { throw new Error('complete() chưa được hiện thực'); }
}
class GeminiProvider extends LLMProvider { /* gọi Gemini REST API */ }
// Đổi model: AI_PROVIDER=gemini | claude | openai | mock trong file .env
```

**Một quy trình AI dùng chung** – `aiService.run` che PII đệ quy (`maskDeep`), phát hiện injection, ghép prompt rồi gọi `callWithRetry`:

```js
while (attempts <= maxRetry) {
  attempts += 1;
  try {
    raw = await provider.complete({ ...prompt, timeoutMs });
    const parsed = zodSchema.parse(JSON.parse(raw));   // sai định dạng → ném lỗi → thử lại
    return { ok: true, data: refine ? refine(parsed) : parsed, attempts };
  } catch (err) { lastError = err.message; }           // thông báo kèm đường dẫn trường bị sai
}
```

**So sánh AC theo nội dung dòng** – `utils/ac.js`: `normalize` (bỏ dấu đầu dòng, số thứ tự, khoảng trắng), `parse`, `diff` trả `added`, `removed`, `same`. `storyService.applyContentChange` dùng kết quả để gắn cờ test trong **cùng transaction** với việc tạo phiên bản mới.

**Chỉ ghi bản Jira mới hơn** – `saveStories` so `fields.updated` với `jira_updated_at` đã lưu; bản cũ hơn hoặc bằng thì bỏ qua, nên hai lượt đồng bộ chồng nhau không ghi đè ngược.

**Cố định phiên bản trong Test Run** – `test_run_items.tc_version` lưu khi thêm test; `record` ghi `tc_version` của dòng đó vào `test_executions`, nên test sửa sau không làm đổi đợt; `get` so với phiên bản hiện tại để hiện cảnh báo.

**Lưu kết quả AI** – `saveAiResult` kiểm tra QĐ2 và thêm test mới trong **một transaction**, **không xóa bản nháp cũ**, trả về số test bị cắt khi vượt giới hạn.

**Sao lưu CSDL cũ** – `db/index.js` phát hiện lược đồ cũ, chạy `wal_checkpoint(TRUNCATE)` rồi đổi tên `app.db` (và `-wal`, `-shm`) thành `app.db.bak-<thời điểm>` trước khi tạo CSDL mới.

**MockProvider** – sinh test theo luật (mỗi AC một case Positive kèm `ac_refs`; AC có từ khóa "bắt buộc/tối đa/hết hạn…" thêm case Negative; AC có số + đơn vị thêm case biên); phân tích ảnh hưởng ghép AC cũ – mới theo vị trí để ra *Cần sửa*, AC mới chưa có test ra *Còn thiếu*; xếp ưu tiên regression theo AC đã đổi. Giúp demo chạy khi không có mạng hoặc API key và giúp test tự động ổn định.

**Chạy script do AI sinh an toàn (mở rộng)** – `scriptService.run`: kiểm tra tĩnh → ghi file tên ngẫu nhiên → `spawn('playwright test --reporter=json')` với `env` tối thiểu → `SIGKILL` khi quá `RUN_TIMEOUT_SEC` → xóa file tạm → ghi kết quả vào một test trong Test Run.

## 5.5. Quy ước và quản lý mã nguồn

- Đặt tên: `camelCase` cho biến/hàm, `PascalCase` cho lớp, `snake_case` cho cột CSDL, `UPPER_CASE` cho tham số quy định.
- Comment tiếng Việt, ghi rõ YC/QĐ liên quan ngay tại chỗ hiện thực.
- Git flow: nhánh `main` luôn chạy được; mỗi mục của Product Backlog một nhánh `feature/pb-xx-...` (ví dụ `feature/pb-06-ai-sinh-test-case`); tạo Pull Request, CI phải xanh mới merge.
- Commit theo dạng: `feat(yc2): sinh test case bằng AI`, `fix(qd4): bắt buộc ghi chú khi trả lại`, `test(e2e): luồng duyệt`.
- Không commit `.env`, CSDL, báo cáo test (`.gitignore`).

## 5.6. Hướng dẫn cài đặt môi trường phát triển

```bash
cd app
npm install
cp .env.example .env      # chỉnh AI_PROVIDER, API key nếu muốn dùng AI thật
npm run reset             # xóa và tạo lại CSDL với dữ liệu mẫu
npm run dev               # chạy và tự khởi động lại khi sửa mã
```

```bash
cd automation
npm install               # chỉ cần khi bật SCRIPT_ENABLED (YC19)
```
