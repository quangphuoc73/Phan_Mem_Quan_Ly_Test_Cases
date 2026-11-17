# Chương 7. Triển khai và hướng dẫn sử dụng

## 7.1. Yêu cầu hệ thống

| Thành phần | Yêu cầu |
|---|---|
| Cách 1 – chạy trực tiếp | Node.js ≥ 20, 500 MB đĩa (Google Chrome chỉ cần khi bật YC19) |
| Cách 2 – Docker | Docker Desktop ≥ 4.x (đã có sẵn Chromium trong image) |
| Trình duyệt người dùng | Chrome, Edge, Firefox, Safari bản mới |
| Mạng | Cần Internet khi dùng AI thật (Gemini/Claude/OpenAI) hoặc Jira Cloud thật; chế độ `mock` và Jira giả lập chạy offline |

## 7.2. Cách 1 – Chạy trực tiếp trên máy (khuyến nghị khi demo)

**Nhanh nhất trên macOS:** bấm đúp file `ChayDemo.command` ở thư mục gốc. Script tự cài thư viện (lần đầu), tạo dữ liệu mẫu, chạy server và mở trình duyệt.

**Hoặc chạy bằng lệnh:**

```bash
cd app
npm install
cp .env.example .env
npm run reset
npm start
```

Chỉ khi bật YC19 mới cần thêm `cd automation && npm install`. Lần đầu chạy bản mới trên CSDL cũ, hệ thống tự sao lưu `app.db` thành `app.db.bak-<thời điểm>` rồi tạo CSDL theo lược đồ mới.

Mở `http://localhost:3000`.

## 7.3. Cách 2 – Docker

```bash
docker compose up --build
```

- Mở `http://localhost:3000`. Dữ liệu lưu ở volume `app-data`, không mất khi khởi động lại.
- Container chạy bằng user không phải root, giới hạn 2 CPU và 2 GB RAM, bật `no-new-privileges`.
- Khi đưa lên server thật: đặt `JWT_SECRET` ngẫu nhiên, đặt reverse proxy (Nginx/Caddy) có HTTPS phía trước, đổi mật khẩu các tài khoản mẫu.

## 7.4. Cấu hình AI thật

Mặc định hệ thống dùng `AI_PROVIDER=mock` (không cần mạng). Để dùng AI thật, sửa `app/.env`:

| Provider | Cấu hình | Ghi chú |
|---|---|---|
| Gemini | `AI_PROVIDER=gemini`, `GEMINI_API_KEY=...` | Có gói miễn phí, phù hợp sinh viên. Lấy key tại Google AI Studio |
| Claude | `AI_PROVIDER=claude`, `ANTHROPIC_API_KEY=...` | Trả phí theo token; chất lượng test case tốt |
| OpenAI | `AI_PROVIDER=openai`, `OPENAI_API_KEY=...` | Trả phí theo token |

Khởi động lại server sau khi sửa. Thanh bên trái hiển thị provider và model đang dùng.

> **Chính sách dữ liệu:** dữ liệu gửi qua API của các nhà cung cấp trên (gói API, không phải ứng dụng chat) theo điều khoản hiện hành không được dùng để huấn luyện model; hệ thống vẫn che dữ liệu nhạy cảm trước khi gửi. Kiểm tra lại điều khoản mới nhất của nhà cung cấp trước khi dùng với dữ liệu thật.

### Cấu hình kết nối Jira (YC1, YC8, YC12)

Requirement chỉ được tạo trên Jira rồi đồng bộ **một chiều** về hệ thống. Jira Cloud gói **Free** (tối đa 10 người) là đủ. Để trống `JIRA_BASE_URL` thì hệ thống dùng **Jira giả lập** có 2 dự án mẫu `HRM` và `LIB` (cho kiểm thử tự động và khi buổi demo không có mạng); ở chế độ này chi tiết requirement có nút **✎ Mô phỏng sửa trên Jira** để demo PO/BA đổi AC. Để dùng Jira thật, điền vào `app/.env` rồi khởi động lại server:

| Biến | Ví dụ | Ghi chú |
|---|---|---|
| `JIRA_BASE_URL` | `https://ten-nhom.atlassian.net` | Địa chỉ Jira Cloud của nhóm |
| `JIRA_EMAIL` | email tài khoản Atlassian | Tài khoản có quyền xem dự án |
| `JIRA_API_TOKEN` | (token) | Tạo tại *id.atlassian.com → Bảo mật → Mã thông báo API*; chỉ để trong `.env`, không commit |
| `JIRA_SYNC_MINUTES` | `5` | Tự đồng bộ mọi dự án Jira mỗi 5 phút; `0` = tắt |
| `JIRA_WEBHOOK_SECRET` | chuỗi ngẫu nhiên dài | Bật webhook; để trống thì tắt |
| `JIRA_ISSUE_TYPES` | `Story` | Các loại issue được đồng bộ, ngăn cách bằng dấu phẩy (VD `Story,Task`) |

Thành viên Jira được gán vào tài khoản có **email trùng** (Jira ẩn email thì so họ tên), nên Admin tạo tài khoản với đúng email Atlassian của từng người trước khi đồng bộ. Danh sách thành viên chỉ dùng để hiển thị và phân công, không cấp quyền.

**Quy ước viết requirement trên Jira** (để hệ thống đọc được):

1. Loại issue thuộc `JIRA_ISSUE_TYPES` (mặc định **Story**).
2. Trong **Description**: phần đầu là mô tả *"Là …, tôi muốn …, để …"*; tiếp theo một dòng **Acceptance criteria**; dưới đó mỗi dòng (gạch đầu dòng) là một AC.
3. **Priority** Highest/High → High, Medium → Medium, Low/Lowest → Low. **Component** thành module.
4. Sửa câu chữ một AC được tính là bỏ AC cũ, thêm AC mới: test liên kết AC cũ sẽ bị gắn cờ *Cần xem lại*.

**Webhook** (tùy chọn, cần địa chỉ công khai): Jira → *Settings → System → WebHooks → Create* với URL `https://<địa chỉ app>/api/jira/webhook?secret=<JIRA_WEBHOOK_SECRET>`, chọn sự kiện *Issue created / updated / deleted*. Khi chạy trên máy cá nhân, mở đường hầm bằng `ngrok http 3000`; nếu không dùng webhook thì đồng bộ định kỳ và nút *Đồng bộ ngay* vẫn đủ.

### Bật phần mở rộng (ngoài MVP)

| Biến | Mặc định | Khi bật |
|---|---|---|
| `SCRIPT_ENABLED` | `false` | YC19: tab Script Playwright trong chi tiết test case, URL ứng dụng cần test ở *Dự án & module*, tham số `RUN_TIMEOUT_SEC` |
| `SPRINT_ENABLED` | `false` | YC20: menu *Sprint (mở rộng)*, ô chọn sprint, đồng bộ sprint và story point từ Jira, tham số `SPRINT_MAX_DAYS` |

### Cấu hình bộ kiểm thử Playwright (phần mở rộng YC19)

Sao chép `automation/.env.example` thành `automation/.env` (không commit file này):

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `BASE_URL` | `https://www.saucedemo.com/` | Web cần kiểm thử |
| `TEST_USERNAME`, `TEST_PASSWORD`, `LOCKED_USERNAME` | Tài khoản công khai của Sauce Demo | Tài khoản **test** dùng trong bộ test mẫu |
| `PW_CHANNEL` | (trống = Chrome trên máy) | `chromium` khi chạy trong Docker/CI |
| `HEADED`, `SLOW_MO` | chạy ngầm, 0 ms | `HEADED=1`, `SLOW_MO=300` để hội đồng xem trình duyệt tự thao tác khi demo |
| `TEST_TIMEOUT`, `EXPECT_TIMEOUT`, `RETRIES`, `WORKERS` | 30000, 5000, 0, tự động | Thời gian chờ, số lần chạy lại, số luồng song song |
| `VIDEO` | (tắt) | `1` để quay video khi lỗi (cần `npx playwright install ffmpeg`) |
| `APP_URL` | `http://localhost:3000` | Hệ thống dùng cho công cụ chụp ảnh `tools/screenshots.js` |

