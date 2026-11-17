#!/usr/bin/env python3
"""Sinh sơ đồ luồng dữ liệu (DFD) theo KÝ HIỆU CỦA MÔN SE104 (GV Đặng Việt Dũng).

Ký hiệu:
  - Người dùng / Thiết bị: hình chữ nhật
  - Khối xử lý (công việc): hình elip
  - Luồng dữ liệu: mũi tên khối, ghi D1–D6; luồng "Không có" tô màu trắng
  - Bộ nhớ phụ: hai đường kẻ ngang
Bố cục theo "Sơ đồ luồng dữ liệu tổng quát": người dùng ở trên (D1 xuống, D6 lên),
thiết bị nhập bên trái (D2 vào), thiết bị xuất bên phải (D5 ra), bộ nhớ phụ ở dưới (D3 lên, D4 xuống).

Mỗi lần chạy sinh ra (cạnh file này):
  - YCxx_*.drawio : mở bằng draw.io (app.diagrams.net hoặc draw.io Desktop) để xem, sửa
  - YCxx_*.svg    : hình chèn vào báo cáo
  - PhoiHop_CacCongViec.drawio/.svg : sơ đồ phối hợp giữa các công việc
và cập nhật mục 3.4 của docs/03_PhanTich.md (giữa hai dấu <!-- DFD:BEGIN --> và <!-- DFD:END -->).

Chạy:  python3 docs/dfd/generate_dfd.py
Sửa nội dung sơ đồ: sửa danh sách DFDS / PHOI_HOP bên dưới rồi chạy lại.
"""
import math
import re
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).parent
CHAPTER = OUT.parent / '03_PhanTich.md'

BLUE = '#1046A8'
OLIVE = '#8C9524'
FONT = 'Times New Roman'
NONE = 'Không có'

