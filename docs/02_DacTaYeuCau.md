# Chương 2. Xác định và đặc tả yêu cầu

> Sản phẩm của giai đoạn: **danh sách các yêu cầu phần mềm** kèm biểu mẫu (BM) và quy định (QĐ), cùng bảng trách nhiệm. **Yêu cầu phần mềm** là các công việc, các nghiệp vụ được hỗ trợ thực hiện trên máy tính với phần mềm. Nội dung chương này theo **đặc tả yêu cầu nghiệp vụ bản chốt ngày 16/11/2026** (`docs/DacTa_YeuCauNghiepVu_1011.docx`), được cả nhóm thống nhất làm căn cứ triển khai.

Theo môn học, yêu cầu phần mềm được lập theo thứ tự **nghiệp vụ → chất lượng → hệ thống**:

| Nhóm | Gồm | Đảm bảo | Mục trong chương |
|---|---|---|---|
| **Yêu cầu nghiệp vụ** | Lưu trữ, tra cứu, tính toán, kết xuất | Tính **đúng đắn** | 2.2 – 2.4 |
| **Yêu cầu chất lượng** | Tính tiến hóa, tiện dụng, hiệu quả, tương thích | | 2.5 |
| **Yêu cầu hệ thống** | Tính an toàn, bảo mật | | 2.6 |
| Yêu cầu khác | Yêu cầu công nghệ (dễ sửa lỗi, bảo trì, tái sử dụng, mang chuyển) | | 2.7 |

**Bối cảnh và phạm vi.** Phần mềm là ứng dụng web quản lý kiểm thử gồm Test Suite, Test Case, phê duyệt, Test Run và báo cáo. **Điểm mới trọng tâm:** AI giúp QA xác định test nào cần sửa và test nào cần chạy lại sau khi requirement thay đổi trên Jira. **Phân chia trách nhiệm:** Jira quản lý requirement gốc; ứng dụng quản lý nghiệp vụ kiểm thử và bản sao requirement được đồng bộ.

**Giả định:**
- Đồng bộ Jira **một chiều**: ứng dụng chỉ đọc requirement, không ghi ngược lên Jira.
- Nội dung nghiệp vụ của requirement là tiêu đề, mô tả và AC (acceptance criteria).
- MVP gồm **18 yêu cầu**. YC19 (script tự động) và YC20 (sprint) nằm ngoài MVP, mô tả ở mục 2.8.
- Phân quyền theo **5 vai trò toàn cục** (Admin, QA Lead, PO/BA, Tester, Developer), không phân quyền theo dự án.
- AI chỉ phân tích khi người dùng bấm, không tự chạy khi đồng bộ. AI không tự đổi test; mọi thay đổi phải qua duyệt.
- Các con số (giới hạn, số lần thử lại, độ dài tên) là tham số, thay đổi được (YC10).

## 2.1. Tác nhân (actor)

| Tác nhân | Mô tả |
|---|---|
| Admin | Quản trị hệ thống: tài khoản, quy định; kiểm tra kết nối Jira, thêm dự án và đồng bộ từ Jira; xử lý requirement Cần kiểm tra |
| QA Lead | Trưởng nhóm kiểm thử: duyệt test case, lập Test Run và phân công, chấp nhận hoặc từ chối đề xuất AI, xác nhận bộ regression, thay đổi quy định, đồng bộ Jira; có toàn bộ quyền của Tester |
| PO / BA | Product Owner / Business Analyst: viết requirement kèm AC **trên Jira**; trong hệ thống chỉ xem requirement, test case, Test Run và báo cáo để nghiệm thu |
| Tester | Dùng AI sinh test case, soạn và gửi duyệt test, gắn AC, xác nhận Đã xem lại khi requirement đổi, quản lý Test Suite, ghi kết quả chạy test, chạy phân tích ảnh hưởng và xem đề xuất AI |
| Developer | Xem test case, kết quả chạy và báo cáo để tái hiện lỗi; báo đã sửa lỗi kèm bản build để kiểm thử lại |
| Dịch vụ LLM (hệ thống ngoài) | Gemini / Claude / OpenAI: nhận prompt đã che dữ liệu nhạy cảm, trả JSON |
| Jira (hệ thống ngoài) | Jira Cloud: **nơi duy nhất** tạo và sửa requirement; cung cấp dự án, component (module), thành viên, issue qua REST API và gọi webhook khi issue thay đổi |

## 2.2. Danh sách yêu cầu nghiệp vụ

