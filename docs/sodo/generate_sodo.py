#!/usr/bin/env python3
"""
Sinh các sơ đồ mô hình của đồ án bằng draw.io (thay cho Mermaid), mỗi sơ đồ 2 file trong docs/sodo/:
  <tên>.drawio  mở bằng draw.io (app.diagrams.net / draw.io Desktop) để xem, sửa
  <tên>.svg     hình chèn vào báo cáo

Chạy:  python3 docs/sodo/generate_sodo.py
Sửa nội dung: sửa hàm vẽ tương ứng bên dưới rồi chạy lại.
"""
from lib import Board, save
from seq import sequence

DIAGRAMS = []


def diagram(name, page):
    def wrap(fn):
        DIAGRAMS.append((name, page, fn))
        return fn
    return wrap


# =====================================================================================
# CHƯƠNG 0 – TỔNG QUAN, QUY TRÌNH AGILE
# =====================================================================================
@diagram('QuyTrinhThucHien', 'Quy trình thực hiện đồ án')
def quy_trinh_thuc_hien():
    b = Board(1200, 800)
    b.title('Quy trình thực hiện đồ án: Scrum, 5 sprint × 1 tuần', size=26)
    s = b.rect(['Đầu Sprint 1', 'Khảo sát hiện trạng · Product Backlog', 'kiến trúc sơ bộ · CI'], 300, 70, 600, 100, 'user', size=20, bold_first=True)
    f = b.frame('Mỗi sprint 1 tuần (Sprint 1 → 5): đủ 6 hoạt động của môn học', 30, 220, 1140, 400, 'gray', size=20)
    steps = [('Xác định yêu cầu', 'YC, BM, QĐ'), ('Phân tích', 'use case, DFD'), ('Thiết kế', 'CSDL, API, tuần tự'),
             ('Cài đặt', 'code + review (PR)'), ('Kiểm chứng', 'unit, API, E2E'), ('Triển khai', 'demo, Docker image')]
    ids = []
    for i, (t, d) in enumerate(steps):
        r, c = divmod(i, 3)
        x = 80 + c * 370 if r == 0 else 80 + (2 - c) * 370
        ids.append(b.rect([t, d], x, 280 + r * 170, 300, 100, 'proc', size=20, bold_first=True))
    L = b.link
    L([b.mid(ids[0], 'right'), b.mid(ids[1], 'left')]); L([b.mid(ids[1], 'right'), b.mid(ids[2], 'left')])
    L([b.mid(ids[2], 'bottom'), b.mid(ids[3], 'top')])
    L([b.mid(ids[3], 'left'), b.mid(ids[4], 'right')]); L([b.mid(ids[4], 'left'), b.mid(ids[5], 'right')])
    L([b.mid(ids[5], 'top'), b.mid(ids[0], 'bottom')], label='Sprint Review: góp ý\n→ Product Backlog', lpos=(230, 415), size=18)
    e = b.rect(['Cuối tuần 5', 'Bảo vệ đồ án (Sprint Review cuối cùng)'], 300, 680, 600, 90, 'done', size=20, bold_first=True)
    L([b.mid(s, 'bottom'), (600, 220)])
    L([(600, 620), b.mid(e, 'top')])
    return b


@diagram('KhungScrum', 'Khung làm việc Scrum')
def khung_scrum():
    b = Board(1200, 900)
    b.title('Khung làm việc Scrum của nhóm', size=26)
    W, H = 420, 120
    pb = b.rect(['Product Backlog', 'user story sắp theo ưu tiên', '(MoSCoW, story point)'], 60, 80, W, H, 'user', size=20, bold_first=True)
    sp = b.rect(['Sprint Planning', 'chọn story theo velocity,', 'chốt Sprint Goal'], 720, 80, W, H, 'proc', size=20, bold_first=True)
    sb = b.rect(['Sprint Backlog', 'story + task,', 'mỗi story 1 người phụ trách'], 720, 280, W, H, 'user', size=20, bold_first=True)
    s = b.rect(['Sprint 1 tuần', 'yêu cầu → phân tích → thiết kế', '→ cài đặt → kiểm chứng', 'Daily Scrum 15 phút mỗi tối'], 720, 480, W, 150, 'ai', size=20, bold_first=True)
    inc = b.rect(['Increment', 'phần mềm chạy được,', 'đạt Definition of Done'], 720, 710, W, H, 'done', size=20, bold_first=True)
    rv = b.rect(['Sprint Review', 'demo với giảng viên,', 'lấy góp ý'], 60, 710, W, H, 'proc', size=20, bold_first=True)
    rt = b.rect(['Retrospective', 'điều gì tốt, chưa tốt,', 'cải tiến gì sprint sau'], 60, 440, W, H, 'proc', size=20, bold_first=True)
    L = b.link
    L([b.mid(pb, 'right'), b.mid(sp, 'left')]); L([b.mid(sp, 'bottom'), b.mid(sb, 'top')]); L([b.mid(sb, 'bottom'), b.mid(s, 'top')])
    L([b.mid(s, 'bottom'), b.mid(inc, 'top')]); L([b.mid(inc, 'left'), b.mid(rv, 'right')]); L([b.mid(rv, 'top'), b.mid(rt, 'bottom')])
    L([b.mid(rt, 'top'), b.mid(pb, 'bottom')], label='cập nhật, sắp xếp lại', lpos=(270, 320), size=18)
    b.tag('Vai trò: Product Owner · Scrum Master · Developers (4 thành viên)', 600, 870, size=18, bg=False, italic=True)
    return b


@diagram('KeHoachSprint', 'Kế hoạch 5 sprint')
def ke_hoach_sprint():
    sprints = [
        ('Sprint 1 · 16 SP', 'Khởi động, đăng nhập, phân quyền,', 'đồng bộ requirement từ Jira'),
        ('Sprint 2 · 22 SP', 'AI sinh test gắn AC, soạn, duyệt', '(rủi ro cao, làm sớm)'),
        ('Sprint 3 · 21 SP', 'Test Suite, Test Run, ghi kết quả,', 'tra cứu, báo cáo'),
        ('Sprint 4 · 21 SP', 'Requirement đổi: gắn cờ, Cần kiểm tra,', 'AI phân tích ảnh hưởng, đề xuất'),
        ('Sprint 5 · 19 SP', 'Regression, kiểm thử lại, quy định,', 'xuất Excel, Docker, hoàn thiện'),
    ]
    days = ['26/10', '02/11', '09/11', '16/11', '23/11', '30/11']
    L, X0, DAY, ROW = 30, 470, 20, 92
    b = Board(1200, 130 + ROW * (len(sprints) + 1) + 40)
    b.title('Kế hoạch sprint đồ án (26/10 → 30/11/2026)', size=26)
    top = 80
    for i, d in enumerate(days):
        x = X0 + i * 7 * DAY
        b.tag(d, x, top + 20, size=18, bg=False, bold=True)
        b.link([(x, top + 42), (x, top + 50 + ROW * (len(sprints) + 1))], head='none', dashed=True, color='#BBBBBB', width=1)
    colors = ['user', 'ai', 'proc', 'ext', 'done']
    for i, (name, g1, g2) in enumerate(sprints):
        y = top + 56 + i * ROW
        b.rect([name, g1, g2], L, y, X0 - L - 20, ROW - 12, 'gray', size=18, bold_first=True, align='left', rounded=False)
        b.rect([name.split(' ·')[0]], X0 + i * 7 * DAY + 2, y + 14, 7 * DAY - 4, ROW - 40, colors[i], size=18, bold_first=True)
    y = top + 56 + len(sprints) * ROW
    b.rect(['Bảo vệ đồ án', 'Sprint Review cuối cùng', 'với giảng viên'], L, y, X0 - L - 20, ROW - 12, 'gray', size=18, bold_first=True, align='left', rounded=False)
    mx, my = X0 + 35 * DAY, y + (ROW - 12) / 2
    b.diamond('', mx - 18, my - 18, 36, 36)
    b.tag('30/11', mx - 60, my, size=18, bg=False, bold=True)
    return b


@diagram('BangCongViec', 'Bảng công việc của nhóm')
def bang_cong_viec():
    cols = [('Backlog', 'chưa chọn', 'gray'), ('To do', 'thuộc sprint này', 'user'), ('In progress', 'WIP ≤ 2 / người', 'ai'),
            ('Code review', 'Pull Request, 1 người duyệt', 'proc'), ('Testing', 'CI xanh + E2E', 'warn'), ('Done', 'đạt Definition of Done', 'done')]
    b = Board(1200, 400)
    b.title('Bảng công việc (Jira / Trello): luồng một thẻ task', size=26)
    ids = []
    for i, (t, d, k) in enumerate(cols):
        r, c = divmod(i, 3)
        x = 40 + c * 400 if r == 0 else 40 + (2 - c) * 400
        ids.append(b.rect([t, d], x, 80 + r * 170, 320, 100, k, size=20, bold_first=True))
    L = b.link
    L([b.mid(ids[0], 'right'), b.mid(ids[1], 'left')]); L([b.mid(ids[1], 'right'), b.mid(ids[2], 'left')])
    L([b.mid(ids[2], 'bottom'), b.mid(ids[3], 'top')])
    L([b.mid(ids[3], 'left'), b.mid(ids[4], 'right')]); L([b.mid(ids[4], 'left'), b.mid(ids[5], 'right')])
    return b