# ---------------------------------------------------------------------------
# NỘI DUNG CÁC DFD
#   d     : mô tả D1–D6; luồng không có thì bỏ trống (tự ghi "Không có", vẽ mũi tên trắng)
#   inp   : tên thiết bị nhập (D2) – bỏ trống thì vẽ hộp "Thiết bị nhập"
#   outp  : tên thiết bị xuất (D5) – bỏ trống thì vẽ hộp "Thiết bị xuất"
#   check : các bước xử lý giữa "Đọc D3" và "Lưu D4". Bước kết thúc bằng "?" là bước kiểm tra:
#           nếu không thỏa thì ghi thông báo lỗi vào D6 và chuyển tới bước "Xuất D6".
#   d2_first : nhận D2 ngay sau D1 (VD: nhập file)
#   d5_inline: D5/D2 đã được nói trong các bước check (VD: gửi prompt cho LLM)
# ---------------------------------------------------------------------------
DFDS = [
    dict(file='YC01_DongBoRequirement', title='DFD YC1 – Xem requirement từ Jira và lịch sử thay đổi', process='Đồng bộ, xem requirement',
         user='Mọi vai trò (đồng bộ: Admin, QA Lead)', inp='Jira (REST API)', outp='Jira (REST API)', bm='BM1', qd='QĐ1', d5_inline=True,
         d={'D1': 'Dự án cần đồng bộ (thao tác Đồng bộ ngay); hoặc requirement cần xem, phiên bản cần so sánh.',
            'D2': 'Từ Jira: các issue thuộc loại JIRA_ISSUE_TYPES của dự án – issue ID, mã, Summary, Description (có mục "Acceptance criteria"), '
                  'Priority, loại issue, component, trạng thái, thời điểm cập nhật (updated).',
            'D3': 'Mã Jira của dự án; requirement đã có (theo issue ID) cùng thời điểm cập nhật Jira đã lưu và phiên bản hiện tại; module của dự án.',
            'D4': 'Requirement mới (BM1, phiên bản 1) hoặc cập nhật; phiên bản mới khi tiêu đề, mô tả hoặc AC đổi; nhật ký đồng bộ; nhật ký hoạt động.',
            'D5': 'Yêu cầu tìm issue theo loại của dự án gửi Jira REST API, kèm thông tin xác thực đọc từ .env.',
            'D6': 'Danh sách requirement kèm trạng thái đồng bộ (Bình thường, Thiếu AC, Cần kiểm tra, Đã lưu trữ); chi tiết, lịch sử phiên bản '
                  'và so sánh trước/sau; hoặc thông báo lỗi.'},
         check=['Đồng bộ: kiểm tra người dùng có vai trò Admin hoặc QA Lead và dự án đã liên kết Jira?',
                'Xuất D5 đến Jira, nhận D2 (lấy hết các trang); lỗi kết nối thì thử lại tối đa 2 lần.',
                'Với từng issue: nhận diện requirement bằng issue ID; chỉ ghi khi thời điểm cập nhật trên Jira mới hơn bản đã lưu.',
                'Tách Description: phần trước nhãn "Acceptance criteria" là mô tả, mỗi dòng sau là một AC; đổi Priority về High / Medium / Low.',
                'Tiêu đề, mô tả hoặc AC đổi thì tạo phiên bản mới, không xóa phiên bản cũ; đổi ưu tiên, trạng thái Jira chỉ cập nhật giá trị hiện tại.',
                'Requirement không có AC được đánh dấu Thiếu AC.']),
    dict(file='YC02_SinhTestCaseBangAI', title='DFD YC2 – Sinh test case bằng AI', process='Sinh test case bằng AI',
         user='QA Lead, Tester', inp='Dịch vụ LLM', outp='Dịch vụ LLM', bm='BM2', qd='QĐ2', d5_inline=True,
         d={'D1': 'Requirement cần sinh test case.',
            'D2': 'Chuỗi JSON danh sách test case do LLM trả về, mỗi test có danh sách AC liên quan (ac_refs).',
            'D3': 'Nội dung requirement (tiêu đề, mô tả, AC đánh số); trạng thái lưu trữ, Cần kiểm tra; số test hiện có; tham số MAX_TC_PER_STORY, '
                  'MIN_AC_PER_STORY, AI_MAX_RETRY, AI_TIMEOUT_SEC, AI_CALLS_PER_HOUR; số lần gọi AI của người dùng trong 1 giờ.',
            'D4': 'Test case mới (nguồn AI, Nháp, phiên bản 1, phiên bản requirement đã liên kết) cùng liên kết AC; nhật ký AI (prompt đã che dữ liệu, '
                  'kết quả gốc, số lần thử, cờ injection).',
            'D5': 'Prompt gửi LLM: vai trò QA, quy định QĐ2, requirement ĐÃ CHE dữ liệu nhạy cảm, AC được đánh số.',
            'D6': 'Danh sách test case Nháp vừa sinh kèm AC liên quan, số test bị bỏ do vượt giới hạn, cảnh báo prompt injection; hoặc thông báo lỗi.'},
         check=['Kiểm tra số lần gọi AI trong 1 giờ < AI_CALLS_PER_HOUR (dùng chung cho YC2, YC15, YC17)?',
                'Kiểm tra requirement chưa lưu trữ, không Cần kiểm tra và có ít nhất MIN_AC_PER_STORY AC?',
                'Tính số test còn được sinh = MAX_TC_PER_STORY − số test hiện có. Kiểm tra số này > 0?',
                'Che dữ liệu nhạy cảm và đánh dấu nếu phát hiện prompt injection; ghép prompt, xuất D5 đến LLM, chờ tối đa AI_TIMEOUT_SEC giây.',
                'Nhận D2. Nếu sai JSON schema (thiếu ac_refs, sai số bước…) thì gọi lại, tối đa AI_MAX_RETRY lần; quá số lần vẫn sai?',
                'Cắt danh sách theo số test còn được sinh; giữ nguyên bản nháp cũ (không thay thế); đổi ac_refs thành nội dung AC để liên kết.']),
    dict(file='YC03_SoanThaoGuiDuyet', title='DFD YC3 – Soạn thảo, gửi duyệt và xem lại test case', process='Soạn thảo, xem lại test',
         user='QA Lead, Tester', bm='BM2', qd='QĐ3',
         d={'D1': 'Nội dung test case (BM2) và các AC liên kết; hoặc test cần gửi duyệt; hoặc test cần Đã xem lại kèm lý do (và AC gán lại).',
            'D3': 'Requirement và AC của phiên bản hiện tại; trạng thái, phiên bản, AC đã liên kết, cờ Cần xem lại của test; số test của requirement; '
                  'lần chạy của test; tham số MAX_TC_PER_STORY.',
            'D4': 'Test mới hoặc phiên bản mới (Nháp), liên kết AC, phiên bản requirement đã liên kết; trạng thái Chờ duyệt; '
                  'nhật ký Đã xem lại (người, phiên bản requirement, lý do, thời điểm) và gỡ cờ; nhật ký hoạt động.',
            'D6': 'Thông báo lưu, gửi duyệt, Đã xem lại thành công; hoặc thông báo lỗi vi phạm QĐ2, QĐ3.'},
         check=['Thêm: kiểm tra số test < MAX_TC_PER_STORY, có 1–15 bước và AC thuộc phiên bản hiện tại?',
                'Sửa: kiểm tra test không ở trạng thái Chờ duyệt? Sửa test Đã duyệt thì đưa về Nháp; phiên bản test + 1.',
                'Gửi duyệt: kiểm tra test ở trạng thái Nháp hoặc Bị trả lại và đã liên kết ít nhất 1 AC?',
                'Xóa: kiểm tra test Nháp hoặc Bị trả lại và chưa có lần chạy nào?',
                'Đã xem lại: kiểm tra test đang có cờ Cần xem lại và có lý do? Gỡ cờ, nâng phiên bản requirement đã liên kết lên phiên bản hiện tại.']),
    dict(file='YC04_DuyetTestCase', title='DFD YC4 – Duyệt test case', process='Duyệt test case',
         user='QA Lead', bm='BM3', qd='QĐ4',
         d={'D1': 'Test case, quyết định Duyệt / Trả lại, ghi chú (BM3).',
            'D3': 'Trạng thái hiện tại của test; phiên bản hiện tại của requirement; vai trò người duyệt.',
            'D4': 'Trạng thái mới; khi duyệt: gỡ cờ Cần xem lại và nâng phiên bản requirement đã liên kết; phiếu duyệt; nhật ký hoạt động.',
            'D6': 'Thông báo duyệt thành công kèm trạng thái mới, hoặc thông báo lỗi vi phạm QĐ4.'},
         check=['Kiểm tra người duyệt có vai trò QA Lead?',
                'Kiểm tra test đang ở trạng thái Chờ duyệt (kể cả bản nháp tạo từ đề xuất AI)?',
                'Nếu quyết định là Trả lại: kiểm tra có ghi chú?']),
    dict(file='YC05_GhiKetQuaChayTest', title='DFD YC5 – Ghi nhận kết quả chạy test', process='Ghi nhận kết quả',
         user='QA Lead, Tester', bm='BM4', qd='QĐ5, QĐ18', inp='', outp='',
         d={'D1': 'Test trong Test Run, kết quả Pass / Fail / Blocked, ghi chú, mã defect, liên kết bằng chứng (BM4).',
            'D3': 'Test Run (trạng thái, build, môi trường); test trong đợt (phiên bản cố định, người được giao); phiếu báo sửa đang chờ của test.',
            'D4': 'Lần chạy: kết quả, phiên bản test đã cố định, ghi chú, mã defect, bằng chứng, người chạy, thời điểm, lần Fail gốc (nếu là kiểm thử lại); '
                  'trạng thái kiểm thử lại của phiếu báo sửa.',
            'D6': 'Thông báo ghi nhận thành công kèm cảnh báo (VD build khác build đã báo sửa), hoặc thông báo lỗi vi phạm QĐ5.'},
         check=['Kiểm tra Test Run đang mở?',
                'Kiểm tra người ghi là người được giao hoặc QA Lead?',
                'Nếu kết quả là Fail hoặc Blocked: kiểm tra có ghi chú? Bằng chứng (nếu có) là đường dẫn?',
                'Nếu test đang chờ kiểm thử lại: gắn lần chạy với lần Fail gốc; Pass → Đã đóng, Fail → Mở lại, Blocked → vẫn chờ; build khác thì cảnh báo.']),
    dict(file='YC06_LapBaoCao', title='DFD YC6 – Lập báo cáo kiểm thử', process='Lập báo cáo',
         user='Mọi vai trò', bm='BM5', qd='QĐ6',
         d={'D1': 'Dự án hoặc Test Run cần xem báo cáo.',
            'D3': 'Requirement chưa lưu trữ và AC của phiên bản hiện tại; test Đã duyệt và liên kết AC; các lần chạy; đề xuất AI; nhật ký AI.',
            'D6': 'Báo cáo BM5: tỷ lệ pass, tiến độ thực thi, bao phủ requirement và bao phủ AC, kết quả theo module, xu hướng theo ngày, '
                  'requirement và AC chưa được bao phủ, requirement Thiếu AC, số test cần xem lại, chờ kiểm thử lại, đề xuất AI, thống kê AI.'},
         check=['Chọn Test Run: lấy lần chạy gần nhất của từng test trong đợt. Chọn dự án: chỉ tính lần chạy của phiên bản hiện tại của test Đã duyệt.',
                'Tỷ lệ pass = Pass / số test đã chạy (Blocked tính là đã chạy, không tính Pass); tiến độ = số test đã chạy / số test trong phạm vi.',
                'Bao phủ requirement = số requirement có test Đã duyệt / số requirement có AC (không gồm Thiếu AC); bao phủ AC tương tự theo từng AC.',
                'Tỷ lệ AI phải sửa = số test nguồn AI có các bước hoặc kết quả mong đợi khác bản AI gốc / số test nguồn AI.']),
    dict(file='YC07_TraCuuTestCase', title='DFD YC7 – Tra cứu test case', process='Tra cứu test case',
         user='Mọi vai trò', bm='BM6', qd='QĐ7',
         d={'D1': 'Điều kiện tra cứu: từ khóa (mã / tiêu đề), dự án, module, trạng thái, độ ưu tiên, loại, nguồn, requirement, Test Suite, '
                  'Test Run, cần xem lại, cần kiểm thử lại.',
            'D3': 'Các test thỏa điều kiện kèm requirement, phiên bản, cờ, suite và lần chạy của phiên bản hiện tại.',
            'D6': 'Danh sách test (BM6) sắp theo requirement mới nhất rồi theo mã test; "Kết quả gần nhất" là Chưa chạy nếu test vừa sửa.'},
         check=['Ghép các điều kiện D1 theo AND thành câu truy vấn có tham số (không nối chuỗi SQL) trước khi đọc D3.',
                'Kết quả gần nhất chỉ lấy lần chạy của phiên bản hiện tại của test (QĐ6, QĐ7).']),
    dict(file='YC08_NhanThayDoiRequirement', title='DFD YC8 – Nhận thay đổi requirement từ Jira', process='Nhận thay đổi requirement',
         user='Admin, QA Lead', inp='Jira (webhook, REST API)', outp='Jira (REST API)', bm='BM7', qd='QĐ8', d2_first=True, d5_inline=True,
         d={'D1': 'Thao tác Đồng bộ ngay; hoặc quyết định Lưu trữ / Giữ lại cho requirement Cần kiểm tra.',
            'D2': 'Từ Jira: sự kiện webhook kèm mã bí mật, hoặc lượt đồng bộ định kỳ; nội dung issue lấy lại qua REST API; kết quả hỏi lại từng issue ID.',
            'D3': 'JIRA_WEBHOOK_SECRET, JIRA_SYNC_MINUTES, JIRA_ISSUE_TYPES; requirement đã lưu (issue ID, thời điểm cập nhật Jira, nội dung, phiên bản); '
                  'test và AC liên kết của requirement.',
            'D4': 'Phiên bản requirement mới; cờ Cần xem lại của test (lý do AC đổi / AC bị bỏ / tiêu đề, mô tả đổi); cờ Cần kiểm tra kèm lý do; '
                  'quyết định Lưu trữ / Giữ lại; nhật ký đồng bộ (nguồn, thời điểm, kết quả, lỗi); nhật ký hoạt động.',
            'D5': 'Yêu cầu đọc issue qua Jira REST API (không dùng dữ liệu trong webhook); hỏi lại theo issue ID với requirement biến mất.',
            'D6': 'Kết quả đồng bộ (BM7): số requirement cập nhật, phiên bản mới, test bị gắn cờ, Cần kiểm tra; trạng thái và lỗi lần đồng bộ gần nhất; '
                  'hoặc thông báo lỗi.'},
         check=['Webhook: kiểm tra đúng mã bí mật JIRA_WEBHOOK_SECRET và dự án đã được thêm vào hệ thống?',
                'Xuất D5, nhận D2 qua Jira API; lỗi thì thử lại tối đa 2 lần, vẫn lỗi thì ghi nhật ký đồng bộ thất bại và không thay đổi dữ liệu.',
                'Với từng issue: chỉ ghi khi bản Jira mới hơn; nội dung đổi thì tạo phiên bản mới (như YC1).',
                'AC đổi hoặc bị bỏ: gắn cờ Cần xem lại cho test liên kết với AC đó. Tiêu đề hoặc mô tả đổi: gắn cờ mọi test của requirement.',
                'Requirement không còn trong kết quả (danh sách khác rỗng): hỏi Jira theo issue ID; 404 → "Jira báo không tìm thấy", '
                'khác loại → "Không còn thuộc loại được đồng bộ"; gắn cờ Cần kiểm tra, không tự lưu trữ.',
                'Requirement Cần kiểm tra hoặc đã lưu trữ xuất hiện lại trên Jira thì tự gỡ cờ, tự hiện lại.',
                'Quyết định: kiểm tra người dùng là Admin hoặc QA Lead và requirement đang Cần kiểm tra? Lưu trữ → ẩn requirement, giữ test; '
                'Giữ lại → chỉ ghi nhận, cờ vẫn giữ.']),
    dict(file='YC09_XuatTestCase', title='DFD YC9 – Xuất dữ liệu test case', process='Xuất test case ra Excel',
         user='Mọi vai trò', outp='File Excel (.xlsx)', bm='BM8', qd='QĐ9',
         d={'D1': 'Điều kiện lọc đang chọn ở màn hình tra cứu (như YC7).',
            'D3': 'Các test thỏa điều kiện kèm AC liên kết, suite, Test Run, phiên bản, cờ, kết quả gần nhất.',
            'D4': 'Nhật ký hoạt động (lần xuất).',
            'D5': 'File testcases.xlsx: mỗi test một dòng theo các cột của BM2 cùng kết quả gần nhất, requirement Jira, Test Suite, Test Run, phiên bản, '
                  'cờ cần xem lại (BM8); dòng tiêu đề tô màu.',
            'D6': 'Trình duyệt tải file về, hoặc thông báo lỗi.'},
         check=['Ghi từng test thành một dòng Excel; các bước và AC xuống dòng trong ô.']),
    dict(file='YC10_ThayDoiQuyDinh', title='DFD YC10 – Thay đổi quy định hệ thống', process='Thay đổi quy định',
         user='Admin, QA Lead', bm='BM9', qd='QĐ10',
         d={'D1': 'Tham số cần thay đổi, giá trị mới.',
            'D3': 'Giá trị hiện tại và miền giá trị cho phép của tham số; vai trò người sửa.',
            'D4': 'Giá trị mới, người sửa, thời điểm sửa; nhật ký hoạt động.',
            'D6': 'Thông báo thay đổi thành công (giá trị cũ → mới), hoặc thông báo giá trị ngoài miền cho phép.'},
         check=['Kiểm tra người sửa có vai trò Admin hoặc QA Lead?',
                'Kiểm tra tham số thuộc BM9 (độ ưu tiên, nhãn "Acceptance criteria" và cấu hình Jira không sửa được trên giao diện)?',
                'Kiểm tra giá trị mới là số nguyên thuộc miền giá trị cho phép (QĐ10)?']),
    dict(file='YC11_QuanLyNguoiDung', title='DFD YC11 – Quản lý người dùng', process='Quản lý người dùng',
         user='Admin', bm='BM10', qd='QĐ11',
         d={'D1': 'Thông tin tài khoản (BM10): tên đăng nhập, họ tên, email, vai trò, mật khẩu; thao tác thêm, cập nhật, đổi vai trò, khóa / mở khóa.',
            'D3': 'Danh sách tên đăng nhập đã có; tài khoản đang đăng nhập.',
            'D4': 'Tài khoản (mật khẩu ĐÃ BĂM bcrypt); nhật ký hoạt động.',
            'D6': 'Thông báo lưu thành công (không chứa mật khẩu băm), hoặc thông báo lỗi vi phạm QĐ11.'},
         check=['Kiểm tra người thực hiện có vai trò Admin?',
                'Kiểm tra tên đăng nhập 3–30 ký tự a-z 0-9 _ . và không trùng; mật khẩu ≥ 8 ký tự?',
                'Kiểm tra Admin không tự khóa hoặc tự hạ quyền chính mình?',
                'Băm mật khẩu bằng bcrypt.']),
    dict(file='YC12_DongBoDuAnJira', title='DFD YC12 – Đồng bộ dự án từ Jira', process='Đồng bộ dự án từ Jira',
         user='Admin, QA Lead', inp='Jira (REST API)', outp='Jira (REST API)', bm='BM11', qd='QĐ12', d5_inline=True,
         d={'D1': 'Thao tác Kiểm tra kết nối, hoặc mã dự án trên Jira cần thêm, hoặc thao tác Đồng bộ lại (BM11).',
            'D2': 'Từ Jira: kết quả xác thực; tên, mô tả dự án; component (module); thành viên (tên, email).',
            'D3': 'Mã dự án đã có; tài khoản đang hoạt động (email, họ tên) để gán thành viên.',
            'D4': 'Dự án (mã, tên, mô tả, mã Jira, thời điểm đồng bộ), module, thành viên dự án; requirement của dự án (như YC1); nhật ký hoạt động.',
            'D5': 'Yêu cầu gửi Jira REST API kèm thông tin xác thực đọc từ .env.',
            'D6': 'Kết quả kiểm tra kết nối; hoặc dự án vừa thêm kèm số module, số thành viên, thành viên chưa có tài khoản; hoặc thông báo lỗi.'},
         check=['Kiểm tra quyền: kiểm tra kết nối chỉ Admin; thêm dự án, đồng bộ lại: Admin hoặc QA Lead?',
                'Kiểm tra kết nối: xuất D5, nhận D2; nếu chỉ kiểm tra kết nối thì chuyển tới bước Xuất D6.',
                'Kiểm tra mã dự án 2–10 ký tự in hoa hoặc số, bắt đầu bằng chữ cái và chưa có trong hệ thống?',
                'Xuất D5 (lấy dự án, component, thành viên) đến Jira, nhận D2. Kiểm tra dự án có trên Jira?',
                'Gán thành viên theo email trùng; Jira ẩn email thì so họ tên, nhiều tài khoản trùng họ tên thì không gán. '
                'Thành viên chỉ để hiển thị và phân công, không cấp quyền.',
                'Đồng bộ requirement của dự án vừa thêm (YC1).']),
    dict(file='YC13_QuanLyTestSuite', title='DFD YC13 – Quản lý Test Suite', process='Quản lý Test Suite',
         user='QA Lead, Tester', bm='BM12', qd='QĐ13',
         d={'D1': 'Thông tin suite (dự án, tên, mô tả); thao tác tạo, sửa, xóa; test cần thêm hoặc bớt.',
            'D3': 'Tên các suite của dự án; dự án của các test cần thêm.',
            'D4': 'Suite (tên, mô tả, người tạo, ngày tạo); danh sách test của suite; nhật ký hoạt động.',
            'D6': 'Suite sau khi lưu kèm danh sách test; hoặc thông báo lỗi vi phạm QĐ13.'},
         check=['Kiểm tra người dùng có vai trò QA Lead hoặc Tester?',
                'Kiểm tra tên suite 3–100 ký tự và không trùng tên suite khác trong dự án?',
                'Thêm test: kiểm tra test cùng dự án với suite? (một test thuộc được nhiều suite)',
                'Xóa suite: chỉ xóa suite và danh sách thuộc suite, không xóa test.']),
    dict(file='YC14_LapTestRun', title='DFD YC14 – Lập Test Run và phân công', process='Lập Test Run, phân công',
         user='QA Lead', bm='BM13', qd='QĐ14',
         d={'D1': 'Thông tin đợt (BM13): dự án, tên, loại, build, môi trường, hạn; suite hoặc test được chọn; người được giao; '
                  'hoặc thao tác sửa đợt, thêm/bỏ test, phân công lại, đóng đợt (kèm xác nhận).',
            'D3': 'Trạng thái, phiên bản, cờ của test; trạng thái lưu trữ, Cần kiểm tra của requirement; vai trò người được giao; '
                  'các lần chạy đã có trong đợt.',
            'D4': 'Test Run; các test trong đợt với phiên bản cố định và người được giao; build, môi trường mới; trạng thái Đã đóng; nhật ký hoạt động.',
            'D6': 'Đợt vừa lập kèm danh sách test bị bỏ qua và lý do; tiến độ, cảnh báo (test có phiên bản mới, requirement đổi); '
                  'hoặc thông báo lỗi vi phạm QĐ14.'},
         check=['Kiểm tra người dùng có vai trò QA Lead và đã nhập build, môi trường?',
                'Kiểm tra người được giao là QA Lead hoặc Tester?',
                'Với từng test: kiểm tra điều kiện chạy – Đã duyệt, không có cờ Cần xem lại, requirement không lưu trữ hoặc Cần kiểm tra. '
                'Test không đủ điều kiện bị bỏ qua kèm lý do. Kiểm tra còn ít nhất 1 test đủ điều kiện?',
                'Cố định phiên bản hiện tại của từng test khi đưa vào đợt.',
                'Sửa build hoặc môi trường: kiểm tra đợt chưa có kết quả nào?',
                'Bỏ test khỏi đợt: kiểm tra test chưa có kết quả trong đợt?',
                'Đóng đợt: còn test chưa chạy thì kiểm tra người dùng đã xác nhận?']),
    dict(file='YC15_PhanTichAnhHuong', title='DFD YC15 – AI phân tích ảnh hưởng', process='AI phân tích ảnh hưởng',
         user='QA Lead, Tester', inp='Dịch vụ LLM', outp='Dịch vụ LLM', bm='BM14', qd='QĐ15', d5_inline=True,
         d={'D1': 'Requirement đã đổi cần phân tích.',
            'D2': 'Chuỗi JSON danh sách đề xuất: loại, test liên quan, phần thay đổi nguồn (AC / tiêu đề / mô tả), lý do, nội dung test đề xuất.',
            'D3': 'Các phiên bản requirement; test của requirement kèm AC liên kết và phiên bản requirement đã liên kết; tham số AI; '
                  'số lần gọi AI của người dùng trong 1 giờ.',
            'D4': 'Lần phân tích (mốc so, phiên bản hiện tại); các đề xuất (trạng thái Chờ xử lý, phiên bản requirement và test lúc phân tích); nhật ký AI.',
            'D5': 'Prompt gửi LLM: hai phiên bản requirement và các test, ĐÃ CHE dữ liệu nhạy cảm; quy tắc chỉ xét thay đổi sau phiên bản test đã liên kết.',
            'D6': 'Danh sách đề xuất (BM14); hoặc thông báo lỗi (requirement chỉ có 1 phiên bản, mọi test đã được xem lại, hết hạn mức AI, AI lỗi).'},
         check=['Kiểm tra số lần gọi AI trong 1 giờ < AI_CALLS_PER_HOUR?',
                'Kiểm tra requirement chưa lưu trữ và có ít nhất 2 phiên bản?',
                'Xác định mốc so = phiên bản cũ nhất mà các test đã liên kết (chưa có test thì phiên bản liền trước). '
                'Kiểm tra mốc so cũ hơn phiên bản hiện tại?',
                'Với từng test, tính các thay đổi xảy ra sau phiên bản mà test đó đã liên kết.',
                'Che dữ liệu, xuất D5 đến LLM, nhận D2; sai schema thì gọi lại tối đa AI_MAX_RETRY lần; quá số lần vẫn sai?',
                'Bỏ đề xuất trỏ tới test không thuộc requirement; mỗi đề xuất phải có loại, lý do và phần thay đổi nguồn. Phân tích không tự đổi test.']),
    dict(file='YC16_RaSoatDeXuat', title='DFD YC16 – Rà soát và áp dụng đề xuất AI', process='Rà soát đề xuất AI',
         user='QA Lead (Tester xem)', bm='BM15', qd='QĐ16',
         d={'D1': 'Đề xuất được chọn, quyết định Chấp nhận / Từ chối, ghi chú (BM15).',
            'D3': 'Đề xuất (loại, test liên quan, nội dung đề xuất, phiên bản requirement và test lúc phân tích); phiên bản hiện tại của requirement và test; '
                  'số test của requirement; bộ regression đang lập của cùng thay đổi.',
            'D4': 'Trạng thái đề xuất (Đã chấp nhận / Đã từ chối / Lỗi thời), người quyết định, ngày, ghi chú; bản nháp test mới hoặc phiên bản Nháp mới '
                  'ghi mã đề xuất; test thêm vào bộ regression; nhật ký hoạt động.',
            'D6': 'Đề xuất sau khi quyết định kèm test nháp vừa tạo (phải qua duyệt YC4); hoặc thông báo lỗi (Lỗi thời, thiếu ghi chú, vượt giới hạn test).'},
         check=['Kiểm tra người quyết định có vai trò QA Lead và đề xuất đang Chờ xử lý?',
                'Từ chối: kiểm tra có ghi chú?',
                'Chấp nhận: kiểm tra phiên bản requirement và test chưa đổi so với lúc phân tích? Đã đổi thì chuyển đề xuất sang Lỗi thời.',
                'Cần sửa: sửa test theo đề xuất, test về Nháp như khi sửa thủ công. Còn thiếu: kiểm tra số test < MAX_TC_PER_STORY? Tạo test nháp nguồn AI.',
                'Nên chạy lại: thêm test vào bộ regression của cùng thay đổi (chưa có bộ thì tạo bộ). Cần làm rõ: chỉ ghi nhận để trao đổi với PO/BA.']),
    dict(file='YC17_DeXuatRegression', title='DFD YC17 – AI đề xuất bộ regression', process='AI đề xuất regression',
         user='QA Lead (Tester xem)', inp='Dịch vụ LLM', outp='Dịch vụ LLM', bm='BM16', qd='QĐ17', d5_inline=True,
         d={'D1': 'Requirement đã đổi; test cần thêm, bỏ (kèm lý do); thao tác xác nhận kèm tên đợt, build, môi trường, người được giao.',
            'D2': 'Chuỗi JSON: mức ưu tiên và lý do cho từng test, các test gợi ý thêm.',
            'D3': 'Hai phiên bản requirement của thay đổi; test liên kết với AC đã đổi (hoặc mọi test nếu tiêu đề, mô tả đổi); '
                  'test đã duyệt khác của dự án; điều kiện chạy của từng test.',
            'D4': 'Bộ regression (Nháp / Đã xác nhận) và từng test: ưu tiên, lý do, nguồn, bắt buộc, đã bỏ, lý do bỏ; Test Run loại Regression khi xác nhận; '
                  'nhật ký AI.',
            'D5': 'Prompt gửi LLM: requirement hiện tại, các test bắt buộc và test ứng viên, ĐÃ CHE dữ liệu nhạy cảm.',
            'D6': 'Bộ regression (BM16) kèm danh sách test chưa đủ điều kiện chạy; Test Run vừa tạo; hoặc thông báo lỗi vi phạm QĐ17.'},
         check=['Lập bộ: kiểm tra số lần gọi AI trong 1 giờ < AI_CALLS_PER_HOUR và requirement có thay đổi chưa có bộ regression được xác nhận?',
                'Lấy phần bắt buộc: test liên kết với AC đã đổi; tiêu đề hoặc mô tả đổi thì mọi test của requirement.',
                'Xuất D5 đến LLM, nhận D2 (xếp ưu tiên, gợi ý thêm). Không gọi được AI thì vẫn đưa ra danh sách test liên kết.',
                'Bỏ test thuộc phần bắt buộc: kiểm tra có lý do?',
                'Xác nhận: kiểm tra người dùng là QA Lead và không còn test chưa đủ điều kiện chạy trong bộ (QĐ14)?',
                'Tạo Test Run loại Regression theo YC14 với các test còn trong bộ.']),
    dict(file='YC18_BaoSuaLoiKiemThuLai', title='DFD YC18 – Báo đã sửa lỗi và kiểm thử lại', process='Báo đã sửa lỗi',
         user='Developer (QA Lead lập đợt kiểm thử lại)', bm='BM17', qd='QĐ18',
         d={'D1': 'Lần chạy Fail được chọn, bản build đã sửa, ghi chú cho Tester (BM17); hoặc các phiếu chờ kiểm thử lại cần lập đợt, môi trường.',
            'D3': 'Kết quả của lần chạy; lần chạy gần nhất của test trong cùng Test Run; phiếu báo sửa đã có; Test Run chứa lần Fail (trạng thái, build).',
            'D4': 'Phiếu báo sửa (build, ghi chú, người báo, thời điểm, trạng thái Chờ kiểm thử lại); đợt Kiểm thử lại (theo YC14); nhật ký hoạt động.',
            'D6': 'Thông báo đã báo sửa và cách kiểm thử lại (chạy ngay trong đợt cũ nếu đợt còn mở và trùng build, ngược lại lập đợt Kiểm thử lại); '
                  'hoặc thông báo lỗi vi phạm QĐ18.'},
         check=['Kiểm tra người báo có vai trò Developer và đã nhập build (1–50 ký tự)?',
                'Kiểm tra lần chạy có kết quả Fail và là lần chạy gần nhất của test trong cùng Test Run?',
                'Kiểm tra lần chạy chưa được báo sửa?',
                'Lập đợt Kiểm thử lại: kiểm tra người dùng là QA Lead; build của đợt là build đã sửa. Kết quả chạy lại cập nhật phiếu ở YC5.']),
]

