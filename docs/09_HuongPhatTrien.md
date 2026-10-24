# Chương 9. Kết luận và hướng phát triển

## 9.1. Kết quả đạt được

| Mục tiêu | Kết quả |
|---|---|
| Quy trình CNPM | Agile/Scrum: Sprint 0 + 6 sprint 2 tuần, Product Backlog 28 story, DoR/DoD, biên bản các sự kiện; mỗi sprint đi qua đủ 7 hoạt động của môn học |
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

## 9.4. Hướng phát triển lên khóa luận tốt nghiệp (ngành AI)

Đồ án SE104 trả lời: *"Hệ thống làm được gì, thiết kế ra sao?"*. Khóa luận cần trả lời: *"Phương pháp AI nào tốt hơn, tốt hơn bao nhiêu, vì sao?"*. Hệ thống này trở thành **công cụ thực nghiệm và demo**.

| Hướng | Câu hỏi nghiên cứu ví dụ | Đo bằng |
|---|---|---|
| So sánh LLM | Model nào sinh test case tốt nhất từ user story tiếng Việt? | Độ bao phủ acceptance criteria, tỷ lệ test case hợp lệ, tỷ lệ phải sửa, đánh giá chuyên gia QA |
| RAG theo domain | RAG với tài liệu nghiệp vụ cải thiện độ bao phủ bao nhiêu? | So sánh có/không RAG trên cùng bộ dữ liệu |
| Fine-tune model nhỏ | Qwen/Llama 7B fine-tune bằng LoRA có tiệm cận model lớn không? | Cùng các chỉ số + chi phí, độ trễ |
| AI agent tự sửa script | Agent dùng Playwright (qua MCP) tự chạy, đọc lỗi, sửa locator (self-healing) đạt tỷ lệ pass bao nhiêu? | Tỷ lệ script chạy được ở lần 1, sau n vòng tự sửa |

**Dữ liệu đã chuẩn bị sẵn từ SE104:** bảng `ai_logs` (prompt, model, kết quả gốc) và `test_case_versions` (bản AI gốc v1 – bản người sửa cuối cùng). Cặp này chính là dữ liệu đánh giá quý nhất.

> Lưu ý: khóa luận phải có đóng góp mới so với đồ án môn và cần giảng viên hướng dẫn đồng ý. Không dùng dữ liệu nội bộ công ty khi chưa được phép bằng văn bản; dùng dữ liệu công khai hoặc dữ liệu tự xây dựng (như dự án hư cấu "App bảo hiểm thú cưng").
