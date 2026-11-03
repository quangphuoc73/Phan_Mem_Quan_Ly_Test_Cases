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
| Admin | Quản trị hệ thống: tài khoản, phân quyền, quy định; kiểm tra kết nối Jira, thêm dự án từ Jira, khai báo URL ứng dụng cần test |
| QA Lead | Trưởng nhóm kiểm thử: duyệt/trả lại test case, xem báo cáo, thay đổi quy định, thêm dự án và đồng bộ user story, sprint từ Jira; có toàn bộ quyền của Tester |
| PO / BA | Product Owner / Business Analyst: viết user story kèm acceptance criteria và lập sprint **trên Jira** (NV1, NV9); trong hệ thống chỉ xem user story, test case, sprint và báo cáo để nghiệm thu |
| Tester | Dùng AI sinh test case từ user story đã đồng bộ, chỉnh sửa, gửi duyệt, chạy test, sinh và chạy script tự động; xem lại test case khi story đổi trên Jira |
| Developer | Xem test case, kết quả chạy (log, ảnh chụp lỗi) và báo cáo để tái hiện lỗi; báo đã sửa lỗi kèm bản build để Tester kiểm thử lại |
| Dịch vụ LLM (hệ thống ngoài) | Gemini / Claude / OpenAI: nhận prompt đã che dữ liệu nhạy cảm, trả JSON |
| Jira (hệ thống ngoài) | Jira Cloud: **nơi duy nhất** tạo và sửa user story, sprint; cung cấp dự án, component (module), thành viên, story, sprint qua REST API và gọi webhook khi story thay đổi |
| Playwright Worker (hệ thống ngoài) | Chạy script kiểm thử tự động trên trình duyệt, trả kết quả và ảnh chụp lỗi |

## 2.2. Danh sách yêu cầu nghiệp vụ

| STT | Tên yêu cầu | Loại yêu cầu | Biểu mẫu | Quy định | Ghi chú |
|---|---|---|---|---|---|
| 1 | YC1 – Đồng bộ user story từ Jira | Lưu trữ | BM1 | QĐ1 | Một chiều Jira → hệ thống; story chỉ đọc trong hệ thống |
| 2 | YC2 – Sinh test case bằng AI | Lưu trữ, tính toán | BM2 | QĐ2 | Mã `<mã US>-TCnn`, tối đa 20 test case/story, kiểm tra JSON schema |
| 3 | YC3 – Soạn thảo và gửi duyệt test case | Lưu trữ | BM2 | QĐ3 | Có lịch sử phiên bản |
| 4 | YC4 – Duyệt test case | Lưu trữ | BM3 | QĐ4 | Chỉ QA Lead; trả lại bắt buộc có ghi chú |
| 5 | YC5 – Ghi nhận kết quả chạy test | Lưu trữ | BM4 | QĐ5 | Fail/Blocked chạy thủ công bắt buộc có ghi chú (mã bug) |
| 6 | YC6 – Lập báo cáo kiểm thử | Tính toán, kết xuất | BM5 | QĐ6 | Tính theo lần chạy gần nhất |
| 7 | YC7 – Tra cứu test case | Tra cứu | BM6 | QĐ7 | Tìm theo từ khóa, kết hợp nhiều điều kiện lọc |
| 8 | YC8 – Nhận thay đổi user story từ Jira | Lưu trữ, tính toán | BM7 | QĐ8 | Webhook, đồng bộ định kỳ; đánh dấu test case cần xem lại |
| 9 | YC9 – Xuất dữ liệu test case | Kết xuất | BM8 | QĐ9 | File Excel (.xlsx) |
| 10 | YC10 – Sinh và chạy script kiểm thử tự động | Lưu trữ, tính toán | BM9 | QĐ10 | Playwright, chạy trong tiến trình cô lập |
| 11 | YC11 – Thay đổi quy định hệ thống | Lưu trữ | BM10 | QĐ11 | Tính tiến hóa |
| 12 | YC12 – Quản lý người dùng | Lưu trữ | BM11 | QĐ12 | Băm mật khẩu bcrypt; Admin không tự khóa, tự hạ quyền |
| 13 | YC13 – Đồng bộ dự án từ Jira | Lưu trữ, tính toán | BM12 | QĐ13 | Lấy dự án, module, thành viên qua Jira REST API; không tạo dự án tay |
| 14 | YC14 – Theo dõi sprint (Agile/Scrum) | Lưu trữ, tính toán | BM13 | QĐ14 | Sprint, story point lấy từ Jira; DoD, velocity, burndown được tính |
| 15 | YC15 – Báo đã sửa lỗi và kiểm thử lại | Lưu trữ, tra cứu | BM14 | QĐ15 | Developer báo, Tester lọc được test case cần kiểm thử lại |

