# Chương 8. Kịch bản demo khi bảo vệ (8–10 phút)

## 8.1. Chuẩn bị trước buổi bảo vệ (checklist)

- [ ] `cd app && npm run reset` để có dữ liệu mẫu sạch.
- [ ] Bấm đúp `ChayDemo.command` (hoặc `npm start`), kiểm tra `http://localhost:3000` mở được.
- [ ] Thanh bên hiển thị *Playwright worker: 🟢 sẵn sàng*.
- [ ] Có mạng để chạy test trên saucedemo.com (nếu không có mạng: bỏ bước 8, mở video dự phòng).
- [ ] Nếu muốn demo AI thật: điền `GEMINI_API_KEY` và `AI_PROVIDER=gemini`, thử sinh 1 lần trước. **Luôn giữ phương án `mock`** phòng khi mạng/API lỗi.
- [ ] Mở sẵn 2 cửa sổ trình duyệt: cửa sổ thường đăng nhập **tester**, cửa sổ ẩn danh đăng nhập **qalead**.
- [ ] Mở sẵn terminal để chạy `npm test` và `npm run test:e2e`.
- [ ] Quay sẵn video toàn bộ kịch bản (QuickTime → File → New Screen Recording).
- [ ] Phóng to trình duyệt (Cmd +) để hội đồng nhìn rõ.

## 8.2. Kịch bản

| # | Thời gian | Thao tác | Lời dẫn gợi ý | Điểm nhấn |
|---|---|---|---|---|
| 1 | 0:00 | Mở slide, trình bày vấn đề | "Viết test case thủ công mất 30–60 phút/story, dễ sót case lỗi, duyệt qua chat không lưu vết." | Khảo sát hiện trạng |
| 2 | 1:00 | Đăng nhập **tester** → *Tổng quan* | "Hệ thống quản lý cả vòng đời test case, báo cáo tự động." | 4 chỉ số, biểu đồ |
| 2b | 1:15 | Chọn dự án **PETINS** → *Sprint (Agile)*: Sprint Goal, bảng 4 cột, burndown, velocity | "Nhóm em làm đồ án theo Scrum, và hệ thống cũng hỗ trợ đội QA làm Scrum: story chỉ tính Hoàn thành khi mọi test case đã duyệt đều Pass." | **Agile** |
| 3 | 1:30 | *User story* → *Lập user story* trực tiếp, ví dụ "Hủy hợp đồng bảo hiểm" với 3 acceptance criteria | "Đây là BM1, có QĐ1: mã không trùng, ít nhất 1 tiêu chí." | Biểu mẫu, quy định |
| 4 | 2:30 | Bấm **✨ Sinh test case bằng AI** | "AI Service tách riêng: che dữ liệu nhạy cảm, ghép prompt, gọi LLM, kiểm tra JSON schema, thử lại nếu sai." | Có case Positive, Negative, Edge |
| 5 | 3:30 | Mở **US-PET-004** (có email, SĐT) → sinh → bấm *Xem nhật ký AI* | "Prompt gửi đi đã được che thành [EMAIL], [PHONE]." | **Bảo mật AI** |
| 6 | 4:15 | Sửa 1 test case (đổi tiêu đề), xóa 1 case thừa → tab *Lịch sử* → chọn tất cả → *Gửi duyệt* | "Con người luôn kiểm soát; mỗi lần sửa là một phiên bản, so sánh được bản AI gốc với bản người sửa." | Human-in-the-loop |
| 7 | 5:00 | Chuyển cửa sổ **qalead** → *Duyệt test case* → trả lại 1 case **không ghi chú** (bị chặn) → có ghi chú → duyệt phần còn lại | "QĐ4: chỉ QA Lead được duyệt, trả lại bắt buộc ghi chú. Tester không có nút này, gọi thẳng API cũng bị 403." | Phân quyền |
| 8 | 6:00 | Mở **US-SAU-001-TC01** (Sauce Demo) → tab *Script Playwright* → *Sinh script* → *▶️ Chạy tự động* | "Test case đã duyệt được AI chuyển thành script Playwright, chạy trong tiến trình cô lập có giới hạn thời gian." | **Ấn tượng nhất** – Pass sau ~3 giây |
| 9 | 7:00 | Sửa script cho sai (`toHaveText('2')`) → chạy | "Khi Fail, hệ thống lưu log và ảnh chụp màn hình cho Developer." | Ảnh chụp lỗi |
| 10 | 7:30 | *Thay đổi quy định* → `MAX_TC_PER_STORY` = 5 → quay lại story mới → sinh lại | "Quy định nằm trong bảng tham số, đổi không cần sửa mã nguồn – tính tiến hóa." | AI tuân thủ quy định mới |
| 11 | 8:15 | Đăng nhập **qalead** → *Sprint (Agile)* → đưa **US-PET-005** từ Product backlog vào Sprint 2; mở *Tổng quan* → bảng tiến độ theo sprint | "Đây là bước Sprint Planning. Báo cáo lọc được theo sprint, tính theo lần chạy gần nhất." | YC6, YC12 |
| 12 | 8:45 | Terminal: `npm test` (55 pass) và `npm run test:e2e` (Playwright mở Chrome, 9 pass) | "Kiểm thử tự động 3 tầng, chạy trên GitHub Actions mỗi lần push." | Chất lượng |
| 13 | 9:30 | Slide kết luận, hướng phát triển | | |

