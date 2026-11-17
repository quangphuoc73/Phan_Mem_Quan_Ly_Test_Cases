# Checklist các chỗ bị ảnh hưởng bởi đặc tả bản 08/11

> **Trạng thái (16/11/2026): đã xử lý xong, file chỉ còn giá trị lưu vết.** Đặc tả được chốt ngày 16/11/2026 (`DacTa_YeuCauNghiepVu_1011.docx`, đã gồm mọi góp ý [1.1]…[4], [A1]–[A6], [B1]–[B4], [D1]–[D3], [R1]–[R5]). Phần mềm, CSDL, giao diện, kiểm thử (129 test + 11 E2E), sơ đồ và báo cáo đã được thiết kế lại theo bản chốt; chi tiết thiết kế ở [ThietKe_MVP_1611.md](ThietKe_MVP_1611.md). Các mục bên dưới được đánh dấu đã làm; tên file, số dòng trong đó là của mã nguồn cũ.

Nguồn: `docs/DacTa_YeuCauNghiepVu_DeXuat.pdf` (bản 08/11/2026). Rà soát ngày 09/11/2026, nhánh `phuoc`.

Ký hiệu nguồn ảnh hưởng:
- **[08/11]**: do các chỗ sửa ngày 08/11 (xem mục 6 của đặc tả).
- **[MỚI]**: do 5 yêu cầu mới YC15–YC19 và mô hình Test Run.
- **[NGOÀI MVP]**: do YC10 (Playwright) và YC14 (Sprint) chuyển ra ngoài MVP.
- **[ĐỔI MÃ]**: YC15 cũ (báo đã sửa lỗi) đổi thành YC20.

Thứ tự gợi ý: làm mục 0 → 1 → 2 → 3 cùng lúc (để CI không đỏ) → 4 → 5 → 6.

---

## 0. Sửa lại đặc tả trước khi code

- [x] Phụ lục ghi "YC10, YC14: code đã có, ẩn bằng cấu hình" là sai: chưa có cờ ẩn Sprint, còn `RUNNER_ENABLED` chỉ tắt phần chạy script. Thêm cờ (ví dụ `SPRINT_ENABLED`, `SCRIPT_ENABLED`) hoặc sửa câu thành "cần thêm cờ để ẩn". **[NGOÀI MVP]**
- [x] Ghi thêm quy định: không xóa được test case đã có lần chạy (hiện xóa Nháp sẽ xóa luôn lịch sử chạy do `ON DELETE CASCADE`). **[MỚI]**
- [x] Ghi chú khi code: QĐ2 "sinh lại không thay thế bản nháp cũ" ngược với code hiện tại (xem mục 1).
- [x] Đưa các góp ý MVP đã nhận vào đặc tả, xem [GopY_MVP_QuyetDinh.md](GopY_MVP_QuyetDinh.md):
  - [x] Cao: 1.4 cờ "Cần kiểm tra" thay cho tự lưu trữ (QĐ8); 2.1 QĐ17 chặn test có cờ như QĐ20.
  - [x] TB: 1.2 so `updated` của Jira; 2.2 nhật ký Đã xem lại; 3.1 `retest_of`; 3.3 ý nghĩa Pass/Fail/Blocked (QĐ15); 4 ghi rõ phân quyền toàn cục.
  - [x] Thấp: 1.1 issue ID; 3.2 build và môi trường của Test Run.
  - [x] Không làm: 1.3 hàng đợi sự kiện → hướng phát triển.

## 1. Backend (`app/src/`)

### Cơ sở dữ liệu
- [x] [schema.sql:163](../app/src/db/schema.sql) `test_runs`: bảng đang lưu **từng lần chạy**, trùng tên với Test Run (**đợt chạy**). Đổi thành `test_executions`, thêm `test_run_id` và phiên bản test lúc chạy. **[MỚI]**
- [x] Thêm bảng: phiên bản requirement, liên kết test ↔ AC, Test Suite, Test Run, test trong đợt (người được giao), đề xuất AI, bộ regression. **[MỚI]**
- [x] [schema.sql:121](../app/src/db/schema.sql) `test_cases.source`: giữ 2 giá trị AI/MANUAL, thêm cột "tạo từ đề xuất" (ID đề xuất). **[08/11]**
- [x] `reviews.decision`: xem có cần thêm giá trị cho duyệt đề xuất (YC18) hay tách bảng riêng. **[MỚI]**
- [x] [seed.js](../app/src/db/seed.js), [parameterService.js:6](../app/src/services/parameterService.js): ẩn `PRIORITIES` (cố định), `RUN_TIMEOUT_SEC`, `SPRINT_MAX_DAYS` khỏi BM10. **[08/11] [NGOÀI MVP]**