**Ý nghĩa loại yêu cầu:**
- **Lưu trữ:** ghi thông tin mới hoặc thay đổi xuống bộ nhớ phụ.
- **Tra cứu:** tìm và xem lại thông tin đã lưu.
- **Tính toán:** tạo ra thông tin mới từ thông tin đã có theo quy định, công thức (tỷ lệ pass, số test case còn được thêm, velocity).
- **Kết xuất:** đưa thông tin ra màn hình, máy in hoặc file theo biểu mẫu.

## 2.3. Biểu mẫu và quy định

### BM1 – User story (đồng bộ từ Jira)

| BM1 | **User story** – lấy từ issue loại *Story* trên Jira |
|---|---|
| Mã user story: ............ (mã issue Jira, VD `SHOP-5`) | Dự án: ............ Module (component): ............ |
| Tiêu đề (Summary): ............ | Độ ưu tiên (Priority): ............ |
| Mô tả: *Là [vai trò], tôi muốn [chức năng], để [lợi ích].* | Story point: ............ Sprint: ............ Trạng thái Jira: ............ |
| Acceptance criteria (mục *Acceptance criteria* trong Description): 1. ............ 2. ............ | Đồng bộ lần cuối: ............ |

**QĐ1:** User story chỉ được tạo và sửa **trên Jira**; hệ thống không có chức năng lập, sửa, xóa hay nhập story từ file. Chỉ lấy issue loại **Story** của dự án đã thêm (YC13); mã user story là mã issue Jira và không trùng. Trong Description, phần trước dòng **Acceptance criteria** là mô tả, mỗi dòng (gạch đầu dòng) sau đó là một acceptance criterion. Độ ưu tiên Jira đổi về danh sách **High, Medium, Low** (Highest → High, Lowest → Low). Story có ít hơn **1** acceptance criterion (tham số `MIN_AC_PER_STORY`) vẫn được lấy về nhưng **không được sinh test case** cho tới khi bổ sung trên Jira.

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

**QĐ6:** Báo cáo được tính ngay khi mở (không lưu sẵn), trong phạm vi dự án và sprint đang chọn. Kết quả Pass/Fail/Blocked chỉ lấy từ **lần chạy gần nhất** của từng test case. Độ bao phủ tính trên số user story có ít nhất 1 test case *Đã duyệt*. Thống kê AI chỉ tính test case nguồn AI; một test case AI được tính là *phải sửa* khi Tester đã thay đổi các bước hoặc kết quả mong đợi.

### BM6 – Tra cứu test case

| BM6 | **Danh sách test case** |
|---|---|
| Điều kiện lọc: từ khóa (mã/tiêu đề), dự án, trạng thái, độ ưu tiên, loại, nguồn | |
| Kết quả: Mã · Tiêu đề · User story · Loại · Ưu tiên · Nguồn · Trạng thái · Kết quả gần nhất · Có script | |

