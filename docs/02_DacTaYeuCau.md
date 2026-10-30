# Chương 2. Xác định và đặc tả yêu cầu

> Sản phẩm của giai đoạn: **danh sách các yêu cầu phần mềm** kèm biểu mẫu (BM) và quy định (QĐ), cùng bảng trách nhiệm. **Yêu cầu phần mềm** là các công việc, các nghiệp vụ được hỗ trợ thực hiện trên máy tính với phần mềm.

Theo môn học, yêu cầu phần mềm được lập theo thứ tự **nghiệp vụ → chất lượng → hệ thống**:

| Nhóm | Gồm | Đảm bảo | Mục trong chương |
|---|---|---|---|
| **Yêu cầu nghiệp vụ** | Lưu trữ, tra cứu, tính toán, kết xuất | Tính **đúng đắn** | 2.2 – 2.4 |
| **Yêu cầu chất lượng** | Tính tiến hóa, tiện dụng, hiệu quả, tương thích | | 2.5 |
| **Yêu cầu hệ thống** | Tính an toàn, bảo mật | | 2.6 |
| Yêu cầu khác | Yêu cầu công nghệ (dễ sửa lỗi, bảo trì, tái sử dụng, mang chuyển) | | 2.7 |

## 2.1. Tác nhân (actor)

| Tác nhân | Mô tả |
|---|---|
| Admin | Quản trị hệ thống: tài khoản, phân quyền, dự án, module, quy định |
| QA Lead | Trưởng nhóm kiểm thử: duyệt/trả lại test case, xem báo cáo, thay đổi quy định, lập kế hoạch sprint (vai trò Scrum Master); có toàn bộ quyền của Tester |
| PO / BA | Product Owner / Business Analyst: lập và nhập user story kèm acceptance criteria (NV1), lập kế hoạch sprint, xem test case và báo cáo để nghiệm thu; không viết, duyệt hay chạy test case, không gọi AI |
| Tester | Lập user story (khi đội không có BA), dùng AI sinh test case, chỉnh sửa, gửi duyệt, chạy test, sinh và chạy script tự động |
| Developer | Xem test case, kết quả chạy (log, ảnh chụp lỗi) và báo cáo để tái hiện lỗi; báo đã sửa lỗi kèm bản build để Tester kiểm thử lại |
| Dịch vụ LLM (hệ thống ngoài) | Gemini / Claude / OpenAI: nhận prompt đã che dữ liệu nhạy cảm, trả JSON |
| Playwright Worker (hệ thống ngoài) | Chạy script kiểm thử tự động trên trình duyệt, trả kết quả và ảnh chụp lỗi |

## 2.2. Danh sách yêu cầu nghiệp vụ

| STT | Tên yêu cầu | Loại yêu cầu | Biểu mẫu | Quy định | Ghi chú |
|---|---|---|---|---|---|
| 1 | YC1 – Lập user story | Lưu trữ | BM1 | QĐ1 | Nhập tay |
| 2 | YC2 – Sinh test case bằng AI | Lưu trữ, tính toán | BM2 | QĐ2 | Chức năng AI chính |
| 3 | YC3 – Soạn thảo và gửi duyệt test case | Lưu trữ | BM2 | QĐ3 | Có lịch sử phiên bản |
| 4 | YC4 – Duyệt test case | Lưu trữ | BM3 | QĐ4 | Chỉ QA Lead |
| 5 | YC5 – Ghi nhận kết quả chạy test | Lưu trữ | BM4 | QĐ5 | |
| 6 | YC6 – Lập báo cáo kiểm thử | Tính toán, kết xuất | BM5 | | Tỷ lệ pass, độ bao phủ, tiến độ |
| 7 | YC7 – Tra cứu test case | Tra cứu | BM6 | | |
| 8 | YC8 – Nhập/xuất dữ liệu | Lưu trữ, kết xuất | BM7, BM8 | QĐ8 | CSV/JSON vào, Excel ra |
| 9 | YC9 – Sinh và chạy script kiểm thử tự động | Lưu trữ, tính toán | BM9 | QĐ9 | Playwright |
| 10 | YC10 – Thay đổi quy định | Lưu trữ | | QĐ10 | Tính tiến hóa |
| 11 | YC11 – Quản lý người dùng, dự án | Lưu trữ | | QĐ11 | Admin |
| 12 | YC12 – Quản lý sprint (Agile/Scrum) | Lưu trữ, tính toán | BM10 | QĐ12 | Velocity, burndown được tính, không nhập |
| 13 | YC13 – Báo đã sửa lỗi và kiểm thử lại | Lưu trữ, tra cứu | BM11 | QĐ13 | Developer báo, Tester lọc được test case cần kiểm thử lại |

