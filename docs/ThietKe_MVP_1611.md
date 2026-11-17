# Thiết kế phần mềm theo đặc tả chốt 16/11

Căn cứ: `docs/DacTa_YeuCauNghiepVu_1011.docx` (bản chốt 16/11/2026). Tài liệu này là bản thiết kế làm việc để code; sau khi code xong, nội dung được đưa vào chương 3, 4 của báo cáo.

Quy ước: "requirement" trong đặc tả là một issue Jira được đồng bộ về, lưu ở bảng `user_stories` (giữ tên bảng cũ để không phải sửa toàn bộ code). Mã QĐ, BM, YC theo đặc tả chốt.

## 1. Phạm vi và nguyên tắc

| Nội dung | Quyết định thiết kế |
|---|---|
| Phạm vi | 18 yêu cầu MVP: YC1–YC18 (YC19, YC20 ngoài MVP) |
| Ngoài MVP | YC19 (script Playwright), YC20 (sprint): giữ code, ẩn bằng cờ `SCRIPT_ENABLED`, `SPRINT_ENABLED` trong `.env`, mặc định `false` |
| Jira | Đồng bộ một chiều; chỉ đọc; nhận diện bằng issue ID; chỉ ghi bản mới hơn (`updated`) |
| Phân quyền | 5 vai trò toàn cục; thêm 2 quyền `testrun:manage`, `proposal:review` |
| AI | Chỉ chạy khi người dùng bấm; không tự đổi test; mọi thay đổi qua YC4 |
| Kiến trúc | Giữ client–server nhiều lớp: route → service → CSDL; AI Service là module riêng |
| CSDL | SQLite (demo), SQL chuẩn để chuyển PostgreSQL |

## 2. Ánh xạ yêu cầu → module

| YC | Service | Route chính | Màn hình |
|---|---|---|---|
| YC1 | `storyService` | `GET /stories`, `/stories/:id`, `/stories/:id/versions` | Requirement (danh sách, chi tiết, lịch sử phiên bản) |
| YC2 | `aiService.generateTestCases`, `testCaseService.saveAiResult` | `POST /stories/:id/generate` | Chi tiết requirement |
| YC3 | `testCaseService` | `POST/PUT/DELETE /testcases`, `/testcases/submit`, `/testcases/recheck` | Test case |
| YC4 | `testCaseService.review` | `POST /testcases/:id/review` | Hàng đợi duyệt |
| YC5 | `runService.record` | `POST /runs/:id/items/:itemId/executions` | Chi tiết Test Run |
| YC6 | `reportService` | `GET /reports/summary` | Tổng quan |
| YC7 | `testCaseService.list` | `GET /testcases` | Test case |
| YC8 | `jiraService` | webhook, `POST /projects/:id/jira-sync`, `POST /stories/:id/check-decision` | Requirement Cần kiểm tra |
| YC9 | route xuất Excel | `GET /export/testcases.xlsx` | Test case |
| YC10 | `parameterService` | `GET/PUT /parameters` | Quản trị |
| YC11 | route quản trị | `/users` | Quản trị |
| YC12 | `jiraService` | `/jira/test`, `/jira/import` | Quản trị |
| YC13 | `suiteService` (mới) | `/suites` | Test Suite |
| YC14 | `runService` (viết lại) | `/runs` | Test Run |
| YC15 | `impactService` (mới) + `aiService.analyzeImpact` | `POST /stories/:id/analyze` | Chi tiết requirement → Đề xuất AI |
| YC16 | `impactService.decide` | `POST /proposals/:id/decision` | Đề xuất AI |
| YC17 | `regressionService` (mới) + `aiService.rankRegression` | `/regressions` | Bộ regression |
| YC18 | `retestService` (mới) | `POST /executions/:id/fix`, `GET /retests` | Kiểm thử lại |

## 3. Thiết kế dữ liệu

### 3.1. Danh sách bảng