**QĐ7:** Từ khóa được tìm gần đúng (chứa từ khóa) trong mã và tiêu đề test case. Nhiều điều kiện lọc được kết hợp theo điều kiện **và** (AND). Kết quả sắp theo user story mới nhất, trong mỗi story theo mã test case; danh sách cập nhật ngay khi đổi điều kiện lọc.

### BM7 – Phiếu thay đổi user story

| BM7 | **Phiếu thay đổi user story** |
|---|---|
| Mã user story: ............ | Nguồn: Webhook Jira / Đồng bộ định kỳ / Nút Đồng bộ ngay |
| Nội dung thay đổi: tiêu đề · mô tả · acceptance criteria · ưu tiên · story point · sprint · trạng thái | Thời điểm thay đổi: ............ |
| Kết quả: Cần xem lại test case / Đã lưu trữ (xóa trên Jira) / Cập nhật | Người xem lại: ............ Ngày xem lại: ............ |

**QĐ8:** Hệ thống nhận thay đổi từ Jira theo 3 cách: **webhook** (Jira gọi `POST /api/jira/webhook?secret=…`, đúng mã bí mật `JIRA_WEBHOOK_SECRET` mới nhận), **đồng bộ định kỳ** mỗi `JIRA_SYNC_MINUTES` phút (mặc định 5) và nút **Đồng bộ ngay** (Admin, QA Lead). Khi tiêu đề, mô tả hoặc acceptance criteria của story **đã có test case** thay đổi, story được đánh dấu **Cần xem lại test case** cho tới khi Tester hoặc QA Lead bấm *Đã xem lại*. Story không còn trên Jira được **lưu trữ**: ẩn khỏi danh sách, giữ nguyên test case đã viết, không sinh thêm; story xuất hiện lại thì hiện lại.

### BM8 – Xuất test case

| BM8 | **Xuất test case** |
|---|---|
| Điều kiện lọc: theo bộ lọc đang chọn của BM6 | Định dạng tệp: `.xlsx` |
| Cột xuất: các cột của BM2 + Kết quả gần nhất | Tên tệp: `testcases.xlsx` |

**QĐ9:** Xuất đúng danh sách test case đang hiển thị theo bộ lọc của BM6. Mỗi test case một dòng; các bước xuống dòng trong ô; dòng tiêu đề tô màu. Mọi người dùng đã đăng nhập đều được xuất; mỗi lần xuất được ghi nhật ký hoạt động.

### BM9 – Script kiểm thử tự động

| BM9 | **Script kiểm thử tự động** |
|---|---|
| Mã test case: ............ | Framework: Playwright |
| Mã nguồn script: ............ | Kết quả chạy, thời gian, log, ảnh chụp lỗi |

**QĐ10:** Chỉ sinh và chạy script cho test case *Đã duyệt*. Trước khi chạy, script phải qua kiểm tra tĩnh: không dùng `child_process`, `fs`, `net`, `http`, `os`, `vm`…; không truy cập `process.env`; không dùng `eval`, `new Function`, `import()` động. Mỗi lần chạy tối đa **60** giây.

### BM10 – Thay đổi quy định hệ thống

| BM10 | **Thay đổi quy định hệ thống** |
|---|---|
| Người cấu hình: ............ | Ngày cập nhật: ............ |
| Tham số nghiệp vụ: số test case tối đa/user story (1–50); số acceptance criteria tối thiểu (1–10); độ dài tối đa sprint (7–42 ngày); danh sách độ ưu tiên | Tham số AI và tự động hóa: số lần gọi AI tối đa/giờ (1–500); thời gian chờ AI (5–120 giây); số lần thử lại khi sai schema (0–5); thời gian chạy script tối đa (10–300 giây) |

**QĐ11:** Admin hoặc QA Lead được thay đổi các tham số: số test case tối đa/story (1–50), số acceptance criteria tối thiểu (1–10), danh sách độ ưu tiên, số lần thử lại AI (0–5), thời gian chờ AI (5–120 giây), số lần gọi AI/giờ (1–500), thời gian chạy script (10–300 giây), độ dài tối đa sprint (7–42 ngày).