# =====================================================================================
# CHƯƠNG 1 – KHẢO SÁT
# =====================================================================================
@diagram('GiaiDoanYeuCau', 'Các bước xác định yêu cầu')
def giai_doan_yeu_cau():
    b = Board(1200, 340)
    b.title('Ba bước xác định yêu cầu (lặp lại cho tới khi ổn định)', size=26)
    a = b.rect(['Khảo sát hiện trạng', 'tổ chức, nghiệp vụ,', 'quy trình hiện tại'], 30, 80, 320, 120, 'user', size=20, bold_first=True)
    c = b.rect(['Lập danh sách', 'yêu cầu phần mềm', 'YC, BM, QĐ (Ch.2)'], 440, 80, 320, 120, 'proc', size=20, bold_first=True)
    d = b.rect(['Lập sơ đồ', 'luồng dữ liệu', 'DFD từng YC (Ch.3)'], 850, 80, 320, 120, 'proc', size=20, bold_first=True)
    L = b.link
    L([b.mid(a, 'right'), b.mid(c, 'left')]); L([b.mid(c, 'right'), b.mid(d, 'left')])
    L([b.mid(d, 'bottom'), (1010, 290), (650, 290), (650, 200)], dashed=True, label='bổ sung, điều chỉnh', lpos=(830, 290), size=18)
    L([(550, 200), (550, 260), (190, 260), b.mid(a, 'bottom')], dashed=True, label='bổ sung, điều chỉnh', lpos=(370, 260), size=18)
    return b


# =====================================================================================
# CHƯƠNG 3 – PHÂN TÍCH
# =====================================================================================
@diagram('HoatDong_QuyTrinhMoi', 'Sơ đồ hoạt động – quy trình kiểm thử mới')
def hoat_dong():
    b = Board(1280, 1500)
    b.title('Sơ đồ hoạt động – quy trình kiểm thử mới (chia làn theo vai trò)', size=26)
    widths = [230, 290, 270, 220, 230]
    b.lanes(['PO / BA (Jira)', 'Hệ thống', 'Tester', 'QA Lead', 'Developer'], 20, 60, widths, 1420)
    xs, x = [], 20
    for w in widths:
        xs.append(x + w / 2)
        x += w
    PO, HT, TE, QA, DV = xs
    F = 19

    def act(cx, cy, text, w, h=96, kind='proc'):
        return b.rect(text.split('\n'), cx - w / 2, cy - h / 2, w, h, kind, size=F)

    def dec(cx, cy, text, w=200, h=110):
        return b.diamond(text, cx - w / 2, cy - h / 2, w, h, size=F)

    st = b.dot(PO, 150)
    n1 = act(PO, 270, 'Viết requirement\nkèm mục Acceptance\ncriteria', 200, 110, 'jira')
    n2 = act(HT, 270, 'Đồng bộ một chiều;\nchỉ ghi bản Jira\nmới hơn', 260, 110)
    d1 = dec(HT, 420, 'Có AC?', 190, 100)
    n3 = act(PO, 420, 'Bổ sung AC', 200, 80, 'jira')
    n4 = act(TE, 420, 'Bấm Sinh test\ncase bằng AI', 240)
    n5 = act(HT, 570, 'AI sinh test Nháp,\nmỗi test gắn AC\n(che PII, schema)', 260, 110, 'ai')
    n6 = act(TE, 720, 'Xem lại, sửa,\ngắn AC, gửi duyệt', 240)
    d2 = dec(QA, 720, 'Duyệt:\nđạt?', 180)
    n7 = act(QA, 890, 'Lập Test Run:\nbuild, môi trường,\nphân công', 210, 110)
    n8 = act(TE, 890, 'Ghi kết quả\ntrong Test Run', 240)
    d3 = dec(TE, 1040, 'Fail?', 170, 100)
    n9 = act(DV, 1040, 'Sửa lỗi, báo\nđã sửa kèm build', 200, 110)
    n10 = act(QA, 1190, 'Lập đợt Kiểm thử\nlại hoặc chạy lại\ntrong đợt', 210, 110)
    n11 = act(HT, 1320, 'Báo cáo: tỷ lệ pass,\nbao phủ AC, tiến độ', 260, 96, 'done')
    en = b.dot(HT, 1420, final=True)

    L = b.link
    L([b.mid(st, 'bottom'), b.mid(n1, 'top')])
    L([b.mid(n1, 'right'), b.mid(n2, 'left')])
    L([b.mid(n2, 'bottom'), b.mid(d1, 'top')])
    L([b.mid(d1, 'left'), b.mid(n3, 'right')], label='Không', lpos=(PO + 128, 400), size=17)
    L([b.mid(n3, 'top'), b.mid(n1, 'bottom')])
    L([b.mid(d1, 'right'), b.mid(n4, 'left')], label='Có', lpos=(HT + 130, 400), size=17)
    L([b.mid(n4, 'bottom'), (TE, 570), b.mid(n5, 'right')])
    L([b.mid(n5, 'bottom'), (HT, 720), b.mid(n6, 'left')])
    L([b.mid(n6, 'right'), b.mid(d2, 'left')])
    L([b.mid(d2, 'top'), (QA, 630), (TE + 60, 630), (TE + 60, 672)], label='Trả lại + ghi chú', lpos=(QA - 120, 612), size=17)
    L([b.mid(d2, 'bottom'), b.mid(n7, 'top')], label='Duyệt', lpos=(QA + 40, 800), size=17)
    L([b.mid(n7, 'left'), b.mid(n8, 'right')])
    L([b.mid(n8, 'bottom'), b.mid(d3, 'top')])
    L([b.mid(d3, 'right'), b.mid(n9, 'left')], label='Có', lpos=(QA, 1024), size=17)
    L([b.mid(n9, 'bottom'), (DV, 1190), b.mid(n10, 'right')], label='Chờ kiểm\nthử lại', lpos=(DV + 60, 1130), size=17)
    L([b.mid(n10, 'top'), (QA, 1110), (TE + 150, 1110), (TE + 150, 938), (TE + 120, 938)], label='Chạy lại', lpos=(TE + 150, 1080), size=17)
    L([b.mid(d3, 'bottom'), (TE, 1320), b.mid(n11, 'right')], label='Không', lpos=(TE + 42, 1110), size=17)
    L([b.mid(n11, 'bottom'), b.mid(en, 'top')])
    return b


@diagram('HoatDong_ThayDoiRequirement', 'Sơ đồ hoạt động – khi requirement thay đổi trên Jira')
def hoat_dong_thay_doi():
    b = Board(1220, 1480)
    b.title('Sơ đồ hoạt động – khi requirement thay đổi trên Jira (YC8, YC15, YC16, YC17)', size=26)
    widths = [240, 320, 300, 320]
    b.lanes(['PO / BA (Jira)', 'Hệ thống', 'Tester', 'QA Lead'], 20, 60, widths, 1400)
    xs, x = [], 20
    for w in widths:
        xs.append(x + w / 2)
        x += w
    PO, HT, TE, QA = xs
    F = 19

    def act(cx, cy, text, w, h=96, kind='proc'):
        return b.rect(text.split('\n'), cx - w / 2, cy - h / 2, w, h, kind, size=F)

    st = b.dot(PO, 150)
    a1 = act(PO, 270, 'Sửa AC, tiêu đề\nhoặc mô tả\ntrên Jira', 210, 110, 'jira')
    a2 = act(HT, 270, 'Nhận webhook / đồng bộ;\nlấy issue qua API,\nbản mới hơn mới ghi', 290, 110)
    a3 = act(HT, 430, 'Tạo phiên bản mới;\ngắn cờ Cần xem lại\ncho test bị ảnh hưởng', 290, 110, 'warn')
    a4 = act(TE, 430, 'Bấm Phân tích\nảnh hưởng (AI)', 250)
    a5 = act(HT, 590, 'AI so phiên bản test đã\nliên kết với hiện tại:\nđề xuất kèm lý do', 290, 110, 'ai')
    d1 = b.diamond('Chấp nhận\nđề xuất?', QA - 105, 740 - 55, 210, 110, size=F)
    a6 = act(QA, 890, 'Từ chối\n(ghi chú)', 200, 80)
    a7 = act(HT, 740, 'Cần sửa / Còn thiếu:\nbản nháp; Nên chạy\nlại: vào bộ regression', 290, 110)
    a8 = act(TE, 890, 'Test vẫn đúng: Đã xem lại\n(lý do); cần sửa: sửa,\ngửi duyệt', 270, 110)
    a9 = act(QA, 1040, 'Duyệt bản sửa\n(YC4) → gỡ cờ', 230)
    a10 = act(QA, 1190, 'Lập bộ regression;\nbỏ test ghi lý do;\nxác nhận', 240, 110)
    a11 = act(HT, 1190, 'Kiểm tra điều kiện chạy;\ntạo Test Run Regression', 290)
    a12 = act(TE, 1330, 'Chạy regression,\nghi kết quả', 250, 90, 'done')
    f1 = b.dot(QA + 135, 890, final=True)
    en = b.dot(TE, 1430, final=True)

    L = b.link
    L([b.mid(st, 'bottom'), b.mid(a1, 'top')])
    L([b.mid(a1, 'right'), b.mid(a2, 'left')])
    L([b.mid(a2, 'bottom'), b.mid(a3, 'top')])
    L([b.mid(a3, 'right'), b.mid(a4, 'left')], dashed=True)
    L([b.mid(a4, 'bottom'), (TE, 590), b.mid(a5, 'right')])
    L([b.mid(a5, 'bottom'), (HT, 665), (QA, 665), b.mid(d1, 'top')], label='đề xuất (Chờ xử lý)', lpos=(TE, 648), size=16)
    L([b.mid(d1, 'left'), b.mid(a7, 'right')], label='Chấp nhận\n[phiên bản chưa đổi]', lpos=(TE, 715), size=16)
    L([b.mid(d1, 'bottom'), b.mid(a6, 'top')], label='Từ chối', lpos=(QA + 45, 820), size=16)
    L([b.mid(a6, 'right'), b.mid(f1, 'left')])
    L([b.mid(a7, 'bottom'), (HT, 890), b.mid(a8, 'left')], label='bản nháp', lpos=(HT + 60, 873), size=16)
    L([b.mid(a8, 'bottom'), (TE, 1040), b.mid(a9, 'left')], label='gửi duyệt', lpos=(TE + 150, 1024), size=16)
    L([b.mid(a9, 'bottom'), b.mid(a10, 'top')])
    L([b.mid(a10, 'left'), b.mid(a11, 'right')])
    L([b.mid(a11, 'bottom'), (HT, 1330), b.mid(a12, 'left')])
    L([b.mid(a12, 'bottom'), b.mid(en, 'top')])
    return b