# Phần mở rộng ngoài MVP (phụ lục đặc tả): giữ DFD để tham khảo
DFDS_EXT = [
    dict(file='YC19_SinhVaChayScript', title='DFD YC19 – Sinh và chạy script kiểm thử tự động (mở rộng)', process='Sinh và chạy script',
         user='QA Lead, Tester', inp='Dịch vụ LLM, Playwright Worker', outp='Dịch vụ LLM, Playwright Worker',
         bm='BM18', qd='QĐ19', d5_inline=True,
         d={'D1': 'Test case; yêu cầu sinh script hoặc chạy script; test trong Test Run để ghi kết quả; mã script đã sửa.',
            'D2': 'Từ LLM: mã script Playwright. Từ Playwright Worker: báo cáo chạy (JSON), log, ảnh chụp lỗi.',
            'D3': 'Test Đã duyệt, URL ứng dụng của dự án, script đang lưu; tham số RUN_TIMEOUT_SEC, AI_MAX_RETRY.',
            'D4': 'Script; lần chạy hình thức Tự động trong Test Run (kết quả, thời gian, log, ảnh lỗi); nhật ký AI.',
            'D5': 'Đến LLM: prompt đã che dữ liệu. Đến Playwright Worker: script đã qua kiểm tra tĩnh.',
            'D6': 'Mã script, kết quả Pass / Fail, log, ảnh chụp lỗi; hoặc thông báo lỗi vi phạm QĐ19.'},
         check=['Kiểm tra bật cờ SCRIPT_ENABLED và test ở trạng thái Đã duyệt?',
                'Sinh script: xuất D5 (prompt) đến Dịch vụ LLM, nhận D2 (mã script).',
                'Kiểm tra tĩnh script: không dùng module nguy hiểm, không truy cập process.env, không eval?',
                'Chạy script: kiểm tra đã chọn test trong một Test Run đang mở? Xuất D5 đến Playwright Worker, chờ tối đa RUN_TIMEOUT_SEC giây.',
                'Xác định kết quả Pass / Fail và ghi như YC5.']),
    dict(file='YC20_TheoDoiSprint', title='DFD YC20 – Theo dõi sprint (mở rộng)', process='Theo dõi sprint',
         user='Mọi vai trò', inp='Jira (Agile API)', bm='BM19', qd='QĐ20',
         d={'D1': 'Dự án và sprint cần xem.',
            'D2': 'Từ Jira (khi đồng bộ): các sprint của board dự án – tên, mục tiêu, ngày bắt đầu, ngày kết thúc, trạng thái.',
            'D3': 'Sprint đã đồng bộ; tham số SPRINT_MAX_DAYS; requirement của sprint, test Đã duyệt và kết quả chạy gần nhất.',
            'D4': 'Sprint mới hoặc cập nhật (BM19).',
            'D6': 'Bảng sprint theo trạng thái DoD, story point cam kết / hoàn thành (velocity), burndown; cảnh báo sprint chưa có ngày hoặc quá dài.'},
         check=['Kiểm tra bật cờ SPRINT_ENABLED?',
                'Khi đồng bộ: bỏ qua sprint chưa có ngày (ghi cảnh báo); sprint dài hơn SPRINT_MAX_DAYS thì ghi cảnh báo.',
                'Requirement đạt DoD: có ≥ 1 test Đã duyệt và mọi test Đã duyệt có lần chạy gần nhất là Pass; velocity = tổng story point đạt DoD.']),
]