### BM11 – Quản lý người dùng

| BM11 | **Quản lý người dùng** |
|---|---|
| Tên đăng nhập: ............ Họ tên: ............ Email: ............ | Vai trò: Admin / QA Lead / PO-BA / Tester / Developer |
| Mật khẩu: ............ | Trạng thái: Hoạt động / Đã khóa |
| Thao tác: thêm mới, cập nhật thông tin, đổi vai trò, khóa / mở khóa | |

**QĐ12:** Chỉ Admin được quản lý người dùng. Tên đăng nhập 3–30 ký tự `a-z 0-9 _ .`, không trùng. Mật khẩu tối thiểu 8 ký tự, được băm bằng bcrypt trước khi lưu. Admin không được tự khóa hoặc tự hạ quyền chính mình.

### BM12 – Đồng bộ dự án từ Jira

| BM12 | **Đồng bộ dự án từ Jira** |
|---|---|
| Mã dự án trên Jira: ............ | Tên dự án · Mô tả: ............ |
| Module (component của Jira): ............ | Thành viên thuộc dự án: ............ |
| Thao tác: Kiểm tra kết nối Jira · Thêm dự án từ Jira · Đồng bộ lại | Lần đồng bộ gần nhất: ............ |

**QĐ13:** Dự án, module và danh sách thành viên chỉ được lấy từ Jira qua REST API, hệ thống không có chức năng tạo dự án hay module bằng tay; địa chỉ Jira, email và API token chỉ cấu hình ở máy chủ (`.env`), không nhập trên giao diện và không lưu xuống CSDL. Chỉ **Admin** được kiểm tra kết nối; **Admin và QA Lead** được thêm dự án và đồng bộ lại. Mã dự án gồm 2–10 ký tự in hoa hoặc số, bắt đầu bằng chữ cái, và chưa có trong hệ thống. Thành viên Jira được gán vào tài khoản có **email trùng** (Jira ẩn email thì so họ tên); thành viên chưa có tài khoản được liệt kê để Admin tạo sau. Jira không có URL ứng dụng cần test nên Admin khai báo thêm trường này cho từng dự án (dùng ở YC10). Thêm dự án xong hệ thống đồng bộ luôn user story (YC1) và sprint (YC14).

### BM13 – Sprint (đồng bộ từ Jira)

| BM13 | **Sprint** – Dự án: ............ |
|---|---|
| Tên sprint: ............ | Mục tiêu sprint (Sprint Goal): ............ |
| Ngày bắt đầu: ............ | Ngày kết thúc: ............ Trạng thái Jira: future / active / closed |
| Các user story trong sprint (mã, story point, trạng thái DoD) | Story point cam kết / hoàn thành (velocity) · Burndown chart |

**QĐ14:** Sprint, story point và việc đưa story vào sprint làm **trên Jira**; hệ thống không tạo, sửa, xóa sprint. Chỉ đồng bộ sprint đã đặt **ngày bắt đầu và kết thúc**; sprint dài hơn `SPRINT_MAX_DAYS` (mặc định **28**, 7–42) vẫn được lấy nhưng có cảnh báo. Story chưa thuộc sprint nào nằm trong **Product backlog**. Story point thuộc dãy **1, 2, 3, 5, 8, 13**; giá trị khác bị bỏ qua kèm cảnh báo. Một user story đạt **Definition of Done** khi có ít nhất 1 test case *Đã duyệt* và mọi test case *Đã duyệt* có lần chạy gần nhất là *Pass*. Velocity = tổng story point của các story đạt DoD trong sprint.

### BM14 – Phiếu báo đã sửa lỗi