def state(b, lines, x, y, w=240, h=74, kind='proc'):
    return b.rect(lines, x, y, w, h, kind, size=17, bold_first=True)


@diagram('TrangThai_TestCase', 'Sơ đồ trạng thái của test case')
def trang_thai_test_case():
    b = Board(1150, 900)
    b.title('Sơ đồ trạng thái của test case', size=26)
    W, H = 290, 90
    st = lambda lines, x, y, k: b.rect(lines, x, y, W, H, k, size=20, bold_first=True)
    init = b.dot(575, 90)
    draft = st(['Nháp', 'DRAFT'], 430, 140, 'proc')
    pend = st(['Chờ duyệt', 'PENDING_REVIEW'], 430, 380, 'warn')
    appr = st(['Đã duyệt', 'APPROVED'], 430, 600, 'done')
    ret = st(['Bị trả lại', 'RETURNED'], 830, 380, 'sec')
    f1 = b.dot(200, 170, final=True)
    f2 = b.dot(975, 620, final=True)
    L = b.link
    L([b.mid(init, 'bottom'), b.mid(draft, 'top')], label='AI sinh / thêm thủ công /\ntừ đề xuất Còn thiếu', lpos=(410, 100), size=17)
    L([(520, 230), (520, 380)], label='Gửi duyệt\n[≥ 1 AC]', lpos=(455, 300), size=17)
    L([(640, 470), (640, 600)], label='QA Lead duyệt\n(gỡ cờ)', lpos=(555, 535), size=17)
    L([(720, 405), (830, 405)], label='Trả lại\n(ghi chú)', lpos=(775, 345), size=17)
    L([(830, 450), (720, 450)], label='Gửi lại', lpos=(775, 475), size=17)
    L([(880, 380), (880, 200), (720, 200)], label='Sửa', lpos=(880, 290), size=17)
    L([b.mid(draft, 'left'), (214, 185)], label='Xóa [chưa\ncó lần chạy]', lpos=(320, 160), size=17)
    L([(975, 470), (975, 606)], label='Xóa [chưa\ncó lần chạy]', lpos=(1050, 540), size=17)
    L([b.mid(appr, 'left'), (330, 645), (330, 215), (430, 215)], label='Sửa / chấp nhận\nđề xuất Cần sửa\n(phải duyệt lại)', lpos=(330, 430), size=17)
    L([(720, 160), (780, 160), (780, 105), (680, 105), (680, 140)], label='Sửa (phiên bản +1)', lpos=(900, 95), size=17)
    L([(720, 620), (790, 620), (790, 675), (720, 675)], label='Đưa vào Test Run,\nghi kết quả', lpos=(880, 680), size=17)
    b.note(['Cờ Cần xem lại độc lập với trạng thái: gắn khi AC, tiêu đề hoặc mô tả đổi; gỡ khi Đã xem lại',
            'hoặc bản sửa được duyệt. Chỉ test Đã duyệt, không có cờ mới đưa vào Test Run (QĐ3, QĐ14).'], 100, 770, 950, 80, size=18)
    return b


@diagram('TrangThai_Requirement', 'Sơ đồ trạng thái của requirement đồng bộ từ Jira')
def trang_thai_requirement():
    b = Board(1250, 920)
    b.title('Sơ đồ trạng thái của requirement (đồng bộ một chiều từ Jira)', size=26)
    st = lambda lines, x, y, w, k: b.rect(lines, x, y, w, 96, k, size=20, bold_first=True)
    init = b.dot(575, 90)
    miss = st(['Thiếu AC', 'chưa sinh test bằng AI'], 60, 200, 350, 'warn')
    ok = st(['Bình thường', 'sinh, viết, chạy test được'], 700, 200, 370, 'done')
    chk = st(['Cần kiểm tra', 'Jira không tìm thấy / đổi loại'], 700, 470, 370, 'sec')
    keep = st(['Cần kiểm tra – đã chọn Giữ lại', 'cờ vẫn còn'], 700, 650, 370, 'warn')
    arch = st(['Đã lưu trữ', 'ẩn khỏi danh sách, giữ test'], 60, 470, 350, 'gray')
    L = b.link
    L([b.mid(init, 'bottom'), (575, 140)], head='none')
    L([(575, 140), (235, 140), (235, 200)], label='[không có AC]', lpos=(390, 140), size=17)
    L([(575, 140), (885, 140), (885, 200)], label='[có AC]', lpos=(760, 140), size=17)
    b.tag('Đồng bộ lần đầu', 680, 92, size=17, bg=False, italic=True)
    L([(410, 230), (700, 230)], label='PO/BA bổ sung AC', lpos=(555, 214), size=17)
    L([(700, 268), (410, 268)], label='AC bị xóa hết', lpos=(555, 284), size=17)
    L([(1000, 200), (1000, 168), (1060, 168), (1060, 200)])
    b.tag('Nội dung đổi: phiên bản mới, gắn cờ test', 960, 145, size=16, bg=False, italic=True)
    L([(800, 296), (800, 470)], label='Issue biến mất\n(404 / đổi loại)', lpos=(620, 383), size=16)
    L([(980, 470), (980, 296)], label='Đồng bộ lấy\nlại được issue', lpos=(1070, 383), size=16)
    L([(885, 566), (885, 650)], label='QA Lead / Admin\nchọn Giữ lại', lpos=(990, 608), size=16)
    L([(1070, 698), (1180, 698), (1180, 250), (1070, 250)], label='Đồng bộ lấy\nlại được issue', lpos=(1180, 560), size=16)
    L([(700, 518), (410, 518)], label='Chọn Lưu trữ', lpos=(555, 502), size=17)
    L([(700, 720), (235, 720), (235, 566)], label='Chọn Lưu trữ', lpos=(470, 704), size=17)
    L([(120, 470), (120, 296)], dashed=True, label='Xuất hiện\nlại trên Jira', lpos=(150, 383), size=17)
    b.note(['AI chỉ sinh test khi requirement không lưu trữ, không Cần kiểm tra và đủ MIN_AC_PER_STORY AC (QĐ2).',
            'Hệ thống không tự lưu trữ; Jira trả danh sách rỗng hoặc lỗi kết nối thì không gắn cờ (QĐ8).'], 60, 790, 1130, 80, size=18)
    return b


@diagram('TrangThai_TestRun', 'Sơ đồ trạng thái của Test Run')
def trang_thai_test_run():
    b = Board(1150, 600)
    b.title('Sơ đồ trạng thái của Test Run (đợt kiểm thử)', size=26)
    st = lambda lines, x, y, k: b.rect(lines, x, y, 310, 120, k, size=19, bold_first=True)
    init = b.dot(215, 95)
    s1 = st(['Đang mở – chưa có kết quả', 'sửa được build, môi trường;', 'thêm, bỏ test; phân công'], 60, 150, 'proc')
    s2 = st(['Đang mở – đã có kết quả', 'build, môi trường cố định;', 'chỉ bỏ test chưa có kết quả'], 420, 150, 'warn')
    s3 = st(['Đã đóng', 'không ghi thêm kết quả;', 'test chưa chạy tính chưa chạy'], 780, 150, 'gray')
    fin = b.dot(935, 360, final=True)
    L = b.link
    L([b.mid(init, 'bottom'), b.mid(s1, 'top')], label='Lập đợt', lpos=(150, 122), size=17)
    L([b.mid(s1, 'right'), b.mid(s2, 'left')], label='Ghi kết quả\nđầu tiên', lpos=(390, 125), size=17)
    L([b.mid(s2, 'right'), b.mid(s3, 'left')], label='Đóng đợt\n[xác nhận nếu\ncòn test chưa chạy]', lpos=(750, 110), size=16)
    L([b.mid(s1, 'bottom'), (215, 330), (840, 330), (840, 270)], label='Đóng đợt [xác nhận]', lpos=(520, 314), size=17)
    L([(575, 270), (575, 300), (635, 300), (635, 270)])
    b.tag('Ghi thêm kết quả', 690, 290, size=16, bg=False, italic=True, anchor='start')
    L([b.mid(s3, 'bottom'), b.mid(fin, 'top')], label=None)
    b.note(['Muốn chạy build hoặc môi trường khác thì lập đợt mới (D3). Requirement đổi, lưu trữ hoặc Cần kiểm tra',
            'khi đợt đang mở thì đợt vẫn chạy phiên bản test đã cố định và hiện cảnh báo (QĐ14).'], 60, 420, 1030, 80, size=18)
    return b