**Ý nghĩa loại yêu cầu:**
- **Lưu trữ:** ghi thông tin mới hoặc thay đổi xuống bộ nhớ phụ.
- **Tra cứu:** tìm và xem lại thông tin đã lưu.
- **Tính toán:** tạo ra thông tin mới từ thông tin đã có theo quy định, công thức (tỷ lệ pass, số test case còn được thêm, velocity).
- **Kết xuất:** đưa thông tin ra màn hình, máy in hoặc file theo biểu mẫu.

## 2.3. Biểu mẫu và quy định

### BM1 – User story

| BM1 | **User story** |
|---|---|
| Mã user story: ............ | Dự án: ............ Module: ............ |
| Tiêu đề: ............ | Độ ưu tiên: ............ |
| Mô tả: *Là [vai trò], tôi muốn [chức năng], để [lợi ích].* | |
| Acceptance criteria: 1. ............ 2. ............ | |

**QĐ1:** Mã user story có dạng `US-XXX` (chữ in hoa, số, dấu gạch ngang) và không được trùng. Tiêu đề tối thiểu 5 ký tự, mô tả tối thiểu 10 ký tự. Có ít nhất **1** acceptance criterion (mỗi dòng một tiêu chí). Độ ưu tiên thuộc danh sách **High, Medium, Low**.

### BM2 – Test case

| BM2 | **Test case** |
|---|---|
| Mã test case: ............ (tự sinh: `<mã story>-TCnn`) | Thuộc user story: ............ |
| Tiêu đề: ............ | Loại: Positive / Negative / Edge |
| Điều kiện tiên quyết: ............ | Độ ưu tiên: High / Medium / Low |
| Các bước: 1. ............ 2. ............ | |
| Kết quả mong đợi: ............ | Nguồn: AI / Thủ công · Trạng thái · Phiên bản |

**QĐ2:** Mỗi user story có tối đa **20** test case. AI chỉ được sinh trong giới hạn còn lại; khi sinh lại, các test case AI còn ở trạng thái *Nháp* được thay thế. Mỗi test case có 1–15 bước. Kết quả AI phải đúng JSON schema; sai thì hệ thống tự thử lại tối đa **2** lần. Mỗi lần gọi AI chờ tối đa **30** giây. Mỗi người dùng gọi AI tối đa **30** lần/giờ.

**QĐ3:** Chỉ test case ở trạng thái *Nháp* hoặc *Bị trả lại* mới được gửi duyệt hoặc xóa. Test case *Chờ duyệt* không được sửa. Sửa test case *Đã duyệt* thì test case quay về *Nháp* và phải duyệt lại. Mỗi lần sửa tạo một phiên bản mới (lưu toàn bộ nội dung).

### BM3 – Phiếu duyệt test case

| BM3 | **Phiếu duyệt test case** |
|---|---|
| Mã test case: ............ | Người duyệt: ............ |
| Quyết định: Duyệt / Trả lại | Ngày duyệt: ............ |
| Ghi chú: ............ | |

**QĐ4:** Chỉ **QA Lead** được duyệt. Chỉ duyệt test case ở trạng thái *Chờ duyệt*. Trả lại **bắt buộc** có ghi chú.