### Phân quyền
- [x] [auth.js](../app/src/middleware/auth.js): thêm quyền `testrun:manage`, `proposal:review`. Chỉ thêm quyền, không thêm role.

### Test case, lần chạy
- [x] [testCaseService.js:89](../app/src/services/testCaseService.js) `saveAiResult`: đang `DELETE` bản nháp AI khi sinh lại → trái QĐ2. Đổi thành sinh thêm, không xóa.
- [x] [testCaseService.js:139](../app/src/services/testCaseService.js) `remove`: chặn xóa test đã có lần chạy. **[MỚI]**
- [x] `testCaseService.js` `submit`: QĐ3 — phải liên kết ít nhất 1 AC mới được gửi duyệt. **[MỚI]**
- [x] [testCaseService.js:36](../app/src/services/testCaseService.js) `NEEDS_RETEST`: "lần chạy gần nhất" tính trong cùng Test Run. **[08/11]**
- [x] [runService.js:16](../app/src/services/runService.js) `record`: bỏ kiểm tra `APPROVED` lúc ghi; kiểm tra đợt còn mở và người được giao. Đã duyệt được kiểm tra lúc thêm test vào đợt (QĐ5, QĐ17). **[08/11]**
- [x] [runService.js:42](../app/src/services/runService.js) `reportFix`: lần chạy gần nhất trong cùng Test Run; hỗ trợ đợt kiểm thử lại do QA Lead tạo (QĐ15). **[08/11] [ĐỔI MÃ]**

### Báo cáo
- [x] [reportService.js:10](../app/src/services/reportService.js): bỏ story đã lưu trữ khỏi số đếm. **[08/11]**
- [x] [reportService.js:99](../app/src/services/reportService.js): tiến độ không vượt 100%; phạm vi dự án chỉ tính đợt của phiên bản hiện tại. **[08/11]**
- [x] [reportService.js:64](../app/src/services/reportService.js) `ai_edited`: chỉ tính khi đổi bước hoặc kết quả mong đợi (QĐ6), không dùng `version > 1`.
- [x] `reportService.js`: bỏ lọc sprint; thêm lọc theo Test Run. **[NGOÀI MVP] [MỚI]**

### User story, Jira
- [x] [storyService.js:99](../app/src/services/storyService.js) `markReviewed`: cờ Cần xem lại chuyển từ story về **từng test**, kèm gán lại AC khi bấm Đã xem lại (QĐ3). **[08/11]**
- [x] [storyService.js:85](../app/src/services/storyService.js) `create`: không có route gọi, trái QĐ1 → xóa.
- [x] [jiraService.js:341](../app/src/services/jiraService.js): Jira trả danh sách rỗng thì đang lưu trữ toàn bộ story → hỏi Jira theo từng mã trước khi lưu trữ.
- [x] `jiraService.js`: thêm thử lại 2 lần khi gọi Jira lỗi; tạo phiên bản requirement khi nội dung đổi. **[MỚI]**
- [x] [jiraService.js:249](../app/src/services/jiraService.js): trùng họ tên thì không gán thành viên (QĐ13). **[08/11]**

### AI
- [x] [ai/schemas.js](../app/src/services/ai/schemas.js), `promptBuilder.js`, 4 provider: kết quả AI có trường AC liên quan. **[MỚI]**
- [x] Thêm tác vụ AI phân tích ảnh hưởng (YC17) và xếp ưu tiên regression (YC19). **[MỚI]**
- [x] QĐ19: đề xuất "Nên chạy lại" → thêm test vào bộ regression; bản nháp tạo từ đề xuất ghi ID đề xuất. **[08/11]**
- [x] QĐ20: test có cờ Cần xem lại hiện cảnh báo trong bộ regression, phải xem lại hoặc gỡ trước khi xác nhận. **[08/11]**