Máy phát triển đã có sẵn `automation/.env` (Chrome trên máy, chạy ngầm, 4 luồng). **Khi demo cho hội đồng xem trình duyệt tự thao tác**, sửa hai dòng `HEADED=1` và `SLOW_MO=300`, rồi đổi lại sau buổi bảo vệ.

**Trên GitHub Actions (CI):** job *Playwright mẫu (Sauce Demo)* đọc biến từ repo, vào *Settings → Secrets and variables → Actions*:

| Loại | Tên | Giá trị ví dụ | Ghi chú |
|---|---|---|---|
| Secret | `TEST_USERNAME` | `standard_user` | Tài khoản test – lưu ở Secrets để không lộ trong log |
| Secret | `TEST_PASSWORD` | `secret_sauce` | |
| Variable | `BASE_URL` | `https://www.saucedemo.com/` | Đổi sang môi trường staging khi test web của mình |
| Variable | `LOCKED_USERNAME` | `locked_out_user` | |

Chưa khai báo thì CI dùng giá trị mặc định cho Sauce Demo. CI luôn đặt sẵn `PW_CHANNEL=chromium`, `RETRIES=1`, `WORKERS=2`.

## 7.5. Tài khoản mẫu

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Admin | `admin` | `Admin@123` |
| QA Lead | `qalead` | `QaLead@123` |
| PO / BA | `poba` | `PoBa@1234` |
| Tester | `tester` | `Tester@123` |
| Developer | `dev` | `Dev@123456` |

Dữ liệu mẫu (không liên kết Jira, để xem và demo; không đồng bộ được):

- **PETINS – App bảo hiểm thú cưng** (hư cấu): 3 module, requirement PETINS-1…PETINS-5 (PETINS-5 *Thiếu AC*), test đã duyệt có liên kết AC, suite *Đăng ký tài khoản*, đợt *Đăng ký – build 1.0.0* (đã đóng, có 1 lần Fail) và đợt *Kiểm thử lại – build 1.0.1* (đã đóng, lần chạy lại Pass gắn với lần Fail gốc).
- **SAUCE – Sauce Demo Shop** (web thật `https://www.saucedemo.com/`): SAUCE-1, SAUCE-2, 4 test đã duyệt, suite *Smoke test cửa hàng*, đợt *Smoke test – bản web 11/2026* đang mở.

Muốn demo đầy đủ vòng thay đổi requirement, thêm dự án `HRM` từ Jira giả lập (mục 7.6, Admin). Đặt lại dữ liệu: `npm run reset`.

## 7.6. Hướng dẫn sử dụng theo vai trò

Menu bên trái chỉ hiện chức năng đúng quyền: *Tổng quan & báo cáo*, *Requirement (Jira)*, *Test case*, *Duyệt test case*, *Test Suite*, *Test Run*, *Đề xuất AI*, *Sửa lỗi & kiểm thử lại*, *Nhật ký AI*, *Thay đổi quy định*, *Dự án & module*, *Người dùng*, *Nhật ký hoạt động*. Chọn dự án ở thanh trên cùng để lọc toàn hệ thống.

### Tester