| Bảng | Mới/sửa | Nội dung | BM, QĐ |
|---|---|---|---|
| `users` | giữ | Tài khoản, vai trò | BM10, QĐ11 |
| `projects`, `modules`, `project_members` | giữ | Dự án, module, thành viên từ Jira | BM11, QĐ12 |
| `user_stories` | sửa | Requirement hiện tại: thêm `jira_issue_id`, `issue_type`, `jira_updated_at`, `current_version`, `check_reason`, `check_kept_by/at`; bỏ `changed_at` | BM1, BM7, QĐ1, QĐ8 |
| `requirement_versions` | mới | Mỗi phiên bản nội dung (tiêu đề, mô tả, AC) | QĐ1, QĐ8 |
| `sync_logs` | mới | Kết quả từng lần đồng bộ (nguồn, thời điểm, lỗi) | BM7, QĐ8 [1.3] |
| `test_cases` | sửa | Thêm `req_version`, `needs_review`, `review_reason`, `proposal_id` | BM2, QĐ3 |
| `test_case_acs` | mới | Liên kết test ↔ AC (theo nội dung dòng AC) | QĐ3 |
| `test_case_versions` | giữ | Lịch sử nội dung test | QĐ3 |
| `recheck_logs` | mới | Nhật ký Đã xem lại | QĐ3 [2.2] |
| `reviews` | giữ | Phiếu duyệt | BM3, QĐ4 |
| `test_suites`, `test_suite_items` | mới | Test Suite phẳng | BM12, QĐ13 |
| `test_runs` | **đổi nghĩa** | Đợt kiểm thử (Test Run) | BM13, QĐ14 |
| `test_run_items` | mới | Test trong đợt: phiên bản cố định, người được giao | BM13, QĐ14 |
| `test_executions` | mới (thay `test_runs` cũ) | Từng lần ghi kết quả | BM4, QĐ5 |
| `fix_reports` | mới (tách từ cột `fix_*`) | Phiếu báo đã sửa, trạng thái kiểm thử lại | BM17, QĐ18 |
| `impact_analyses` | mới | Một lần chạy phân tích ảnh hưởng | BM14, QĐ15 |
| `ai_proposals` | mới | Đề xuất AI và quyết định của QA Lead | BM14, BM15, QĐ15, QĐ16 |
| `regression_sets`, `regression_items` | mới | Bộ regression đề xuất và xác nhận | BM16, QĐ17 |
| `ai_logs` | sửa | Thêm task `ANALYZE_IMPACT`, `RANK_REGRESSION` | QĐ2, QĐ15 |
| `parameters`, `audit_logs` | giữ | Tham số, nhật ký hoạt động | BM9, QĐ10 |
| `sprints`, `automation_scripts` | giữ, ngoài MVP | Chỉ dùng khi bật cờ | Phụ lục |

### 3.2. Chi tiết các bảng mới và cột thay đổi

**`user_stories`** (requirement hiện tại)

| Cột | Kiểu | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `jira_issue_id` | TEXT | UNIQUE | Issue ID Jira, định danh không đổi [1.1]. Dữ liệu mẫu không từ Jira để NULL |
| `code` | TEXT | NOT NULL UNIQUE | Mã hiển thị (VD SHOP-5), cập nhật khi Jira đổi mã |
| `issue_type` | TEXT | | Loại issue (Story…) [B2] |
| `jira_updated_at` | TEXT | | Thời điểm cập nhật trên Jira, dùng chặn ghi bản cũ [1.2] |
| `current_version` | INTEGER | NOT NULL DEFAULT 1 | Phiên bản hiện tại |
| `archived` | INTEGER | 0/1 | Đã lưu trữ |
| `check_reason` | TEXT | NULL | Khác NULL = Cần kiểm tra; giá trị: `NOT_FOUND`, `TYPE_EXCLUDED` [1.4] |
| `check_kept_by`, `check_kept_at` | | NULL | QA Lead/Admin đã chọn Giữ lại (cờ vẫn còn) [D2] |

Trạng thái đồng bộ hiển thị (BM1) được suy ra, không lưu riêng: `archived` → Đã lưu trữ; `check_reason` → Cần kiểm tra (kèm "đã chọn Giữ lại" nếu có `check_kept_at`); số AC = 0 → Thiếu AC; còn lại Bình thường.

**`requirement_versions`**: `id`, `story_id` FK, `version` (UNIQUE với story), `title`, `description`, `acceptance_criteria`, `jira_updated_at`, `changes` (JSON: phần đổi `title`/`description`/`ac_added`/`ac_removed`), `source` (`IMPORT`/`WEBHOOK`/`SCHEDULE`/`MANUAL`), `created_at`.

**`sync_logs`**: `id`, `project_id` FK, `source`, `started_at`, `finished_at`, `status` (`SUCCESS`/`FAILED`), `attempts`, `summary` (JSON), `error`.

**`test_cases`** thêm: `req_version` INTEGER (phiên bản requirement đã liên kết, QĐ3, nâng lên khi Đã xem lại hoặc bản sửa được duyệt [R5]); `needs_review` 0/1; `review_reason` TEXT (`AC_CHANGED`/`AC_REMOVED`/`CONTENT_CHANGED`); `proposal_id` FK `ai_proposals` (tạo từ đề xuất).