def algorithm(spec):
    """Thuật toán theo khuôn của môn học: Nhận D1 → Kết nối CSDL → Đọc D3 → … → Lưu D4 → Xuất D5 → Xuất D6 → Đóng kết nối → Kết thúc."""
    d = spec['d']
    steps = ['Nhận D1 từ người dùng.']
    if spec.get('d2_first'):
        steps.append('Nhận D2 từ thiết bị nhập.')
    steps.append('Kết nối cơ sở dữ liệu.')
    if 'D3' in d:
        steps.append('Đọc D3 từ bộ nhớ phụ.')
    checks = list(spec['check'])
    tail = []
    if 'D4' in d:
        tail.append('Lưu D4 xuống bộ nhớ phụ.')
    if 'D5' in d and not spec.get('d5_inline'):
        tail.append('Xuất D5 ra thiết bị xuất.')
    tail.append('Xuất D6 cho người dùng.')
    d6_step = len(steps) + len(checks) + len(tail)  # số thứ tự bước "Xuất D6"
    for c in checks:
        steps.append(f'{c} Nếu không thỏa: ghi thông báo lỗi vào D6, chuyển tới B{d6_step}.' if c.endswith('?') else c)
    steps += tail + ['Đóng kết nối cơ sở dữ liệu.', 'Kết thúc.']
    return [f'B{i}: {s}' for i, s in enumerate(steps, 1)]


