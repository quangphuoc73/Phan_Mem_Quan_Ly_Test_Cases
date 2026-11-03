# Chương 7. Triển khai và hướng dẫn sử dụng

## 7.1. Yêu cầu hệ thống

| Thành phần | Yêu cầu |
|---|---|
| Cách 1 – chạy trực tiếp | Node.js ≥ 20, Google Chrome (để chạy Playwright), 500 MB đĩa |
| Cách 2 – Docker | Docker Desktop ≥ 4.x (đã có sẵn Chromium trong image) |
| Trình duyệt người dùng | Chrome, Edge, Firefox, Safari bản mới |
| Mạng | Cần Internet khi dùng AI thật (Gemini/Claude/OpenAI) hoặc chạy test trên saucedemo.com; chế độ `mock` chạy offline |

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

```bash
cd automation
npm install
```

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

### Cấu hình kết nối Jira (YC1, YC8, YC13, YC14)

User story và sprint chỉ được tạo trên Jira rồi đồng bộ **một chiều** về hệ thống. Jira Cloud gói **Free** (tối đa 10 người) là đủ. Để trống `JIRA_BASE_URL` thì hệ thống dùng **Jira giả lập** có 2 dự án mẫu `HRM` và `LIB` (cho kiểm thử tự động và khi buổi demo không có mạng). Để dùng Jira thật, điền vào `app/.env` rồi khởi động lại server:

| Biến | Ví dụ | Ghi chú |
|---|---|---|
| `JIRA_BASE_URL` | `https://ten-nhom.atlassian.net` | Địa chỉ Jira Cloud của nhóm |
| `JIRA_EMAIL` | email tài khoản Atlassian | Tài khoản có quyền xem dự án |
| `JIRA_API_TOKEN` | (token) | Tạo tại *id.atlassian.com → Bảo mật → Mã thông báo API*; chỉ để trong `.env`, không commit |
| `JIRA_SYNC_MINUTES` | `5` | Tự đồng bộ mọi dự án Jira mỗi 5 phút; `0` = tắt |
| `JIRA_WEBHOOK_SECRET` | chuỗi ngẫu nhiên dài | Bật webhook; để trống thì tắt |

Thành viên Jira được gán vào tài khoản có **email trùng**, nên Admin tạo tài khoản với đúng email Atlassian của từng người trước khi đồng bộ.

**Quy ước viết story trên Jira** (để hệ thống đọc được):

1. Loại issue là **Story** (Task, Bug không được lấy).
2. Trong **Description**: phần đầu là mô tả *"Là …, tôi muốn …, để …"*; tiếp theo một dòng **Acceptance criteria**; dưới đó mỗi gạch đầu dòng là một tiêu chí.
3. **Priority** Highest/High → High, Medium → Medium, Low/Lowest → Low. **Story point estimate** dùng 1, 2, 3, 5, 8, 13. **Component** thành module.
4. Sprint phải có ngày bắt đầu, kết thúc mới được đồng bộ.

**Webhook** (tùy chọn, cần địa chỉ công khai): Jira → *Settings → System → WebHooks → Create* với URL `https://<địa chỉ app>/api/jira/webhook?secret=<JIRA_WEBHOOK_SECRET>`, chọn sự kiện *Issue created / updated / deleted* và *Sprint*. Khi chạy trên máy cá nhân, mở đường hầm bằng `ngrok http 3000` để lấy địa chỉ công khai; nếu không dùng webhook thì đồng bộ định kỳ và nút *Đồng bộ ngay* vẫn đủ.

### Cấu hình bộ kiểm thử Playwright

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

Dữ liệu mẫu (không liên kết Jira, chỉ để xem và demo; story của dự án mẫu không đồng bộ được): dự án **PETINS – App bảo hiểm thú cưng** (hư cấu, 3 module, 5 user story, 4 test case đã duyệt có lịch sử chạy; Sprint 1 đã kết thúc, Sprint 2 đang chạy tính từ ngày tạo dữ liệu, 1 story trong Product backlog) và **SAUCE – Sauce Demo Shop** (web thật `https://www.saucedemo.com/`, 2 user story, 4 test case đã duyệt dùng cho Playwright). Đặt lại dữ liệu: `npm run reset`.

## 7.6. Hướng dẫn sử dụng theo vai trò

### Tester