**`test_case_acs`**: `test_case_id` FK, `ac_text` TEXT; PK (`test_case_id`, `ac_text`). AC nhận diện theo nội dung dòng đã chuẩn hóa (bỏ ký hiệu đầu dòng, khoảng trắng thừa) [QĐ3].

**`recheck_logs`**: `id`, `test_case_id`, `user_id`, `req_version`, `reason`, `batch_id` (xác nhận hàng loạt [D1]), `created_at`.

**`test_suites`**: `id`, `project_id`, `name` (3–100, UNIQUE trong dự án), `description`, `created_by`, `created_at`. **`test_suite_items`**: PK (`suite_id`, `test_case_id`).

**`test_runs`** (đợt): `id`, `project_id`, `name`, `run_type` (`NORMAL`/`RETEST`/`REGRESSION`), `build`, `environment`, `due_date`, `status` (`OPEN`/`CLOSED`), `created_by`, `created_at`, `closed_by`, `closed_at`, `regression_set_id`.

**`test_run_items`**: `id`, `run_id`, `test_case_id`, `tc_version` (cố định khi đưa vào đợt), `assignee_id`; UNIQUE (`run_id`, `test_case_id`).

**`test_executions`**: `id`, `run_id`, `item_id`, `test_case_id`, `tc_version`, `result` (`PASS`/`FAIL`/`BLOCKED`), `note`, `defect_code`, `evidence_url`, `retest_of` FK `test_executions` (lần Fail gốc [3.1]), `run_type` (`MANUAL`/`AUTO`), `executed_by`, `executed_at`.

**`fix_reports`**: `id`, `execution_id` FK UNIQUE (lần Fail), `build` (1–50), `note`, `reported_by`, `reported_at`, `status` (`WAITING`/`CLOSED`/`REOPENED`), `closed_by_execution` FK.

**`impact_analyses`**: `id`, `story_id`, `from_version`, `to_version`, `user_id`, `ai_log_id`, `created_at`.

**`ai_proposals`**: `id`, `analysis_id`, `story_id`, `type` (`UPDATE` Cần sửa / `MISSING` Còn thiếu / `RERUN` Nên chạy lại / `CLARIFY` Cần làm rõ), `test_case_id` NULL, `source_part` (`AC`/`TITLE`/`DESCRIPTION`), `source_ac`, `content` (JSON test đề xuất cho UPDATE, MISSING), `reason`, `req_version`, `tc_version`, `status` (`PENDING`/`ACCEPTED`/`REJECTED`/`OUTDATED`), `decided_by`, `decided_at`, `note`, `result_test_case_id`.

**`regression_sets`**: `id`, `story_id`, `from_version`, `to_version`, `status` (`DRAFT`/`CONFIRMED`), `ai_log_id`, `created_by`, `created_at`, `confirmed_by`, `confirmed_at`, `run_id`.
**`regression_items`**: `set_id`, `test_case_id`, `priority` (`HIGH`/`MEDIUM`/`LOW`), `reason`, `origin` (`LINKED`/`AI`/`PROPOSAL`/`MANUAL`), `mandatory` 0/1, `removed` 0/1, `remove_reason`; PK (`set_id`, `test_case_id`).

### 3.3. Nâng cấp CSDL cũ

Lược đồ mới đổi nghĩa bảng `test_runs`. Khi khởi động, nếu phát hiện CSDL kiểu cũ (`test_runs` có cột `test_case_id`), hệ thống đổi tên file cũ thành `app.db.bak-<thời điểm>`, tạo CSDL mới và nạp dữ liệu mẫu, rồi in thông báo. Dữ liệu thật lấy lại bằng đồng bộ Jira.

## 4. Sơ đồ trạng thái

**Test case** (QĐ3, QĐ4, [R4]): `DRAFT` → gửi duyệt → `PENDING_REVIEW` → `APPROVED` hoặc `RETURNED` (bắt buộc ghi chú); `RETURNED` → sửa → gửi lại; `APPROVED` → sửa → `DRAFT`. Cờ `needs_review` độc lập với trạng thái: gắn khi AC/tiêu đề/mô tả đổi; gỡ khi Đã xem lại hoặc bản sửa được duyệt.