| STT | Tên yêu cầu | Loại yêu cầu | Biểu mẫu | Quy định | Vai trò | Ghi chú |
|---|---|---|---|---|---|---|
| 1 | YC1 – Xem requirement từ Jira và lịch sử thay đổi | Lưu trữ, tra cứu | BM1 | QĐ1 | Mọi vai trò xem | Một chiều, chỉ đọc; nhận diện bằng issue ID; mỗi lần AC, tiêu đề, mô tả đổi tạo một phiên bản |
| 2 | YC2 – Sinh test case bằng AI | Lưu trữ, tính toán | BM2 | QĐ2 | QA Lead, Tester | Tối đa 20 test/requirement; kết quả AI là bản nháp, không thay thế bản nháp cũ; chỉ sinh khi đủ AC |
| 3 | YC3 – Soạn thảo và gửi duyệt test case | Lưu trữ | BM2 | QĐ3 | QA Lead, Tester | Liên kết AC và phiên bản nguồn; không xóa test đã có lần chạy; Đã xem lại phải ghi lý do |
| 4 | YC4 – Duyệt test case | Lưu trữ | BM3 | QĐ4 | QA Lead | Trả lại bắt buộc có ghi chú; bản nháp từ đề xuất AI cũng phải duyệt |
| 5 | YC5 – Ghi nhận kết quả chạy test | Lưu trữ | BM4 | QĐ5 | QA Lead, Tester | Ghi trong Test Run đang mở, theo phiên bản test cố định; Fail/Blocked bắt buộc ghi chú |
| 6 | YC6 – Lập báo cáo kiểm thử | Tính toán, kết xuất | BM5 | QĐ6 | Mọi vai trò xem | Theo dự án hoặc Test Run; độ bao phủ theo requirement và theo AC |
| 7 | YC7 – Tra cứu test case | Tra cứu | BM6 | QĐ7 | Mọi vai trò xem | Lọc theo requirement, Test Suite, Test Run, cờ cần xem lại |
| 8 | YC8 – Nhận thay đổi requirement từ Jira | Lưu trữ, tính toán | BM7 | QĐ8 | Hệ thống; Admin, QA Lead | Webhook, định kỳ, nút Đồng bộ ngay; chỉ ghi bản mới hơn; không tự lưu trữ |
| 9 | YC9 – Xuất dữ liệu test case | Kết xuất | BM8 | QĐ9 | Mọi vai trò | File .xlsx theo bộ lọc đang chọn |
| 10 | YC10 – Thay đổi quy định hệ thống | Lưu trữ | BM9 | QĐ10 | Admin, QA Lead | Chỉ tham số nghiệp vụ và AI; cấu hình Jira ở `.env` |
| 11 | YC11 – Quản lý người dùng | Lưu trữ | BM10 | QĐ11 | Admin | 5 vai trò toàn cục; băm bcrypt; không tự khóa, tự hạ quyền |
| 12 | YC12 – Đồng bộ dự án từ Jira | Lưu trữ, tính toán | BM11 | QĐ12 | Admin, QA Lead | Lấy dự án, module, thành viên qua Jira API; không tạo dự án tay |
| 13 | YC13 – Quản lý Test Suite | Lưu trữ, tra cứu | BM12 | QĐ13 | QA Lead, Tester | Suite dạng phẳng; một test thuộc được nhiều suite |
| 14 | YC14 – Lập Test Run và phân công | Lưu trữ, tính toán | BM13 | QĐ14 | QA Lead lập; Tester chạy | Chỉ test đủ điều kiện chạy; cố định phiên bản; ghi build và môi trường, khóa khi đã có kết quả |
| 15 | YC15 – AI phân tích ảnh hưởng | Tính toán, lưu trữ | BM14 | QĐ15 | QA Lead, Tester | So phiên bản test đã liên kết với phiên bản hiện tại; 4 loại đề xuất, luôn có lý do |
| 16 | YC16 – Rà soát và áp dụng đề xuất AI | Lưu trữ | BM15 | QĐ16 | Tester xem; QA Lead quyết định | Kiểm tra phiên bản nguồn; áp dụng tạo bản nháp, phải duyệt lại |
| 17 | YC17 – AI đề xuất bộ regression | Tính toán, lưu trữ | BM16 | QĐ17 | Tester xem; QA Lead xác nhận | Luôn gồm test liên kết với AC đã đổi; xác nhận mới tạo Test Run |
| 18 | YC18 – Báo đã sửa lỗi và kiểm thử lại | Lưu trữ, tra cứu | BM17 | QĐ18 | Developer báo; Tester chạy lại | Bắt buộc có build; lần chạy lại gắn với đúng lần Fail gốc |

Mã YC đánh liên tục YC1–YC18 cho MVP; hai yêu cầu ngoài MVP xếp cuối là YC19 (script tự động) và YC20 (sprint), xem mục 2.8. Quy định đánh cùng số với yêu cầu (QĐ1–QĐ18 cho MVP, QĐ19, QĐ20 ngoài MVP); biểu mẫu đánh liên tục BM1–BM17 cho MVP (YC2 và YC3 dùng chung BM2), BM18, BM19 ngoài MVP.

**Ý nghĩa loại yêu cầu:**
- **Lưu trữ:** ghi thông tin mới hoặc thay đổi xuống bộ nhớ phụ.
- **Tra cứu:** tìm và xem lại thông tin đã lưu.
- **Tính toán:** tạo ra thông tin mới từ thông tin đã có theo quy định, công thức (tỷ lệ pass, độ bao phủ, mốc phiên bản để so, đề xuất AI).
- **Kết xuất:** đưa thông tin ra màn hình, máy in hoặc file theo biểu mẫu.

## 2.3. Biểu mẫu và quy định

### BM1 – Requirement (đồng bộ từ Jira)

| BM1 | **Requirement** – issue thuộc loại được đồng bộ trên Jira |
|---|---|
| Mã hiển thị: ............ (mã issue Jira, VD `SHOP-5`) | Dự án: ............ Module: ............ |
| Issue ID Jira: ............ (định danh nội bộ, không đổi) | Độ ưu tiên: ............ Trạng thái Jira: ............ |
| Loại issue: ............ | Thời điểm cập nhật trên Jira: ............ |
| Tiêu đề (Summary): ............ | Trạng thái đồng bộ: Bình thường / Thiếu AC / Cần kiểm tra (lý do) / Đã lưu trữ |
| Mô tả: *Là [vai trò], tôi muốn [chức năng], để [lợi ích].* | Phiên bản hiện tại: ............ Lịch sử: phiên bản, thời điểm, nội dung đổi |
| Acceptance criteria: 1. ............ 2. ............ | Liên kết Jira: ............ |

**QĐ1:** Requirement chỉ được tạo và sửa **trên Jira**; hệ thống không có chức năng lập, sửa, xóa hay nhập requirement từ file. Chỉ lấy issue thuộc các loại khai báo trong `JIRA_ISSUE_TYPES` (mặc định Story) của dự án đã thêm. Mỗi requirement được nhận diện bằng **issue ID** của Jira; mã hiển thị (VD SHOP-5) chỉ để xem và được cập nhật khi Jira đổi mã, nên test, lịch sử và liên kết được giữ nguyên. Trong Description, phần trước dòng "Acceptance criteria" là mô tả, mỗi dòng sau đó là một AC; nhãn mục này cố định. Độ ưu tiên Jira đổi về High, Medium, Low. Requirement có ít hơn `MIN_AC_PER_STORY` AC (mặc định 1) vẫn được lấy về nhưng AI không sinh test; tham số này không chặn soạn test thủ công. Requirement không có AC nào được đánh dấu **Thiếu AC** và liệt kê riêng để PO/BA bổ sung trên Jira. Mỗi khi tiêu đề, mô tả hoặc AC đổi, hệ thống tạo **một phiên bản mới**, không xóa phiên bản cũ. Đổi độ ưu tiên hoặc trạng thái Jira chỉ cập nhật giá trị hiện tại.

### BM2 – Test case

| BM2 | **Test case** |
|---|---|
| Mã test case: ............ (tự sinh: `<mã requirement>-TCnn`) | Thuộc requirement: ............ Phiên bản requirement đã liên kết: ............ |
| Tiêu đề: ............ | Loại: Positive / Negative / Edge · Độ ưu tiên: High / Medium / Low |
| Điều kiện tiên quyết: ............ | AC liên kết: ............ · Test Suite: ............ |
| Các bước: 1. ............ 2. ............ | Nguồn: AI / Thủ công · Tạo từ đề xuất: ............ |
| Kết quả mong đợi: ............ | Trạng thái · Phiên bản · Cờ: Cần xem lại |