| BM14 | **Phiếu báo đã sửa lỗi** |
|---|---|
| Mã test case: ............ | Lần chạy Fail (ngày, ghi chú mã bug): ............ |
| Bản build đã sửa: ............ | Ghi chú cho Tester: ............ |
| Người báo (Developer): ............ | Ngày báo: ............ |

**QĐ15:** Chỉ **Developer** được báo đã sửa. Chỉ báo cho **lần chạy gần nhất** của test case và lần chạy đó có kết quả *Fail*; mỗi lần chạy chỉ báo một lần. **Bắt buộc** nhập bản build (1–50 ký tự). Test case **cần kiểm thử lại** khi lần chạy gần nhất là *Fail* và đã được báo sửa; khi Tester ghi một lần chạy mới, test case tự hết trạng thái này.


## 2.4. Bảng trách nhiệm yêu cầu nghiệp vụ

| STT | Nghiệp vụ | Người dùng | Phần mềm | Ghi chú |
|---|---|---|---|---|
| 1 | YC1 Đồng bộ user story | PO/BA viết story trên Jira; Admin hoặc QA Lead bấm *Đồng bộ ngay* | Gọi Jira, tách mô tả và acceptance criteria theo QĐ1, lưu story chỉ đọc | Một chiều Jira → hệ thống |
| 2 | YC2 Sinh test case bằng AI | Chọn user story, bấm Sinh | Che dữ liệu nhạy cảm, ghép prompt, gọi LLM, kiểm tra schema, thử lại, cắt theo QĐ2, lưu trạng thái Nháp, ghi nhật ký AI | Kết quả luôn cần người xem lại |
| 3 | YC3 Soạn thảo, gửi duyệt | Sửa/xóa/thêm, chọn và gửi duyệt | Kiểm tra QĐ3, lưu phiên bản, đổi trạng thái | |
| 4 | YC4 Duyệt | Xem, duyệt hoặc trả lại kèm ghi chú | Kiểm tra QĐ4, lưu phiếu duyệt | |
| 5 | YC5 Ghi kết quả | Chọn kết quả, nhập ghi chú | Kiểm tra QĐ5, lưu | |
| 6 | YC6 Báo cáo | Chọn dự án, sprint | Tính toán theo QĐ6 và vẽ biểu đồ | |
| 7 | YC7 Tra cứu | Nhập điều kiện lọc | Tìm theo QĐ7 và hiển thị | |
| 8 | YC8 Nhận thay đổi user story | PO/BA sửa hoặc xóa story trên Jira; Tester xem lại test case rồi bấm *Đã xem lại* | Nhận webhook hoặc đồng bộ định kỳ, so nội dung cũ, đánh dấu *Cần xem lại test case*, lưu trữ story đã xóa (QĐ8) | Tester không bỏ sót thay đổi yêu cầu |
| 9 | YC9 Xuất test case | Bấm Xuất Excel ở màn hình tra cứu | Tạo file .xlsx theo QĐ9 | |
| 10 | YC10 Script tự động | Bấm Sinh script, xem lại, sửa, bấm Chạy | Gọi LLM sinh script, kiểm tra tĩnh, chạy trong tiến trình cô lập có giới hạn thời gian, lưu kết quả và ảnh lỗi | |
| 11 | YC11 Thay đổi quy định | Nhập giá trị mới | Kiểm tra miền giá trị, lưu vào bảng tham số | |
| 12 | YC12 Quản lý người dùng | Nhập thông tin, khóa/mở khóa | Băm mật khẩu, kiểm tra QĐ12 | |
| 13 | YC13 Đồng bộ dự án từ Jira | Bấm Kiểm tra kết nối; nhập mã dự án Jira, bấm Thêm hoặc Đồng bộ lại | Gọi Jira REST API, kiểm tra QĐ13, lưu dự án, module, ánh xạ thành viên theo email; đồng bộ story và sprint | Admin khai báo thêm URL ứng dụng cần test |
| 14 | YC14 Theo dõi sprint | PO/BA, Scrum Master lập sprint, ước lượng story point trên Jira; mọi người xem bảng sprint | Đồng bộ sprint theo QĐ14; tự tính trạng thái DoD của story, velocity, burndown | Hỗ trợ đội làm Scrum |
| 15 | YC15 Báo đã sửa lỗi | Developer chọn lần chạy Fail, nhập bản build, ghi chú; Tester lọc *Cần kiểm thử lại* rồi chạy lại | Kiểm tra QĐ15, lưu phiếu báo sửa, ghi audit log; tự xác định test case cần kiểm thử lại | Khép kín vòng báo lỗi – sửa – kiểm thử lại |

