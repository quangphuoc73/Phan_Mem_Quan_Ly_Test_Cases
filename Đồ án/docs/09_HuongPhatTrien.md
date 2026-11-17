# Chương 9. Kết luận và hướng phát triển

## 9.1. Kết quả đạt được

| Mục tiêu | Kết quả |
|---|---|
| Quy trình CNPM | Agile/Scrum, nhóm 4 người; đặc tả yêu cầu được rà soát nhiều vòng, chốt ngày 16/11/2026 và thiết kế lại phần mềm theo bản chốt; mỗi sprint đi qua đủ các hoạt động của môn học |
| Phần mềm chạy được | 18 yêu cầu nghiệp vụ MVP: requirement đồng bộ một chiều từ Jira có phiên bản, test case liên kết AC, Test Suite, Test Run cố định phiên bản, AI phân tích ảnh hưởng, đề xuất, regression, báo sửa lỗi – kiểm thử lại; 18 màn hình, 75 thao tác API (OpenAPI 3.1) |
| Điểm mới | Khi requirement đổi, hệ thống tự gắn cờ đúng test bị ảnh hưởng; AI chỉ ra test cần sửa, test còn thiếu, test nên chạy lại kèm lý do; QA Lead quyết định |
| Tích hợp AI đúng cách | AI Service tách riêng (Strategy pattern, 4 provider) dùng chung cho 3 tác vụ; che PII, chống prompt injection, schema + retry, hạn mức, nhật ký AI; đề xuất lỗi thời không áp dụng được |
| Kiểm thử tự động | 33 unit, 85 API, 11 test phần mở rộng, 11 E2E Playwright – tất cả pass |
| Mô hình bằng công cụ chuyên dụng | Sơ đồ use case, DFD, ERD (sinh từ lược đồ thật), hoạt động, trạng thái, tuần tự vẽ bằng draw.io; CSDL mở được bằng DB Browser for SQLite |
| Triển khai | Docker, docker-compose, GitHub Actions CI |

## 9.2. Hạn chế

- MockProvider dùng luật đơn giản; chất lượng phân tích ảnh hưởng thật phụ thuộc LLM được cấu hình và chưa được đo trên bộ dữ liệu lớn.
- Sự kiện Jira chưa vào hàng đợi bền vững: nếu máy chủ tắt giữa lúc nhận webhook thì phải chờ lần đồng bộ định kỳ.
- Phân quyền theo 5 vai trò toàn cục, chưa giới hạn theo thành viên từng dự án.
- Bộ regression lập theo từng requirement, chưa gộp nhiều thay đổi của một bản phát hành.
- Tích hợp Jira một chiều: chưa đọc trạng thái Bug để tự gợi ý kiểm thử lại, chưa đẩy kết quả ngược lên Jira.
- YC19 (script tự động) và YC20 (sprint) có code nhưng nằm ngoài MVP, tắt mặc định.
- Chưa kiểm thử hiệu năng với dữ liệu lớn.

## 9.3. Hướng phát triển cho phần mềm

1. **Hàng đợi sự kiện Jira bền vững** (BullMQ + Redis hoặc bảng outbox): không mất sự kiện webhook, xử lý tuần tự theo issue.
2. **Phân quyền theo thành viên dự án**: dùng danh sách thành viên đồng bộ từ Jira để giới hạn quyền ghi theo dự án.
3. **Regression theo bản phát hành**: gộp thay đổi của nhiều requirement thành một bộ regression.
4. **Đọc trạng thái Bug từ Jira**: Bug chuyển *Resolved* thì tự gợi ý Developer báo đã sửa hoặc tạo phiếu kiểm thử lại; đẩy kết quả kiểm thử lên Jira.
5. **Bật lại YC19, YC20**: script Playwright theo Page Object, tự sửa locator khi giao diện đổi; theo dõi sprint, burndown, velocity.
6. Phát hiện test trùng lặp bằng embedding; RAG với pgvector để AI dùng tài liệu nghiệp vụ; quan sát LLM (Langfuse); chuyển sang PostgreSQL, đăng nhập SSO.

## 9.4. Hướng phát triển chung – nâng cao chất lượng AI

Hệ thống đã lưu sẵn dữ liệu để đo chất lượng AI: `ai_logs` (prompt, model, kết quả gốc), `test_case_versions` (bản AI sinh và bản người sửa), `ai_proposals` (đề xuất và quyết định chấp nhận/từ chối của QA Lead). Dựa vào đó, các phiên bản sau có thể cải tiến AI theo hướng có số liệu:

| Hướng | Nội dung | Đo bằng |
|---|---|---|
| Chọn model phù hợp | Chạy cùng bộ requirement tiếng Việt với nhiều LLM | Độ bao phủ AC, tỷ lệ test hợp lệ, tỷ lệ phải sửa |
| Độ chính xác phân tích ảnh hưởng | So đề xuất AI với quyết định của QA Lead | Tỷ lệ đề xuất được chấp nhận, số test bị bỏ sót |
| Dùng tài liệu nghiệp vụ (RAG) | Đưa tài liệu nghiệp vụ của dự án vào prompt | So sánh có / không dùng tài liệu trên cùng bộ dữ liệu |
| Model nhỏ chạy nội bộ | Model mã nguồn mở chạy trên máy chủ công ty để không gửi dữ liệu ra ngoài | Chất lượng so với model lớn, chi phí, độ trễ |

> Lưu ý: không dùng dữ liệu nội bộ công ty khi chưa được phép bằng văn bản; dùng dữ liệu công khai hoặc dữ liệu tự xây dựng (như dự án hư cấu "App bảo hiểm thú cưng").