**QĐ2:** Mỗi requirement có tối đa **20** test case (tham số). Giảm tham số xuống thấp hơn số test hiện có thì chỉ chặn tạo thêm, không xóa test cũ. AI chỉ được sinh trong giới hạn còn lại và chỉ khi requirement đủ `MIN_AC_PER_STORY` AC; khi sinh lại, **bản nháp cũ được giữ nguyên**, không bị thay thế. Mỗi test case có 1–15 bước. Kết quả AI phải đúng JSON schema; sai thì tự thử lại tối đa **2** lần. Mỗi lần gọi AI chờ tối đa **30** giây. Mỗi người dùng gọi AI tối đa **30** lần/giờ, dùng chung cho YC2 và YC15. Test do AI sinh phải **chỉ rõ AC liên quan**.

**QĐ3:** Chỉ test ở trạng thái *Nháp* hoặc *Bị trả lại* mới được gửi duyệt. Test *Chờ duyệt* không được sửa. Sửa test *Đã duyệt* thì quay về *Nháp* và phải duyệt lại; trong lúc đó test không được đưa vào đợt mới, các đợt đang mở vẫn chạy phiên bản đã cố định. Mỗi lần sửa tạo một phiên bản mới. Test phải **liên kết ít nhất 1 AC** mới được gửi duyệt, và lưu phiên bản requirement tại thời điểm liên kết. Chỉ xóa được test *Nháp* hoặc *Bị trả lại* **chưa có lần chạy nào**; test đã có lần chạy chỉ được bỏ khỏi suite hoặc khỏi đợt chưa ghi kết quả.

AC được xác định theo **nội dung từng dòng**: AC không đổi giữa hai phiên bản thì giữ liên kết; AC đổi hoặc bị bỏ thì test liên kết với AC đó được gắn cờ **Cần xem lại**. Tiêu đề hoặc mô tả đổi thì **mọi test** của requirement được gắn cờ Cần xem lại. Đổi ưu tiên hoặc trạng thái Jira không gắn cờ. Test có cờ được xử lý theo một trong hai cách:

| Trường hợp | Xử lý |
|---|---|
| Test vẫn đúng (VD AC chỉ sửa chính tả) | Tester hoặc QA Lead bấm **Đã xem lại**, bắt buộc ghi lý do, gán lại AC nếu cần. Cờ phát sinh do đổi tiêu đề hoặc mô tả được xác nhận hàng loạt: chọn nhiều test, ghi một lý do chung. Hệ thống lưu người xác nhận, phiên bản requirement, lý do, thời điểm; cờ được gỡ và phiên bản requirement đã liên kết của test được nâng lên phiên bản hiện tại. |
| Test cần sửa (VD "≥ 6" → "≥ 8") | Sửa test → về *Nháp* → gửi duyệt → QA Lead duyệt; cờ được gỡ khi bản sửa được duyệt, đồng thời phiên bản requirement đã liên kết được nâng lên phiên bản hiện tại. |

### BM3 – Phiếu duyệt test case

| BM3 | **Phiếu duyệt test case** |
|---|---|
| Mã test case: ............ | Người duyệt: ............ Ngày duyệt: ............ |
| Quyết định: Duyệt / Trả lại | Nguồn bản nháp: Thủ công / AI sinh · Tạo từ đề xuất: ............ |
| Ghi chú: ............ | |

**QĐ4:** Chỉ QA Lead được duyệt. Chỉ duyệt test ở trạng thái *Chờ duyệt*. Trả lại bắt buộc có ghi chú. Bản nháp tạo từ đề xuất AI cũng phải qua bước này.

### BM4 – Kết quả chạy test

| BM4 | **Kết quả chạy test** |
|---|---|
| Mã test case: ............ Phiên bản được chạy: ............ | Người chạy: ............ Ngày chạy: ............ |
| Test Run: ............ (build, môi trường của đợt) | Mã defect: ............ Liên kết bằng chứng: ............ |
| Kết quả: Pass / Fail / Blocked · Ghi chú: ............ | Kiểm thử lại cho lần Fail: ............ (nếu có) |

**QĐ5:** Mọi kết quả được ghi trong **một Test Run đang mở**, theo đúng phiên bản đã cố định trong đợt. Điều kiện chạy được kiểm tra khi đưa test vào đợt (QĐ14); khi ghi kết quả chỉ kiểm tra đợt còn mở, kể cả khi test đã được sửa sau đó. Chỉ **người được giao hoặc QA Lead** được ghi. Fail hoặc Blocked bắt buộc có ghi chú. Mã defect không bắt buộc; nếu là mã issue Jira thì hiện thành liên kết. Bằng chứng là đường dẫn, không tải file lên hệ thống.

### BM5 – Báo cáo kiểm thử

| BM5 | **Báo cáo kiểm thử** |
|---|---|
| Phạm vi: Dự án ............ Test Run ............ (không bắt buộc) | Độ bao phủ requirement = số requirement có ≥ 1 test Đã duyệt / số requirement có AC |
| Tỷ lệ pass = Pass / số test đã chạy | Độ bao phủ AC = số AC có ≥ 1 test Đã duyệt / tổng số AC |
| Tiến độ thực thi = số test đã chạy / số test trong phạm vi | Requirement chưa bao phủ, AC chưa có test, requirement Thiếu AC |
| Kết quả theo module · Xu hướng theo ngày | Số test cần xem lại, cần kiểm thử lại |
| Thống kê AI: số test AI sinh, tỷ lệ phải sửa | Đề xuất AI: chờ xử lý, chấp nhận, từ chối, lỗi thời |

**QĐ6:** Báo cáo được tính ngay khi mở, không lưu sẵn, trong phạm vi dự án hoặc Test Run đang chọn. Kết quả chỉ lấy từ **lần chạy gần nhất** của từng test; khi chọn Test Run thì lấy lần gần nhất trong đợt đó. Số test trong phạm vi là số test Đã duyệt của dự án, hoặc số test trong đợt. Blocked được tính là đã chạy, không tính là Pass. Chỉ tính requirement chưa lưu trữ. Mẫu số độ bao phủ requirement không gồm requirement Thiếu AC, để độ bao phủ có thể đạt 100%. Ở phạm vi dự án, chỉ tính lần chạy của **phiên bản hiện tại** của test Đã duyệt; test được sửa sau lần chạy cuối được coi là chưa chạy, nên tiến độ không vượt 100%. Thống kê AI chỉ tính test nguồn AI; test AI được tính là phải sửa khi đã đổi các bước hoặc kết quả mong đợi. Test tạo mới từ đề xuất Còn thiếu có nguồn AI; bản sửa theo đề xuất Cần sửa giữ nguồn của test gốc.