**Requirement** (QĐ8, [D2]): Bình thường ↔ Thiếu AC (theo số AC); → Cần kiểm tra (biến mất khỏi đồng bộ) → Lưu trữ, hoặc Giữ lại (vẫn Cần kiểm tra) → tự về Bình thường khi đồng bộ lấy lại được issue; Lưu trữ → tự hiện lại khi xuất hiện lại trên Jira.

**Test Run** (QĐ14, [D3]): `OPEN` (build, môi trường sửa được khi chưa có kết quả) → có kết quả đầu tiên (khóa build, môi trường) → `CLOSED` (xác nhận nếu còn test chưa chạy).

**Đề xuất AI** (QĐ16): `PENDING` → `ACCEPTED` / `REJECTED` (bắt buộc ghi chú) / `OUTDATED` (phiên bản requirement hoặc test đã đổi).

**Kiểm thử lại** (QĐ18, [3.3]): lần Fail → Developer báo sửa → `WAITING` → chạy lại: Pass → `CLOSED`; Fail → `REOPENED` (Developer báo lần nữa trên lần Fail mới); Blocked → vẫn `WAITING`.

## 5. Thiết kế xử lý

### 5.1. Đồng bộ Jira (YC1, YC8, QĐ1, QĐ8)

1. Lấy danh sách issue theo `JIRA_ISSUE_TYPES` (mặc định `Story`); lỗi gọi Jira thử lại tối đa 2 lần; vẫn lỗi thì ghi `sync_logs` FAILED và không đổi dữ liệu.
2. Với mỗi issue: tìm theo `jira_issue_id` (nếu không có thì theo mã). Nếu `updated` của Jira không mới hơn `jira_updated_at` đã lưu thì bỏ qua [1.2].
3. Tách Description thành mô tả và AC. Nếu tiêu đề, mô tả hoặc AC đổi: tạo `requirement_versions` mới, tăng `current_version`, gắn cờ test:
   - AC đổi hoặc bị bỏ: test có liên kết tới dòng AC không còn → `needs_review`, lý do `AC_CHANGED`/`AC_REMOVED` [A1].
   - Tiêu đề hoặc mô tả đổi: mọi test của requirement → `needs_review`, lý do `CONTENT_CHANGED` [D1].
   - Ưu tiên, trạng thái Jira đổi: chỉ cập nhật giá trị hiện tại.
4. Issue đang có trong hệ thống nhưng không có trong kết quả: nếu danh sách rỗng hoặc lỗi kết nối thì không làm gì; ngược lại hỏi Jira theo từng issue ID: 404 → `NOT_FOUND`; loại không thuộc `JIRA_ISSUE_TYPES` → `TYPE_EXCLUDED`; gắn `check_reason` [1.4].
5. Issue có `check_reason` mà được lấy lại với loại hợp lệ → xóa `check_reason`, `check_kept_*` [D2]; issue đã lưu trữ xuất hiện lại → bỏ `archived`.

### 5.2. Gắn AC và Đã xem lại (YC3, QĐ3, [D1], [R5])

- Tạo/sửa test: nhận danh sách AC (theo nội dung dòng của phiên bản hiện tại); lưu `test_case_acs`, `req_version = current_version`.
- Gửi duyệt: bắt buộc ≥ 1 AC.
- Đã xem lại (`POST /testcases/recheck`, nhiều id, một lý do): chỉ test có cờ; cho phép gán lại AC; ghi `recheck_logs`; gỡ cờ; `req_version = current_version`.
- Bản sửa được duyệt (YC4): gỡ cờ, `req_version = current_version`.
- Sửa test `APPROVED` → `DRAFT`, tăng `version`, ghi `test_case_versions` [R4].
- Xóa: chỉ `DRAFT`/`RETURNED` và chưa có `test_executions` [A2].

### 5.3. Test Run (YC5, YC14, QĐ5, QĐ14)

- Điều kiện chạy (dùng chung với YC17): test `APPROVED`, không `needs_review`, requirement không `archived` và không `check_reason`.
- Lập đợt: chọn suite hoặc danh sách test; test không đủ điều kiện bị bỏ và trả về kèm lý do; `tc_version` = phiên bản hiện tại.
- Ghi kết quả: đợt `OPEN`; người ghi là người được giao hoặc QA Lead; Fail/Blocked bắt buộc ghi chú; lưu theo `tc_version` của item.
- Sửa build/môi trường: chỉ khi đợt chưa có `test_executions` [D3].
- Đóng đợt: còn test chưa chạy thì phải gửi `confirm=true`; trả về số test chưa chạy [B4].
- Cảnh báo (không chặn): test có phiên bản mới, requirement đổi/lưu trữ/Cần kiểm tra [A6].

