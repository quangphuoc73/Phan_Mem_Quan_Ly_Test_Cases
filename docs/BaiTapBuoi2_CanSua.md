# Bài tập buổi 2 – những chỗ cần sửa cho khớp phần mềm

Đối chiếu file *PDF – Nhóm 10 – BT Buổi 2 – NMCNPM (ver1)* với phần mềm và tài liệu đồ án (bản ngày 02/11/2026).

Đoạn văn mẫu để chép sang Word lấy từ [02_DacTaYeuCau.md](02_DacTaYeuCau.md) (biểu mẫu, quy định, bảng trách nhiệm, bảng phân quyền) và mục 3.4 của [03_PhanTich.md](03_PhanTich.md) (DFD, D1–D6, thuật toán). Hình DFD nằm ở `docs/dfd/*.svg`.

**Bản đã sửa sẵn:** `~/Desktop/PDF  - Nhom 10 - BT Buoi 2 - NMCNPM (ver3).pdf` và bản Word cùng tên (ver3) – áp dụng các mục A, B, C và mục D bên dưới. Bản ver2 chỉ có A, B, C.

## D. Thay đổi ở ver3 – user story và sprint đồng bộ một chiều từ Jira (03/11/2026)

Theo góp ý của nhóm: user story chỉ được tạo, sửa trên Jira; hệ thống chỉ nhận về, không có chiều ngược lại.

| Mục | ver2 | ver3 |
|---|---|---|
| YC1 – BM1 – QĐ1 | Lập user story (nhập tay, mã US-XXX) | **Đồng bộ user story từ Jira**: mã là mã issue Jira; tách mô tả và mục *Acceptance criteria* trong Description; story thiếu tiêu chí không được sinh test case |
| YC8 – BM7 – QĐ8 | Nhập user story từ file CSV/JSON | **Nhận thay đổi user story từ Jira** (webhook có mã bí mật, đồng bộ định kỳ 5 phút, nút Đồng bộ ngay); story đổi khi đã có test case → *Cần xem lại test case*; story xóa trên Jira → lưu trữ, giữ test case |
| YC13 – QĐ13 | Admin vẫn tạo dự án thủ công | Không tạo dự án, module bằng tay; Admin chỉ khai báo thêm URL ứng dụng cần test; thêm dự án xong đồng bộ luôn story và sprint |
| YC14 – BM13 – QĐ14 | Quản lý sprint: tạo, sửa sprint, đưa story vào sprint trong hệ thống | **Theo dõi sprint**: sprint, story point lấy từ Jira; hệ thống chỉ tính DoD, velocity, burndown; sprint chưa có ngày bỏ qua, quá 28 ngày cảnh báo |
| Bảng phân quyền | PO/BA lập story, tạo sprint | Không ai tạo, sửa story hay sprint trong hệ thống; PO/BA chỉ xem |
| Bảo mật | – | Thêm SE-15: webhook bắt buộc mã bí mật |
| DFD | YC1, YC8, YC14 theo bản cũ | Vẽ lại DFD YC1, YC8, YC13, YC14 theo luồng Jira |

**Đánh giá chung:** bố cục đúng khuôn môn học (nghiệp vụ → chất lượng → hệ thống, DFD theo D1–D6 kèm thuật toán) và phần lớn nội dung đã khớp phần mềm. Cần sửa 3 nhóm việc dưới đây.

## A. Bổ sung phần còn thiếu

| # | Chỗ cần sửa | Nội dung bổ sung |
|---|---|---|
| A1 | Mục II.1a: danh sách yêu cầu (tr. 3–5) | Thêm dòng **YC15 – Báo đã sửa lỗi và kiểm thử lại** · Lưu trữ, tra cứu · BM14 · QĐ15 · *Developer báo, Tester lọc được test case cần kiểm thử lại* |
| A2 | Mục II.1b: yêu cầu chức năng (tr. 5–10) | Thêm dòng 15 cho YC15. Người dùng: Developer chọn lần chạy Fail, nhập bản build và ghi chú; Tester lọc *Cần kiểm thử lại* rồi chạy lại. Phần mềm: kiểm tra QĐ15, lưu phiếu báo sửa, ghi audit log, tự xác định test case cần kiểm thử lại |
| A3 | Mục II.1c: biểu mẫu và quy định | Thêm **BM14 – Phiếu báo đã sửa lỗi** và **QĐ15** (chép từ 02_DacTaYeuCau.md) |
| A4 | Vai trò **PO/BA** (phần mềm có 5 vai trò) | Thêm PO/BA vào BM11 (tr. 15), D1 của DFD YC12 (tr. 39) và bảng phân quyền (tr. 22–23). Từ ver3 PO/BA viết story, lập sprint trên Jira, trong hệ thống chỉ xem (mục D) |
| A5 | Mục III: DFD | Thêm **DFD YC15 – Báo đã sửa lỗi** (hình `docs/dfd/YC15_BaoDaSuaLoi.svg`); bảng thống kê tr. 23 đổi "14 yêu cầu" → **15 yêu cầu**, nhóm Lưu trữ thêm YC15 |
| A6 | Bối cảnh (tr. 1) | "Developer có thể xem các test case thất bại để kịp thời khắc phục lỗi" → thêm "*và báo đã sửa kèm bản build để Tester kiểm thử lại*". "Đồng thời định hướng tích hợp với Jira" → "*đồng bộ dự án, module và thành viên từ Jira*" |