@diagram('TrangThai_DeXuat', 'Sơ đồ trạng thái của đề xuất AI')
def trang_thai_de_xuat():
    b = Board(1150, 600)
    b.title('Sơ đồ trạng thái của đề xuất AI (YC15, YC16)', size=26)
    st = lambda lines, x, y, w, k: b.rect(lines, x, y, w, 100, k, size=19, bold_first=True)
    init = b.dot(575, 90)
    p = st(['Chờ xử lý', 'PENDING'], 420, 140, 310, 'warn')
    a = st(['Đã chấp nhận', 'bản nháp / regression / ghi nhận'], 40, 360, 330, 'done')
    r = st(['Đã từ chối', 'bắt buộc ghi chú'], 420, 360, 310, 'sec')
    o = st(['Lỗi thời', 'không áp dụng được'], 780, 360, 330, 'gray')
    L = b.link
    L([b.mid(init, 'bottom'), b.mid(p, 'top')], label='AI phân tích ảnh hưởng', lpos=(720, 110), size=17)
    L([(470, 240), (470, 290), (205, 290), b.mid(a, 'top')], label='QA Lead chấp nhận [phiên bản chưa đổi]', lpos=(300, 272), size=16)
    L([b.mid(p, 'bottom'), b.mid(r, 'top')], label='QA Lead\ntừ chối', lpos=(625, 300), size=16)
    L([(680, 240), (680, 290), (945, 290), b.mid(o, 'top')], label='chấp nhận khi requirement\nhoặc test đã đổi', lpos=(850, 260), size=16)
    for box in (a, r, o):
        x = b.mid(box, 'bottom')[0]
        b.dot(x, 505, final=True)
        L([b.mid(box, 'bottom'), (x, 491)])
    b.tag('Cần sửa → test về Nháp · Còn thiếu → test nháp mới · Nên chạy lại → vào bộ regression · Cần làm rõ → ghi nhận',
          575, 560, size=16, bg=False, italic=True)
    return b


@diagram('TrangThai_KiemThuLai', 'Sơ đồ trạng thái kiểm thử lại')
def trang_thai_kiem_thu_lai():
    b = Board(1150, 640)
    b.title('Sơ đồ trạng thái kiểm thử lại sau khi báo sửa lỗi (YC18)', size=26)
    st = lambda lines, x, y, k: b.rect(lines, x, y, 300, 100, k, size=19, bold_first=True)
    init = b.dot(210, 95)
    f = st(['Lần chạy Fail', 'trong một Test Run'], 60, 150, 'sec')
    w = st(['Chờ kiểm thử lại', 'WAITING'], 430, 150, 'warn')
    c = st(['Đã đóng', 'CLOSED'], 800, 150, 'done')
    ro = st(['Mở lại', 'REOPENED'], 430, 380, 'sec')
    fin = b.dot(950, 330, final=True)
    L = b.link
    L([b.mid(init, 'bottom'), b.mid(f, 'top')])
    L([b.mid(f, 'right'), b.mid(w, 'left')], label='Developer báo\nđã sửa (build)', lpos=(395, 120), size=16)
    L([b.mid(w, 'right'), b.mid(c, 'left')], label='Chạy lại: Pass', lpos=(765, 222), size=16)
    L([b.mid(w, 'bottom'), b.mid(ro, 'top')], label='Chạy lại: Fail', lpos=(660, 315), size=16)
    L([(730, 175), (765, 175), (765, 120), (680, 120), (680, 150)])
    b.tag('Chạy lại: Blocked (vẫn chờ)', 720, 102, size=16, bg=False, italic=True)
    L([b.mid(ro, 'left'), (210, 430), b.mid(f, 'bottom')], label='lần Fail mới,\nbáo sửa lần nữa', lpos=(300, 410), size=16)
    L([b.mid(c, 'bottom'), b.mid(fin, 'top')])
    b.note(['Chạy lại ngay trong đợt chứa lần Fail khi đợt còn mở và trùng build đã sửa; ngược lại QA Lead lập đợt',
            'Kiểm thử lại với build đã sửa [R1]. Lần chạy lại lưu liên kết tới lần Fail gốc [3.1].'], 60, 520, 1030, 80, size=18)
    return b


# =====================================================================================
# CHƯƠNG 4 – THIẾT KẾ
# =====================================================================================
@diagram('KienTruc', 'Kiến trúc hệ thống')
def kien_truc():
    b = Board(1240, 1570)
    b.title('Kiến trúc hệ thống (client – server nhiều lớp)', size=26)
    F = 19
    D = 92  # khối service thêm một hàng
    b.frame('Frontend – trình duyệt', 30, 70, 860, 140, 'user', size=F)
    b.rect(['Ứng dụng một trang (HTML, CSS, JS, Chart.js)', 'Tổng quan · Requirement · Test case · Duyệt · Test Suite', 'Test Run · Đề xuất AI · Regression · Kiểm thử lại · Quản trị'],
           60, 105, 800, 92, 'user', size=F, bold_first=True)
    jira = b.rect(['«hệ thống ngoài»', 'Jira Cloud', 'REST API · webhook'], 930, 70, 290, 140, 'jira', size=F, bold_first=True)
    b.frame('Backend – Node.js + Express 5', 30, 250, 1190, 900 + D, 'gray', size=F)
    b.rect(['Middleware: helmet (CSP) · JSON ≤ 1 MB · JWT · RBAC (5 vai trò)', 'chặn đăng nhập sai · hạn mức AI/giờ · Zod · audit log'], 60, 290, 830, 84, 'sec', size=F)
    b.rect(['Route REST: /stories · /testcases · /suites · /runs', '/proposals · /regressions · /retests · /reports · /jira'], 60, 400, 830, 84, 'proc', size=F)
    wh = b.rect(['Route webhook', 'POST /api/jira/webhook', 'không JWT,', 'kiểm tra mã bí mật'], 910, 290, 280, 194, 'sec', size=F, bold_first=True)
    b.frame('Lớp service nghiệp vụ', 60, 520, 780, 330 + D, 'proc', size=F)
    names = [('StoryService', 'YC1, YC8'), ('TestCaseService', 'YC2, 3, 4, 7'), ('SuiteService', 'YC13'),
             ('RunService', 'YC5, YC14'), ('RetestService', 'YC18'), ('ImpactService', 'YC15, YC16'),
             ('RegressionService', 'YC17'), ('ReportService', 'YC6, YC9'), ('ParameterService', 'YC10'),
             ('AuditService', 'nhật ký'), ('SprintService', 'YC20 (mở rộng)'), ('ScriptService', 'YC19 (mở rộng)')]
    svc = {}
    for i, (n, d) in enumerate(names):
        r, c = divmod(i, 3)
        svc[n] = b.rect([n, d], 80 + c * 250, 560 + r * 92, 230, 76, 'gray' if 'mở rộng' in d else 'proc', size=F - 1, bold_first=True,
                        dashed='mở rộng' in d)
    b.frame('Tích hợp Jira (một chiều)', 870, 520, 320, 370 + D, 'jira', size=F)
    b.rect(['JiraService', 'YC1, YC8, YC12'], 890, 560, 280, 70, 'jira', size=F - 1, bold_first=True)
    b.rect(['Đồng bộ định kỳ', 'thử lại 2 lần · sync_logs'], 890, 640, 280, 70, 'jira', size=F - 1, bold_first=True)
    b.rect(['Tách Description', 'mô tả + AC (theo dòng)'], 890, 720, 280, 70, 'jira', size=F - 1, bold_first=True)
    b.rect(['Issue ID, chỉ ghi bản', 'mới hơn, phiên bản'], 890, 800, 280, 70, 'jira', size=F - 1, bold_first=True)
    b.rect(['Cờ Cần kiểm tra', 'hỏi lại theo issue ID'], 890, 880, 280, 70, 'jira', size=F - 1, bold_first=True)
    b.frame('AI Service (module riêng)', 60, 880 + D, 780, 220, 'ai', size=F)
    a1 = b.rect(['Che dữ liệu nhạy cảm', '(PII)'], 80, 920 + D, 340, 72, 'ai', size=F)
    a2 = b.rect(['Chống prompt injection,', 'ghép prompt (3 tác vụ)'], 470, 920 + D, 340, 72, 'ai', size=F)
    a3 = b.rect(['LLMProvider', '(Strategy)'], 470, 1012 + D, 340, 72, 'ai', size=F)
    a4 = b.rect(['Kiểm tra JSON schema,', 'thử lại'], 80, 1012 + D, 340, 72, 'ai', size=F)
    dal = b.rect(['Truy cập dữ liệu', 'better-sqlite3,', 'prepared statement'], 870, 930 + D + 40, 320, 110, 'data', size=F, bold_first=True)
    b.frame('Playwright Worker (mở rộng)', 30, 1250 + D, 310, 170, 'ext', size=F)
    pw = b.rect(['@playwright/test', 'Chrome, timeout,', 'env tối thiểu'], 50, 1290 + D, 270, 110, 'ext', size=F - 1, bold_first=True, dashed=True)
    aut = b.rect(['«hệ thống ngoài»', 'Web cần test'], 370, 1290 + D, 220, 110, 'ext', size=F, bold_first=True, dashed=True)
    llm = b.rect(['«hệ thống ngoài»', 'LLM API', 'Gemini · Claude · …'], 620, 1290 + D, 250, 110, 'ext', size=F, bold_first=True)
    b.cyl(['CSDL', 'SQLite / PostgreSQL', '27 bảng'], 900, 1260 + D, 290, 160)
    L = b.link
    L([(460, 197), (460, 290)], label='HTTPS + JWT', lpos=(560, 232), size=17)
    L([(460, 374), (460, 400)])
    L([(450, 484), (450, 520)])
    L([(860, 484), (860, 595), (890, 595)], label=None)
    L([b.mid(jira, 'bottom'), (1050, 290)], dashed=True, color='#0052CC', label='webhook', lpos=(1050, 250), size=17)
    L([b.mid(wh, 'bottom'), (1050, 520)])
    L([(1170, 595), (1205, 595), (1205, 210)], color='#0052CC')
    b.tag('REST', 1205, 420, size=16)
    L([(450, 850 + D), (450, 880 + D)])
    L([b.mid(a1, 'right'), b.mid(a2, 'left')]); L([b.mid(a2, 'bottom'), b.mid(a3, 'top')]); L([b.mid(a3, 'left'), b.mid(a4, 'right')])
    L([(840, 800), (855, 800), (855, 1025 + D), (870, 1025 + D)])
    L([(1030, 890 + D), (1030, 930 + D + 40)])
    L([b.mid(dal, 'bottom'), (1030, 1272 + D)])
    L([b.mid(a3, 'bottom'), (640, 1170 + D), (745, 1170 + D), b.mid(llm, 'top')], label='prompt đã che PII', lpos=(745, 1195 + D), size=16)
    sy = b.mid(svc['ScriptService'], 'left')[1]
    L([b.mid(svc['ScriptService'], 'left'), (45, sy), (45, 1232 + D), (180, 1232 + D), (180, 1290 + D)], dashed=True,
      label='script đã kiểm tra tĩnh', lpos=(160, 1208 + D), size=16)
    L([b.mid(pw, 'right'), b.mid(aut, 'left')], dashed=True)
    b.tag('Mỗi YC nằm trong một service; route chỉ kiểm tra quyền rồi gọi service. Không ghi ngược lên Jira. Khối nét đứt: ngoài MVP.',
          620, 1455 + D, size=16, bg=False, italic=True)
    return b