### 5.4. Phân tích ảnh hưởng (YC15, QĐ15)

1. Điều kiện: requirement có ≥ 2 phiên bản; giới hạn AI chung (QĐ2).
2. Mốc so = phiên bản cũ nhất trong các `req_version` của test (không có test thì phiên bản liền trước); so với `current_version`.
3. Đầu vào AI: hai phiên bản (đã che dữ liệu), danh sách test kèm AC liên kết và `req_version` riêng của từng test.
4. Kết quả AI (JSON schema): mảng đề xuất `{type, test_code?, source_part, source_ac?, reason, proposal?}`; hệ thống kiểm tra schema, bỏ đề xuất trỏ tới test không có, bắt buộc `reason` và `source_part`.
5. Lưu `impact_analyses`, `ai_proposals` (ghi `req_version`, `tc_version` lúc phân tích), `ai_logs`.

### 5.5. Áp dụng đề xuất (YC16, QĐ16)

- Kiểm tra `current_version` và `version` của test so với lúc phân tích; khác → `OUTDATED`.
- `UPDATE`: sửa test theo nội dung đề xuất, test về `DRAFT`, ghi `proposal_id`.
- `MISSING`: tạo test `DRAFT` nguồn AI trong giới hạn QĐ2, liên kết AC nguồn, ghi `proposal_id`.
- `RERUN`: thêm test vào bộ regression `DRAFT` của cùng thay đổi; chưa có bộ thì tạo bộ.
- `CLARIFY`: chỉ ghi nhận.
- `REJECTED` bắt buộc ghi chú.

### 5.6. Bộ regression (YC17, QĐ17)

- Tạo bộ cho một requirement (từ phiên bản trước tới hiện tại): phần bắt buộc = test liên kết với AC đã đổi; nếu tiêu đề/mô tả đổi thì mọi test [R3]. AI xếp ưu tiên kèm lý do và gợi ý thêm; không gọi được AI thì vẫn trả danh sách liên kết.
- Test chưa đủ điều kiện chạy được liệt kê riêng; chỉ xác nhận được khi không còn test như vậy trong bộ.
- Bỏ test bắt buộc phải ghi lý do. Xác nhận → tạo Test Run `REGRESSION`.

### 5.7. Báo sửa lỗi và kiểm thử lại (YC18, QĐ18, [R1])

- Developer chọn lần Fail gần nhất của test trong cùng Test Run, nhập build (1–50 ký tự); mỗi lần Fail báo một lần → `fix_reports` `WAITING`.
- Chạy lại trong cùng đợt chỉ khi đợt `OPEN` và build trùng; ngược lại QA Lead lập đợt `RETEST` với build đã sửa từ danh sách chờ.
- Ghi kết quả có `retest_of` → cập nhật `fix_reports` theo bảng Pass/Fail/Blocked; lệch build thì cảnh báo, không chặn.

### 5.8. Báo cáo (YC6, QĐ6)

Tính khi mở; phạm vi dự án hoặc Test Run; lần chạy gần nhất mỗi test (trong đợt khi chọn đợt; ở phạm vi dự án chỉ tính lần chạy của phiên bản hiện tại của test `APPROVED`); Blocked tính đã chạy; chỉ requirement chưa lưu trữ; bao phủ story (mẫu số không gồm Thiếu AC) và bao phủ AC; thống kê AI: tỷ lệ phải sửa tính khi bước hoặc kết quả mong đợi đổi so với bản AI gốc; đếm đề xuất theo trạng thái.

## 6. Thiết kế API

Mọi API (trừ đăng nhập, webhook) yêu cầu JWT. Đặc tả đầy đủ dạng OpenAPI 3: `docs/api/openapi.yaml` (viết ở đợt 2 cùng code).