### BM4 – Kết quả chạy test

| BM4 | **Kết quả chạy test** |
|---|---|
| Mã test case: ............ | Hình thức: Thủ công / Tự động |
| Kết quả: Pass / Fail / Blocked | Người chạy: ............ Ngày chạy: ............ |
| Ghi chú (mã bug): ............ | Log, ảnh chụp lỗi (nếu tự động) |

**QĐ5:** Chỉ ghi kết quả cho test case *Đã duyệt*. Kết quả *Fail* hoặc *Blocked* khi chạy thủ công **bắt buộc** có ghi chú. Báo cáo tính theo **lần chạy gần nhất** của mỗi test case.

### BM5 – Báo cáo kiểm thử

| BM5 | **Báo cáo kiểm thử** – Dự án: ............ |
|---|---|
| Tỷ lệ pass = Pass / số test case đã chạy | Độ bao phủ = số user story có ≥ 1 test case đã duyệt / tổng user story |
| Tiến độ thực thi = số test case đã chạy / số test case đã duyệt | Danh sách user story chưa được bao phủ |
| Kết quả theo module | Xu hướng theo ngày; thống kê AI (số test case AI sinh, tỷ lệ phải sửa) |

### BM6 – Tra cứu test case

| BM6 | **Danh sách test case** |
|---|---|
| Điều kiện lọc: từ khóa (mã/tiêu đề), dự án, trạng thái, độ ưu tiên, loại, nguồn | |
| Kết quả: Mã · Tiêu đề · User story · Loại · Ưu tiên · Nguồn · Trạng thái · Kết quả gần nhất · Có script | |

### BM7 – Nhập user story từ file · BM8 – Xuất test case

- BM7: file `.csv` hoặc `.json`, các cột `code, title, description, acceptance_criteria, priority, module`; trong CSV các acceptance criteria ngăn cách bằng `|`.
- BM8: file Excel `.xlsx` gồm các cột của BM2 và kết quả gần nhất, theo bộ lọc của BM6.

**QĐ8:** Mỗi lần nhập tối đa 200 dòng. Mỗi dòng được kiểm tra theo QĐ1; dòng lỗi được báo cáo, không làm hỏng các dòng hợp lệ.

### BM9 – Script kiểm thử tự động

| BM9 | **Script kiểm thử tự động** |
|---|---|
| Mã test case: ............ | Framework: Playwright |
| Mã nguồn script: ............ | Kết quả chạy, thời gian, log, ảnh chụp lỗi |

**QĐ9:** Chỉ sinh và chạy script cho test case *Đã duyệt*. Trước khi chạy, script phải qua kiểm tra tĩnh: không dùng `child_process`, `fs`, `net`, `http`, `os`, `vm`…; không truy cập `process.env`; không dùng `eval`, `new Function`, `import()` động. Mỗi lần chạy tối đa **60** giây.

**QĐ10:** Admin hoặc QA Lead được thay đổi các tham số: số test case tối đa/story (1–50), số acceptance criteria tối thiểu (1–10), danh sách độ ưu tiên, số lần thử lại AI (0–5), thời gian chờ AI (5–120 giây), số lần gọi AI/giờ (1–500), thời gian chạy script (10–300 giây), độ dài tối đa sprint (7–42 ngày).

### BM10 – Sprint

| BM10 | **Sprint** – Dự án: ............ |
|---|---|
| Tên sprint: ............ | Mục tiêu sprint (Sprint Goal): ............ |
| Ngày bắt đầu: ............ | Ngày kết thúc: ............ |
| Các user story trong sprint (mã, story point, trạng thái) | Story point cam kết / hoàn thành (velocity) · Burndown chart |

