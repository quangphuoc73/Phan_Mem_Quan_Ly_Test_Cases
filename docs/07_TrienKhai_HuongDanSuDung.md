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
| Tester | `tester` | `Tester@123` |
| Developer | `dev` | `Dev@123456` |

Dữ liệu mẫu: dự án **PETINS – App bảo hiểm thú cưng** (hư cấu, 3 module, 5 user story, 4 test case đã duyệt có lịch sử chạy; Sprint 1 đã kết thúc, Sprint 2 đang chạy tính từ ngày tạo dữ liệu, 1 story trong Product backlog) và **SAUCE – Sauce Demo Shop** (web thật `https://www.saucedemo.com/`, 2 user story, 4 test case đã duyệt dùng cho Playwright). Đặt lại dữ liệu: `npm run reset`.

## 7.6. Hướng dẫn sử dụng theo vai trò

### Tester

1. **Lập user story:** menu *User story* → *＋ Lập user story* → nhập mã (`US-...`), tiêu đề, mô tả "Là…, tôi muốn…, để…", mỗi acceptance criterion một dòng → *Lưu*. Có thể *⬆️ Nhập từ file* CSV/JSON (mẫu ở `app/samples/`).
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

### QA Lead – lập kế hoạch sprint (Agile/Scrum)

1. Chọn dự án ở thanh trên cùng → menu *Sprint (Agile)*.
2. *＋ Tạo sprint*: nhập tên, Sprint Goal, ngày bắt đầu/kết thúc (tối đa 28 ngày, không trùng sprint khác).
3. **Sprint Planning:** ở mục *Product backlog*, chọn sprint cho từng story → *Đưa vào*. Khi lập hoặc sửa user story có thể chọn luôn sprint và story point (1, 2, 3, 5, 8, 13).
4. Theo dõi bảng 4 cột: *Cần viết test case → Đang soạn/chờ duyệt → Đang kiểm thử → Hoàn thành (DoD)*. Story tự chuyển cột theo trạng thái test case và kết quả chạy.
5. Xem *Burndown chart* (story point còn lại theo ngày) và *Velocity các sprint*. Chọn sprint ở ô thứ hai trên thanh trên cùng để lọc toàn bộ hệ thống (báo cáo, user story, tra cứu, duyệt) theo sprint đó.

### Developer

Xem *Tra cứu test case*, *Kết quả chạy test* (ghi chú có mã bug, log và ảnh chụp lỗi để tái hiện) và *Tổng quan & báo cáo*.

### Admin

*Người dùng* (thêm, khóa/mở khóa, xem ma trận phân quyền), *Dự án & module* (tạo dự án, khai báo URL ứng dụng cần test cho Playwright, thêm module), *Nhật ký hoạt động*, *Nhật ký AI*.

## 7.7. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `Error: listen EADDRINUSE :3000` | Cổng 3000 đang được dùng | `PORT=3001 npm start` |
| Thanh bên báo "Playwright worker: chưa cài" | Chưa cài thư mục `automation` | `cd automation && npm install`, khởi động lại server |
| Chạy tự động báo "Không chạy được script… Chrome" | Máy không có Google Chrome | Cài Chrome, hoặc `npx playwright install chromium` và đặt `PW_CHANNEL=chromium` |
| Provider "unavailable" | Chọn AI thật nhưng thiếu API key | Điền key trong `.env` hoặc quay về `AI_PROVIDER=mock` |
| AI báo "chưa sinh được test case hợp lệ" | Model trả sai định dạng sau 3 lần | Bấm sinh lại; xem *Nhật ký AI* để biết lý do; hoặc viết thủ công |
| Bị 429 khi gọi AI | Vượt hạn mức/giờ | Chờ, hoặc QA Lead tăng `AI_CALLS_PER_HOUR` |
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

**Script Playwright do AI sinh và chạy tự động (YC9)**

![Playwright](images/08_playwright_chay_tu_dong.png)

**Sprint (Agile) – YC12** – Sprint Goal, bảng sprint theo Definition of Done, burndown, velocity, Product backlog.

![Sprint](images/11_sprint.png)

**Thay đổi quy định (YC10)**

![Quy định](images/09_thay_doi_quy_dinh.png)