def wrap(text, n):
    words, lines, cur = text.split(), [], ''
    for w in words:
        if cur and len(cur) + 1 + len(w) > n:
            lines.append(cur)
            cur = w
        else:
            cur = f'{cur} {w}'.strip()
    return lines + [cur] if cur else lines


def attr(s):
    return escape(s, {'"': '&quot;'})


# ---------------------------------------------------------------------------
# Vẽ: mỗi hình được thêm một lần, xuất ra cả draw.io (mxGraph XML) lẫn SVG
# ---------------------------------------------------------------------------
class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.cells, self.svg, self.n = [], [], 1

    def _cell(self, value, style, x, y, w, h):
        self.n += 1
        self.cells.append(f'<mxCell id="c{self.n}" value="{attr(value)}" style="{style}" vertex="1" parent="1">'
                          f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        return f'c{self.n}'

    def _svg_text(self, text, cx, cy, size, width_chars, bold=False, color='#000'):
        lines = wrap(text, width_chars)
        top = cy - (len(lines) - 1) * size * 0.6
        weight = ' font-weight="bold"' if bold else ''
        for i, line in enumerate(lines):
            self.svg.append(f'<text x="{cx}" y="{top + i * size * 1.2:.1f}" font-size="{size}"{weight} fill="{color}" '
                            f'text-anchor="middle" dominant-baseline="middle">{escape(line)}</text>')

    def box(self, text, x, y, w=420, h=90, size=26):
        # Người dùng / Thiết bị: hình chữ nhật
        self._cell(text, f'rounded=0;whiteSpace=wrap;html=1;fillColor={BLUE};strokeColor=#000000;strokeWidth=3;'
                         f'fontFamily={FONT};fontSize={size};fontColor=#000000;', x, y, w, h)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{BLUE}" stroke="#000" stroke-width="3"/>')
        self._svg_text(text, x + w / 2, y + h / 2, size, int(w / size * 2))

    def process(self, text, x, y, w=380, h=130, size=26):
        # Khối xử lý: hình elip
        cid = self._cell(text, f'ellipse;whiteSpace=wrap;html=1;fillColor={BLUE};strokeColor=#000000;strokeWidth=3;'
                               f'fontFamily={FONT};fontSize={size};fontColor=#000000;', x, y, w, h)
        self.svg.append(f'<ellipse cx="{x + w / 2}" cy="{y + h / 2}" rx="{w / 2}" ry="{h / 2}" fill="{BLUE}" stroke="#000" stroke-width="3"/>')
        self._svg_text(text, x + w / 2, y + h / 2, size, int(w / size * 1.5))
        return cid

    def store(self, text, x, y, w=400, h=90, size=26):
        # Bộ nhớ phụ: hai đường kẻ ngang
        self._cell(text, f'shape=partialRectangle;whiteSpace=wrap;html=1;left=0;right=0;fillColor=none;strokeColor=#000000;'
                         f'strokeWidth=4;fontFamily={FONT};fontSize={size};', x, y, w, h)
        self.svg.append(f'<line x1="{x}" y1="{y}" x2="{x + w}" y2="{y}" stroke="#000" stroke-width="4"/>'
                        f'<line x1="{x}" y1="{y + h}" x2="{x + w}" y2="{y + h}" stroke="#000" stroke-width="4"/>')
        self._svg_text(text, x + w / 2, y + h / 2, size, 40)

    def arrow(self, direction, x, y, w, h, label, lx, ly, present=True):
        # Luồng dữ liệu: mũi tên khối; luồng "Không có" tô trắng
        fill = OLIVE if present else '#FFFFFF'
        stroke = '#4D5214' if present else '#000000'
        self._cell('', f'shape=singleArrow;direction={direction};whiteSpace=wrap;html=1;arrowWidth=0.42;arrowSize=0.28;'
                       f'fillColor={fill};strokeColor={stroke};strokeWidth=2;', x, y, w, h)
        self._cell(label, f'text;html=1;align=center;verticalAlign=middle;fontFamily={FONT};fontSize=26;fontStyle=1;', lx, ly, 60, 40)
        if direction in ('south', 'north'):
            sw, hl = w * 0.42, h * 0.28
            l, r = x + (w - sw) / 2, x + (w + sw) / 2
            if direction == 'south':
                pts = [(l, y), (r, y), (r, y + h - hl), (x + w, y + h - hl), (x + w / 2, y + h), (x, y + h - hl), (l, y + h - hl)]
            else:
                pts = [(l, y + h), (r, y + h), (r, y + hl), (x + w, y + hl), (x + w / 2, y), (x, y + hl), (l, y + hl)]
        else:
            sh, hl = h * 0.42, w * 0.28
            t, b = y + (h - sh) / 2, y + (h + sh) / 2
            pts = [(x, t), (x + w - hl, t), (x + w - hl, y), (x + w, y + h / 2), (x + w - hl, y + h), (x + w - hl, b), (x, b)]
        self.svg.append(f'<polygon points="{" ".join(f"{a:.1f},{b:.1f}" for a, b in pts)}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
        self.svg.append(f'<text x="{lx + 30}" y="{ly + 20}" font-size="26" font-weight="bold" text-anchor="middle" dominant-baseline="middle">{label}</text>')

    def edge(self, src, dst, label, p1, p2, s1, s2, dashed=False, label_shift=0, label_t=0.5):
        # Mũi tên nối hai công việc (sơ đồ phối hợp). p1, p2: điểm đầu/cuối; s1, s2: (x, y, w, h) của hình nguồn/đích
        self.n += 1
        ex, ey = (p1[0] - s1[0]) / s1[2], (p1[1] - s1[1]) / s1[3]
        nx, ny = (p2[0] - s2[0]) / s2[2], (p2[1] - s2[1]) / s2[3]
        dash = 'dashed=1;' if dashed else ''
        self.cells.append(
            f'<mxCell id="c{self.n}" value="{attr('<br>'.join(escape(x) for x in wrap(label, 18)))}" style="endArrow=block;endFill=1;html=1;strokeWidth=2;{dash}'
            f'fontFamily={FONT};fontSize=16;labelBackgroundColor=#FFFFFF;exitX={ex:.3f};exitY={ey:.3f};entryX={nx:.3f};entryY={ny:.3f};" '
            f'edge="1" parent="1" source="{src}" target="{dst}"><mxGeometry relative="1" as="geometry"/></mxCell>')
        (x1, y1), (x2, y2) = p1, p2
        ang = math.atan2(y2 - y1, x2 - x1)
        hx, hy = x2 - 14 * math.cos(ang), y2 - 14 * math.sin(ang)
        head = [(x2, y2), (hx - 7 * math.sin(ang), hy + 7 * math.cos(ang)), (hx + 7 * math.sin(ang), hy - 7 * math.cos(ang))]
        da = ' stroke-dasharray="8 6"' if dashed else ''
        self.svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{hx:.1f}" y2="{hy:.1f}" stroke="#000" stroke-width="2"{da}/>'
                        f'<polygon points="{" ".join(f"{a:.1f},{b:.1f}" for a, b in head)}" fill="#000"/>')
        mx, my = x1 + (x2 - x1) * label_t - label_shift * math.sin(ang), y1 + (y2 - y1) * label_t + label_shift * math.cos(ang)
        lines = wrap(label, 18)
        bw, bh = max(len(s) for s in lines) * 8 + 10, len(lines) * 19 + 4
        self.svg.append(f'<rect x="{mx - bw / 2:.1f}" y="{my - bh / 2:.1f}" width="{bw}" height="{bh}" fill="#fff"/>')
        self._svg_text(label, mx, my, 16, 18)

    def frame(self, text, x, y, w, h):
        self._cell(text, f'rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor=none;dashed=1;strokeWidth=2;verticalAlign=top;'
                         f'align=left;spacingLeft=10;fontFamily={FONT};fontSize=18;fontStyle=2;', x, y, w, h)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 6"/>'
                        f'<text x="{x + 12}" y="{y + 22}" font-size="18" font-style="italic">{escape(text)}</text>')

    def drawio_text(self, html, x, y, w, h, size=16):
        # Phần chữ chỉ có trong file draw.io (trong báo cáo đã có ở Markdown)
        self._cell(html, f'text;html=1;whiteSpace=wrap;align=left;verticalAlign=top;fontFamily={FONT};fontSize={size};', x, y, w, h)

    def title(self, text):
        self._cell(f'<b>{escape(text)}</b>', f'text;html=1;align=left;verticalAlign=middle;fontFamily={FONT};fontSize=30;', 40, 10, 1500, 50)
        self.svg.append(f'<text x="40" y="40" font-size="30" font-weight="bold">{escape(text)}</text>')

    def mxgraph(self, page_h):
        return ('<mxGraphModel dx="1600" dy="1000" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
                f'fold="1" page="1" pageScale="1" pageWidth="{self.w}" pageHeight="{page_h}" math="0" shadow="0"><root>'
                '<mxCell id="0"/><mxCell id="1" parent="0"/>' + ''.join(self.cells) + '</root></mxGraphModel>')

    def svg_doc(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" '
                f'font-family="{FONT}, Times, serif"><rect width="100%" height="100%" fill="#fff"/>' + ''.join(self.svg) + '</svg>\n')