**QĐ12:** Sprint dài tối đa **28** ngày (tham số `SPRINT_MAX_DAYS`, 7–42), ngày kết thúc không trước ngày bắt đầu, các sprint của cùng dự án không trùng thời gian. Chỉ Admin, QA Lead và PO/BA được tạo/sửa sprint. User story chỉ thuộc sprint của chính dự án; story chưa thuộc sprint nào nằm trong **Product backlog**. Story point thuộc dãy **1, 2, 3, 5, 8, 13**. Một user story đạt **Definition of Done** khi có ít nhất 1 test case *Đã duyệt* và mọi test case *Đã duyệt* có lần chạy gần nhất là *Pass*. Velocity = tổng story point của các story đạt DoD trong sprint.

### BM11 – Phiếu báo đã sửa lỗi

| BM11 | **Phiếu báo đã sửa lỗi** |
|---|---|
| Mã test case: ............ | Lần chạy Fail (ngày, ghi chú mã bug): ............ |
| Bản build đã sửa: ............ | Ghi chú cho Tester: ............ |
| Người báo (Developer): ............ | Ngày báo: ............ |

**QĐ13:** Chỉ **Developer** được báo đã sửa. Chỉ báo cho **lần chạy gần nhất** của test case và lần chạy đó có kết quả *Fail*; mỗi lần chạy chỉ báo một lần. **Bắt buộc** nhập bản build (1–50 ký tự). Test case **cần kiểm thử lại** khi lần chạy gần nhất là *Fail* và đã được báo sửa; khi Tester ghi một lần chạy mới, test case tự hết trạng thái này.

**QĐ11:** Tên đăng nhập 3–30 ký tự `a-z 0-9 _ .`, không trùng. Mật khẩu tối thiểu 8 ký tự. Admin không được tự khóa hoặc tự hạ quyền chính mình.

## 2.4. Bảng trách nhiệm yêu cầu nghiệp vụ

| STT | Nghiệp vụ | Người dùng | Phần mềm | Ghi chú |
|---|---|---|---|---|
| 1 | YC1 Lập user story | Nhập thông tin theo BM1 | Kiểm tra QĐ1, lưu | |
| 2 | YC2 Sinh test case bằng AI | Chọn user story, bấm Sinh | Che dữ liệu nhạy cảm, ghép prompt, gọi LLM, kiểm tra schema, thử lại, cắt theo QĐ2, lưu trạng thái Nháp, ghi nhật ký AI | Kết quả luôn cần người xem lại |
| 3 | YC3 Soạn thảo, gửi duyệt | Sửa/xóa/thêm, chọn và gửi duyệt | Kiểm tra QĐ3, lưu phiên bản, đổi trạng thái | |
| 4 | YC4 Duyệt | Xem, duyệt hoặc trả lại kèm ghi chú | Kiểm tra QĐ4, lưu phiếu duyệt | |
| 5 | YC5 Ghi kết quả | Chọn kết quả, nhập ghi chú | Kiểm tra QĐ5, lưu | |
| 6 | YC6 Báo cáo | Chọn dự án | Tính toán và vẽ biểu đồ | |
| 7 | YC7 Tra cứu | Nhập điều kiện lọc | Tìm và hiển thị | |
| 8 | YC8 Nhập/xuất | Chọn file / bấm Xuất | Kiểm tra từng dòng, báo lỗi; tạo file Excel | |
| 9 | YC9 Script tự động | Bấm Sinh script, xem lại, sửa, bấm Chạy | Gọi LLM sinh script, kiểm tra tĩnh, chạy trong tiến trình cô lập có giới hạn thời gian, lưu kết quả và ảnh lỗi | |
| 10 | YC10 Thay đổi quy định | Nhập giá trị mới | Kiểm tra miền giá trị, lưu vào bảng tham số | |
| 11 | YC11 Quản lý người dùng | Nhập thông tin, khóa/mở khóa | Băm mật khẩu, kiểm tra QĐ11 | |
| 12 | YC12 Quản lý sprint | Tạo sprint (tên, mục tiêu, ngày); đưa story từ backlog vào sprint; ước lượng story point | Kiểm tra QĐ12; tự tính trạng thái DoD của story, velocity, burndown | Hỗ trợ đội làm Scrum |
| 13 | YC13 Báo đã sửa lỗi | Developer chọn lần chạy Fail, nhập bản build, ghi chú; Tester lọc *Cần kiểm thử lại* rồi chạy lại | Kiểm tra QĐ13, lưu phiếu báo sửa, ghi audit log; tự xác định test case cần kiểm thử lại | Khép kín vòng báo lỗi – sửa – kiểm thử lại |