**Dự phòng:** mạng hoặc API lỗi → chuyển `AI_PROVIDER=mock` (khởi động lại 3 giây) hoặc mở video đã quay.

## 8.3. Câu hỏi hội đồng có thể hỏi

| Câu hỏi | Gợi ý trả lời |
|---|---|
| Môn dạy thác nước, sao nhóm làm Agile? | Nhóm thực hiện theo Scrum (5 sprint, mỗi sprint 1 tuần) vì yêu cầu AI khó chốt từ đầu và cần demo sớm. Các hoạt động của thác nước không mất đi mà lặp lại trong mỗi sprint; báo cáo vẫn trình bày đủ 7 chương. Minh chứng: Product Backlog, biên bản Planning/Review/Retro, lịch sử commit theo sprint, CI. |
| Nhóm 4 người chia vai trò Scrum thế nào? | 1 Product Owner, 1 Scrum Master (hai người khác nhau), cả 4 người là Developer, mỗi người phụ trách một mảng (yêu cầu – phân tích; backend – AI; giao diện; kiểm thử – CI – Docker). Daily Scrum 15 phút mỗi tối; Planning thứ Hai, Review và Retro thứ Bảy; giảng viên và bạn cùng lớp là stakeholder. |
| Definition of Done của đồ án là gì? | Code merge qua PR, có test tự động mới, CI xanh, đủ acceptance criteria, tài liệu cập nhật, demo được. |
| Velocity, burndown dùng để làm gì? | Velocity là số story point hoàn thành mỗi sprint, dùng để cam kết sprint sau cho thực tế. Burndown cho biết sprint có kịp không ngay trong sprint. |
| AI sinh sai thì sao? | AI chỉ tạo **bản nháp**. Bắt buộc Tester xem lại và QA Lead duyệt; kết quả sai định dạng bị schema chặn và tự thử lại; mọi lần gọi đều có nhật ký để truy vết. |
| Đề tài có phải "chỉ gọi API" không? | AI chỉ là YC2 và YC9 trong 11 yêu cầu. Trọng tâm là quy trình quản lý test case có phân quyền, duyệt, phiên bản, báo cáo, quy định thay đổi được. Phần AI cũng được thiết kế bài bản: Strategy pattern, che PII, chống prompt injection, schema, retry, rate limit, sandbox. |
| Vì sao tách AI Service? | Để đổi model (Gemini/Claude/OpenAI/local) chỉ sửa một chỗ; để test bằng provider giả; để quản lý bảo mật và chi phí tập trung. |
| Tính tiến hóa thể hiện ở đâu? | Bảng `parameters` (QĐ2, QĐ1, hạn mức AI, timeout), đổi qua màn hình *Thay đổi quy định*; đổi nhà cung cấp LLM qua cấu hình. |
| Prompt injection là gì, chống thế nào? | Người dùng chèn câu lệnh vào dữ liệu để AI làm sai. Hệ thống tách prompt hệ thống và dữ liệu, bọc dữ liệu trong `<user_story>`, xóa thẻ giả, gắn cờ khi phát hiện, và quan trọng nhất là kết quả bắt buộc đúng schema nên AI không thể "trả lời lung tung". |
| Chạy mã do AI sinh có nguy hiểm không? | Có, nên có 4 lớp: kiểm tra tĩnh chặn `fs/child_process/process.env/eval`; chạy tiến trình riêng với biến môi trường tối thiểu (không có API key); timeout; trong Docker giới hạn CPU/RAM, user không phải root. |
| Vì sao chọn Playwright? | Tự chờ phần tử (ít test chập chờn), locator theo vai trò, trace và ảnh chụp khi lỗi, chạy song song, một API cho Chrome/Firefox/WebKit, dùng được cho cả E2E hệ thống và script AI sinh. |
| Vì sao SQLite mà không PostgreSQL? | Để demo không phụ thuộc cài đặt. Lược đồ viết SQL chuẩn, có ghi chú chuyển đổi; chỉ cần đổi lớp kết nối. |
| Nhóm phối hợp thế nào để không xung đột code? | Mỗi story một nhánh `feature/pb-xx-*`, Pull Request nhỏ, ít nhất 1 thành viên khác review; CI chạy test mỗi lần push; bảng Jira/Trello cho biết ai đang làm gì. |
| Tỷ lệ AI phải sửa dùng để làm gì? | Đo chất lượng AI; cặp "bản AI – bản người sửa" là dữ liệu để chọn model, cải tiến prompt ở các phiên bản sau. |