1. **User story** đến từ Jira (PO/BA viết). Menu *User story* liệt kê story đã đồng bộ; story có nhãn 🔁 *Cần xem lại test case* là story vừa đổi trên Jira – mở ra, sửa test case cho khớp acceptance criteria mới rồi bấm **✔ Đã xem lại**.
2. **Sinh test case bằng AI:** mở user story → *✨ Sinh test case bằng AI*. Sau vài giây bảng test case hiện ra ở trạng thái *Nháp*; thông báo cho biết số test case, thời gian, dữ liệu nhạy cảm đã che.
3. **Xem lại và sửa:** bấm vào một dòng → *✏️ Sửa* → *Lưu phiên bản mới*. Xóa case thừa, *＋ Thêm thủ công* case còn thiếu.
4. **Gửi duyệt:** tích chọn các test case → *📤 Gửi duyệt mục đã chọn*. Nếu bị trả lại, ghi chú của QA Lead hiện ở đầu chi tiết test case.
5. **Chạy thủ công:** test case *Đã duyệt* → tab *Chạy test* → chọn kết quả, ghi chú (bắt buộc khi Fail/Blocked) → *Lưu kết quả*.
6. **Tự động hóa:** tab *🎭 Script Playwright* → *✨ Sinh script Playwright bằng AI* → xem lại, sửa nếu cần → *💾 Lưu* → *▶️ Chạy tự động*. Kết quả, log và ảnh chụp lỗi lưu vào lịch sử chạy. *⬇️ Tải file .spec.js* để chạy ngoài hệ thống.

### QA Lead

1. Menu *Duyệt test case* (huy hiệu cam cho biết số lượng chờ).
2. Bấm vào dòng để xem chi tiết và tab *Lịch sử* (so sánh bản AI gốc với bản Tester đã sửa).
3. *✓ Duyệt*, hoặc nhập ghi chú và *↩️ Trả lại*. Có thể chọn nhiều dòng → *Duyệt tất cả mục đã chọn*.
4. *Thay đổi quy định*: sửa số test case tối đa, số lần gọi AI/giờ… → *Lưu*. Có hiệu lực ngay.
5. *Tổng quan & báo cáo*: theo dõi tỷ lệ pass, độ bao phủ, story chưa có test case, hiệu quả AI.

### PO / BA, QA Lead – user story và sprint (Agile/Scrum)

PO/BA viết user story và lập sprint **trên Jira** theo quy ước ở mục 7.4; hệ thống chỉ đọc.

1. QA Lead (hoặc Admin) chọn dự án → menu *User story* → **⟳ Đồng bộ từ Jira** (hoặc chờ đồng bộ định kỳ / webhook). Thông báo cho biết số story mới, cập nhật, cần xem lại, đã xóa trên Jira và các cảnh báo.
2. Menu *Sprint (Agile)*: chọn sprint (lấy từ Jira). Bảng 4 cột *Cần viết test case → Đang soạn/chờ duyệt → Đang kiểm thử → Hoàn thành (DoD)* do hệ thống tự tính từ trạng thái test case và kết quả chạy.
3. Xem *Burndown chart* (story point còn lại theo ngày) và *Velocity các sprint*; mục *Product backlog* là story chưa thuộc sprint nào trên Jira. Chọn sprint ở ô thứ hai trên thanh trên cùng để lọc toàn bộ hệ thống theo sprint đó.

### Developer

1. Xem *Kết quả chạy test* (ghi chú có mã bug, log và ảnh chụp lỗi) để tái hiện lỗi; *Tra cứu test case* và *Tổng quan & báo cáo* để nắm tình hình.
2. Sửa xong lỗi, ở lần chạy *Fail* bấm **🔧 Báo đã sửa** → nhập bản build (VD `1.0.2`) và ghi chú cho Tester → *Báo đã sửa*.
3. Test case chuyển sang **🔁 Cần kiểm thử lại**. Tester lọc *Cần kiểm thử lại* ở *Tra cứu test case*, chạy lại trên bản build mới; lần chạy mới làm test case hết trạng thái này.

### Admin

*Người dùng* (thêm, khóa/mở khóa, xem ma trận phân quyền), *Nhật ký hoạt động*, *Nhật ký AI*.

