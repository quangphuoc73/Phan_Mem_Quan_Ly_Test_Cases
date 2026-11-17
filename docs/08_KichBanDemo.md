# Chương 8. Kịch bản demo khi bảo vệ (10 phút)

## 8.1. Chuẩn bị trước buổi bảo vệ (checklist)

- [ ] `cd app && npm run reset` để có dữ liệu mẫu sạch.
- [ ] Bấm đúp `ChayDemo.command` (hoặc `npm start`), kiểm tra `http://localhost:3000` mở được.
- [ ] Để trống `JIRA_BASE_URL` (Jira giả lập) hoặc cấu hình Jira thật và kiểm tra kết nối. Với Jira giả lập: đăng nhập **admin** → *Dự án & module* → *Thêm dự án từ Jira* mã `HRM`.
- [ ] Sinh sẵn test cho 1 requirement của HRM, gửi duyệt, duyệt, lập 1 Test Run và ghi kết quả để có dữ liệu cho bước thay đổi requirement.
- [ ] Nếu muốn demo AI thật: điền `GEMINI_API_KEY` và `AI_PROVIDER=gemini`, thử 1 lần trước. **Luôn giữ phương án `mock`** phòng khi mạng/API lỗi.
- [ ] Mở sẵn 3 cửa sổ trình duyệt (hồ sơ riêng): **tester**, **qalead**, **dev**.
- [ ] Mở sẵn terminal để chạy `npm test` và `npm run test:e2e`.
- [ ] Quay sẵn video toàn bộ kịch bản (QuickTime → File → New Screen Recording).
- [ ] Phóng to trình duyệt (Cmd +) để hội đồng nhìn rõ.

## 8.2. Kịch bản

Trọng tâm: **khi requirement đổi trên Jira, hệ thống cho QA biết test nào cần sửa, test nào cần chạy lại**.

| # | Thời gian | Thao tác | Lời dẫn gợi ý | Điểm nhấn |
|---|---|---|---|---|
| 1 | 0:00 | Slide: vấn đề | "Requirement trên Jira đổi liên tục; QA không biết test nào đã lỗi thời, phải dò tay, dễ sót." | Khảo sát hiện trạng |
| 2 | 0:45 | **tester** → *Tổng quan*: chọn phạm vi dự án rồi một Test Run | "Báo cáo tính ngay khi mở: tỷ lệ pass, tiến độ, độ bao phủ theo requirement và theo AC." | YC6 |
| 3 | 1:15 | *Requirement (Jira)*: các tab Bình thường, Thiếu AC, Cần kiểm tra | "Requirement chỉ đọc, đồng bộ một chiều, nhận diện bằng issue ID; thiếu AC thì AI không sinh." | YC1, QĐ1 |
| 4 | 1:45 | Mở 1 requirement chưa có test → **✨ Sinh test case bằng AI** → mở *Nhật ký AI* | "AI sinh bản nháp, mỗi test gắn AC; prompt đã che [EMAIL], [PHONE]." | YC2, bảo mật AI |
| 5 | 2:30 | Sửa 1 test, gán AC, *Gửi duyệt*; **qalead** trả lại không ghi chú (bị chặn) → có ghi chú → duyệt phần còn lại | "Con người luôn kiểm soát; chỉ QA Lead duyệt." | YC3, YC4 |
| 6 | 3:15 | **qalead** → *Test Run* → *＋ Lập Test Run* từ suite, build `1.0.0`; có test bị bỏ qua kèm lý do | "Chỉ test đủ điều kiện mới vào đợt; phiên bản test được cố định; build khóa khi đã có kết quả." | YC13, YC14 |
| 7 | 4:00 | **tester** ghi Fail (bắt buộc ghi chú); **dev** → *Sửa lỗi & kiểm thử lại* → *🔧 Báo đã sửa* build `1.0.1`; **qalead** lập đợt Kiểm thử lại; **tester** chạy lại Pass | "Lần chạy lại trỏ về đúng lần Fail gốc dù ở đợt khác." | YC5, YC18 |
| 8 | 5:15 | Chi tiết requirement → **✎ Mô phỏng sửa trên Jira** (hoặc sửa thật trên Jira) đổi 1 AC "≥ 6 ký tự" → "≥ 8 ký tự"; *⟳ Đồng bộ ngay* | "Phiên bản mới; so sánh tô màu AC đổi; chỉ test liên kết AC đó bị gắn cờ Cần xem lại." | **YC8 – điểm mới** |
| 9 | 6:15 | **🔍 Phân tích ảnh hưởng (AI)** → *Đề xuất AI*: Cần sửa, Còn thiếu, Nên chạy lại, Cần làm rõ, mỗi đề xuất có lý do | "AI so phiên bản test đã liên kết với phiên bản hiện tại; AI không tự đổi test." | **YC15** |
| 10 | 7:00 | **qalead** *✓ Chấp nhận* đề xuất Cần sửa → test về Nháp, duyệt lại; 1 test khác vẫn đúng → **tester** *✔ Đã xem lại* kèm lý do | "Hai cách xử lý cờ; bản nháp từ AI vẫn phải duyệt." | YC16, QĐ3 |
| 11 | 7:45 | **🧭 Tạo bộ regression** → xem phần bắt buộc, ưu tiên AI → *✓ Xác nhận và tạo Test Run* | "Bộ regression luôn gồm test liên kết AC đã đổi; AI chỉ xếp ưu tiên và gợi ý thêm." | **YC17** |
| 12 | 8:30 | *Thay đổi quy định* → `MAX_TC_PER_STORY` = 2 → sinh lại | "Quy định nằm trong bảng tham số – tính tiến hóa." | YC10 |
| 13 | 9:00 | Terminal: `npm test` (129 pass) và `npm run test:e2e` (11 pass) | "Kiểm thử tự động nhiều tầng, chạy trên GitHub Actions." | Chất lượng |
| 14 | 9:30 | Slide kết luận, hướng phát triển | | |