### BM6 – Danh sách test case

| BM6 | **Tra cứu test case** |
|---|---|
| Điều kiện lọc: từ khóa (mã, tiêu đề), dự án, module, trạng thái, độ ưu tiên, loại, nguồn, cần kiểm thử lại, requirement, Test Suite, Test Run, cần xem lại | Kết quả: Mã · Tiêu đề · Requirement · Loại · Ưu tiên · Nguồn · Trạng thái · Kết quả gần nhất · Phiên bản · Cờ cần xem lại |

**QĐ7:** Từ khóa được tìm gần đúng trong mã và tiêu đề. Nhiều điều kiện lọc kết hợp theo **AND**. Kết quả sắp theo requirement mới nhất, trong mỗi requirement theo mã test. "Kết quả gần nhất" dùng cùng quy tắc với QĐ6: chỉ lấy lần chạy của phiên bản hiện tại; test vừa sửa hiện "Chưa chạy". Danh sách cập nhật ngay khi đổi điều kiện lọc.

### BM7 – Phiếu thay đổi requirement

| BM7 | **Phiếu thay đổi requirement** |
|---|---|
| Mã requirement: ............ Phiên bản trước và sau: ............ | Nguồn: Webhook Jira / Đồng bộ định kỳ / Nút Đồng bộ ngay |
| Nội dung thay đổi: tiêu đề, mô tả, AC, ưu tiên, trạng thái | Thời điểm cập nhật trên Jira: ............ |
| Kết quả: Cập nhật / Cần xem lại test / Cần kiểm tra (lý do) / Đã lưu trữ / Giữ lại (vẫn Cần kiểm tra) | Người xử lý: ............ Ngày xử lý: ............ |
| Test bị ảnh hưởng: ............ | Lần đồng bộ gần nhất: thời điểm, kết quả, lỗi (nếu có) |

**QĐ8:** Hệ thống nhận thay đổi theo 3 cách: **webhook** (đúng mã bí mật `JIRA_WEBHOOK_SECRET` mới nhận), **đồng bộ định kỳ** mỗi `JIRA_SYNC_MINUTES` phút (mặc định 5) và nút **Đồng bộ ngay** (Admin, QA Lead). Hệ thống luôn lấy nội dung qua Jira API, không dùng dữ liệu trong webhook. **Chỉ ghi khi thời điểm cập nhật trên Jira mới hơn bản đã lưu**, nên hai lượt đồng bộ chạy chồng nhau không ghi bản cũ đè bản mới; nội dung không đổi thì không tạo phiên bản. Lỗi khi gọi Jira được thử lại tối đa 2 lần, sau đó chờ lần đồng bộ kế tiếp; trạng thái và lỗi của lần đồng bộ gần nhất được hiển thị. Khi AC, tiêu đề hoặc mô tả đổi, test liên quan được gắn cờ Cần xem lại theo QĐ3.

**Hệ thống không tự lưu trữ requirement.** Requirement không còn trong kết quả đồng bộ được hỏi lại Jira theo từng issue ID rồi gắn cờ **Cần kiểm tra** kèm lý do: "Jira báo không tìm thấy" (bị xóa hoặc ứng dụng mất quyền đọc, Jira trả cùng mã 404) hoặc "Không còn thuộc loại được đồng bộ" (VD Story đổi sang Task). Lỗi kết nối hoặc danh sách rỗng không gắn cờ và không thay đổi dữ liệu. QA Lead hoặc Admin xem lý do rồi chọn **Lưu trữ** hoặc **Giữ lại**. Giữ lại chỉ ghi nhận quyết định chưa lưu trữ, **cờ Cần kiểm tra vẫn giữ**; hệ thống tự gỡ cờ khi một lần đồng bộ sau đó thành công và lấy lại được issue với loại còn được đồng bộ. Requirement lưu trữ thì ẩn khỏi danh sách, giữ test, lịch sử phiên bản và kết quả chạy, không sinh thêm test; xuất hiện lại trên Jira thì tự hiện lại.

### BM8 – Xuất test case

| BM8 | **Xuất test case** |
|---|---|
| Điều kiện lọc: theo bộ lọc đang chọn của BM6 | Định dạng tệp: .xlsx |
| Cột xuất: các cột của BM2 + Kết quả gần nhất + requirement Jira, Test Suite, Test Run, phiên bản, cờ cần xem lại | Tên tệp: `testcases.xlsx` |

**QĐ9:** Xuất đúng danh sách đang hiển thị theo bộ lọc của BM6. Mỗi test một dòng; các bước xuống dòng trong ô; dòng tiêu đề tô màu. Mọi người dùng đã đăng nhập đều được xuất; mỗi lần xuất được ghi nhật ký hoạt động.

### BM9 – Thay đổi quy định hệ thống

| BM9 | **Thay đổi quy định hệ thống** |
|---|---|
| Người cấu hình: ............ Ngày cập nhật: ............ | Tham số AI: số lần gọi AI tối đa/giờ (1–500); thời gian chờ AI (5–120 giây); số lần thử lại khi sai schema (0–5) |
| Tham số nghiệp vụ: số test tối đa/requirement (1–50); số AC tối thiểu để AI sinh test (1–10) | |

**QĐ10:** Admin hoặc QA Lead được thay đổi các tham số trên, trong miền giá trị đã ghi. Độ ưu tiên (High, Medium, Low) và nhãn mục "Acceptance criteria" cố định. Cấu hình Jira chỉ đặt ở `.env`, không có trên giao diện: địa chỉ, email, API token, mã bí mật webhook, chu kỳ đồng bộ và danh sách loại issue `JIRA_ISSUE_TYPES`.

### BM10 – Quản lý người dùng

| BM10 | **Quản lý người dùng** |
|---|---|
| Tên đăng nhập: ............ Họ tên: ............ Email: ............ | Vai trò: Admin / QA Lead / PO-BA / Tester / Developer |
| Mật khẩu: ............ | Trạng thái: Hoạt động / Đã khóa · Thao tác: thêm mới, cập nhật, đổi vai trò, khóa, mở khóa |

