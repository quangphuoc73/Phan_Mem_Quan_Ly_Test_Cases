# Chương 9. Kết luận và hướng phát triển

## 9.1. Kết quả đạt được

| Mục tiêu | Kết quả |
|---|---|
| Quy trình CNPM | Agile/Scrum, nhóm 4 người: 5 sprint × 1 tuần, Product Backlog 28 story, DoR/DoD, biên bản các sự kiện; mỗi sprint đi qua đủ 7 hoạt động của môn học |
| Phần mềm chạy được | 12 yêu cầu nghiệp vụ (YC1–YC12), 14 màn hình, 40+ API; hỗ trợ đội làm Scrum (sprint, story point, burndown, velocity) |
| Tích hợp AI đúng cách | AI Service tách riêng (Strategy pattern, 4 provider), che PII, chống prompt injection, schema + retry, rate limit, nhật ký AI |
| Kiểm thử tự động | 55 unit/API test, 9 E2E Playwright, 8 test Playwright mẫu (POM), script AI sinh chạy được trên web thật |
| Triển khai | Docker, docker-compose, GitHub Actions CI |

## 9.2. Hạn chế

- MockProvider dùng luật đơn giản; chất lượng thật phụ thuộc LLM được cấu hình.
- Script Playwright do AI sinh còn dạng "phẳng", chưa tái sử dụng Page Object.
- Chưa tích hợp Jira/GitHub Issues 2 chiều; chưa có thông báo (email/Slack).
- Hàng đợi chạy test đang đồng bộ (mỗi request chờ kết quả); chưa có hàng đợi job (BullMQ + Redis) cho chạy hàng loạt.
- Chưa kiểm thử hiệu năng với dữ liệu lớn.

## 9.3. Hướng phát triển cho phần mềm

1. Hàng đợi job (BullMQ + Redis) để sinh test case và chạy script nền, chạy hàng loạt theo bộ test (test suite).
2. Tích hợp Jira: nhập user story trực tiếp, tạo bug tự động khi Fail.
3. Phát hiện test case trùng lặp bằng embedding; gợi ý edge case còn thiếu.
4. RAG với pgvector: đưa tài liệu nghiệp vụ vào để AI sinh test case sát thực tế hơn.
5. Quan sát LLM (Langfuse): theo dõi chi phí, độ trễ, chất lượng từng prompt.
6. Chuyển sang PostgreSQL, thêm đăng nhập SSO.

## 9.4. Hướng phát triển chung – nâng cao chất lượng AI

Hệ thống đã lưu sẵn dữ liệu để đo chất lượng AI: bảng `ai_logs` (prompt, model, kết quả gốc) và `test_case_versions` (bản AI sinh ra v1 và bản người dùng sửa cuối cùng). Dựa vào đó, các phiên bản sau có thể cải tiến phần AI theo hướng có số liệu:

| Hướng | Nội dung | Đo bằng |
|---|---|---|
| Chọn model phù hợp | Chạy cùng bộ user story tiếng Việt với nhiều LLM, chọn model cho kết quả tốt nhất với chi phí hợp lý | Độ bao phủ acceptance criteria, tỷ lệ test case hợp lệ, tỷ lệ phải sửa |
| Dùng tài liệu nghiệp vụ (RAG) | Đưa tài liệu nghiệp vụ của dự án vào prompt để test case sát thực tế hơn | So sánh có / không dùng tài liệu trên cùng bộ dữ liệu |
| Model nhỏ chạy nội bộ | Dùng model mã nguồn mở chạy trên máy chủ công ty để không gửi dữ liệu ra ngoài | Chất lượng so với model lớn, chi phí, độ trễ |
| Script tự sửa khi giao diện đổi | Khi script fail vì không tìm thấy phần tử, AI đọc lại trang và đề xuất locator mới (self-healing) | Tỷ lệ script chạy được sau khi giao diện thay đổi |

> Lưu ý: không dùng dữ liệu nội bộ công ty khi chưa được phép bằng văn bản; dùng dữ liệu công khai hoặc dữ liệu tự xây dựng (như dự án hư cấu "App bảo hiểm thú cưng").