def build_dfd(spec):
    d = spec['d']
    c = Canvas(1600, 800)
    c.title(spec['title'])
    oy, cx = 70, 800
    c.box(spec['user'], cx - 210, oy + 20)                                          # Người dùng
    c.process(spec['process'], cx - 190, oy + 300)                                  # Khối xử lý
    c.box(spec.get('inp') or 'Thiết bị nhập', 20, oy + 320)                         # Thiết bị nhập
    c.box(spec.get('outp') or 'Thiết bị xuất', 1160, oy + 320)                      # Thiết bị xuất
    c.store('Bộ nhớ phụ', cx - 200, oy + 620)                                       # Bộ nhớ phụ
    c.arrow('south', cx - 70, oy + 112, 46, 190, 'D1', cx - 140, oy + 185, 'D1' in d)
    c.arrow('north', cx + 24, oy + 112, 46, 190, 'D6', cx + 80, oy + 185, 'D6' in d)
    c.arrow('east', 445, oy + 340, 168, 50, 'D2', 495, oy + 290, 'D2' in d)
    c.arrow('east', 990, oy + 340, 168, 50, 'D5', 1040, oy + 290, 'D5' in d)
    c.arrow('north', cx - 70, oy + 428, 46, 190, 'D3', cx - 140, oy + 505, 'D3' in d)
    c.arrow('south', cx + 24, oy + 428, 46, 190, 'D4', cx + 80, oy + 505, 'D4' in d)
    # Phần mô tả trong file draw.io: biểu mẫu, quy định, D1–D6, thuật toán
    head = f'<b>Biểu mẫu:</b> {spec["bm"] or NONE} &nbsp; <b>Quy định:</b> {spec["qd"] or NONE}<br><br>'
    lines = ''.join(f'<b>{k}:</b> {escape(d.get(k, NONE))}<br>' for k in ('D1', 'D2', 'D3', 'D4', 'D5', 'D6'))
    algo = '<br>'.join(escape(s) for s in algorithm(spec))
    c.drawio_text(f'{head}{lines}<br><b>Thuật toán:</b><br>{algo}', 40, oy + 740, 1520, 700)
    return c