## 2.5. Yêu cầu chất lượng

### 2.5.1. Tính tiến hóa

| STT | Nghiệp vụ | Tham số cần thay đổi | Miền giá trị cần thay đổi |
|---|---|---|---|
| 1 | Đồng bộ user story | Số acceptance criteria tối thiểu | Danh sách độ ưu tiên; nhãn tiêu đề mục *Acceptance criteria* (Anh / Việt) |
| 2 | Sinh test case bằng AI | Số test case tối đa/story, số lần thử lại, thời gian chờ, số lần gọi/giờ | **Nhà cung cấp LLM** (mock, Gemini, Claude, OpenAI) – đổi qua cấu hình, không sửa mã nguồn |
| 3 | Chạy script tự động | Thời gian chạy tối đa | Framework kiểm thử (thiết kế mở cho WebdriverIO, Cypress) |
| 4 | Theo dõi sprint | Độ dài tối đa sprint (ngưỡng cảnh báo) | Thang story point |
| 5 | Đồng bộ với Jira | Địa chỉ Jira, tài khoản, API token, mã bí mật webhook, chu kỳ đồng bộ (cấu hình `.env`) | Trường story point, sprint tự tìm theo tên trên từng site Jira; chưa cấu hình thì dùng Jira giả lập |

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
| 1 | Đồng bộ user story, sprint | Jira Cloud REST API v3, Jira Software Agile API, webhook Jira |
| 2 | Xuất test case | Microsoft Excel, Google Sheets (.xlsx) |
| 3 | Script tự động | Playwright (Node.js), chạy được độc lập ngoài hệ thống |
| 4 | Trình duyệt | Chrome, Edge, Firefox, Safari bản mới |
| 5 | LLM | Gemini API, Claude API, OpenAI API (cùng interface `LLMProvider`) |

## 2.6. Yêu cầu hệ thống

### 2.6.1. Tính an toàn