1. **Requirement (Jira):** các tab *Bình thường*, *Thiếu AC*, *Cần kiểm tra*, *Đã lưu trữ*; cột số test cần xem lại. Mở một requirement để xem AC, lịch sử phiên bản và **so sánh hai phiên bản** (AC đổi được tô màu).
2. **Sinh test bằng AI:** trong chi tiết requirement bấm *✨ Sinh test case bằng AI*. Test mới ở trạng thái *Nháp*, mỗi test đã gắn AC; bản nháp cũ được giữ.
3. **Soạn, gán AC, gửi duyệt:** bấm một test → *✏️ Sửa* → chọn AC liên kết → *Lưu phiên bản mới*; *＋ Thêm thủ công* khi thiếu. Tích chọn → *📤 Gửi duyệt mục đã chọn* (test phải có ít nhất 1 AC).
4. **Khi requirement đổi:** test có cờ 🔁 *Cần xem lại*. Test vẫn đúng → *✔ Đã xem lại* (bắt buộc ghi lý do, có thể gán lại AC); nhiều test bị gắn cờ do đổi tiêu đề/mô tả → chọn hết → *✔ Đã xem lại mục đã chọn* với một lý do chung. Test cần sửa → sửa, gửi duyệt lại.
5. **Phân tích ảnh hưởng:** *🔍 Phân tích ảnh hưởng (AI)* trong chi tiết requirement; xem đề xuất ở menu *Đề xuất AI* (Tester chỉ xem, QA Lead quyết định).
6. **Test Suite:** *＋ Tạo suite*, *＋ Thêm vào suite* để gom test theo chức năng.
7. **Ghi kết quả:** menu *Test Run* → mở đợt → test được giao cho mình → *Ghi kết quả*: Pass / Fail / Blocked, ghi chú (bắt buộc khi Fail, Blocked), mã defect, liên kết bằng chứng.
8. **Kiểm thử lại:** menu *Sửa lỗi & kiểm thử lại* liệt kê phiếu *Chờ kiểm thử lại*; chạy lại trong đợt chứa lần Fail (nếu còn mở và trùng build) hoặc trong đợt Kiểm thử lại do QA Lead lập.

### QA Lead

Có mọi chức năng của Tester, thêm:

1. **Duyệt:** menu *Duyệt test case* (huy hiệu cho biết số chờ) → *✓ Duyệt*, hoặc nhập ghi chú → *↩️ Trả lại*; chọn nhiều → *✓ Duyệt tất cả mục đã chọn*.
2. **Lập Test Run:** *＋ Lập Test Run* → tên, build, môi trường, hạn → chọn suite hoặc test → giao người chạy → *Lập đợt*. Test không đủ điều kiện được liệt kê kèm lý do. Build, môi trường chỉ sửa được khi đợt chưa có kết quả; muốn chạy build khác thì lập đợt mới. *Đóng đợt* khi xong (còn test chưa chạy thì hệ thống hỏi xác nhận).
3. **Đề xuất AI:** menu *Đề xuất AI* → xem nội dung trước/sau, lý do → *✓ Chấp nhận* hoặc *✕ Từ chối* (bắt buộc ghi chú). Bản nháp tạo ra phải duyệt lại; đề xuất *Lỗi thời* không áp dụng được.
4. **Bộ regression:** trong chi tiết requirement → *🧭 Tạo bộ regression* → xem phần bắt buộc, ưu tiên AI gợi ý, test chưa đủ điều kiện → thêm, bỏ (bỏ test bắt buộc phải ghi lý do) → *✓ Xác nhận và tạo Test Run*.
5. **Kiểm thử lại:** ở *Sửa lỗi & kiểm thử lại* chọn phiếu → *▶️ Lập đợt Kiểm thử lại cho mục đã chọn* (dùng build Developer đã báo).
6. **Requirement Cần kiểm tra:** mở requirement ở tab *Cần kiểm tra*, đọc lý do → *🗄 Lưu trữ* hoặc *Giữ lại* (cờ vẫn còn tới khi đồng bộ lấy lại được issue).
7. **Đồng bộ, quy định, báo cáo:** *⟳ Đồng bộ ngay*; *Thay đổi quy định*; *Tổng quan & báo cáo* theo dự án hoặc theo Test Run (*📊 Báo cáo đợt*).