# ---------------------------------------------------------------------------
# SƠ ĐỒ PHỐI HỢP GIỮA CÁC CÔNG VIỆC
# Công việc trước tạo ra thông tin (lưu ở bộ nhớ phụ) để công việc sau sử dụng.
# ---------------------------------------------------------------------------
EW, EH = 250, 100
PHOI_HOP_NODES = {  # khóa: (tâm x, tâm y, tên) – lưới 3 cột x = 175 / 575 / 975, luồng đi từ trên xuống
    'YC1': (175, 170, 'YC1 – Đồng bộ requirement'),
    'YC8': (575, 170, 'YC8 – Nhận thay đổi requirement'),
    'YC15': (975, 170, 'YC15 – Phân tích ảnh hưởng'),
    'YC2': (175, 350, 'YC2 – Sinh test case bằng AI'),
    'YC3': (575, 350, 'YC3 – Soạn thảo, xem lại test'),
    'YC16': (975, 350, 'YC16 – Rà soát đề xuất AI'),
    'YC13': (175, 530, 'YC13 – Quản lý Test Suite'),
    'YC4': (575, 530, 'YC4 – Duyệt test case'),
    'YC17': (975, 530, 'YC17 – Bộ regression'),
    'YC14': (175, 710, 'YC14 – Lập Test Run'),
    'YC5': (575, 710, 'YC5 – Ghi nhận kết quả'),
    'YC18': (975, 710, 'YC18 – Báo sửa lỗi'),
    'YC6': (175, 890, 'YC6 – Lập báo cáo'),
    'YC7': (575, 890, 'YC7 – Tra cứu test case'),
    'YC9': (975, 890, 'YC9 – Xuất test case'),
    'YC12': (175, 1110, 'YC12 – Đồng bộ dự án từ Jira'),
    'YC11': (575, 1110, 'YC11 – Quản lý người dùng'),
    'YC10': (975, 1110, 'YC10 – Thay đổi quy định'),
}
PHOI_HOP_EDGES = [  # (nguồn, đích, thông tin chuyển giao, dịch song song để hai chiều không chồng nhau)
    ('YC1', 'YC2', 'requirement, AC', 0),
    ('YC8', 'YC3', 'test bị gắn cờ Cần xem lại', 0),
    ('YC8', 'YC15', 'phiên bản requirement mới', 0),
    ('YC15', 'YC16', 'đề xuất AI', 0),
    ('YC16', 'YC3', 'test nháp từ đề xuất', 0),
    ('YC16', 'YC17', 'test Nên chạy lại', 0),
    ('YC2', 'YC3', 'test case Nháp', 0),
    ('YC3', 'YC4', 'test Chờ duyệt', -45),
    ('YC4', 'YC3', 'test Bị trả lại + ghi chú', -45),
    ('YC4', 'YC14', 'test Đã duyệt', 0),
    ('YC13', 'YC14', 'Test Suite', 0),
    ('YC17', 'YC14', 'bộ regression đã xác nhận', 0),
    ('YC14', 'YC5', 'test trong đợt, người được giao', 0),
    ('YC5', 'YC18', 'lần chạy Fail', -45),
    ('YC18', 'YC5', 'phiếu chờ kiểm thử lại', -45),
    ('YC5', 'YC6', 'kết quả chạy', 0),
    ('YC5', 'YC7', 'kết quả gần nhất', 0),
    ('YC7', 'YC9', 'danh sách đang lọc', 0),
]


def ellipse_point(cx, cy, tx, ty, shift):
    """Giao điểm của tia (cx,cy)→(tx,ty) với elip, dịch vuông góc một đoạn shift."""
    ang = math.atan2(ty - cy, tx - cx)
    nx, ny = -math.sin(ang), math.cos(ang)
    cx2, cy2 = cx + nx * shift, cy + ny * shift
    a, b = EW / 2, EH / 2
    dx, dy = math.cos(ang), math.sin(ang)
    # tìm t sao cho ((cx2-cx+t dx)/a)^2 + ((cy2-cy+t dy)/b)^2 = 1
    ox, oy = cx2 - cx, cy2 - cy
    A = (dx / a) ** 2 + (dy / b) ** 2
    B = 2 * (ox * dx / a ** 2 + oy * dy / b ** 2)
    C = (ox / a) ** 2 + (oy / b) ** 2 - 1
    t = (-B + math.sqrt(B * B - 4 * A * C)) / (2 * A)
    return cx2 + t * dx, cy2 + t * dy


def build_phoi_hop():
    c = Canvas(1150, 1190)
    c.title('Sơ đồ phối hợp giữa các công việc')
    c.frame('Mọi công việc đọc tài khoản (YC11), dự án, module (YC12), tham số quy định (YC10) từ bộ nhớ phụ', 30, 70, 1090, 935)
    ids, rect = {}, {}
    for k, (x, y, name) in PHOI_HOP_NODES.items():
        ids[k] = c.process(name, x - EW / 2, y - EH / 2, EW, EH, size=19)
        rect[k] = (x - EW / 2, y - EH / 2, EW, EH)
    for s, t, label, shift, *lt in PHOI_HOP_EDGES:
        (sx, sy, _), (tx, ty, _) = PHOI_HOP_NODES[s], PHOI_HOP_NODES[t]
        p1 = ellipse_point(sx, sy, tx, ty, shift)
        p2 = ellipse_point(tx, ty, sx, sy, -shift)
        # mũi tên nằm ngang, ngắn: đặt nhãn phía trên đường để không che đầu mũi tên
        flat = shift == 0 and abs(ty - sy) < 0.3 * abs(tx - sx)
        above = -(len(wrap(label, 18)) * 19 + 4) / 2 - 6
        c.edge(ids[s], ids[t], label, p1, p2, rect[s], rect[t], label_shift=above if flat else shift, label_t=lt[0] if lt else 0.3 if shift else 0.5)
    # YC10, YC11, YC12 cung cấp dữ liệu nền cho mọi công việc (mũi tên nét đứt lên khung)
    fid = f'c{3}'  # id của khung (được tạo ngay sau tiêu đề)
    frame = (30, 70, 1090, 935)
    for k, label in (('YC12', 'dự án, module, thành viên'), ('YC11', 'tài khoản, vai trò'), ('YC10', 'tham số quy định')):
        x, y, _ = PHOI_HOP_NODES[k]
        c.edge(ids[k], fid, label, (x, y - EH / 2), (x, 1005), rect[k], frame, dashed=True)
    return c