## 2.5. Yêu cầu chất lượng

### 2.5.1. Tính tiến hóa

| STT | Nghiệp vụ | Tham số cần thay đổi | Miền giá trị cần thay đổi |
|---|---|---|---|
| 1 | Lập user story | Số acceptance criteria tối thiểu | Danh sách độ ưu tiên |
| 2 | Sinh test case bằng AI | Số test case tối đa/story, số lần thử lại, thời gian chờ, số lần gọi/giờ | **Nhà cung cấp LLM** (mock, Gemini, Claude, OpenAI) – đổi qua cấu hình, không sửa mã nguồn |
| 3 | Chạy script tự động | Thời gian chạy tối đa | Framework kiểm thử (thiết kế mở cho WebdriverIO, Cypress) |
| 4 | Quản lý sprint | Độ dài tối đa sprint | Thang story point |

### 2.5.2. Tính tiện dụng

| STT | Nghiệp vụ | Mức độ dễ học | Mức độ dễ sử dụng |
|---|---|---|---|
| 1 | Sinh test case bằng AI | 5 phút làm quen | 1 nút bấm; thông báo rõ số test case, thời gian, dữ liệu đã che |
| 2 | Duyệt | Không cần hướng dẫn | Hàng đợi duyệt, duyệt hàng loạt, huy hiệu số lượng chờ duyệt |
| 3 | Toàn hệ thống | Giao diện tiếng Việt | Thông báo lỗi bằng tiếng Việt, nêu rõ quy định bị vi phạm |

### 2.5.3. Tính hiệu quả

| STT | Nghiệp vụ | Tốc độ xử lý | Dung lượng lưu trữ |
|---|---|---|---|
| 1 | Đăng nhập, tra cứu, lưu dữ liệu | < 1 giây | |
| 2 | Sinh test case bằng AI | ≤ 30 giây (theo tham số), có hiển thị trạng thái chờ | Lưu toàn bộ prompt và kết quả gốc |
| 3 | Lập báo cáo | < 2 giây với 10.000 test case | |
| 4 | Chạy một script tự động | ≤ 60 giây | Ảnh chụp lỗi ~100 KB/lần |

### 2.5.4. Tính tương thích

| STT | Nghiệp vụ | Đối tượng liên quan |
|---|---|---|
| 1 | Nhập user story | File CSV (UTF-8, xuất từ Excel/Jira), JSON |
| 2 | Xuất test case | Microsoft Excel, Google Sheets (.xlsx) |
| 3 | Script tự động | Playwright (Node.js), chạy được độc lập ngoài hệ thống |
| 4 | Trình duyệt | Chrome, Edge, Firefox, Safari bản mới |
| 5 | LLM | Gemini API, Claude API, OpenAI API (cùng interface `LLMProvider`) |

## 2.6. Yêu cầu hệ thống

### 2.6.1. Tính an toàn