@diagram('TrienKhai', 'Sơ đồ triển khai')
def trien_khai():
    b = Board(1150, 1200)
    b.title('Sơ đồ triển khai (deployment)', size=26)
    F = 19
    user = b.rect(['Máy người dùng', 'Chrome / Edge / Firefox / Safari'], 380, 70, 390, 100, 'user', size=F, bold_first=True)
    rp = b.rect(['Reverse proxy', 'Nginx / Caddy, chứng chỉ HTTPS'], 380, 240, 390, 100, 'sec', size=F, bold_first=True)
    ci = b.rect(['GitHub Actions CI', 'test → build image'], 30, 240, 280, 100, 'gray', size=F, bold_first=True)
    ng = b.rect(['ngrok (tùy chọn)', 'địa chỉ công khai cho', 'webhook khi chạy trên', 'máy cá nhân'], 840, 220, 280, 140, 'warn', size=F - 1, bold_first=True, dashed=True)
    b.frame('Docker host (docker compose)', 200, 410, 750, 440, 'gray', size=F)
    app = b.rect(['Container app', 'Node.js · Express 5', 'Chromium (khi bật YC19)', 'CPU ≤ 2 · RAM ≤ 2 GB', 'no-new-privileges'], 240, 470, 380, 200, 'proc', size=F, bold_first=True)
    vol = b.cyl(['Volume app-data', 'CSDL app.db', 'ảnh chụp lỗi'], 680, 490, 230, 160)
    llm = b.rect(['«hệ thống ngoài»', 'LLM API', 'Gemini · Claude · OpenAI'], 40, 930, 320, 110, 'ext', size=F, bold_first=True)
    aut = b.rect(['«hệ thống ngoài»', 'Web cần test', '(mở rộng YC19)'], 410, 930, 320, 110, 'ext', size=F, bold_first=True, dashed=True)
    jira = b.rect(['«hệ thống ngoài»', 'Jira Cloud', 'REST API · webhook'], 780, 930, 320, 110, 'jira', size=F, bold_first=True)
    b.note(['app/.env (chỉ trên máy chủ, không commit): JWT_SECRET, khóa LLM, JIRA_BASE_URL, JIRA_EMAIL,', 'JIRA_API_TOKEN, JIRA_WEBHOOK_SECRET, JIRA_ISSUE_TYPES, cờ SCRIPT_ENABLED, SPRINT_ENABLED'], 60, 1090, 1030, 76, size=18)
    L = b.link
    L([b.mid(user, 'bottom'), b.mid(rp, 'top')], label='HTTPS :443', lpos=(660, 205), size=17)
    L([b.mid(rp, 'bottom'), (575, 470)], label=':3000', lpos=(620, 440), size=17)
    L([b.mid(ng, 'left'), b.mid(rp, 'right')], dashed=True)
    L([b.mid(ci, 'bottom'), (170, 520), (200, 520)], label='build image', lpos=(170, 450), size=17)
    L([b.mid(app, 'right'), (680, 570)], head='none', label='đọc / ghi', lpos=(650, 545), size=16)
    L([(430, 670), (430, 890)], head='none')
    for box, label in ((llm, 'HTTPS'), (aut, 'Playwright'), (jira, 'REST')):
        x = b.mid(box, 'top')[0]
        L([(430, 890), (x, 890), b.mid(box, 'top')], color='#0052CC' if box == jira else '#333333')
    b.tag('HTTPS ra ngoài', 330, 870, size=16, bg=False, italic=True)
    L([b.mid(jira, 'right'), (1130, 985), (1130, 330), (1120, 330)], dashed=True, color='#0052CC')
    b.tag('webhook:\nPOST /api/jira/\nwebhook?secret=…', 1050, 640, size=16)
    return b


@diagram('Lop_AIService', 'Sơ đồ lớp – AI Service')
def lop_ai():
    b = Board(1200, 1190)
    b.title('Sơ đồ lớp – AI Service (mẫu Strategy cho nhà cung cấp LLM)', size=26)
    K = dict(size=18, row=26)
    ai, h_ai = b.uml_class('AIService', ['-provider: LLMProvider'], ['+generateTestCases(story, userId)  YC2', '+analyzeImpact(input, userId)  YC15',
                           '+rankRegression(input, userId)  YC17', '-run(task): che PII, gọi, log', '-callWithRetry(prompt, schema)'], 30, 80, 560, **K)
    llm, h_llm = b.uml_class('LLMProvider', ['+name: string', '+model: string'], ['+complete(req): Promise<string>'], 640, 80, 530, stereo='abstract', **K)
    subs = [('MockProvider', ['-luật theo từ khóa']), ('GeminiProvider', ['-apiKey, -model']), ('ClaudeProvider', ['-apiKey, -model']), ('OpenAIProvider', ['-apiKey, -model'])]
    for i, (n, a) in enumerate(subs):
        r, c = divmod(i, 2)
        x, y = 640 + c * 280, 300 + r * 150
        cid, hh = b.uml_class(n, a, ['+complete(req)'], x, y, 250, **K)
        side = x + 250 if c == 0 else x
        b.link([(side, y + hh / 2), (905, y + hh / 2)], head='none')
    b.link([(905, 300 + 150 + 112 / 2), (905, 80 + h_llm)], head='triangle')
    fac, _ = b.uml_class('ProviderFactory', [], ['+createProvider(name): LLMProvider'], 640, 640, 530, **K)
    b.link([(640, 690), (615, 690), (615, 200), (640, 200)], head='open', dashed=True)
    b.tag('«create»', 622, 600, size=16, bg=False, italic=True, anchor='start')
    b.link([(590, 140), (640, 140)], head='open', label='dùng', lpos=(615, 124), size=16)
    helpers = [('PIIMasker', [], ['+maskPII(text)']), ('InjectionGuard', [], ['+detectInjection(text)', '+neutralize(text)']),
               ('PromptBuilder', [], ['+buildTestCasePrompt()', '+buildImpactPrompt()', '+buildRegressionPrompt()']), ('Schemas', ['aiTestCaseSchema (ac_refs)', 'impactResultSchema', 'regressionResultSchema'], [])]
    b.link([(300, 80 + h_ai), (300, 290)], head='none', dashed=True)
    for i, (n, a, m) in enumerate(helpers):
        r, c = divmod(i, 2)
        x, y = 30 + c * 290, 320 + r * 190
        b.uml_class(n, a, m, x, y, 270, stereo='module', **K)
        cx = x + 135
        if r == 0:
            b.link([(300, 290), (cx, 290), (cx, y)], head='open', dashed=True)
        else:
            b.link([(310, 290), (310, 485), (cx, 485), (cx, y)], head='open', dashed=True)
    b.tag('«use»', 360, 274, size=16, bg=False, italic=True)
    tc, h_tc = b.uml_class('TestCaseService', [], ['+saveAiResult(story, tcs, logId, userId)', '+create() · update() · remove()', '+submit(ids) · review(id) · recheck()', '+history(id)'], 30, 720, 560, **K)
    sc, h_sc = b.uml_class('ImpactService', ['YC15, YC16'], ['+analyze(storyId, userId)', '+decide(id, ACCEPT|REJECT, note)', '-baseline(story, tests)', '+list(filter)'], 640, 800, 530, **K)
    rn, h_rn = b.uml_class('RegressionService', ['YC17'], ['+create(storyId, userId)', '+updateItems(id) · confirm(id)'], 640, 1025, 530, **K)
    b.link([(640, 860), (590, 860)], head='open', label='update() / create()', lpos=(700, 785), size=16)
    b.link([(905, 976), (905, 1025)], head='open')
    b.tag('Nên chạy lại → bộ regression', 915, 1000, size=16, bg=False, anchor='start')
    b.link([(1170, 900), (1185, 900), (1185, 60), (300, 60), (300, 80)], head='open', label='analyzeImpact() · rankRegression()', lpos=(800, 60), size=16)
    b.tag('Route POST /stories/:id/generate: StoryService.assertReady → AIService.generateTestCases → TestCaseService.saveAiResult', 600, 1165, size=16, bg=False, italic=True)
    return b