## B. Viết khác với phần mềm (sửa PDF theo phần mềm)

| # | Trang | PDF đang viết | Phần mềm thực tế → sửa thành |
|---|---|---|---|
| B1 | 6 (YC2) | "**Mã hóa** dữ liệu nhạy cảm" | **Che** (ẩn) dữ liệu nhạy cảm: email, số điện thoại, CCCD, số thẻ được thay bằng nhãn trước khi gửi LLM. Đây không phải mã hóa |
| B2 | 7, 12, 32–33 (YC5, BM4, DFD YC5) | Chạy thủ công thì "tải lên file log/ảnh chụp lỗi"; D2 = file log, ảnh | Chạy thủ công chỉ nhập **kết quả và ghi chú (mã bug)**. Log và ảnh chụp lỗi chỉ có khi **chạy tự động** (YC10). DFD YC5: D2 = *Không có* (mũi tên trắng), bỏ bước B2 |
| B3 | 7, 46–47 (YC6) | Chọn "khoảng thời gian"; B11 "Lưu D4 xuống bộ nhớ phụ" | Chọn **dự án và sprint**. Báo cáo được **tính ngay khi mở, không lưu**, nên D4 = *Không có* (mũi tên trắng) và bỏ B11; D6 là bảng số liệu và biểu đồ |
| B4 | 12–13 (QĐ6) | "Tổng hợp theo thời gian thực (Real-time)" | "Báo cáo được tính ngay khi mở, trong phạm vi dự án và sprint đang chọn" (giữ phần còn lại) |
| B5 | 13, 45 (QĐ7, DFD YC7) | Phân trang 50 dòng/trang; sắp theo thời gian cập nhật; chỉ tra cứu dự án được phân quyền | **Không phân trang**, danh sách cập nhật ngay khi đổi bộ lọc; sắp theo user story mới nhất, trong mỗi story theo mã test case; mọi người dùng đăng nhập đều tra cứu được (chọn dự án ở thanh trên). Sửa B3–B5 của DFD YC7 tương ứng |
| B6 | 13, 34–35 (BM7, QĐ8, DFD YC8) | Chọn "Bỏ qua / Ghi đè" khi trùng mã; cột bắt buộc có `module` | **Không có Ghi đè**: dòng trùng mã được báo lỗi "mã đã tồn tại", các dòng khác vẫn nhập. Cột bắt buộc: `code, title, description, acceptance_criteria, priority`; tùy chọn: `module, sprint, story_points`. DFD YC8: D1 chỉ còn *dự án*; B10 đổi thành "dòng trùng mã ghi vào danh sách lỗi" |
| B7 | 14, 48–49 (QĐ9, DFD YC9) | Tên tệp `TestCases_MaDuAn_NgayXuat_GioXuat.xlsx`; tô màu cột Trạng thái/Kết quả; chỉ người thuộc dự án mới xuất | Tên tệp **`testcases.xlsx`**; chỉ **dòng tiêu đề** tô màu, các bước xuống dòng trong ô; mọi người dùng đăng nhập đều xuất được, mỗi lần xuất ghi nhật ký. DFD YC9: bỏ B4–B5 (kiểm tra thuộc dự án) |
| B8 | 15 (BM10) | Danh sách độ ưu tiên "Khẩn cấp. Cao. Trung bình. Thấp." | Mặc định **High, Medium, Low** (khớp QĐ1, BM1, BM2); Admin đổi được trong *Thay đổi quy định* |
| B9 | 15, 38 (QĐ11, DFD YC11) | Chỉ Admin thay đổi quy định | **Admin hoặc QA Lead** được thay đổi (B4 của DFD YC11 sửa tương ứng) |
| B10 | 10, 16, 41–42 (YC13, BM12, QĐ13) | Người dùng nhập thông tin cấu hình API trên giao diện; "không cung cấp tính năng thêm, sửa dự án bằng tay" | Địa chỉ Jira, email, API token **chỉ cấu hình ở máy chủ (`.env`)**, không nhập trên giao diện, không lưu CSDL (SE-08). Thao tác: Kiểm tra kết nối (Admin) · Thêm dự án từ Jira (Admin, QA Lead) · **Đồng bộ lại**. Thành viên gán theo **email trùng** với tài khoản. **Admin vẫn tạo dự án thủ công** khi đội không dùng Jira. Chép QĐ13 mới từ 02_DacTaYeuCau.md; DFD YC13: D1 bỏ "thông tin cấu hình API", D5 ghi "thông tin xác thực đọc từ `.env`" |
| B11 | 17 (tiến hóa) | Framework "WebdriverIO, Cypress, Playwright"; story point "Fibonacci hoặc Linear"; số dòng nhập cấu hình 100–1000 qua `.env` | Hiện chỉ có **Playwright** (thiết kế mở để thêm framework khác); story point chỉ theo dãy **Fibonacci 1, 2, 3, 5, 8, 13**; số dòng nhập **cố định 200** (QĐ8), không cấu hình qua `.env`. Thêm dòng "Đồng bộ dự án: địa chỉ Jira, tài khoản, token cấu hình trong `.env`" |
| B12 | 18 (tiện dụng) | Giao diện Sáng/Tối (Light/Dark mode) | Chưa có chế độ tối. Bỏ ý này, hoặc chuyển sang mục hướng phát triển. Responsive thì đã có |
| B13 | 18–19 (hiệu quả) | Nén dữ liệu text < 2 KB/bản ghi; dọn cache báo cáo sau 24 giờ; ≥ 50 người dùng đồng thời; < 2 giây với 10.000 test case | Phần mềm **không có** nén dữ liệu và cache báo cáo; tải đồng thời và 10.000 test case **chưa đo**. Bỏ hai ý đầu; hai ý sau ghi rõ là *mục tiêu*, hoặc bỏ |
| B14 | 20 (an toàn) | "Test case đã xóa nhầm: có lịch sử phiên bản"; "CSDL tự động sao lưu định kỳ qua Volume Docker"; "xác nhận qua 2 bước bảo mật" | Xóa test case thì **xóa luôn lịch sử**; lịch sử phiên bản chỉ giúp khôi phục khi **sửa nhầm**. Volume Docker chỉ **giữ** dữ liệu khi tạo lại container; sao lưu bằng cách sao chép file `app.db`. Xóa user story có **1 hộp thoại xác nhận** |
| B15 | 29–30 (DFD YC3, B10) | Xóa test case "giữ nội dung trong lịch sử phiên bản để có thể phục hồi" | Xóa hẳn test case cùng lịch sử (chỉ xóa được test case *Nháp* hoặc *Bị trả lại*) |
| B16 | 22–23 (bảng phân quyền) | Xem bảng đúng ở mục B17 | Các chỗ lệch: Admin **không** sinh AI, sửa/gửi duyệt test case, chạy test (dòng 4, 5, 6, 9, 10 của Admin là ✗); QA Lead **được** thay đổi quy định (dòng 12); QA Lead xem **toàn bộ** nhật ký hoạt động (dòng 13); xem báo cáo **không giới hạn** theo dự án (dòng 11); không có chức năng "sao chép, tái sử dụng" và "so sánh phiên bản" (chỉ *xem lịch sử phiên bản*); cấu hình LLM và Jira nằm ở `.env`, không trên giao diện |