**QĐ11:** Chỉ Admin được quản lý người dùng. Tên đăng nhập 3–30 ký tự a-z 0-9 _ ., không trùng. Mật khẩu tối thiểu 8 ký tự, băm bằng bcrypt trước khi lưu. Admin không được tự khóa hoặc tự hạ quyền chính mình. Vai trò áp dụng cho mọi dự án (mục 2.6.2).

### BM11 – Đồng bộ dự án từ Jira

| BM11 | **Đồng bộ dự án từ Jira** |
|---|---|
| Mã dự án trên Jira: ............ | Tên dự án, mô tả: ............ |
| Module (component của Jira): ............ | Thành viên thuộc dự án: ............ |
| Thao tác: Kiểm tra kết nối · Thêm dự án từ Jira · Đồng bộ lại | Lần đồng bộ gần nhất: ............ |

**QĐ12:** Dự án, module và thành viên chỉ được lấy từ Jira qua REST API, không tạo bằng tay. Chỉ Admin được kiểm tra kết nối; Admin và QA Lead được thêm dự án và đồng bộ lại. Mã dự án 2–10 ký tự in hoa hoặc số, bắt đầu bằng chữ cái, chưa có trong hệ thống. Thành viên Jira được gán vào tài khoản có email trùng (Jira ẩn email thì so họ tên; nhiều tài khoản trùng họ tên thì không gán); thành viên chưa có tài khoản được liệt kê để Admin tạo sau. **Danh sách thành viên chỉ dùng để hiển thị và phân công, không cấp hay giới hạn quyền.** Thêm dự án xong hệ thống đồng bộ luôn requirement (YC1).

### BM12 – Test Suite

| BM12 | **Test Suite** |
|---|---|
| Tên suite: ............ Mô tả: ............ | Dự án: ............ |
| Danh sách test case: mã, tiêu đề, trạng thái | Người tạo: ............ Ngày tạo: ............ |

**QĐ13:** QA Lead và Tester được quản lý suite. Tên 3–100 ký tự, không trùng trong dự án. Suite dạng phẳng, không lồng nhau. Một test thuộc được nhiều suite nhưng phải cùng dự án. Xóa suite không xóa test.

### BM13 – Test Run

| BM13 | **Test Run** (đợt kiểm thử) |
|---|---|
| Tên đợt: ............ Dự án: ............ | Người lập: ............ Hạn hoàn thành: ............ |
| Build: ............ Môi trường: ............ (khóa khi đợt đã có kết quả) | Loại đợt: Thường / Kiểm thử lại / Regression |
| Test case: mã, phiên bản được chạy, người được giao, kết quả | Trạng thái: Đang mở / Đã đóng · Tiến độ: ............ |

**QĐ14:** Chỉ QA Lead được lập, phân công và đóng đợt. Người được giao là QA Lead hoặc Tester. **Điều kiện chạy**, dùng chung cho YC14 và YC17: test *Đã duyệt*, không có cờ *Cần xem lại*, requirement không bị lưu trữ hoặc *Cần kiểm tra*. Khi chọn cả suite, test không đủ điều kiện bị bỏ qua và được liệt kê kèm lý do. **Phiên bản test được cố định khi đưa vào đợt**; test sửa sau đó không làm đổi đợt, chỉ hiện cảnh báo có phiên bản mới. Requirement đổi, bị lưu trữ hoặc Cần kiểm tra khi đợt đang mở thì đợt vẫn chạy phiên bản đã cố định và hiện cảnh báo. Một test có thể nằm trong nhiều đợt đang mở; kết quả từng đợt tính riêng. Mỗi đợt ghi build và môi trường đang kiểm thử. **Build và môi trường được sửa khi đợt chưa có kết quả nào; từ lần ghi kết quả đầu tiên thì cố định.** Muốn chạy build hoặc môi trường khác thì lập đợt mới. Được đóng đợt khi còn test chưa chạy, nhưng phải xác nhận; hệ thống liệt kê số test chưa chạy và tính chúng là chưa chạy. Đợt đã đóng không ghi thêm kết quả. QA Lead được tạo đợt kiểm thử lại từ danh sách test cần kiểm thử lại (YC18).

### BM14 – Kết quả phân tích ảnh hưởng

| BM14 | **Kết quả phân tích ảnh hưởng** |
|---|---|
| Requirement: ............ Phiên bản so sánh: ............ → ............ | Người chạy: ............ Thời điểm: ............ |
| Nội dung thay đổi: ............ | Mỗi đề xuất: loại (Cần sửa / Còn thiếu / Nên chạy lại / Cần làm rõ), test liên quan, nội dung đề xuất, lý do, phần thay đổi nguồn (AC / tiêu đề / mô tả) |
| Test liên quan: ............ | |

**QĐ15:** QA Lead và Tester được chạy khi requirement có ít nhất 2 phiên bản. Mặc định so **phiên bản mà các test đã liên kết** (QĐ3) với **phiên bản hiện tại**, để không bỏ sót các lần sửa ở giữa; mốc này được nâng lên khi test được xem lại hoặc sửa xong (QĐ3). Nếu các test liên kết với những phiên bản khác nhau thì lấy **phiên bản cũ nhất** làm mốc so; với từng test, AI chỉ xét các thay đổi xảy ra sau phiên bản mà test đó đã liên kết. Dùng chung giới hạn AI ở QĐ2 và các biện pháp che dữ liệu, chống prompt injection. Mỗi đề xuất bắt buộc có loại, lý do và phần thay đổi nguồn: AC cụ thể, tiêu đề hoặc mô tả. Loại Còn thiếu có thể không có test liên quan. **Phân tích không tự đổi test.** Mỗi lần chạy được ghi nhật ký AI.

### BM15 – Phiếu rà soát đề xuất

| BM15 | **Phiếu rà soát đề xuất AI** |
|---|---|
| Đề xuất: ............ Loại: ............ Lý do: ............ | Trạng thái: Chờ xử lý / Đã chấp nhận / Đã từ chối / Lỗi thời |
| Nội dung trước: ............ Nội dung sau: ............ | Người quyết định: ............ Ngày: ............ Ghi chú: ............ |

**QĐ16:** Tester và QA Lead được xem; chỉ QA Lead được chấp nhận hoặc từ chối. Từ chối bắt buộc có ghi chú. Trước khi áp dụng, hệ thống kiểm tra phiên bản requirement và test; nếu đã đổi so với lúc phân tích thì đề xuất chuyển sang **Lỗi thời** và không áp dụng được. *Cần sửa* đổi nội dung test theo đề xuất, test quay về Nháp như khi sửa thủ công (QĐ3); *Còn thiếu* tạo test nháp mới trong giới hạn QĐ2; *Nên chạy lại* thêm test vào bộ regression của cùng thay đổi (YC17); *Cần làm rõ* chỉ ghi nhận để trao đổi với PO/BA trên Jira. Bản nháp phải qua YC4 và ghi lại mã đề xuất đã tạo ra nó. Mọi quyết định đều được lưu.