| Phương thức, đường dẫn | Quyền | YC |
|---|---|---|
| `GET /stories?project_id&state&q` | đăng nhập | YC1 |
| `GET /stories/:id`, `GET /stories/:id/versions` | đăng nhập | YC1 |
| `POST /stories/:id/check-decision` `{decision: ARCHIVE/KEEP}` | `jira:import` | YC8 |
| `POST /stories/:id/generate` | `ai:use` | YC2 |
| `GET /testcases?…&needs_review&suite_id&run_id` | đăng nhập | YC7 |
| `POST /testcases`, `PUT /testcases/:id`, `DELETE /testcases/:id` | `testcase:write` | YC3 |
| `POST /testcases/submit`, `POST /testcases/recheck` | `testcase:write` | YC3 |
| `POST /testcases/:id/review` | `testcase:review` | YC4 |
| `GET/POST/PUT/DELETE /suites`, `PUT /suites/:id/items` | `testcase:write` (ghi) | YC13 |
| `GET /runs`, `GET /runs/:id` | đăng nhập | YC14 |
| `POST /runs`, `PUT /runs/:id`, `POST /runs/:id/items`, `PUT /runs/:id/items/:itemId`, `POST /runs/:id/close` | `testrun:manage` | YC14 |
| `POST /runs/:id/items/:itemId/executions` | `run:write` | YC5 |
| `POST /stories/:id/analyze` | `ai:use` | YC15 |
| `GET /proposals?story_id&status` | `ai:use` | YC16 |
| `POST /proposals/:id/decision` | `proposal:review` | YC16 |
| `POST /regressions`, `GET /regressions/:id` | `ai:use` | YC17 |
| `PUT /regressions/:id/items`, `POST /regressions/:id/confirm` | `proposal:review` | YC17 |
| `GET /retests` | đăng nhập | YC18 |
| `POST /executions/:id/fix` | `bug:fix` | YC18 |
| `GET /reports/summary?project_id&run_id` | đăng nhập | YC6 |
| `GET /export/testcases.xlsx` | đăng nhập | YC9 |

## 7. Thiết kế giao diện

| Màn hình | Vai trò dùng | Thành phần chính |
|---|---|---|
| Tổng quan | mọi vai trò | Chọn dự án/Test Run; chỉ số, biểu đồ, bao phủ story và AC, đề xuất AI |
| Requirement | mọi vai trò | Lọc theo trạng thái đồng bộ; chi tiết: AC, lịch sử phiên bản (so trước/sau), test liên quan; nút Sinh test, Phân tích ảnh hưởng, Tạo bộ regression; Lưu trữ/Giữ lại |
| Test case | QA Lead, Tester | Bộ lọc BM6; soạn test với chọn AC; Đã xem lại hàng loạt; gửi duyệt; xuất Excel |
| Duyệt | QA Lead | Hàng đợi, xem nguồn (thủ công/AI, đề xuất), Duyệt/Trả lại |
| Test Suite | QA Lead, Tester | Danh sách suite, thêm/bớt test |
| Test Run | QA Lead (lập), Tester (chạy) | Danh sách đợt; lập đợt từ suite/test (liệt kê test bị chặn); chi tiết: phân công, ghi kết quả, cảnh báo, đóng đợt |
| Đề xuất AI | QA Lead (quyết định), Tester (xem) | Trước/sau, loại, lý do, phần thay đổi nguồn; Chấp nhận/Từ chối |
| Bộ regression | QA Lead | Danh sách test, ưu tiên, lý do, test bị chặn; thêm/bớt; xác nhận |
| Kiểm thử lại | Developer, Tester, QA Lead | Lần Fail cần sửa; báo đã sửa; danh sách chờ kiểm thử lại; tạo đợt kiểm thử lại |
| Quản trị | Admin, QA Lead | Người dùng, Jira, tham số, nhật ký |

## 8. Kiểm thử

- Unit: tách Description/AC, so khác AC, chuẩn hóa dòng AC, schema AI mới.
- API: mỗi YC13–YC18 ít nhất 1 test; các trường hợp biên của QĐ3, QĐ8, QĐ14, QĐ16, QĐ17, QĐ18 (gồm [D1]–[D3], [R1]–[R5]).
- E2E: luồng chính mới: sửa AC trên Jira giả lập → đồng bộ → test bị gắn cờ → phân tích ảnh hưởng → chấp nhận đề xuất → duyệt → bộ regression → Test Run → ghi kết quả.

## 9. Công cụ

| Việc | Công cụ |
|---|---|
| Sơ đồ (use case, DFD, ERD, lớp, tuần tự, trạng thái) | draw.io Desktop (file `.drawio`, xuất SVG bằng draw.io CLI) |
| CSDL | SQLite; kiểm tra bằng DB Browser for SQLite |
| API | OpenAPI 3 (`docs/api/openapi.yaml`) |
| Báo cáo | Markdown → Word (`.docx`) bằng `docs/tools`, hoàn thiện và xuất PDF bằng Microsoft Word |
| Backlog | Excel |
| Code, test | VS Code, Node.js test runner, Supertest, Playwright |