# ---------------------------------------------------------------------------
# MỤC 3.4 CỦA CHƯƠNG 3
# ---------------------------------------------------------------------------
INTRO = '''## 3.4. Sơ đồ luồng dữ liệu (DFD) cho từng yêu cầu

Các sơ đồ được vẽ bằng phần mềm chuyên dụng **draw.io (diagrams.net)**. File gốc `.drawio` nằm trong thư mục `docs/dfd/` (mở bằng [app.diagrams.net](https://app.diagrams.net) hoặc draw.io Desktop để xem, sửa); hình trong báo cáo được sinh từ cùng một nguồn bằng lệnh `python3 docs/dfd/generate_dfd.py`.

### 3.4.1. Ký hiệu và quy ước

| Ký hiệu | Ý nghĩa |
|---|---|
| Hình chữ nhật | Người dùng (tác nhân) hoặc thiết bị nhập / xuất |
| Hình elip | Khối xử lý – một công việc của phần mềm |
| Mũi tên khối | Luồng dữ liệu, ghi tên D1–D6. Luồng **không có** được vẽ **màu trắng** và mô tả là "Không có" |
| Hai đường kẻ ngang | Bộ nhớ phụ (cơ sở dữ liệu) |

| Luồng | Ý nghĩa |
|---|---|
| **D1** | Thông tin **người dùng nhập** vào khối xử lý |
| **D2** | Thông tin từ **thiết bị nhập khác** (không phải bàn phím, chuột): file, dịch vụ bên ngoài… |
| **D3** | Dữ liệu **đọc** từ bộ nhớ phụ |
| **D4** | Dữ liệu **ghi** xuống bộ nhớ phụ (thông tin nhập cần lưu + kết quả mới tạo ra hoặc thay đổi) |
| **D5** | Thông tin đưa ra **thiết bị xuất khác** (không phải màn hình): máy in, file, dịch vụ bên ngoài… |
| **D6** | Thông tin **trả về người dùng**, luôn có thông báo thành công hoặc thất bại |

**Lưu ý khi vẽ:**
- Tên luồng D là **thông tin**, không phải hành động.
- Mỗi khối xử lý có ít nhất một luồng vào và một luồng ra.
- Không có luồng trực tiếp giữa tác nhân với tác nhân, hay giữa tác nhân với bộ nhớ phụ: mọi dữ liệu đều đi qua khối xử lý.
- Người dùng không nhập những thông tin đã lưu hoặc tính được (VD: người tạo, ngày tạo, phiên bản, tỷ lệ pass do hệ thống tự lấy / tự tính).

**Ba bước thực hiện cho mỗi yêu cầu:** (1) vẽ sơ đồ luồng dữ liệu; (2) mô tả các luồng D1–D6 (luồng không có ghi "Không có"); (3) viết thuật toán xử lý theo khuôn *Nhận D1 → Kết nối CSDL → Đọc D3 → kiểm tra quy định → Lưu D4 → Xuất D5 → Xuất D6 → Đóng kết nối → Kết thúc*. Ở mỗi bước kiểm tra, nếu không thỏa quy định thì ghi thông báo lỗi vào D6 và nhảy tới bước Xuất D6.
'''


def markdown():
    parts = [INTRO]
    for i, spec in enumerate(DFDS, 2):
        d = spec['d']
        name = spec.get('svg', spec['file'])
        parts.append(f'### 3.4.{i}. {spec["title"]}\n\n'
                     f'![{spec["title"]}](dfd/{name}.svg)\n\n'
                     f'*Biểu mẫu:* {spec["bm"] or NONE} · *Quy định:* {spec["qd"] or NONE} · *File:* `docs/dfd/{spec["file"]}.drawio`\n\n'
                     '| Luồng | Mô tả |\n|---|---|\n'
                     + ''.join(f'| {k} | {d.get(k, NONE)} |\n' for k in ('D1', 'D2', 'D3', 'D4', 'D5', 'D6'))
                     + '\n**Thuật toán:**\n\n' + ''.join(f'- {s}\n' for s in algorithm(spec)) + '\n')
    n = len(DFDS) + 2
    parts.append(f'### 3.4.{n}. DFD phần mở rộng ngoài MVP\n\n'
                 'YC19 (sinh và chạy script Playwright) và YC20 (theo dõi sprint) không thuộc 18 yêu cầu MVP. Code vẫn giữ, ẩn bằng cờ '
                 '`SCRIPT_ENABLED`, `SPRINT_ENABLED` (mặc định tắt); DFD dưới đây để tham khảo khi bật lại (hướng phát triển).\n\n')
    for spec in DFDS_EXT:
        d = spec['d']
        parts.append(f'#### {spec["title"]}\n\n![{spec["title"]}](dfd/{spec["file"]}.svg)\n\n'
                     f'*Biểu mẫu:* {spec["bm"]} · *Quy định:* {spec["qd"]} · *File:* `docs/dfd/{spec["file"]}.drawio`\n\n'
                     '| Luồng | Mô tả |\n|---|---|\n' + ''.join(f'| {k} | {d.get(k, NONE)} |\n' for k in ('D1', 'D2', 'D3', 'D4', 'D5', 'D6'))
                     + '\n**Thuật toán:**\n\n' + ''.join(f'- {s}\n' for s in algorithm(spec)) + '\n')
    n += 1
    parts.append(f'### 3.4.{n}. Sơ đồ phối hợp giữa các công việc\n\n'
                 '![Sơ đồ phối hợp giữa các công việc](dfd/PhoiHop_CacCongViec.svg)\n\n'
                 '*File:* `docs/dfd/PhoiHop_CacCongViec.drawio`. Mỗi mũi tên là **thông tin** do công việc trước tạo ra '
                 '(ghi xuống bộ nhớ phụ ở D4) và công việc sau sử dụng (đọc lên ở D3).\n\n'
                 '| Công việc trước | Thông tin chuyển giao | Công việc sau |\n|---|---|---|\n'
                 + ''.join(f'| {PHOI_HOP_NODES[s][2]} | {lb} | {PHOI_HOP_NODES[t][2]} |\n' for s, t, lb, *_ in PHOI_HOP_EDGES)
                 + '| YC12 – Đồng bộ dự án từ Jira | dự án, module, thành viên | Mọi công việc |\n'
                 '| YC11 – Quản lý người dùng | tài khoản, vai trò | Mọi công việc |\n'
                 '| YC10 – Thay đổi quy định | tham số quy định | Mọi công việc |\n\n')
    return ''.join(parts)


def mxfile(pages):
    body = ''.join(f'<diagram id="p{i + 1}" name="{attr(t)}">{x}</diagram>' for i, (t, x) in enumerate(pages))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<mxfile host="generate_dfd.py" agent="SE104 AI TestCase Manager" version="24.0.0">{body}</mxfile>\n')


def main():
    files = {}
    for old in ('YC01_DongBoUserStory', 'YC08_NhanThayDoiUserStory', 'YC15_BaoDaSuaLoi'):  # tên file trước đặc tả chốt 16/11
        for ext in ('.drawio', '.svg'):
            (OUT / f'{old}{ext}').unlink(missing_ok=True)
    for spec in DFDS + DFDS_EXT:
        c = build_dfd(spec)
        (OUT / f'{spec.get("svg", spec["file"])}.svg').write_text(c.svg_doc(), encoding='utf-8')
        files.setdefault(spec['file'], []).append((spec['title'], c.mxgraph(1500)))
    for name, pages in files.items():
        (OUT / f'{name}.drawio').write_text(mxfile(pages), encoding='utf-8')
    ph = build_phoi_hop()
    (OUT / 'PhoiHop_CacCongViec.svg').write_text(ph.svg_doc(), encoding='utf-8')
    (OUT / 'PhoiHop_CacCongViec.drawio').write_text(mxfile([('Sơ đồ phối hợp', ph.mxgraph(1190))]), encoding='utf-8')

    text = CHAPTER.read_text(encoding='utf-8')
    block = f'<!-- DFD:BEGIN (sinh tự động bởi docs/dfd/generate_dfd.py, đừng sửa tay) -->\n{markdown()}<!-- DFD:END -->\n'
    if '<!-- DFD:BEGIN' in text:
        text = re.sub(r'<!-- DFD:BEGIN.*?<!-- DFD:END -->\n', lambda _: block, text, flags=re.S)
    else:  # lần đầu: thay mục 3.4 cũ
        text = re.sub(r'## 3\.4\. .*?(?=## 3\.5\. )', lambda _: block + '\n', text, flags=re.S)
    CHAPTER.write_text(text, encoding='utf-8')
    print(f'Đã tạo {len(files) + 1} file .drawio, {len(DFDS) + len(DFDS_EXT) + 1} hình SVG và cập nhật mục 3.4 trong {CHAPTER.name}')


if __name__ == '__main__':
    main()