**Dự phòng:** mạng hoặc API lỗi → `AI_PROVIDER=mock`, để trống `JIRA_BASE_URL` (Jira giả lập, dự án `HRM`), khởi động lại; hoặc mở video đã quay.

## 8.3. Câu hỏi hội đồng có thể hỏi

| Câu hỏi | Gợi ý trả lời |
|---|---|
| Môn dạy thác nước, sao nhóm làm Agile? | Nhóm thực hiện theo Scrum (5 sprint, mỗi sprint 1 tuần) vì yêu cầu AI khó chốt từ đầu và cần demo sớm. Các hoạt động của thác nước không mất đi mà lặp lại trong mỗi sprint; báo cáo vẫn trình bày đủ 7 chương. Minh chứng: Product Backlog, biên bản Planning/Review/Retro, lịch sử commit theo sprint, CI. |
| Nhóm 4 người chia vai trò Scrum thế nào? | 1 Product Owner, 1 Scrum Master (hai người khác nhau), cả 4 người là Developer, mỗi người phụ trách một mảng (yêu cầu – phân tích; backend – AI; giao diện; kiểm thử – CI – Docker). Daily Scrum 15 phút mỗi tối; Planning thứ Hai, Review và Retro thứ Bảy; giảng viên và bạn cùng lớp là stakeholder. |
| Definition of Done của đồ án là gì? | Code merge qua PR, có test tự động mới, CI xanh, đủ acceptance criteria, tài liệu cập nhật, demo được. |
| Velocity, burndown dùng để làm gì? | Velocity là số story point hoàn thành mỗi sprint, dùng để cam kết sprint sau cho thực tế. Burndown cho biết sprint có kịp không ngay trong sprint. |
| AI sinh sai thì sao? | AI chỉ tạo **bản nháp** và **đề xuất**; AI không tự đổi test. Bắt buộc Tester xem lại và QA Lead duyệt; kết quả sai định dạng bị schema chặn và tự thử lại; mọi lần gọi đều có nhật ký để truy vết. |
| Đề tài có phải "chỉ gọi API" không? | AI chỉ có ở YC2, YC15, YC17 trong 18 yêu cầu. Trọng tâm là quy trình quản lý kiểm thử có phân quyền, duyệt, phiên bản requirement và test, Test Run cố định phiên bản, báo cáo, quy định thay đổi được. Phần AI cũng được thiết kế bài bản: Strategy pattern, che PII, chống prompt injection, schema, retry, rate limit, sandbox. |
| Vì sao tách AI Service? | Để đổi model (Gemini/Claude/OpenAI/local) chỉ sửa một chỗ; để test bằng provider giả; để quản lý bảo mật và chi phí tập trung. |
| Tính tiến hóa thể hiện ở đâu? | Bảng `parameters` (QĐ2, QĐ1, hạn mức AI, timeout), đổi qua màn hình *Thay đổi quy định*; đổi nhà cung cấp LLM, loại issue đồng bộ, bật phần mở rộng qua cấu hình. |
| Làm sao biết test nào bị ảnh hưởng khi requirement đổi? | Mỗi lần đổi tạo một phiên bản; AC được so theo nội dung dòng. Test liên kết AC bị đổi/bỏ được gắn cờ; đổi tiêu đề/mô tả thì gắn cờ mọi test. AI phân tích ảnh hưởng so phiên bản mà test đã liên kết với phiên bản hiện tại. |
| Hai lượt đồng bộ chạy chồng nhau thì sao? | Chỉ ghi khi thời điểm cập nhật trên Jira mới hơn bản đã lưu, nên bản cũ đến sau không ghi đè. |
| Issue bị xóa trên Jira thì test có mất không? | Không. Hệ thống không tự lưu trữ: hỏi lại Jira theo issue ID rồi gắn cờ Cần kiểm tra; QA Lead chọn Lưu trữ (giữ test, lịch sử, kết quả) hoặc Giữ lại. |
| Vì sao Test Run phải cố định phiên bản test và khóa build? | Để kết quả luôn gắn với đúng nội dung đã chạy và đúng bản build; sửa test hay đổi build không làm sai lịch sử. Muốn chạy build khác thì lập đợt mới. |
| Prompt injection là gì, chống thế nào? | Người dùng chèn câu lệnh vào dữ liệu để AI làm sai. Hệ thống tách prompt hệ thống và dữ liệu, bọc dữ liệu trong `<user_story>`, xóa thẻ giả, gắn cờ khi phát hiện, và quan trọng nhất là kết quả bắt buộc đúng schema nên AI không thể "trả lời lung tung". |
| Chạy mã do AI sinh có nguy hiểm không? | Đây là phần mở rộng YC19 (tắt mặc định). Nếu bật thì có 4 lớp: kiểm tra tĩnh chặn `fs/child_process/process.env/eval`; chạy tiến trình riêng với biến môi trường tối thiểu (không có API key); timeout; trong Docker giới hạn CPU/RAM, user không phải root. |
| Vì sao chọn Playwright? | Tự chờ phần tử (ít test chập chờn), locator theo vai trò, trace và ảnh chụp khi lỗi, chạy song song, một API cho Chrome/Firefox/WebKit, dùng cho E2E hệ thống (và cho script AI sinh ở phần mở rộng). |
| Vì sao SQLite mà không PostgreSQL? | Để demo không phụ thuộc cài đặt. Lược đồ viết SQL chuẩn, có ghi chú chuyển đổi; chỉ cần đổi lớp kết nối. |
| Nhóm phối hợp thế nào để không xung đột code? | Mỗi mục backlog một nhánh `feature/pb-xx-*`, Pull Request nhỏ, ít nhất 1 thành viên khác review; CI chạy test mỗi lần push; bảng Jira/Trello cho biết ai đang làm gì. |
| Tỷ lệ AI phải sửa dùng để làm gì? | Đo chất lượng AI; cặp "bản AI – bản người sửa" là dữ liệu để chọn model, cải tiến prompt ở các phiên bản sau. |