| STT | Nghiệp vụ | Đối tượng |
|---|---|---|
| 1 | Phục hồi | Sửa nhầm test case: xem lại lịch sử phiên bản để khôi phục nội dung cũ; CSDL nằm trên volume Docker, sao lưu bằng cách sao chép file `app.db` |
| 2 | Không hủy thật sự | Story bị xóa trên Jira chỉ được **lưu trữ**, test case và kết quả chạy đã có vẫn giữ lại |
| 3 | Không cho phép xóa | Test case *Chờ duyệt*/*Đã duyệt*; tài khoản đang đăng nhập không tự khóa |

### 2.6.2. Tính bảo mật

| STT | Nghiệp vụ | Admin | QA Lead | PO/BA | Tester | Developer |
|---|---|---|---|---|---|---|
| 1 | Quản lý người dùng; khai báo URL ứng dụng cần test | ✔ | | | | |
| 2 | Kiểm tra kết nối Jira | ✔ | | | | |
| 3 | Thêm dự án; đồng bộ user story, sprint từ Jira | ✔ | ✔ | | | |
| 4 | Sinh test case/script bằng AI | | ✔ | | ✔ | |
| 5 | Soạn thảo, gửi duyệt; đánh dấu đã xem lại khi story đổi | | ✔ | | ✔ | |
| 6 | Duyệt test case | | ✔ | | | |
| 7 | Ghi kết quả, chạy tự động | | ✔ | | ✔ | |
| 8 | Báo đã sửa lỗi | | | | | ✔ |
| 9 | Thay đổi quy định | ✔ | ✔ | | | |
| 10 | Xem nhật ký hoạt động | ✔ | ✔ | | | |
| 11 | Xem nhật ký AI | ✔ | ✔ | | ✔ | |
| 12 | Xem user story, sprint, báo cáo; tra cứu, xuất Excel, xem kết quả chạy | ✔ | ✔ | ✔ | ✔ | ✔ |

Không vai trò nào được tạo, sửa, xóa user story hoặc sprint trong hệ thống: việc đó làm trên Jira.

**Yêu cầu bảo mật kỹ thuật:**

| Mã | Yêu cầu |
|---|---|
| SE-01 | Mật khẩu băm bằng bcrypt (cost 10), không bao giờ trả về qua API |
| SE-02 | Xác thực bằng JWT có hạn 8 giờ; kiểm tra tài khoản còn hoạt động ở mỗi request |
| SE-03 | Phân quyền theo vai trò (RBAC) kiểm tra ở **backend**, giao diện chỉ ẩn nút |
| SE-04 | Giới hạn đăng nhập sai: 10 lần/15 phút/IP |
| SE-05 | Mọi truy vấn CSDL dùng prepared statement (chống SQL injection) |
| SE-06 | Kiểm tra dữ liệu đầu vào bằng schema (Zod); giới hạn kích thước request 1 MB |
| SE-07 | Chống XSS: escape mọi dữ liệu khi hiển thị + Content-Security-Policy `script-src 'self'` |
| SE-08 | API key LLM và API token Jira chỉ lưu ở biến môi trường backend, không commit (.gitignore), không gửi xuống trình duyệt |
| SE-09 | **Che dữ liệu nhạy cảm** (email, số điện thoại, CCCD, số thẻ) trước khi gửi LLM |
| SE-10 | **Chống prompt injection:** tách prompt hệ thống và dữ liệu người dùng, bọc dữ liệu trong thẻ, phát hiện và gắn cờ, kết quả bắt buộc qua schema |
| SE-11 | Giới hạn số lần gọi AI mỗi người/giờ (chống lạm dụng chi phí) |
| SE-12 | **Sandbox** cho script do AI sinh: kiểm tra tĩnh, tiến trình riêng, biến môi trường tối thiểu, timeout, giới hạn CPU/RAM trong Docker |
| SE-13 | Nhật ký hoạt động (audit log) cho mọi thao tác ghi: ai, làm gì, đối tượng nào, lúc nào, IP |
| SE-14 | Ghi rõ chính sách dữ liệu của nhà cung cấp LLM (dùng gói API không dùng dữ liệu để huấn luyện) |
| SE-15 | Webhook Jira không dùng JWT nên bắt buộc có mã bí mật `JIRA_WEBHOOK_SECRET`, so sánh an toàn theo thời gian; thiếu mã thì tắt webhook |

## 2.7. Yêu cầu khác – yêu cầu công nghệ

| STT | Yêu cầu | Mô tả chi tiết |
|---|---|---|
| 1 | Dễ sửa lỗi | Kiến trúc nhiều lớp; mỗi YC nằm trong một service riêng |
| 2 | Dễ bảo trì | Thêm LLM mới chỉ cần thêm 1 lớp kế thừa `LLMProvider` |
| 3 | Tái sử dụng | AI Service, script Playwright dùng lại được ngoài hệ thống |
| 4 | Dễ mang chuyển | Chạy bằng Docker; CSDL viết theo SQL chuẩn, chuyển SQLite → PostgreSQL |
| 5 | Kiểm thử tự động | Unit + API + E2E, chạy tự động trên GitHub Actions |