@diagram('Lop_TichHopJira', 'Sơ đồ lớp – tích hợp Jira')
def lop_jira():
    b = Board(1200, 1200)
    b.title('Sơ đồ lớp – tích hợp Jira một chiều (Jira → hệ thống)', size=26)
    K = dict(size=18, row=26)
    b.uml_class('AdminRoutes', [], ['POST /jira/test  (jira:connect)', 'POST /jira/import  (jira:import)', 'POST /projects/:id/jira-sync',
                'POST /stories/:id/check-decision', 'GET /projects/:id/sync-logs'], 30, 80, 560, stereo='route', **K)
    b.uml_class('WebhookRoute', [], ['POST /api/jira/webhook?secret=…', '(không qua JWT)'], 30, 345, 560, stereo='route', kind='sec', **K)
    b.uml_class('Scheduler', ['JIRA_SYNC_MINUTES = 5'], ["setInterval(syncAll('SCHEDULE'))"], 30, 525, 560, stereo='server.js', **K)
    _, h_jc = b.uml_class('JiraCloud', ['REST v3: /project, /search/jql,', '/issue/{id}, /user/assignable'], ['webhook: jira:issue_*'],
                          640, 80, 530, stereo='hệ thống ngoài', kind='jira', **K)
    _, h_js = b.uml_class('JiraService', ['-config.jira: baseUrl, issueTypes, maxRetry', '-MOCK_PROJECTS (Jira giả lập)'],
                          ['+testConnection() · importProject(key)', '+syncProject(projectId, userId, source)', '+syncAll(userId, source)',
                           '+checkWebhookSecret() · handleWebhook()', '+lastSync(projectId)', '-jira(path): thử lại 2 lần',
                           '-fetchStories · fetchIssue(id)', '-saveStories: issue ID, bản mới hơn', '-logSync(status)'], 640, 300, 530, stereo='service', kind='jira', **K)
    b.uml_class('DescriptionParser', [], ['+adfLines(adf)', '+splitDescription(adf)', '+mapPriority(name) · toIso(time)'], 640, 740, 530, stereo='module', kind='jira', **K)
    b.uml_class('StoryService', [], ['+list · get · versions(id)', '+applyContentChange(story, next)', '+checkDecision(id, KEEP|ARCHIVE)', '+assertReady(story)'], 30, 710, 330, **K)
    b.uml_class('ac.js', [], ['+normalize(line)', '+parse(text)', '+diff(old, new)'], 380, 710, 210, stereo='module', **K)
    b.uml_class('Bảng dữ liệu', ['user_stories (jira_issue_id, jira_updated_at, current_version, check_reason, archived)',
                'requirement_versions · sync_logs · test_cases (needs_review, review_reason) · test_case_acs',
                'projects (jira_key, synced_at) · project_members · modules'], [], 30, 960, 1140, stereo='CSDL', kind='data', **K)
    L = b.link
    L([(590, 170), (615, 170), (615, 340), (640, 340)], head='open', label='gọi', lpos=(615, 255), size=16)
    L([(590, 410), (640, 410)], head='open', label='gọi', lpos=(615, 394), size=16)
    L([(590, 585), (640, 585)], head='open')
    L([(905, 300), (905, 80 + h_jc)], head='open', color='#0052CC', label='HTTPS, Basic auth', lpos=(1010, 262), size=16)
    L([(1000, 80), (1000, 62), (15, 62), (15, 405), (30, 405)], dashed=True, color='#0052CC', label='webhook khi issue đổi', lpos=(500, 62), size=16)
    L([(905, 300 + h_js), (905, 740)], head='open', dashed=True, label='«use»', lpos=(960, 720), size=16)
    L([(640, 650), (195, 650), (195, 710)], head='open', label='applyContentChange()', lpos=(420, 670), size=16)
    L([(360, 760), (380, 760)], head='open', dashed=True)
    L([(1170, 600), (1185, 600), (1185, 1010), (1170, 1010)], head='open', label='ghi', lpos=(1185, 850), size=16)
    L([(195, 900), (195, 960)], head='open', label='đọc / ghi', lpos=(250, 930), size=16)
    b.tag('Không có API tạo, sửa, xóa requirement: mọi thay đổi đến từ Jira; mỗi lần nội dung đổi tạo một phiên bản mới.', 600, 1175, size=16, bg=False, italic=True)
    return b

SEQ = dict(gap=200, head_w=180, size=19, row=58)


@diagram('TuanTu_SinhTestCase', 'Sơ đồ tuần tự – Sinh test case bằng AI (YC2)')
def tt_sinh():
    b = Board(10, 10)
    b.title('Sơ đồ tuần tự – Sinh test case bằng AI (YC2)', size=26)
    parts = [('T', 'Tester', 'actor'), ('R', 'Route\n/generate', 'box'), ('AI', 'AI Service', 'ai'),
             ('L', 'LLM Provider', 'ext'), ('TC', 'TestCase\nService', 'box'), ('DB', 'CSDL', 'data')]
    steps = [('m', 'T', 'R', 'POST /stories/:id/generate'),
             ('s', 'R', 'JWT, quyền ai:use, hạn mức/giờ'),
             ('m', 'R', 'DB', 'đọc user story, tham số QĐ2'),
             ('s', 'R', 'assertReady: chưa lưu trữ, không Cần kiểm tra, đủ AC'),
             ('m', 'R', 'AI', 'generateTestCases(story)'),
             ('s', 'AI', 'maskPII() + detectInjection()'), ('s', 'AI', 'buildTestCasePrompt(max)'),
             ('loop', 'tối đa 1 + AI_MAX_RETRY lần'), ('m', 'AI', 'L', 'complete(prompt)'), ('r', 'L', 'AI', 'JSON thô'),
             ('s', 'AI', 'JSON.parse + Zod (có ac_refs)'), ('end',),
             ('m', 'AI', 'DB', 'INSERT ai_logs'), ('r', 'AI', 'R', 'testCases, aiLogId'),
             ('m', 'R', 'TC', 'saveAiResult(story, testCases)'), ('m', 'TC', 'DB', 'INSERT test Nháp + liên kết AC (giữ nháp cũ)'),
             ('m', 'R', 'DB', 'INSERT audit_logs'), ('r', 'R', 'T', '200: danh sách test case Nháp')]
    b.w, b.h = sequence(b, parts, steps, **SEQ)
    return b


@diagram('TuanTu_DuyetTestCase', 'Sơ đồ tuần tự – Gửi duyệt và duyệt test case (YC3, YC4)')
def tt_duyet():
    b = Board(10, 10)
    b.title('Sơ đồ tuần tự – Gửi duyệt và duyệt test case (YC3 + YC4)', size=26)
    parts = [('T', 'Tester', 'actor'), ('Q', 'QA Lead', 'actor'), ('S', 'TestCaseService', 'box'), ('DB', 'CSDL', 'data')]
    steps = [('m', 'T', 'S', 'submit([id…])'), ('m', 'S', 'DB', 'kiểm DRAFT/RETURNED, ≥ 1 AC'), ('m', 'S', 'DB', 'UPDATE PENDING_REVIEW'),
             ('r', 'S', 'T', 'đã gửi duyệt n test case'), ('m', 'Q', 'S', 'mở hàng đợi duyệt'), ('r', 'S', 'Q', 'danh sách Chờ duyệt'),
             ('alt', 'Trả lại'), ('m', 'Q', 'S', 'review(RETURNED, ghi chú)'), ('s', 'S', 'ghi chú rỗng → lỗi 400 (QĐ4)'),
             ('m', 'S', 'DB', 'RETURNED; reviews, audit_logs'), ('r', 'S', 'T', 'hiển thị ghi chú trả lại'),
             ('else', 'Duyệt'), ('m', 'Q', 'S', 'review(APPROVED)'), ('m', 'S', 'DB', 'APPROVED, gỡ cờ, nâng req_version'), ('end',)]
    b.w, b.h = sequence(b, parts, steps, gap=330, head_w=200, size=19, row=58)
    return b