**Dự án & module (YC13):**
1. Bấm **🔌 Kiểm tra kết nối Jira** để chắc chắn cấu hình `.env` đúng (dòng đầu trang cho biết đang dùng Jira thật hay giả lập, webhook đã bật chưa).
2. Bấm **⬇ Thêm dự án từ Jira**, nhập mã dự án (space key, VD `SHOP`) → hệ thống lấy tên, mô tả, module (component), thành viên, sprint và mọi Story; thông báo tên thành viên chưa có tài khoản để Admin tạo thêm.
3. Bấm **Sửa URL** để khai báo URL ứng dụng cần test (VD `https://www.saucedemo.com/`) cho Playwright, vì Jira không có thông tin này.
4. Khi Jira có thay đổi mà chưa tới lượt đồng bộ định kỳ, bấm **⟳ Đồng bộ ngay** trên thẻ dự án.

QA Lead cũng thêm dự án và đồng bộ được, nhưng không kiểm tra kết nối và không sửa URL. Hệ thống không có chức năng tạo dự án, module, user story hay sprint bằng tay.

## 7.7. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `Error: listen EADDRINUSE :3000` | Cổng 3000 đang được dùng | `PORT=3001 npm start` |
| Thanh bên báo "Playwright worker: chưa cài" | Chưa cài thư mục `automation` | `cd automation && npm install`, khởi động lại server |
| Chạy tự động báo "Không chạy được script… Chrome" | Máy không có Google Chrome | Cài Chrome, hoặc `npx playwright install chromium` và đặt `PW_CHANNEL=chromium` |
| Provider "unavailable" | Chọn AI thật nhưng thiếu API key | Điền key trong `.env` hoặc quay về `AI_PROVIDER=mock` |
| AI báo "chưa sinh được test case hợp lệ" | Model trả sai định dạng sau 3 lần | Bấm sinh lại; xem *Nhật ký AI* để biết lý do; hoặc viết thủ công |
| Bị 429 khi gọi AI | Vượt hạn mức/giờ | Chờ, hoặc QA Lead tăng `AI_CALLS_PER_HOUR` |
| "Jira từ chối xác thực" / "Không kết nối được tới Jira" | Sai `JIRA_EMAIL`, `JIRA_API_TOKEN` hoặc `JIRA_BASE_URL` | Tạo lại API token, kiểm tra địa chỉ có dạng `https://…atlassian.net`; khởi động lại server |
| Story về hệ thống nhưng có nhãn *Thiếu acceptance criteria* | Description thiếu dòng `Acceptance criteria` hoặc không có gạch đầu dòng bên dưới | Sửa Description trên Jira theo quy ước mục 7.4 rồi *Đồng bộ ngay* |
| Sprint không hiện | Sprint trên Jira chưa đặt ngày | Đặt ngày bắt đầu, kết thúc trên Jira (hoặc bấm *Start sprint*) rồi đồng bộ |
| Lỗi cài `better-sqlite3` | Thiếu công cụ biên dịch | macOS: `xcode-select --install`; hoặc dùng Docker |

## 7.8. Giao diện thực tế

**Đăng nhập** – có nút điền nhanh tài khoản demo theo vai trò.

![Đăng nhập](images/01_dang_nhap.png)

**Tổng quan & báo cáo (YC6)** – tỷ lệ pass, độ bao phủ, tiến độ, biểu đồ, story chưa bao phủ, hiệu quả AI.

![Tổng quan](images/02_tong_quan.png)

**Danh sách user story (YC1, YC8)**

![User story](images/03_user_story.png)

**AI sinh test case (YC2)** – thông báo số test case, thời gian, dữ liệu nhạy cảm đã che.

![AI sinh test case](images/04_ai_sinh_test_case.png)

**Nhật ký AI** – prompt gửi đi đã che email và số điện thoại thành `[EMAIL]`, `[PHONE]`; kết quả gốc của AI.

![Nhật ký AI](images/05_nhat_ky_ai_che_pii.png)

**Lịch sử phiên bản (YC3)** – so sánh bản AI gốc với bản Tester đã sửa.

![Lịch sử phiên bản](images/06_lich_su_phien_ban.png)

**Hàng đợi duyệt của QA Lead (YC4)**

![Duyệt](images/07_hang_doi_duyet.png)

**Script Playwright do AI sinh và chạy tự động (YC10)**

![Playwright](images/08_playwright_chay_tu_dong.png)

**Sprint (Agile) – YC14** – sprint lấy từ Jira: Sprint Goal, bảng sprint theo Definition of Done, burndown, velocity, Product backlog (chỉ xem).

![Sprint](images/11_sprint.png)

**Thay đổi quy định (YC11)**

![Quy định](images/09_thay_doi_quy_dinh.png)