### PO / BA

Viết và sửa requirement **trên Jira** theo quy ước ở mục 7.4. Trong hệ thống chỉ xem: requirement và lịch sử phiên bản (để biết thay đổi nào đã được hệ thống ghi nhận), danh sách *Thiếu AC* (để bổ sung AC trên Jira), test case, Test Run và báo cáo để nghiệm thu.

### Developer

1. Xem lần Fail ở *Sửa lỗi & kiểm thử lại* hoặc trong Test Run (ghi chú, mã defect, bằng chứng) để tái hiện lỗi.
2. Sửa xong, bấm **🔧 Báo đã sửa** ở lần Fail → nhập build (VD `1.0.2`, bắt buộc) và ghi chú → *Báo đã sửa*. Phiếu chuyển *Chờ kiểm thử lại*.
3. Theo dõi kết quả: Pass → *Đã đóng*; Fail → *Mở lại*, cần báo sửa lần nữa.

### Admin

*Người dùng* (thêm, sửa, khóa/mở khóa, xem ma trận phân quyền), *Nhật ký hoạt động*, *Nhật ký AI*, *Thay đổi quy định*.

**Dự án & module (YC12):**
1. Bấm **🔌 Kiểm tra kết nối Jira** (dòng đầu trang cho biết Jira thật hay giả lập, webhook đã bật chưa, loại issue được đồng bộ).
2. Bấm **⬇ Thêm dự án từ Jira**, nhập mã dự án (VD `HRM` ở chế độ giả lập, `SHOP` với Jira thật) → hệ thống lấy tên, mô tả, module, thành viên và requirement; thông báo thành viên chưa có tài khoản.
3. Mỗi thẻ dự án hiện số requirement, số *Cần kiểm tra*, lần đồng bộ gần nhất và nhật ký đồng bộ; bấm **⟳ Đồng bộ ngay** khi cần.

QA Lead cũng thêm dự án và đồng bộ được, nhưng không kiểm tra kết nối. Hệ thống không có chức năng tạo dự án, module hay requirement bằng tay.

## 7.7. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `Error: listen EADDRINUSE :3000` | Cổng 3000 đang được dùng | `PORT=3001 npm start` |
| Thanh bên báo "Playwright worker: chưa cài" (khi bật YC19) | Chưa cài thư mục `automation` | `cd automation && npm install`, khởi động lại server |
| Chạy tự động báo "Không chạy được script… Chrome" (YC19) | Máy không có Google Chrome | Cài Chrome, hoặc `npx playwright install chromium` và đặt `PW_CHANNEL=chromium` |
| Provider "unavailable" | Chọn AI thật nhưng thiếu API key | Điền key trong `.env` hoặc quay về `AI_PROVIDER=mock` |
| AI báo "chưa sinh được test case hợp lệ" | Model trả sai định dạng sau 3 lần | Bấm sinh lại; xem *Nhật ký AI* để biết lý do; hoặc viết thủ công |
| Bị 429 khi gọi AI | Vượt hạn mức/giờ | Chờ, hoặc QA Lead tăng `AI_CALLS_PER_HOUR` |
| "Jira từ chối xác thực" / "Không kết nối được tới Jira" | Sai `JIRA_EMAIL`, `JIRA_API_TOKEN` hoặc `JIRA_BASE_URL` | Tạo lại API token, kiểm tra địa chỉ có dạng `https://…atlassian.net`; khởi động lại server |
| Requirement nằm ở tab *Thiếu AC* | Description thiếu dòng `Acceptance criteria` hoặc không có dòng nào bên dưới | Sửa Description trên Jira theo quy ước mục 7.4 rồi *Đồng bộ ngay* |
| Requirement bị *Cần kiểm tra* | Issue bị xóa, mất quyền đọc hoặc đổi loại issue trên Jira | Kiểm tra trên Jira; khôi phục thì lần đồng bộ sau tự gỡ cờ, nếu không thì *Lưu trữ* |
| Không đưa được test vào Test Run | Test chưa duyệt, đang *Cần xem lại* hoặc requirement đã lưu trữ / Cần kiểm tra | Xử lý theo lý do hiển thị rồi thêm lại |
| Sửa build của đợt bị báo lỗi | Đợt đã có kết quả nên build, môi trường đã cố định | Lập đợt mới cho build khác |
| Đề xuất AI báo *Lỗi thời* | Requirement hoặc test đổi sau lúc phân tích | Chạy *Phân tích ảnh hưởng* lại |
| Lần đồng bộ báo lỗi | Jira không phản hồi sau 2 lần thử lại | Xem *Nhật ký đồng bộ* ở *Dự án & module*; dữ liệu không bị đổi, chờ lần sau hoặc bấm *Đồng bộ ngay* |
| Lỗi cài `better-sqlite3` | Thiếu công cụ biên dịch | macOS: `xcode-select --install`; hoặc dùng Docker |