### B17. Bảng phân quyền đúng với phần mềm (thay bảng tr. 22–23)

| STT | Chức năng | Admin | QA Lead | PO/BA | Tester | Dev |
|---|---|---|---|---|---|---|
| 1 | Quản lý người dùng; tạo dự án, module thủ công | √ | X | X | X | X |
| 2 | Kiểm tra kết nối Jira | √ | X | X | X | X |
| 3 | Thêm dự án từ Jira, đồng bộ lại | √ | √ | X | X | X |
| 4 | Lập, nhập user story | √ | √ | √ | √ | Xem |
| 5 | Sinh test case / script bằng AI | X | √ | X | √ | X |
| 6 | Soạn thảo, gửi duyệt test case; xem lịch sử phiên bản | X (xem) | √ | X (xem) | √ | X (xem) |
| 7 | Duyệt / trả lại test case | X | √ | X | X | X |
| 8 | Ghi kết quả, chạy script tự động | X | √ | X | √ | Xem kết quả, log, ảnh lỗi |
| 9 | Báo đã sửa lỗi | X | X | X | X | √ |
| 10 | Tạo / sửa sprint | √ | √ | √ | Xem | Xem |
| 11 | Thay đổi quy định | √ | √ | X | X | X |
| 12 | Xem nhật ký hoạt động | √ | √ | X | X | X |
| 13 | Xem nhật ký AI | √ | √ | X | √ | X |
| 14 | Xem báo cáo, tra cứu, xuất Excel | √ | √ | √ | √ | √ |

## C. Lỗi chính tả, trình bày

| Trang | Sửa |
|---|---|
| 14 (QĐ9) | "tes case" → "test case" |
| 11 (BM2) | "Đã Duyệt" → "Đã duyệt" cho thống nhất |
| 17 (bảng tiến hóa) | "Miền giá trị  cần  thay đổi" thừa dấu cách |
| 23 | "Bảng thống kê phân loại 3 sơ đồ … cho 14 yêu cầu" → "… cho 15 yêu cầu" |
| Cả bài | Tên trường trong bảng phân quyền "QA Leader" → "QA Lead" (khớp phần còn lại) |

## Không cần sửa (đã khớp phần mềm)

YC1, YC2 (QĐ2: 20 test case, 1–15 bước, thử lại 2 lần, 30 giây, 30 lần/giờ), YC3, YC4, YC10 (QĐ10 kiểm tra tĩnh, 60 giây), YC12 (QĐ12), YC14 (DoD, velocity, burndown, 28 ngày, Fibonacci), bảng SE-01 → SE-14 và các thuật toán DFD còn lại.
