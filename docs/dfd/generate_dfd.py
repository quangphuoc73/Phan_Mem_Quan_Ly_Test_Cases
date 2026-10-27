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
    dict(file='YC01_LapUserStory', title='DFD YC1 – Lập user story', process='Lập user story',
         user='Tester', bm='BM1', qd='QĐ1',
         d={'D1': 'Mã user story, dự án, module, tiêu đề, mô tả, các acceptance criteria, độ ưu tiên.',
            'D3': 'Danh sách mã user story đã có; danh sách dự án, module; tham số MIN_AC_PER_STORY, PRIORITIES.',
            'D4': 'D1 + người tạo, ngày tạo.',
            'D6': 'Thông báo lưu thành công kèm user story vừa lập, hoặc thông báo lỗi vi phạm QĐ1.'},
         check=['Kiểm tra mã user story đúng dạng US-XXX và không trùng với mã đã có?',
                'Kiểm tra tiêu đề ≥ 5 ký tự, mô tả ≥ 10 ký tự?',
                'Kiểm tra độ ưu tiên thuộc danh sách PRIORITIES?',
                'Kiểm tra số acceptance criteria ≥ MIN_AC_PER_STORY?',
                'Kiểm tra module thuộc dự án đã chọn?']),
    dict(file='YC02_SinhTestCaseBangAI', title='DFD YC2 – Sinh test case bằng AI', process='Sinh test case bằng AI',
         user='Tester', inp='Dịch vụ LLM', outp='Dịch vụ LLM', bm='BM2', qd='QĐ2', d5_inline=True,
         d={'D1': 'Mã user story cần sinh test case.',
            'D2': 'Chuỗi JSON danh sách test case do LLM trả về.',
            'D3': 'Nội dung user story; tham số MAX_TC_PER_STORY, AI_MAX_RETRY, AI_TIMEOUT_SEC, AI_CALLS_PER_HOUR; '
                  'số lần gọi AI của người dùng trong 1 giờ; số test case hiện có của user story.',
            'D4': 'Các test case mới (nguồn AI, trạng thái Nháp, phiên bản 1); nhật ký AI (prompt đã che PII, model, '
                  'kết quả gốc, số lần thử, thời gian, cờ injection).',
            'D5': 'Prompt gửi LLM: vai trò QA, quy định QĐ2, nội dung user story ĐÃ CHE dữ liệu nhạy cảm (PII).',
            'D6': 'Thông báo thành công kèm danh sách test case Nháp, cảnh báo nếu có prompt injection; '
                  'hoặc thông báo lỗi (hết hạn mức, LLM lỗi, vượt số test case tối đa).'},
         check=['Kiểm tra số lần gọi AI trong 1 giờ < AI_CALLS_PER_HOUR?',
                'Tính số test case còn được sinh = MAX_TC_PER_STORY − số test case hiện có (không tính test case AI Nháp sẽ thay thế). Kiểm tra số này > 0?',
                'Che dữ liệu nhạy cảm (email, số điện thoại, khóa API…) và đánh dấu nếu phát hiện prompt injection.',
                'Ghép prompt và xuất D5 đến Dịch vụ LLM, chờ tối đa AI_TIMEOUT_SEC giây.',
                'Nhận D2 từ Dịch vụ LLM. Nếu D2 sai JSON schema thì quay lại bước trước, tối đa AI_MAX_RETRY lần; quá số lần vẫn sai?',
                'Xóa các test case AI còn Nháp của user story; cắt danh sách theo số test case còn được sinh.']),
    dict(file='YC03_SoanThaoGuiDuyet', title='DFD YC3 – Soạn thảo và gửi duyệt test case', process='Soạn thảo, gửi duyệt',
         user='Tester', bm='BM2', qd='QĐ2, QĐ3',
         d={'D1': 'Nội dung test case (BM2) cần thêm/sửa kèm ghi chú thay đổi; hoặc danh sách mã test case cần gửi duyệt.',
            'D3': 'Trạng thái, phiên bản hiện tại của test case; số test case của user story; tham số MAX_TC_PER_STORY.',
            'D4': 'Nội dung mới, phiên bản + 1, bản chụp phiên bản; hoặc trạng thái Chờ duyệt của các test case gửi duyệt.',
            'D6': 'Thông báo lưu / gửi duyệt thành công kèm test case sau khi lưu, hoặc thông báo lỗi vi phạm QĐ2, QĐ3.'},
         check=['Thêm mới: kiểm tra số test case của user story < MAX_TC_PER_STORY và có 1–15 bước?',
                'Sửa / gửi duyệt / xóa: kiểm tra trạng thái cho phép theo QĐ3 (Chờ duyệt thì không được sửa; chỉ Nháp, Bị trả lại mới được gửi duyệt)?',
                'Sửa test case Đã duyệt thì đưa trạng thái về Nháp; tính phiên bản mới = phiên bản hiện tại + 1.']),
    dict(file='YC04_DuyetTestCase', title='DFD YC4 – Duyệt test case', process='Duyệt test case',
         user='QA Lead', bm='BM3', qd='QĐ4',
         d={'D1': 'Mã test case, quyết định Duyệt / Trả lại, ghi chú (BM3).',
            'D3': 'Trạng thái hiện tại của test case; vai trò của người duyệt.',
            'D4': 'Trạng thái mới (Đã duyệt / Bị trả lại); phiếu duyệt (người duyệt, quyết định, ghi chú, ngày duyệt); nhật ký hoạt động.',
            'D6': 'Thông báo duyệt thành công kèm trạng thái mới, hoặc thông báo lỗi vi phạm QĐ4.'},
         check=['Kiểm tra người duyệt có vai trò QA Lead?',
                'Kiểm tra test case đang ở trạng thái Chờ duyệt?',
                'Nếu quyết định là Trả lại: kiểm tra có ghi chú?']),
    dict(file='YC05_GhiKetQuaChayTest', title='DFD YC5 – Ghi nhận kết quả chạy test', process='Ghi nhận kết quả',
         user='Tester', bm='BM4', qd='QĐ5',
         d={'D1': 'Mã test case, kết quả Pass / Fail / Blocked, ghi chú (mã bug).',
            'D3': 'Trạng thái của test case.',
            'D4': 'Kết quả chạy: kết quả, hình thức Thủ công, ghi chú, người chạy, thời điểm chạy.',
            'D6': 'Thông báo ghi nhận thành công, hoặc thông báo lỗi vi phạm QĐ5.'},
         check=['Kiểm tra test case ở trạng thái Đã duyệt?',
                'Nếu kết quả là Fail hoặc Blocked: kiểm tra có ghi chú?']),
    dict(file='YC06_LapBaoCao', title='DFD YC6 – Lập báo cáo kiểm thử', process='Lập báo cáo',
         user='Người dùng', bm='BM5', qd='QĐ5',
         d={'D1': 'Dự án cần xem báo cáo.',
            'D3': 'User story, test case, các lần chạy test, nhật ký AI của dự án.',
            'D6': 'Báo cáo BM5: tỷ lệ pass, độ bao phủ, tiến độ thực thi, kết quả theo module, xu hướng theo ngày, '
                  'thống kê AI, danh sách user story chưa được bao phủ (dạng bảng và biểu đồ).'},
         check=['Với mỗi test case: lấy kết quả của lần chạy GẦN NHẤT.',
                'Tính tỷ lệ pass = số test case Pass / số test case đã chạy.',
                'Tính độ bao phủ = số user story có ≥ 1 test case Đã duyệt / tổng số user story.',
                'Tính tiến độ thực thi = số test case đã chạy / số test case Đã duyệt.',
                'Nhóm kết quả theo module và theo ngày; thống kê số test case AI sinh, tỷ lệ phải sửa.']),
    dict(file='YC07_TraCuuTestCase', title='DFD YC7 – Tra cứu test case', process='Tra cứu test case',
         user='Người dùng', bm='BM6', qd='',
         d={'D1': 'Điều kiện tra cứu: từ khóa (mã / tiêu đề), dự án, trạng thái, độ ưu tiên, loại, nguồn.',
            'D3': 'Các test case thỏa điều kiện kèm user story, kết quả chạy gần nhất, có script hay không.',
            'D6': 'Danh sách test case thỏa điều kiện (BM6), hoặc thông báo không tìm thấy.'},
         check=['Ghép điều kiện D1 thành câu truy vấn có tham số (không nối chuỗi SQL) trước khi đọc D3.']),
    dict(file='YC08_NhapXuatDuLieu', svg='YC08a_NhapUserStory', title='DFD YC8a – Nhập user story từ file',
         process='Nhập user story từ file', user='Tester', inp='File CSV / JSON', bm='BM7', qd='QĐ1, QĐ8', d2_first=True,
         d={'D1': 'Dự án nhận dữ liệu; lệnh chọn file.',
            'D2': 'Các dòng user story trong file (BM7).',
            'D3': 'Danh sách mã user story đã có; module của dự án; tham số MIN_AC_PER_STORY, PRIORITIES.',
            'D4': 'Các user story hợp lệ.',
            'D6': 'Thông báo số dòng nhập thành công và danh sách dòng lỗi kèm lý do.'},
         check=['Kiểm tra số dòng trong D2 ≤ 200?',
                'Với từng dòng: kiểm tra theo QĐ1 như YC1; dòng lỗi được ghi lại số dòng và lý do, không làm hỏng các dòng hợp lệ.']),
    dict(file='YC08_NhapXuatDuLieu', svg='YC08b_XuatTestCase', title='DFD YC8b – Xuất test case ra Excel',
         process='Xuất test case ra Excel', user='Người dùng', outp='File Excel (.xlsx)', bm='BM8', qd='',
         d={'D1': 'Điều kiện lọc như YC7.',
            'D3': 'Các test case thỏa điều kiện kèm kết quả chạy gần nhất.',
            'D5': 'File Excel: mỗi test case một dòng theo các cột của BM2 và kết quả gần nhất (BM8).',
            'D6': 'Thông báo xuất file thành công (trình duyệt tải file về).'},
         check=['Ghi từng test case thành một dòng Excel; các bước, acceptance criteria xuống dòng trong ô.']),
    dict(file='YC09_SinhVaChayScript', title='DFD YC9 – Sinh và chạy script kiểm thử tự động', process='Sinh và chạy script',
         user='Tester', inp='Dịch vụ LLM, Playwright Worker', outp='Dịch vụ LLM, Playwright Worker',
         bm='BM9', qd='QĐ9', d5_inline=True,
         d={'D1': 'Mã test case; yêu cầu sinh script hoặc chạy script; mã script đã sửa (nếu Tester sửa tay).',
            'D2': 'Từ LLM: mã script Playwright. Từ Playwright Worker: báo cáo chạy (JSON), log, ảnh chụp lỗi.',
            'D3': 'Test case Đã duyệt, URL ứng dụng của dự án, script đang lưu; tham số RUN_TIMEOUT_SEC, AI_MAX_RETRY.',
            'D4': 'Script (mã nguồn, người tạo, ngày); kết quả chạy hình thức Tự động (kết quả, thời gian, log, ảnh lỗi); nhật ký AI.',
            'D5': 'Đến LLM: prompt đã che PII. Đến Playwright Worker: script đã qua kiểm tra tĩnh.',
            'D6': 'Thông báo thành công kèm mã script, kết quả Pass / Fail, log, ảnh chụp lỗi; hoặc thông báo lỗi vi phạm QĐ9.'},
         check=['Kiểm tra test case ở trạng thái Đã duyệt?',
                'Sinh script: xuất D5 (prompt) đến Dịch vụ LLM, nhận D2 (mã script).',
                'Kiểm tra tĩnh script: không dùng module nguy hiểm, không truy cập process.env, không eval / new Function?',
                'Chạy script: xuất D5 (script) đến Playwright Worker, chờ tối đa RUN_TIMEOUT_SEC giây, nhận D2 (báo cáo, ảnh lỗi).',
                'Xác định kết quả Pass / Fail từ báo cáo.']),
    dict(file='YC10_ThayDoiQuyDinh', title='DFD YC10 – Thay đổi quy định', process='Thay đổi quy định',
         user='Admin / QA Lead', bm='', qd='QĐ10',
         d={'D1': 'Tham số cần thay đổi, giá trị mới.',
            'D3': 'Giá trị hiện tại, kiểu dữ liệu, miền giá trị cho phép của tham số; vai trò người sửa.',
            'D4': 'Giá trị mới, người sửa, thời điểm sửa; nhật ký hoạt động.',
            'D6': 'Thông báo thay đổi thành công (giá trị cũ → mới), hoặc thông báo giá trị ngoài miền cho phép.'},
         check=['Kiểm tra người sửa có vai trò Admin hoặc QA Lead?',
                'Kiểm tra giá trị mới đúng kiểu và thuộc miền giá trị cho phép (QĐ10)?']),
    dict(file='YC11_QuanLyNguoiDungDuAn', title='DFD YC11 – Quản lý người dùng, dự án', process='Quản lý người dùng, dự án',
         user='Admin', bm='', qd='QĐ11',
         d={'D1': 'Thông tin tài khoản (tên đăng nhập, họ tên, vai trò, mật khẩu, khóa/mở); hoặc thông tin dự án, module.',
            'D3': 'Danh sách tài khoản, dự án, module hiện có.',
            'D4': 'Tài khoản (mật khẩu ĐÃ BĂM bcrypt), dự án, module; nhật ký hoạt động.',
            'D6': 'Thông báo lưu thành công (không bao giờ chứa mật khẩu băm), hoặc thông báo lỗi vi phạm QĐ11.'},
         check=['Kiểm tra người thực hiện có vai trò Admin?',
                'Kiểm tra tên đăng nhập 3–30 ký tự a-z 0-9 _ . và không trùng; mật khẩu ≥ 8 ký tự?',
                'Kiểm tra Admin không tự khóa hoặc tự hạ quyền chính mình?',
                'Băm mật khẩu bằng bcrypt.']),
    dict(file='YC12_QuanLySprint', title='DFD YC12 – Quản lý sprint (Agile/Scrum)', process='Quản lý sprint',
         user='QA Lead', bm='BM10', qd='QĐ12',
         d={'D1': 'Tên, mục tiêu, ngày bắt đầu, ngày kết thúc sprint (BM10); user story đưa vào sprint và story point.',
            'D3': 'Các sprint hiện có của dự án; tham số SPRINT_MAX_DAYS; user story, test case Đã duyệt và kết quả chạy gần nhất.',
            'D4': 'Sprint mới / đã sửa; sprint_id, story_points của user story.',
            'D6': 'Thông báo lưu thành công kèm bảng sprint, burndown, velocity; hoặc thông báo lỗi vi phạm QĐ12.'},
         check=['Kiểm tra số ngày của sprint ≤ SPRINT_MAX_DAYS và ngày kết thúc không trước ngày bắt đầu?',
                'Kiểm tra sprint không trùng thời gian với sprint khác của dự án?',
                'Kiểm tra user story cùng dự án và story point thuộc dãy 1, 2, 3, 5, 8, 13?',
                'Xác định story đạt DoD: có ≥ 1 test case Đã duyệt và mọi test case Đã duyệt có lần chạy gần nhất là Pass.',
                'Tính velocity = tổng story point của story đạt DoD; burndown: còn lại(ngày) = tổng story point − story point đã đạt DoD đến ngày đó.']),
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

    def edge(self, src, dst, label, p1, p2, s1, s2, dashed=False, label_shift=0):
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
        mx, my = (x1 + x2) / 2 - label_shift * math.sin(ang), (y1 + y2) / 2 + label_shift * math.cos(ang)
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
PHOI_HOP_NODES = {  # khóa: (tâm x, tâm y, tên)
    'YC1': (175, 300, 'YC1 – Lập user story'),
    'YC8a': (175, 600, 'YC8a – Nhập user story từ file'),
    'YC12': (520, 150, 'YC12 – Quản lý sprint'),
    'YC2': (520, 450, 'YC2 – Sinh test case bằng AI'),
    'YC3': (900, 450, 'YC3 – Soạn thảo, gửi duyệt'),
    'YC4': (1280, 450, 'YC4 – Duyệt test case'),
    'YC5': (1660, 270, 'YC5 – Ghi nhận kết quả'),
    'YC9': (1660, 630, 'YC9 – Sinh và chạy script'),
    'YC7': (2070, 150, 'YC7 – Tra cứu test case'),
    'YC6': (2070, 450, 'YC6 – Lập báo cáo'),
    'YC8b': (2070, 680, 'YC8b – Xuất test case ra Excel'),
    'YC11': (760, 860, 'YC11 – Quản lý người dùng, dự án'),
    'YC10': (1480, 860, 'YC10 – Thay đổi quy định'),
}
PHOI_HOP_EDGES = [  # (nguồn, đích, thông tin chuyển giao, dịch song song để hai chiều không chồng nhau)
    ('YC1', 'YC2', 'user story', 0),
    ('YC8a', 'YC2', 'user story', 0),
    ('YC1', 'YC12', 'user story, story point', 0),
    ('YC2', 'YC3', 'test case Nháp', 0),
    ('YC3', 'YC4', 'test case Chờ duyệt', -20),
    ('YC4', 'YC3', 'test case Bị trả lại + ghi chú', -20),
    ('YC4', 'YC5', 'test case Đã duyệt', 0),
    ('YC4', 'YC9', 'test case Đã duyệt', 0),
    ('YC5', 'YC12', 'kết quả chạy gần nhất (xét DoD)', 0),
    ('YC5', 'YC7', 'kết quả gần nhất', 0),
    ('YC5', 'YC6', 'kết quả chạy thủ công', 0),
    ('YC9', 'YC6', 'kết quả chạy tự động', 0),
    ('YC9', 'YC8b', 'kết quả gần nhất', 0),
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
    c = Canvas(2240, 960)
    c.title('Sơ đồ phối hợp giữa các công việc')
    c.frame('Mọi công việc đọc tài khoản, dự án (YC11) và tham số quy định (YC10) từ bộ nhớ phụ', 30, 70, 2180, 690)
    ids, rect = {}, {}
    for k, (x, y, name) in PHOI_HOP_NODES.items():
        ids[k] = c.process(name, x - EW / 2, y - EH / 2, EW, EH, size=19)
        rect[k] = (x - EW / 2, y - EH / 2, EW, EH)
    for s, t, label, shift in PHOI_HOP_EDGES:
        (sx, sy, _), (tx, ty, _) = PHOI_HOP_NODES[s], PHOI_HOP_NODES[t]
        p1 = ellipse_point(sx, sy, tx, ty, shift)
        p2 = ellipse_point(tx, ty, sx, sy, -shift)
        # mũi tên nằm ngang, ngắn: đặt nhãn phía trên đường để không che đầu mũi tên
        flat = shift == 0 and abs(ty - sy) < 0.3 * abs(tx - sx)
        c.edge(ids[s], ids[t], label, p1, p2, rect[s], rect[t], label_shift=-20 if flat else shift * 1.6)
    # YC10, YC11 cung cấp dữ liệu nền cho mọi công việc (mũi tên nét đứt lên khung)
    fid = f'c{3}'  # id của khung (được tạo ngay sau tiêu đề)
    frame = (30, 70, 2180, 690)
    for k, label in (('YC11', 'tài khoản, vai trò, dự án, module'), ('YC10', 'tham số quy định QĐ1–QĐ12')):
        x, y, _ = PHOI_HOP_NODES[k]
        c.edge(ids[k], fid, label, (x, y - EH / 2), (x, 760), rect[k], frame, dashed=True)
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
    parts.append(f'### 3.4.{n}. Sơ đồ phối hợp giữa các công việc\n\n'
                 '![Sơ đồ phối hợp giữa các công việc](dfd/PhoiHop_CacCongViec.svg)\n\n'
                 '*File:* `docs/dfd/PhoiHop_CacCongViec.drawio`. Mỗi mũi tên là **thông tin** do công việc trước tạo ra '
                 '(ghi xuống bộ nhớ phụ ở D4) và công việc sau sử dụng (đọc lên ở D3).\n\n'
                 '| Công việc trước | Thông tin chuyển giao | Công việc sau |\n|---|---|---|\n'
                 + ''.join(f'| {PHOI_HOP_NODES[s][2]} | {lb} | {PHOI_HOP_NODES[t][2]} |\n' for s, t, lb, _ in PHOI_HOP_EDGES)
                 + '| YC9 – Sinh và chạy script | kết quả chạy tự động gần nhất (xét DoD) | YC12 – Quản lý sprint |\n'
                 '| YC11 – Quản lý người dùng, dự án | tài khoản, vai trò, dự án, module | Mọi công việc |\n'
                 '| YC10 – Thay đổi quy định | tham số quy định QĐ1–QĐ12 | Mọi công việc |\n\n')
    return ''.join(parts)


def mxfile(pages):
    body = ''.join(f'<diagram id="p{i + 1}" name="{attr(t)}">{x}</diagram>' for i, (t, x) in enumerate(pages))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<mxfile host="generate_dfd.py" agent="SE104 AI TestCase Manager" version="24.0.0">{body}</mxfile>\n')


def main():
    files = {}
    for spec in DFDS:
        c = build_dfd(spec)
        (OUT / f'{spec.get("svg", spec["file"])}.svg').write_text(c.svg_doc(), encoding='utf-8')
        files.setdefault(spec['file'], []).append((spec['title'], c.mxgraph(1500)))
    for name, pages in files.items():
        (OUT / f'{name}.drawio').write_text(mxfile(pages), encoding='utf-8')
    ph = build_phoi_hop()
    (OUT / 'PhoiHop_CacCongViec.svg').write_text(ph.svg_doc(), encoding='utf-8')
    (OUT / 'PhoiHop_CacCongViec.drawio').write_text(mxfile([('Sơ đồ phối hợp', ph.mxgraph(960))]), encoding='utf-8')

    text = CHAPTER.read_text(encoding='utf-8')
    block = f'<!-- DFD:BEGIN (sinh tự động bởi docs/dfd/generate_dfd.py, đừng sửa tay) -->\n{markdown()}<!-- DFD:END -->\n'
    if '<!-- DFD:BEGIN' in text:
        text = re.sub(r'<!-- DFD:BEGIN.*?<!-- DFD:END -->\n', lambda _: block, text, flags=re.S)
    else:  # lần đầu: thay mục 3.4 cũ
        text = re.sub(r'## 3\.4\. .*?(?=## 3\.5\. )', lambda _: block + '\n', text, flags=re.S)
    CHAPTER.write_text(text, encoding='utf-8')
    print(f'Đã tạo {len(files) + 1} file .drawio, {len(DFDS) + 1} hình SVG và cập nhật mục 3.4 trong {CHAPTER.name}')


if __name__ == '__main__':
    main()