@diagram('TuanTu_ChayScript', 'Sơ đồ tuần tự – Sinh và chạy script Playwright (YC19, mở rộng)')
def tt_script():
    b = Board(10, 10)
    b.title('Sơ đồ tuần tự – Sinh và chạy script Playwright (YC19, phần mở rộng)', size=26)
    parts = [('T', 'Tester', 'actor'), ('S', 'ScriptService', 'box'), ('DB', 'CSDL', 'data'), ('AI', 'AI Service', 'ai'),
             ('W', 'Playwright\nWorker', 'ext'), ('APP', 'Web cần test', 'ext')]
    steps = [('m', 'T', 'S', 'Sinh script (TC Đã duyệt)'), ('m', 'S', 'AI', 'generateScript(tc, baseUrl)'), ('r', 'AI', 'S', 'mã Playwright'),
             ('m', 'S', 'DB', 'lưu automation_scripts'), ('m', 'T', 'S', 'Chạy tự động'),
             ('s', 'S', 'staticCheck: chặn fs, child_process, eval'),
             ('s', 'S', 'ghi file tạm <mã>-<ngẫu nhiên>.spec.js'), ('m', 'S', 'W', 'spawn playwright test (timeout)'),
             ('m', 'W', 'APP', 'mở Chrome, thao tác'), ('r', 'APP', 'W', 'giao diện'), ('r', 'W', 'S', 'báo cáo JSON (+ ảnh khi lỗi)'),
             ('s', 'S', 'xóa file tạm'), ('m', 'S', 'DB', 'INSERT test_executions (trong Test Run)'), ('r', 'S', 'T', 'Pass / Fail')]
    b.w, b.h = sequence(b, parts, steps, **SEQ)
    return b


@diagram('TuanTu_DongBoJira', 'Sơ đồ tuần tự – Đồng bộ requirement từ Jira (YC1, YC8)')
def tt_jira():
    b = Board(10, 10)
    b.title('Sơ đồ tuần tự – Đồng bộ requirement từ Jira (YC1, YC8)', size=26)
    parts = [('QT', 'QA Lead /\nAdmin', 'actor'), ('WH', 'Route webhook\n/ jira-sync', 'box'), ('JS', 'JiraService', 'jira'),
             ('SS', 'StoryService', 'box'), ('DB', 'CSDL', 'data'), ('J', 'Jira Cloud', 'jira'), ('PO', 'PO / BA', 'actor')]
    steps = [('m', 'PO', 'J', 'sửa issue (AC, mô tả)'),
             ('alt', 'Jira gọi webhook'), ('m', 'J', 'WH', 'POST /api/jira/webhook?secret=…'), ('s', 'WH', 'sai mã bí mật → 401'),
             ('else', 'Đồng bộ ngay, hoặc định kỳ'), ('m', 'QT', 'WH', 'POST /projects/:id/jira-sync'), ('end',),
             ('m', 'WH', 'JS', 'syncProject(id, nguồn)'),
             ('loop', 'lỗi kết nối: thử lại tối đa 2 lần'), ('m', 'JS', 'J', 'POST /search/jql (JIRA_ISSUE_TYPES)'),
             ('r', 'J', 'JS', 'issue ID, updated, Summary, ADF'), ('end',),
             ('opt', 'requirement không còn trong kết quả'), ('m', 'JS', 'J', 'GET /issue/{id}'), ('r', 'J', 'JS', '404 / loại issue'), ('end',),
             ('m', 'JS', 'DB', 'đọc requirement theo issue ID'),
             ('opt', 'updated mới hơn bản đã lưu'), ('s', 'JS', 'splitDescription → mô tả + AC'),
             ('m', 'JS', 'SS', 'applyContentChange()'), ('m', 'SS', 'DB', 'INSERT requirement_versions'),
             ('m', 'SS', 'DB', 'gắn cờ test (AC đổi / tiêu đề, mô tả đổi)'), ('end',),
             ('m', 'JS', 'DB', 'cờ Cần kiểm tra; gỡ cờ khi xuất hiện lại'), ('m', 'JS', 'DB', 'INSERT sync_logs'),
             ('r', 'JS', 'WH', 'mới, phiên bản, test bị gắn cờ'), ('r', 'WH', 'QT', 'kết quả + cảnh báo')]
    b.w, b.h = sequence(b, parts, steps, **SEQ)
    return b


@diagram('TuanTu_PhanTichAnhHuong', 'Sơ đồ tuần tự – Phân tích ảnh hưởng và duyệt đề xuất (YC15, YC16)')
def tt_phan_tich():
    b = Board(10, 10)
    b.title('Sơ đồ tuần tự – AI phân tích ảnh hưởng và QA Lead duyệt đề xuất (YC15, YC16)', size=26)
    parts = [('Q', 'QA Lead', 'actor'), ('IS', 'ImpactService', 'box'), ('AI', 'AI Service', 'ai'), ('L', 'LLM Provider', 'ext'),
             ('TC', 'TestCase\nService', 'box'), ('DB', 'CSDL', 'data')]
    steps = [('m', 'Q', 'IS', 'POST /stories/:id/analyze'), ('s', 'IS', 'quyền ai:use, hạn mức AI/giờ'),
             ('m', 'IS', 'DB', 'đọc phiên bản, test, AC liên kết'), ('s', 'IS', 'mốc = phiên bản cũ nhất test đã liên kết'),
             ('s', 'IS', 'từng test: thay đổi sau phiên bản của nó'), ('m', 'IS', 'AI', 'analyzeImpact(trước, sau, tests)'),
             ('s', 'AI', 'che PII, ghép prompt'), ('loop', 'tối đa 1 + AI_MAX_RETRY lần'), ('m', 'AI', 'L', 'complete(prompt)'),
             ('r', 'L', 'AI', 'JSON đề xuất'), ('s', 'AI', 'Zod: loại, lý do, phần nguồn'), ('end',),
             ('m', 'AI', 'DB', 'INSERT ai_logs'), ('r', 'AI', 'IS', 'proposals'), ('m', 'IS', 'DB', 'INSERT impact_analyses, ai_proposals'),
             ('r', 'IS', 'Q', 'đề xuất Chờ xử lý'),
             ('m', 'Q', 'IS', 'POST /proposals/:id/decision'), ('s', 'IS', 'phiên bản đã đổi → Lỗi thời (409)'),
             ('alt', 'Cần sửa / Còn thiếu'), ('m', 'IS', 'TC', 'update() / create(): test về Nháp'),
             ('else', 'Nên chạy lại'), ('m', 'IS', 'DB', 'thêm test vào bộ regression'), ('end',),
             ('m', 'IS', 'DB', 'lưu quyết định, người, ngày'), ('r', 'IS', 'Q', 'Đã chấp nhận (bản nháp chờ duyệt YC4)')]
    b.w, b.h = sequence(b, parts, steps, **SEQ)
    return b


@diagram('TuanTu_TestRun', 'Sơ đồ tuần tự – Test Run, báo sửa lỗi và kiểm thử lại (YC14, YC5, YC18)')
def tt_test_run():
    b = Board(10, 10)
    b.title('Sơ đồ tuần tự – Test Run, báo sửa lỗi và kiểm thử lại (YC14, YC5, YC18)', size=26)
    parts = [('Q', 'QA Lead', 'actor'), ('T', 'Tester', 'actor'), ('D', 'Developer', 'actor'), ('RS', 'RunService', 'box'),
             ('FS', 'RetestService', 'box'), ('DB', 'CSDL', 'data')]
    steps = [('m', 'Q', 'RS', 'create(suite, build, môi trường, người)'), ('s', 'RS', 'điều kiện chạy từng test (QĐ14)'),
             ('m', 'RS', 'DB', 'INSERT test_runs, test_run_items'), ('r', 'RS', 'Q', 'đợt + test bị bỏ qua, lý do'),
             ('m', 'T', 'RS', 'record(item, FAIL, ghi chú)'), ('s', 'RS', 'đợt mở, người được giao'),
             ('m', 'RS', 'DB', 'INSERT test_executions (phiên bản cố định)'),
             ('m', 'D', 'FS', 'reportFix(lần Fail, build)'), ('s', 'FS', 'Fail gần nhất trong đợt, chưa báo'),
             ('m', 'FS', 'DB', 'INSERT fix_reports (Chờ kiểm thử lại)'),
             ('alt', 'đợt còn mở, trùng build'), ('m', 'T', 'RS', 'record(item, PASS) trong đợt cũ'),
             ('else', 'đợt đã đóng / khác build'), ('m', 'Q', 'FS', 'createRetestRun(build đã sửa)'),
             ('m', 'T', 'RS', 'record(PASS) trong đợt Kiểm thử lại'), ('end',),
             ('m', 'RS', 'DB', 'retest_of = lần Fail gốc; phiếu → Đã đóng'), ('r', 'RS', 'T', 'kết quả + cảnh báo lệch build')]
    b.w, b.h = sequence(b, parts, steps, **SEQ)
    return b