### Xuất Excel
- [x] [work.js:137](../app/src/routes/work.js): thêm cột requirement, suite, run, phiên bản, cờ.

## 2. Giao diện (`app/public/js/`)

- [x] Màn hình mới: Test Suite, Test Run (lập đợt, phân công, ghi kết quả, tạo đợt kiểm thử lại), lịch sử phiên bản requirement, đề xuất AI (so trước/sau, duyệt), bộ regression. **[MỚI]**
- [x] [pages/testcases.js](../app/public/js/pages/testcases.js): ghi kết quả chuyển vào trong Test Run.
- [x] [pages/stories.js:136](../app/public/js/pages/stories.js): câu hỏi "sẽ thay thế bản nháp…" → sửa theo QĐ2.
- [x] [pages/stories.js:82](../app/public/js/pages/stories.js): nút Đã xem lại chuyển về từng test. **[08/11]**
- [x] [pages/admin.js:23](../app/public/js/pages/admin.js): trang tham số bỏ các tham số đã ẩn. **[08/11]**
- [x] [pages/admin.js:92](../app/public/js/pages/admin.js): bảng phân quyền còn nhắc sprint, script. **[NGOÀI MVP]**
- [x] [pages/admin.js:201](../app/public/js/pages/admin.js): chữ hướng dẫn "gán theo email" → bổ sung gán theo họ tên, không gán khi trùng.
- [x] [main.js:15](../app/public/js/main.js): menu "Sprint (Agile)" và ô chọn sprint ẩn theo cờ. **[NGOÀI MVP]**
- [x] [pages/dashboard.js](../app/public/js/pages/dashboard.js), [pages/review.js](../app/public/js/pages/review.js), [pages/sprints.js](../app/public/js/pages/sprints.js): bỏ/ẩn bộ lọc sprint. **[NGOÀI MVP]**

## 3. Test tự động (82 test: 23 unit, 50 API, 9 E2E) — sửa cùng lúc với code

### Sẽ vỡ
- [x] IT-14→22 (`workflow.test.js`): ghi kết quả không qua Test Run.
- [x] IT-46→49 (`bugfix.test.js`): báo đã sửa theo lần chạy gần nhất toàn cục. **[ĐỔI MÃ]**
- [x] IT-56: Đã xem lại theo story. **[08/11]**
- [x] IT-58: lưu trữ story khi đồng bộ.
- [x] IT-23: hành vi sinh lại (không còn xóa nháp).
- [x] IT-31: cột Excel.
- [x] IT-43 (`auth_rbac`): ma trận quyền khi thêm quyền mới.
- [x] E2E-05: ghi kết quả chạy.

### Cần thêm
- [x] Jira trả danh sách rỗng không lưu trữ hàng loạt.
- [x] QĐ17: sửa test giữa đợt vẫn ghi được kết quả theo phiên bản đã thêm vào đợt.
- [x] QĐ15: chạy lại trong đợt đang mở; đợt kiểm thử lại khi đợt đã đóng.
- [x] QĐ20: test có cờ trong regression.
- [x] Tiến độ không vượt 100%; báo cáo không đếm story lưu trữ.
- [x] Không xóa được test có lần chạy.
- [x] YC15–YC19: mỗi yêu cầu ít nhất 1 test API.

### Ngoài MVP
- [x] IT-32, IT-34→42, E2E-08, E2E-09, UT-21→23 (YC10, YC14): chạy có điều kiện theo cờ hoặc ghi rõ là phần mở rộng.

## 4. Báo cáo (`docs/0*.md` → dựng lại `BaoCaoDoAn.docx`/`.pdf` bằng `docs/tools/`)