### BM16 – Đề xuất bộ regression

| BM16 | **Đề xuất bộ regression** |
|---|---|
| Thay đổi nguồn (requirement, phiên bản): ............ | Người xác nhận: ............ Ngày: ............ |
| Mỗi dòng: test case, mức ưu tiên (Cao / Trung bình / Thấp), lý do, nguồn đề xuất (Liên kết / AI gợi ý) | Test bị bỏ khỏi bộ: mã, lý do |

**QĐ17:** Bộ đề xuất luôn gồm test liên kết với AC đã đổi; nếu tiêu đề hoặc mô tả đổi thì gồm mọi test của requirement; AI chỉ xếp ưu tiên và gợi ý thêm. Chỉ test đủ **điều kiện chạy** của QĐ14 được đưa vào bộ; test chưa đủ điều kiện (chưa duyệt, đang Cần xem lại) được liệt kê riêng kèm lý do, và QA Lead chỉ xác nhận được khi các test này đã được xử lý hoặc bỏ khỏi bộ. QA Lead được thêm, bớt và xác nhận; bỏ test thuộc phần bắt buộc phải ghi lý do. Xác nhận xong hệ thống tạo Test Run loại Regression theo YC14. Nếu không gọi được AI, hệ thống vẫn đưa ra danh sách test liên kết.

### BM17 – Phiếu báo đã sửa lỗi

| BM17 | **Phiếu báo đã sửa lỗi** |
|---|---|
| Mã test case: ............ | Người báo (Developer): ............ Ngày báo: ............ |
| Lần chạy Fail (Test Run, ngày, ghi chú, mã defect): ............ | Ghi chú cho Tester: ............ |
| Bản build đã sửa: ............ | Trạng thái kiểm thử lại: Chờ kiểm thử lại / Đã đóng / Mở lại |

**QĐ18:** Chỉ Developer được báo đã sửa, cho **lần chạy Fail gần nhất của test trong cùng Test Run**; mỗi lần chạy chỉ báo một lần. Bắt buộc nhập build (1–50 ký tự). Sau khi báo, test có trạng thái *Chờ kiểm thử lại*. Tester chạy lại ngay trong đợt chứa lần Fail chỉ khi đợt còn mở và build của đợt trùng build Developer đã báo; ngược lại (đợt đã đóng hoặc khác build) QA Lead lập **đợt Kiểm thử lại** với build đã sửa (QĐ14). **Lần chạy lại lưu liên kết tới lần Fail gốc**, nên dù chạy ở đợt khác vẫn truy được lần Fail đang xử lý; lần Fail ở các đợt khác được theo dõi riêng. Nếu build của đợt khác build Developer đã báo, hệ thống cảnh báo nhưng không chặn ghi. Kết quả chạy lại cập nhật trạng thái như sau:

| Kết quả chạy lại | Ý nghĩa | Trạng thái kiểm thử lại |
|---|---|---|
| Pass | Đạt trong phạm vi các bước đã kiểm tra | Đã đóng |
| Fail | Lỗi vẫn còn | Mở lại; Developer báo sửa lần nữa |
| Blocked | Chưa xác minh được (VD máy chủ hỏng) | Vẫn Chờ kiểm thử lại |

## 2.4. Bảng trách nhiệm yêu cầu nghiệp vụ

| STT | Nghiệp vụ | Người dùng | Phần mềm | Ghi chú |
|---|---|---|---|---|
| 1 | YC1 Xem requirement | Xem danh sách, mở chi tiết, xem các phiên bản; xem danh sách Thiếu AC và Cần kiểm tra | Đồng bộ từ Jira; tách mô tả và AC; lưu phiên bản; hiện liên kết Jira, loại issue, trạng thái đồng bộ | Một chiều Jira → hệ thống |
| 2 | YC2 Sinh test bằng AI | Chọn requirement, bấm Sinh test case, kiểm tra kết quả | Kiểm tra QĐ2; che dữ liệu nhạy cảm; gọi AI; kiểm tra schema; lưu bản nháp có liên kết AC; ghi nhật ký AI | Kết quả luôn cần người xem lại |
| 3 | YC3 Soạn thảo, xem lại | Thêm, sửa, xóa test; gán AC; gửi duyệt; xem lại test có cờ: bấm Đã xem lại kèm lý do hoặc sửa test | Kiểm tra QĐ3; lưu phiên bản và phiên bản nguồn; đổi trạng thái; ghi nhật ký xem lại | |
| 4 | YC4 Duyệt | Xem hàng đợi, duyệt hoặc trả lại kèm ghi chú | Kiểm tra QĐ4; đổi trạng thái; lưu phiếu duyệt; gỡ cờ Cần xem lại khi bản sửa được duyệt | |
| 5 | YC5 Ghi kết quả | Mở Test Run, chọn test được giao, nhập kết quả, ghi chú, mã defect, liên kết bằng chứng | Kiểm tra QĐ5; lưu kết quả với phiên bản test; cập nhật tiến độ đợt và yêu cầu kiểm thử lại | |
| 6 | YC6 Báo cáo | Chọn dự án hoặc Test Run | Tính theo QĐ6 khi mở; hiện bảng số liệu và biểu đồ | |
| 7 | YC7 Tra cứu | Nhập điều kiện lọc theo BM6 | Tìm theo QĐ7; hiện kết quả | |
| 8 | YC8 Nhận thay đổi | PO/BA sửa hoặc xóa issue trên Jira; Admin, QA Lead bấm Đồng bộ ngay, xử lý requirement Cần kiểm tra: Lưu trữ hoặc Giữ lại | Nhận sự kiện; lấy nội dung qua API; chỉ ghi bản mới hơn; so sánh; tạo phiên bản; gắn cờ test khi AC, tiêu đề hoặc mô tả đổi; gắn, gỡ cờ Cần kiểm tra; hiện trạng thái lần đồng bộ gần nhất | Không bỏ sót thay đổi yêu cầu |
| 9 | YC9 Xuất Excel | Bấm Xuất Excel ở màn hình tra cứu | Tạo file theo QĐ9; ghi nhật ký | |
| 10 | YC10 Thay đổi quy định | Nhập giá trị mới theo BM9 | Kiểm tra miền giá trị; lưu; áp dụng ngay | |
| 11 | YC11 Quản lý người dùng | Thêm, sửa, đổi vai trò, khóa, mở khóa tài khoản | Kiểm tra QĐ11; băm mật khẩu; ghi nhật ký | |
| 12 | YC12 Đồng bộ dự án | Kiểm tra kết nối; nhập mã dự án; bấm Thêm hoặc Đồng bộ lại | Gọi Jira API; kiểm tra QĐ12; lưu dự án, module, thành viên; đồng bộ requirement | |
| 13 | YC13 Test Suite | Tạo, sửa, xóa suite; thêm, bớt test | Kiểm tra QĐ13; lưu; ghi nhật ký | |
| 14 | YC14 Test Run | Chọn suite hoặc test, phân công, đặt hạn, nhập build và môi trường; mở, đóng đợt; tạo đợt kiểm thử lại | Kiểm tra QĐ14; liệt kê test bị chặn kèm lý do; lưu phiên bản được chạy; tính tiến độ; cảnh báo khi đóng đợt còn test chưa chạy | |
| 15 | YC15 Phân tích ảnh hưởng | Mở requirement đã đổi, bấm Phân tích, xem đề xuất | Kiểm tra QĐ15; so hai phiên bản; che dữ liệu; gọi AI; kiểm tra schema; lưu đề xuất; ghi nhật ký AI | Điểm mới của đề tài |
| 16 | YC16 Rà soát đề xuất | Xem nội dung trước và sau; chấp nhận hoặc từ chối kèm ghi chú | Kiểm tra QĐ16; tạo bản nháp hoặc test mới; lưu quyết định | |
| 17 | YC17 Bộ regression | Xem đề xuất, thêm, bớt test (bớt phải ghi lý do), xác nhận | Lấy test liên kết; AI xếp ưu tiên kèm lý do; kiểm tra điều kiện chạy; tạo Test Run khi xác nhận | |
| 18 | YC18 Báo sửa lỗi | Developer chọn lần chạy Fail, nhập build; Tester lọc test cần kiểm thử lại rồi chạy lại | Kiểm tra QĐ18; lưu phiếu; gắn lần chạy lại với lần Fail gốc; cập nhật trạng thái kiểm thử lại theo kết quả | Khép kín vòng báo lỗi – sửa – kiểm thử lại |