## 7.8. Giao diện thực tế

Ảnh chụp bằng công cụ `automation/tools/screenshots.js` (Playwright) trên dữ liệu mẫu, Jira giả lập (dự án HRM) và AI giả lập; chạy lại để cập nhật khi giao diện đổi.

**Đăng nhập** – có nút điền nhanh tài khoản demo theo vai trò.

![Đăng nhập](images/01_dang_nhap.png)

**Tổng quan & báo cáo (YC6)** – tỷ lệ pass, tiến độ, độ bao phủ requirement và AC, test cần xem lại, chờ kiểm thử lại, đề xuất AI chờ xử lý; chọn phạm vi dự án hoặc Test Run.

![Tổng quan](images/02_tong_quan.png)

**Dự án & module (YC12)** – thêm dự án từ Jira, kết quả đồng bộ, số requirement Cần kiểm tra, nhật ký đồng bộ.

![Dự án và Jira](images/12_du_an_jira.png)

**Requirement (YC1)** – các tab trạng thái đồng bộ; requirement chỉ đọc.

![Requirement](images/03_requirement.png)

**AI sinh test case (YC2)** – mỗi test gắn AC, trạng thái Nháp.

![AI sinh test case](images/04_ai_sinh_test_case.png)

**Nhật ký AI** – prompt gửi đi đã che dữ liệu nhạy cảm; kết quả gốc của AI.

![Nhật ký AI](images/05_nhat_ky_ai_che_pii.png)

**Hàng đợi duyệt của QA Lead (YC4)**

![Duyệt](images/07_hang_doi_duyet.png)

**Test Run (YC14, YC5)** – build, môi trường, phiên bản được chạy, người được giao, kết quả trong đợt.

![Test Run](images/08_test_run.png)

**Sửa lỗi & kiểm thử lại (YC18)** – Developer báo đã sửa kèm build; hệ thống cho biết chạy lại trong đợt hay cần đợt Kiểm thử lại.

![Kiểm thử lại](images/11_kiem_thu_lai.png)

**Requirement đổi trên Jira (YC8)** – so sánh hai phiên bản, AC đổi được tô màu; chỉ test liên kết AC đó bị gắn cờ *Cần xem lại*.

![So sánh phiên bản](images/06_so_sanh_phien_ban.png)

**Đề xuất AI (YC15, YC16)** – loại đề xuất, lý do, AC nguồn, nội dung trước/sau; QA Lead chấp nhận hoặc từ chối.

![Đề xuất AI](images/09_de_xuat_ai.png)

**Bộ regression (YC17)** – phần bắt buộc, ưu tiên và lý do; test chưa đủ điều kiện chạy chặn việc xác nhận.

![Bộ regression](images/10_bo_regression.png)

**Thay đổi quy định (YC10)**

![Quy định](images/13_thay_doi_quy_dinh.png)