@diagram('LuongManHinh', 'Sơ đồ luồng màn hình')
def luong_man_hinh():
    b = Board(1200, 1220)
    b.title('Sơ đồ luồng màn hình', size=26)
    mh = lambda code, name, x, y, k='user', w=300: b.rect([code, name], x, y, w, 76, k, size=20, bold_first=True)
    m1 = mh('MH01', 'Đăng nhập', 450, 70)
    m2 = mh('MH02', 'Tổng quan & báo cáo', 450, 200)
    biz = [('MH03', 'Requirement (Jira)'), ('MH06', 'Test case (tra cứu)'), ('MH07', 'Duyệt test case'), ('MH08', 'Test Suite'),
           ('MH09', 'Test Run'), ('MH11', 'Đề xuất AI'), ('MH13', 'Sửa lỗi & kiểm thử lại')]
    ys = [340, 450, 560, 670, 780, 890, 1000]
    for (c, n), y in zip(biz, ys):
        mh(c, n, 120, y)
    m4 = mh('MH04', 'Chi tiết requirement', 520, 340)
    m12 = mh('MH12', 'Bộ regression', 520, 450, 'ai')
    m5 = mh('MH05', 'Chi tiết test case', 520, 600, 'proc')
    m10 = mh('MH10', 'Chi tiết Test Run', 520, 780)
    b.tag('(phiên bản, đề xuất AI, Lưu trữ / Giữ lại)', 670, 432, size=16, bg=False, italic=True)
    b.tag('(hộp thoại: chi tiết · lịch sử · lần chạy)', 670, 694, size=16, bg=False, italic=True)
    L = b.link
    L([b.mid(m1, 'bottom'), b.mid(m2, 'top')])
    L([b.mid(m2, 'left'), (60, 238), (60, 1038)], head='none')
    for y in ys:
        L([(60, y + 38), (120, y + 38)])
    L([(420, 378), b.mid(m4, 'left')])
    L([(860, 378), (880, 378), (880, 488), (820, 488)], label='Tạo bộ\nregression', lpos=(935, 433), size=16)
    for y in (488, 598):
        L([(420, y), (480, y)], head='none')
    L([(480, 488), (480, 638)], head='none')
    L([(480, 638), (520, 638)])
    L([(420, 818), b.mid(m10, 'left')])
    L([(820, 505), (850, 505), (850, 818), (820, 818)], dashed=True, label='xác nhận → Test Run', lpos=(760, 735), size=16)
    adm = [('MH14', 'Thay đổi quy định', 'gray'), ('MH15', 'Nhật ký AI', 'gray'), ('MH16', 'Dự án & Jira', 'jira'),
           ('MH17', 'Người dùng', 'gray'), ('MH18', 'Nhật ký hoạt động', 'gray')]
    b.frame('Quản trị (theo quyền)', 880, 560, 290, 540, 'gray', size=18)
    for i, (c, n, k) in enumerate(adm):
        mh(c, n, 900, 600 + i * 98, k, w=250)
    L([b.mid(m2, 'right'), (1025, 238), (1025, 560)])
    b.tag('Màu: xanh dương – nghiệp vụ · tím – hộp thoại · AI – bộ regression · xanh Jira – đồng bộ · xám – quản trị', 600, 1130, size=17, bg=False, italic=True)
    b.tag('Menu chỉ hiện chức năng đúng quyền của vai trò; Sprint và script Playwright chỉ hiện khi bật phần mở rộng.', 600, 1165, size=17, bg=False, italic=True)
    b.h = 1200
    return b


@diagram('BaoMat_LopPhongVe', 'Các lớp bảo mật của một request')
def bao_mat():
    b = Board(1200, 1000)
    b.title('Các lớp bảo vệ một request (defense in depth)', size=26)
    items = [('Request', 'user'), ('helmet: CSP, nosniff,\nẩn X-Powered-By', 'sec'), ('Body ≤ 1 MB', 'sec'),
             ('JWT + tài khoản\ncòn hoạt động', 'sec'), ('RBAC theo quyền', 'sec'), ('Hạn mức AI / giờ', 'sec'),
             ('Zod schema', 'sec'), ('Service: quy định\nnghiệp vụ', 'proc'), ('Prepared statement', 'data')]
    ids = []
    for i, (t, k) in enumerate(items):
        r, c = divmod(i, 3)
        x = 40 + (c if r % 2 == 0 else 2 - c) * 400
        ids.append(b.rect(t.split('\n'), x, 80 + r * 170, 320, 100, k, size=20))
    L = b.link
    for i in range(8):
        a, c = ids[i], ids[i + 1]
        if i in (2, 5):
            L([b.mid(a, 'bottom'), b.mid(c, 'top')])
        elif (i // 3) % 2 == 0:
            L([b.mid(a, 'right'), b.mid(c, 'left')])
        else:
            L([b.mid(a, 'left'), b.mid(c, 'right')])
    sv = ids[7]
    au = b.rect(['Audit log', 'ai, làm gì, lúc nào, IP'], 40, 640, 340, 100, 'gray', size=20, bold_first=True)
    ai = b.rect(['AI Service', 'che PII → chống injection', '→ kiểm tra schema'], 430, 640, 340, 120, 'ai', size=20, bold_first=True)
    sb = b.rect(['Script tự động', 'kiểm tra tĩnh → tiến trình', 'riêng, env tối thiểu, timeout,', 'container giới hạn CPU/RAM'], 820, 640, 340, 150, 'ext', size=20, bold_first=True)
    x7 = b.mid(sv, 'bottom')[0]
    L([b.mid(sv, 'bottom'), (x7, 600)], head='none')
    for box in (au, ai, sb):
        bx = b.mid(box, 'top')[0]
        L([(x7, 600), (bx, 600), b.mid(box, 'top')])
    wh = b.rect(['Webhook Jira (không có JWT)', 'kiểm tra mã bí mật, so sánh an toàn theo thời gian,', 'rồi vào thẳng service đồng bộ'], 160, 850, 880, 110, 'jira', size=20, bold_first=True)
    L([(405, 850), (405, 385), (440, 385)], dashed=True)
    return b


@diagram('ThapKiemThu', 'Tháp kiểm thử')
def thap():
    b = Board(1100, 560)
    b.title('Tháp kiểm thử tự động: 140 test chạy trên CI', size=26)
    b.trap(['E2E – Playwright (11)', 'luồng nghiệp vụ qua giao diện thật'], 290, 80, 520, 120, 100, 'ai', size=20)
    b.trap(['API / tích hợp – supertest (85 + 11 mở rộng)', 'QĐ1–QĐ18, phân quyền, đồng bộ Jira,', 'Test Run, đề xuất AI, regression'], 190, 200, 720, 140, 100, 'proc', size=20)
    b.trap(['Unit – node:test (33)', 'che PII, chống injection, so AC,', 'schema đề xuất, AI giả lập'], 90, 340, 920, 140, 100, 'done', size=20)
    b.tag('Thêm 8 test Playwright mẫu (Page Object) trên saucedemo.com', 550, 520, size=18, bg=False, italic=True)
    return b


@diagram('CI_Pipeline', 'Quy trình CI trên GitHub Actions')
def ci():
    b = Board(1100, 760)
    b.title('Quy trình CI trên GitHub Actions', size=26)
    p = b.rect(['git push / Pull Request'], 350, 70, 400, 70, 'user', size=20, bold_first=True)
    u = b.rect(['Job 1: Unit & API test', 'npm ci → npm test (129 test)'], 330, 200, 440, 100, 'proc', size=20, bold_first=True)
    e = b.rect(['Job 2: E2E Playwright', 'cài Chromium → test:e2e', 'lưu báo cáo HTML'], 40, 370, 460, 130, 'ai', size=20, bold_first=True)
    a = b.rect(['Job 3: Playwright mẫu', 'Sauce Demo, biến từ', 'GitHub Secrets / Variables'], 600, 370, 460, 130, 'ext', size=20, bold_first=True)
    d = b.rect(['Job 4: Build Docker image'], 330, 580, 440, 80, 'done', size=20, bold_first=True)
    L = b.link
    L([b.mid(p, 'bottom'), b.mid(u, 'top')])
    L([(550, 300), (550, 335), (270, 335), b.mid(e, 'top')]); L([(550, 335), (830, 335), b.mid(a, 'top')])
    L([b.mid(e, 'bottom'), (270, 540), (550, 540), b.mid(d, 'top')]); L([b.mid(a, 'bottom'), (830, 540), (550, 540)], head='none')
    b.tag('Job sau chỉ chạy khi job trước thành công (needs)', 550, 710, size=18, bg=False, italic=True)
    return b



def main():
    for name, page, fn in DIAGRAMS:
        save(fn(), name, page)
    print(f'Đã tạo {len(DIAGRAMS)} sơ đồ (.drawio + .svg) trong docs/sodo')


if __name__ == '__main__':
    main()