## 2.5. Yêu cầu chất lượng

### 2.5.1. Tính tiến hóa

| STT | Nghiệp vụ | Tham số cần thay đổi | Miền giá trị cần thay đổi |
|---|---|---|---|
| 1 | Đồng bộ requirement | Số AC tối thiểu để AI sinh test; loại issue được đồng bộ (`JIRA_ISSUE_TYPES`) | Chu kỳ đồng bộ; địa chỉ, tài khoản Jira (cấu hình `.env`); chưa cấu hình thì dùng Jira giả lập |
| 2 | Sinh test, phân tích ảnh hưởng, regression bằng AI | Số test tối đa/requirement, số lần thử lại, thời gian chờ, số lần gọi/giờ | **Nhà cung cấp LLM** (mock, Gemini, Claude, OpenAI) – đổi qua cấu hình, không sửa mã nguồn |
| 3 | Phần mở rộng | Bật, tắt YC19, YC20 bằng `SCRIPT_ENABLED`, `SPRINT_ENABLED` | Framework chạy script (thiết kế mở cho WebdriverIO, Cypress) |

### 2.5.2. Tính tiện dụng

| STT | Nghiệp vụ | Mức độ dễ học | Mức độ dễ sử dụng |
|---|---|---|---|
| 1 | Sinh test, phân tích ảnh hưởng | 5 phút làm quen | 1 nút bấm; hiển thị số test, thời gian, dữ liệu đã che, mốc phiên bản so sánh |
| 2 | Xem lại test khi requirement đổi | Không cần hướng dẫn | So phiên bản trước/sau tô màu AC đổi; Đã xem lại hàng loạt với một lý do chung |
| 3 | Duyệt, Test Run | Không cần hướng dẫn | Hàng đợi duyệt, duyệt hàng loạt; danh sách test bị chặn kèm lý do khi lập đợt |
| 4 | Toàn hệ thống | Giao diện tiếng Việt | Thông báo lỗi bằng tiếng Việt, nêu rõ quy định bị vi phạm; menu chỉ hiện chức năng đúng quyền |

### 2.5.3. Tính hiệu quả

| STT | Nghiệp vụ | Tốc độ xử lý | Dung lượng lưu trữ |
|---|---|---|---|
| 1 | Đăng nhập, tra cứu, lưu dữ liệu | < 1 giây với dữ liệu demo | |
| 2 | Sinh test, phân tích ảnh hưởng | ≤ 30 giây mỗi lần gọi AI (tham số), có hiển thị trạng thái chờ | Lưu prompt đã che và kết quả gốc |
| 3 | Lập báo cáo | Tính ngay khi mở, không lưu sẵn | |
| 4 | Đồng bộ Jira | Webhook gần như tức thời; định kỳ 5 phút | Mỗi phiên bản requirement một dòng |

### 2.5.4. Tính tương thích

| STT | Nghiệp vụ | Đối tượng liên quan |
|---|---|---|
| 1 | Đồng bộ requirement | Jira Cloud REST API v3, webhook Jira |
| 2 | Xuất test case | Microsoft Excel, Google Sheets (.xlsx) |
| 3 | Trình duyệt | Chrome, Edge, Firefox, Safari bản mới |
| 4 | LLM | Gemini API, Claude API, OpenAI API (cùng interface `LLMProvider`) |

## 2.6. Yêu cầu hệ thống

### 2.6.1. Tính an toàn

| STT | Nghiệp vụ | Đối tượng |
|---|---|---|
| 1 | Phục hồi | Mọi phiên bản requirement và test case được giữ lại; CSDL nằm trên volume Docker, sao lưu bằng cách sao chép file `app.db` |
| 2 | Không hủy thật sự | Hệ thống không tự lưu trữ requirement; requirement biến mất chỉ gắn cờ Cần kiểm tra; lưu trữ vẫn giữ test, lịch sử và kết quả chạy |
| 3 | Không cho phép xóa | Test case Chờ duyệt, Đã duyệt hoặc đã có lần chạy; test đã có kết quả trong đợt; tài khoản đang đăng nhập không tự khóa |

### 2.6.2. Tính bảo mật