| STT | Nghiệp vụ | Đối tượng |
|---|---|---|
| 1 | Phục hồi | Test case đã xóa nhầm: có lịch sử phiên bản; CSDL sao lưu định kỳ (volume Docker) |
| 2 | Hủy thật sự | Xóa user story xóa kèm test case (có xác nhận 2 bước) |
| 3 | Không cho phép xóa | Test case *Chờ duyệt*/*Đã duyệt*; tài khoản đang đăng nhập không tự khóa |

### 2.6.2. Tính bảo mật

| STT | Nghiệp vụ | Admin | QA Lead | Tester | Developer |
|---|---|---|---|---|---|
| 1 | Quản lý người dùng, dự án | ✔ | | | |
| 2 | Lập user story | ✔ | ✔ | ✔ | |
| 3 | Sinh test case/script bằng AI | | ✔ | ✔ | |
| 4 | Soạn thảo, gửi duyệt | | ✔ | ✔ | |
| 5 | Duyệt test case | | ✔ | | |
| 6 | Ghi kết quả, chạy tự động | | ✔ | ✔ | |
| 7 | Thay đổi quy định | ✔ | ✔ | | |
| 7b | Tạo/sửa sprint | ✔ | ✔ | | |
| 7c | Đưa story vào sprint, ước lượng story point | ✔ | ✔ | ✔ | |
| 8 | Xem nhật ký hoạt động | ✔ | ✔ | | |
| 9 | Xem báo cáo, tra cứu | ✔ | ✔ | ✔ | ✔ |

**Yêu cầu bảo mật kỹ thuật:**

| Mã | Yêu cầu |
|---|---|
| BM-01 | Mật khẩu băm bằng bcrypt (cost 10), không bao giờ trả về qua API |
| BM-02 | Xác thực bằng JWT có hạn 8 giờ; kiểm tra tài khoản còn hoạt động ở mỗi request |
| BM-03 | Phân quyền theo vai trò (RBAC) kiểm tra ở **backend**, giao diện chỉ ẩn nút |
| BM-04 | Giới hạn đăng nhập sai: 10 lần/15 phút/IP |
| BM-05 | Mọi truy vấn CSDL dùng prepared statement (chống SQL injection) |
| BM-06 | Kiểm tra dữ liệu đầu vào bằng schema (Zod); giới hạn kích thước request 1 MB |
| BM-07 | Chống XSS: escape mọi dữ liệu khi hiển thị + Content-Security-Policy `script-src 'self'` |
| BM-08 | API key LLM chỉ lưu ở biến môi trường backend, không commit (.gitignore) |
| BM-09 | **Che dữ liệu nhạy cảm** (email, số điện thoại, CCCD, số thẻ) trước khi gửi LLM |
| BM-10 | **Chống prompt injection:** tách prompt hệ thống và dữ liệu người dùng, bọc dữ liệu trong thẻ, phát hiện và gắn cờ, kết quả bắt buộc qua schema |
| BM-11 | Giới hạn số lần gọi AI mỗi người/giờ (chống lạm dụng chi phí) |
| BM-12 | **Sandbox** cho script do AI sinh: kiểm tra tĩnh, tiến trình riêng, biến môi trường tối thiểu, timeout, giới hạn CPU/RAM trong Docker |
| BM-13 | Nhật ký hoạt động (audit log) cho mọi thao tác ghi: ai, làm gì, đối tượng nào, lúc nào, IP |
| BM-14 | Ghi rõ chính sách dữ liệu của nhà cung cấp LLM (dùng gói API không dùng dữ liệu để huấn luyện) |

## 2.7. Yêu cầu khác – yêu cầu công nghệ

| STT | Yêu cầu | Mô tả chi tiết |
|---|---|---|
| 1 | Dễ sửa lỗi | Kiến trúc nhiều lớp; mỗi YC nằm trong một service riêng |
| 2 | Dễ bảo trì | Thêm LLM mới chỉ cần thêm 1 lớp kế thừa `LLMProvider` |
| 3 | Tái sử dụng | AI Service, script Playwright dùng lại được ngoài hệ thống |
| 4 | Dễ mang chuyển | Chạy bằng Docker; CSDL viết theo SQL chuẩn, chuyển SQLite → PostgreSQL |
| 5 | Kiểm thử tự động | Unit + API + E2E, chạy tự động trên GitHub Actions |