- [x] [00_TongQuan_KeHoach.md](00_TongQuan_KeHoach.md): phạm vi 0.4, kế hoạch sprint 0.6.
- [x] [01_KhaoSatHienTrang.md](01_KhaoSatHienTrang.md): sửa các câu nêu Playwright, sprint là tính năng chính.
- [x] [02_DacTaYeuCau.md](02_DacTaYeuCau.md):
  - [x] Bảng 2.2 thay bằng danh sách 18 yêu cầu MVP.
  - [x] BM/QĐ theo bản đề xuất; YC15 cũ → YC20 (BM14/QĐ15).
  - [x] BM9, BM13 chuyển sang phụ lục.
  - [x] Bảng trách nhiệm 2.4.
  - [x] QĐ2 bỏ chữ "thay thế".
  - [x] Mục 2.5.3 "< 2 giây với 10.000 test case": đo thật hoặc bỏ.
- [x] [03_PhanTich.md](03_PhanTich.md):
  - [x] Use case: UC12, UC19 ra ngoài MVP; UC21 đổi mã; thêm UC cho YC15–YC19.
  - [x] DFD: thêm 5 hình; sửa YC1, YC5, YC6, YC8; xóa/chuyển 3.4.11 (YC10), 3.4.15 (YC14); 3.4.16 đổi thành YC20.
  - [x] Sơ đồ phối hợp, hoạt động, trạng thái test case (thêm cờ), trạng thái story (điều kiện lưu trữ).
- [x] [04_ThietKe.md](04_ThietKe.md): ERD ("đủ 14 bảng" → khoảng 21), lược đồ quan hệ, từ điển dữ liệu, tuần tự đồng bộ Jira, prompt có trường AC, danh sách màn hình và API; bỏ tuần tự YC10, sprint.
- [x] [06_KiemThu.md](06_KiemThu.md): bảng IT/UT/E2E, bộ test thủ công 6.4, mục 6.5 (YC10).
- [x] [07_TrienKhai_HuongDanSuDung.md](07_TrienKhai_HuongDanSuDung.md): hướng dẫn theo vai trò; ảnh `08_playwright_chay_tu_dong.png`, `11_sprint.png`.
- [x] [09_HuongPhatTrien.md](09_HuongPhatTrien.md): chuyển YC10, YC14 vào đây.
- [x] Không sửa: [00a_QuyTrinhAgile.md](00a_QuyTrinhAgile.md) (quy trình Scrum của nhóm, khác tính năng YC14).

## 5. Sơ đồ (sửa `generate_*.py` rồi dựng lại `.drawio` và `.svg`)

- [x] `docs/dfd/`: đổi `YC15_BaoDaSuaLoi` → YC20; thêm DFD YC15–YC19; sửa YC01, YC05, YC06, YC08, PhoiHop.
- [x] `docs/usecase/UseCaseTongQuat`.
- [x] `docs/erd/ERD_CSDL*`.
- [x] `docs/sodo/`: TrangThai_UserStory, TrangThai_TestCase, TuanTu_DongBoJira, Lop_TichHopJira, LuongManHinh, HoatDong_QuyTrinhMoi, BangCongViec, KeHoachSprint.

## 6. Backlog, demo, slide, README

- [x] [agile/ProductBacklog.csv](agile/ProductBacklog.csv) rồi chạy `build_backlog.js` dựng lại `.xlsx`:
  - [x] Thêm item cho YC15–YC19.
  - [x] PB-26: YC15 → YC20.
  - [x] PB-03, PB-18, PB-19 (YC10), PB-21, PB-22 (YC14) chuyển ra ngoài MVP.
- [x] [08_KichBanDemo.md](08_KichBanDemo.md): bước 2b, 8, 9, 11 đang demo Sprint và Playwright → kịch bản mới: sửa AC trên Jira → AI phân tích ảnh hưởng → duyệt đề xuất → chạy regression trong Test Run.
- [x] `SlideThuyetTrinh.html`/`.pdf`: sprint, script, YC14, YC15 cũ.
- [x] `README.md`, `BaiTapBuoi2_CanSua.md`: YC15 cũ, sprint, script.

## Không bị ảnh hưởng

Đăng nhập và JWT, che dữ liệu nhạy cảm, chống prompt injection, quản lý người dùng, webhook, Docker và cấu hình CI, quy trình Scrum của nhóm.