Giữ 5 vai trò toàn cục, không thêm vai trò. Mọi tài khoản xem được dữ liệu tất cả dự án và thao tác theo vai trò chung; ghi kết quả theo người được giao hoặc QA Lead (QĐ5). Danh sách thành viên từ Jira chỉ dùng để hiển thị và phân công.

| STT | Chức năng | Quyền | Admin | QA Lead | PO/BA | Tester | Developer |
|---|---|---|---|---|---|---|---|
| 1 | Quản lý người dùng | `user:manage` | ✔ | | | | |
| 2 | Kiểm tra kết nối Jira | `jira:connect` | ✔ | | | | |
| 3 | Thêm dự án, đồng bộ từ Jira; xử lý requirement Cần kiểm tra | `jira:import` | ✔ | ✔ | | | |
| 4 | Thay đổi quy định | `param:update` | ✔ | ✔ | | | |
| 5 | Xem nhật ký hoạt động | `audit:view` | ✔ | ✔ | | | |
| 6 | Soạn thảo test case; quản lý Test Suite; Đã xem lại | `testcase:write` | | ✔ | | ✔ | |
| 7 | Duyệt test case | `testcase:review` | | ✔ | | | |
| 8 | Lập Test Run, phân công, đóng đợt | `testrun:manage` | | ✔ | | | |
| 9 | Ghi kết quả chạy test | `run:write` | | ✔ | | ✔ | |
| 10 | Sinh test bằng AI, phân tích ảnh hưởng, xem đề xuất | `ai:use` | | ✔ | | ✔ | |
| 11 | Chấp nhận, từ chối đề xuất; xác nhận regression | `proposal:review` | | ✔ | | | |
| 12 | Xem nhật ký AI | `ailog:view` | ✔ | ✔ | | ✔ | |
| 13 | Báo đã sửa lỗi | `bug:fix` | | | | | ✔ |
| 14 | Xem requirement, báo cáo; tra cứu, xuất Excel | đã đăng nhập | ✔ | ✔ | ✔ | ✔ | ✔ |

Không vai trò nào được tạo, sửa, xóa requirement trong hệ thống: việc đó làm trên Jira.

**Yêu cầu bảo mật kỹ thuật:**

| Mã | Yêu cầu |
|---|---|
| SE-01 | Mật khẩu băm bằng bcrypt (cost 10), không bao giờ trả về qua API |
| SE-02 | Xác thực bằng JWT có hạn 8 giờ; kiểm tra tài khoản còn hoạt động ở mỗi request |
| SE-03 | Phân quyền theo vai trò (RBAC) kiểm tra ở **backend**, giao diện chỉ ẩn nút |
| SE-04 | Giới hạn đăng nhập **sai**: 10 lần/15 phút/IP (lần đăng nhập đúng không bị đếm) |
| SE-05 | Mọi truy vấn CSDL dùng prepared statement (chống SQL injection) |
| SE-06 | Kiểm tra dữ liệu đầu vào bằng schema (Zod); giới hạn kích thước request 1 MB |
| SE-07 | Chống XSS: escape mọi dữ liệu khi hiển thị + Content-Security-Policy `script-src 'self'` |
| SE-08 | API key LLM và API token Jira chỉ lưu ở biến môi trường backend, không commit (.gitignore), không gửi xuống trình duyệt |
| SE-09 | **Che dữ liệu nhạy cảm** (email, số điện thoại, CCCD, số thẻ) trước khi gửi LLM, ở cả ba tác vụ AI |
| SE-10 | **Chống prompt injection:** tách prompt hệ thống và dữ liệu, bọc dữ liệu trong thẻ, phát hiện và gắn cờ, kết quả bắt buộc qua schema |
| SE-11 | Giới hạn số lần gọi AI mỗi người/giờ (chống lạm dụng chi phí) |
| SE-12 | Nhật ký hoạt động (audit log) cho mọi thao tác ghi: ai, làm gì, đối tượng nào, lúc nào, IP |
| SE-13 | Ghi rõ chính sách dữ liệu của nhà cung cấp LLM (dùng gói API không dùng dữ liệu để huấn luyện) |
| SE-14 | Webhook Jira không dùng JWT nên bắt buộc có mã bí mật `JIRA_WEBHOOK_SECRET`, so sánh an toàn theo thời gian; thiếu mã thì tắt webhook. Nội dung luôn lấy lại qua Jira API, không tin dữ liệu trong webhook |

## 2.7. Yêu cầu khác – yêu cầu công nghệ

| STT | Yêu cầu | Mô tả chi tiết |
|---|---|---|
| 1 | Dễ sửa lỗi | Kiến trúc nhiều lớp; mỗi YC nằm trong một service riêng |
| 2 | Dễ bảo trì | Thêm LLM mới chỉ cần thêm 1 lớp kế thừa `LLMProvider`; tài liệu API theo chuẩn OpenAPI (`docs/api/openapi.yaml`) |
| 3 | Tái sử dụng | AI Service dùng chung cho 3 tác vụ (sinh test, phân tích ảnh hưởng, xếp ưu tiên regression) |
| 4 | Dễ mang chuyển | Chạy bằng Docker; CSDL viết theo SQL chuẩn, chuyển SQLite → PostgreSQL |
| 5 | Kiểm thử tự động | Unit + API + E2E, chạy tự động trên GitHub Actions |

## 2.8. Yêu cầu ngoài MVP (phụ lục)

| Mã | Tên | BM, QĐ | Ghi chú |
|---|---|---|---|
| YC19 | Sinh và chạy script kiểm thử tự động (Playwright) | BM18, QĐ19 | Code đã có; ẩn bằng cờ `SCRIPT_ENABLED` (mặc định tắt). Khi bật, kết quả chạy tự động được ghi vào một test trong Test Run như YC5 |
| YC20 | Theo dõi sprint (Agile/Scrum) | BM19, QĐ20 | Code đã có; ẩn bằng cờ `SPRINT_ENABLED` (mặc định tắt): menu, ô chọn và dữ liệu sprint |

**Hướng phát triển** (chi tiết ở Chương 9): hàng đợi sự kiện Jira bền vững; phân quyền theo thành viên dự án; bộ regression gộp nhiều requirement trong một bản phát hành; đọc trạng thái Bug từ Jira để tự gợi ý kiểm thử lại; bật lại YC19, YC20.

**Đã loại, không đưa lại:** nhập user story từ CSV/JSON, tạo và sửa requirement trong ứng dụng, mã US-XXX, vai trò Designer và Guest.
