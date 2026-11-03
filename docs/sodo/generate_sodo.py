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
        ('Sprint 1 · 13 SP', 'Khởi động, đăng nhập, phân quyền,', 'đồng bộ user story từ Jira'),
        ('Sprint 2 · 22 SP', 'AI sinh test case, lưu phiên bản', '(rủi ro cao nhất, làm sớm)'),
        ('Sprint 3 · 18 SP', 'Duyệt, chạy test thủ công,', 'tra cứu, báo cáo'),
        ('Sprint 4 · 22 SP', 'Tự động hóa Playwright, quy định,', 'báo đã sửa lỗi'),
        ('Sprint 5 · 21 SP', 'Theo dõi sprint từ Jira, webhook,', 'xuất Excel, Docker, hoàn thiện'),
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
@diagram('HoatDong_QuyTrinhMoi', 'Sơ đồ hoạt động – quy trình nghiệp vụ mới')
def hoat_dong():
    b = Board(1280, 1720)
    b.title('Sơ đồ hoạt động – quy trình kiểm thử mới (chia làn theo vai trò)', size=26)
    widths = [230, 290, 270, 220, 230]
    b.lanes(['PO / BA (Jira)', 'Hệ thống', 'Tester', 'QA Lead', 'Developer'], 20, 60, widths, 1640)
    xs, x = [], 20
    for w in widths:
        xs.append(x + w / 2)
        x += w
    PO, HT, TE, QA, DV = xs
    F = 19

    def act(cx, cy, text, w, h=96, kind='proc', dashed=False):
        return b.rect(text.split('\n'), cx - w / 2, cy - h / 2, w, h, kind, size=F, dashed=dashed)

    def dec(cx, cy, text, w=200, h=110):
        return b.diamond(text, cx - w / 2, cy - h / 2, w, h, size=F)

    st = b.dot(PO, 150)
    n1 = act(PO, 270, 'Viết story kèm\nmục Acceptance\ncriteria', 200, 110, 'jira')
    n2 = act(HT, 270, 'Đồng bộ story\n(webhook · 5 phút ·\nĐồng bộ ngay)', 260, 110)
    d1 = dec(HT, 420, 'Đủ acceptance\ncriteria?', 230)
    n3 = act(PO, 420, 'Bổ sung\nacceptance\ncriteria', 200, 110, 'jira')
    n4 = act(TE, 420, 'Bấm Sinh test\ncase bằng AI', 240)
    n5 = act(HT, 570, 'AI sinh test case\nNháp (che PII,\nschema, thử lại)', 260, 110, 'ai')
    n6 = act(TE, 720, 'Xem lại, sửa,\nxóa, thêm\ntest case', 240, 110)
    n7 = act(PO, 850, 'Sửa story đã\ncó test case', 200, 96, 'jira')
    n8 = act(HT, 850, 'Đánh dấu Cần\nxem lại test case', 260, 96, 'warn')
    n9 = act(TE, 960, 'Gửi duyệt', 240, 76)
    d2 = dec(QA, 960, 'Duyệt:\nđạt?', 180)
    d3 = dec(TE, 1110, 'Tự động\nhóa?', 190)
    n10 = act(TE, 1260, 'Chạy thủ công,\nghi kết quả', 240)
    n11 = act(HT, 1260, 'AI sinh script,\nkiểm tra tĩnh,\nchạy sandbox', 260, 110, 'ai')
    d4 = dec(TE, 1410, 'Fail?', 170, 100)
    n12 = act(DV, 1410, 'Sửa lỗi, Báo\nđã sửa kèm\nbản build', 200, 110)
    n13 = act(HT, 1560, 'Báo cáo, DoD,\nvelocity tự cập nhật', 260, 96, 'done')
    en = b.dot(HT, 1665, final=True)

    L = b.link
    L([b.mid(st, 'bottom'), b.mid(n1, 'top')])
    L([b.mid(n1, 'right'), b.mid(n2, 'left')])
    L([b.mid(n2, 'bottom'), b.mid(d1, 'top')])
    L([b.mid(d1, 'left'), b.mid(n3, 'right')], label='Không', lpos=(PO + 128, 400), size=17)
    L([b.mid(n3, 'top'), b.mid(n1, 'bottom')])
    L([b.mid(d1, 'right'), b.mid(n4, 'left')], label='Có', lpos=(HT + 135, 400), size=17)
    L([b.mid(n4, 'bottom'), (TE, 570), b.mid(n5, 'right')])
    L([b.mid(n5, 'bottom'), (HT, 720), b.mid(n6, 'left')])
    L([b.mid(n7, 'right'), b.mid(n8, 'left')], dashed=True)
    L([b.mid(n8, 'right'), (TE - 60, 850), (TE - 60, 775)], dashed=True)
    L([b.mid(n6, 'bottom'), b.mid(n9, 'top')])
    L([b.mid(n9, 'right'), b.mid(d2, 'left')])
    L([b.mid(d2, 'top'), (QA, 720), b.mid(n6, 'right')], label='Trả lại\n+ ghi chú', lpos=(QA, 800), size=17)
    L([b.mid(d2, 'bottom'), (QA, 1110), b.mid(d3, 'right')], label='Duyệt', lpos=(QA, 1060), size=17)
    L([b.mid(d3, 'bottom'), b.mid(n10, 'top')], label='Không', lpos=(TE + 42, 1180), size=17)
    L([b.mid(d3, 'left'), (HT, 1110), b.mid(n11, 'top')], label='Có', lpos=(HT + 120, 1095), size=17)
    L([b.mid(n10, 'bottom'), b.mid(d4, 'top')])
    L([b.mid(n11, 'bottom'), (HT, 1410), b.mid(d4, 'left')])
    L([b.mid(d4, 'right'), b.mid(n12, 'left')], label='Có', lpos=(QA, 1394), size=17)
    L([b.mid(n12, 'top'), (DV, 1110), (QA + 4, 1110)], label='Cần kiểm\nthử lại', lpos=(DV, 1260), size=17)
    L([b.mid(d4, 'bottom'), (TE, 1560), b.mid(n13, 'right')], label='Không', lpos=(TE + 42, 1490), size=17)
    L([b.mid(n13, 'bottom'), b.mid(en, 'top')])
    return b


def state(b, lines, x, y, w=240, h=74, kind='proc'):
    return b.rect(lines, x, y, w, h, kind, size=17, bold_first=True)


@diagram('TrangThai_TestCase', 'Sơ đồ trạng thái của test case')
def trang_thai_test_case():
    b = Board(1150, 860)
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
    L([b.mid(init, 'bottom'), b.mid(draft, 'top')], label='AI sinh /\nthêm thủ công', lpos=(470, 105), size=17)
    L([(520, 230), (520, 380)], label='Gửi duyệt', lpos=(460, 300), size=17)
    L([(640, 470), (640, 600)], label='QA Lead duyệt', lpos=(560, 535), size=17)
    L([(720, 405), (830, 405)], label='Trả lại\n(ghi chú)', lpos=(775, 345), size=17)
    L([(830, 450), (720, 450)], label='Gửi lại', lpos=(775, 475), size=17)
    L([(880, 380), (880, 200), (720, 200)], label='Sửa', lpos=(880, 290), size=17)
    L([b.mid(draft, 'left'), (214, 185)], label='Xóa', lpos=(320, 170), size=17)
    L([(975, 470), (975, 606)], label='Xóa', lpos=(1010, 540), size=17)
    L([b.mid(appr, 'left'), (330, 645), (330, 215), (430, 215)], label='Sửa nội dung\n(phải duyệt lại)', lpos=(330, 430), size=17)
    L([(720, 160), (780, 160), (780, 105), (680, 105), (680, 140)], label='Sửa (phiên bản +1)', lpos=(900, 95), size=17)
    L([(720, 620), (790, 620), (790, 675), (720, 675)], label='Ghi kết quả /\nchạy tự động', lpos=(880, 648), size=17)
    b.note(['Chỉ Đã duyệt mới được ghi kết quả, sinh và chạy', 'script (QĐ5, QĐ10). Chờ duyệt không được sửa (QĐ3).'], 200, 760, 760, 70, size=18)
    return b


@diagram('TrangThai_UserStory', 'Sơ đồ trạng thái của user story đồng bộ từ Jira')
def trang_thai_user_story():
    b = Board(1150, 800)
    b.title('Sơ đồ trạng thái của user story (đồng bộ một chiều từ Jira)', size=26)
    st = lambda lines, x, y, w, k: b.rect(lines, x, y, w, 96, k, size=20, bold_first=True)
    init = b.dot(575, 90)
    miss = st(['Thiếu acceptance criteria', 'chưa sinh được test case'], 60, 200, 350, 'warn')
    ready = st(['Sẵn sàng', 'sinh / viết test case được'], 700, 200, 370, 'done')
    review = st(['Cần xem lại test case', 'changed_at ≠ NULL'], 700, 470, 370, 'warn')
    arch = st(['Đã lưu trữ', 'archived = 1, chỉ xem'], 60, 470, 350, 'gray')
    L = b.link
    L([b.mid(init, 'bottom'), (575, 140)], head='none')
    L([(575, 140), (235, 140), (235, 200)], label='[thiếu AC]', lpos=(380, 140), size=17)
    L([(575, 140), (885, 140), (885, 200)], label='[đủ AC]', lpos=(760, 140), size=17)
    b.tag('Đồng bộ lần đầu', 680, 92, size=17, bg=False, italic=True)
    L([(410, 230), (700, 230)], label='PO/BA bổ sung AC', lpos=(555, 214), size=17)
    L([(700, 268), (410, 268)], label='AC bị xóa trên Jira', lpos=(555, 284), size=17)
    L([(830, 296), (830, 470)], label='Story đổi\n[đã có\ntest case]', lpos=(905, 383), size=16)
    L([(980, 470), (980, 296)], label='Tester bấm\nĐã xem lại', lpos=(1065, 383), size=16)
    L([(1000, 200), (1000, 168), (1060, 168), (1060, 200)])
    b.tag('Story đổi [chưa có test case]', 1000, 182 - 40, size=16, bg=False, italic=True)
    L([(700, 520), (410, 520)], label='Bị xóa trên Jira', lpos=(555, 504), size=17)
    L([(720, 296), (720, 380), (330, 380), (330, 470)], label='Bị xóa trên Jira', lpos=(470, 380), size=17)
    L([(120, 470), (120, 296)], dashed=True, label='Xuất hiện lại\ntrên Jira', lpos=(120, 383), size=17)
    b.note(['Sinh test case bằng AI chỉ khi story không lưu trữ và có ≥ MIN_AC_PER_STORY', 'acceptance criteria (QĐ1). Story không bị xóa thật: test case luôn được giữ (QĐ8).'],
           60, 640, 1010, 80, size=18)
    return b


# =====================================================================================
# CHƯƠNG 4 – THIẾT KẾ
# =====================================================================================
@diagram('KienTruc', 'Kiến trúc hệ thống')
def kien_truc():
    b = Board(1240, 1480)
    b.title('Kiến trúc hệ thống (client – server nhiều lớp)', size=26)
    F = 19
    b.frame('Frontend – trình duyệt', 30, 70, 860, 140, 'user', size=F)
    ui = b.rect(['Ứng dụng một trang (HTML, CSS, JS, Chart.js)', 'Tổng quan · Sprint · User story · Tra cứu · Duyệt', 'Kết quả chạy · Quy định · Nhật ký · Dự án'],
                60, 105, 800, 92, 'user', size=F, bold_first=True)
    jira = b.rect(['«hệ thống ngoài»', 'Jira Cloud', 'REST · Agile API'], 930, 70, 290, 140, 'jira', size=F, bold_first=True)
    b.frame('Backend – Node.js 21 + Express 5', 30, 250, 1190, 900, 'gray', size=F)
    mw = b.rect(['Middleware: helmet (CSP) · JSON ≤ 1 MB · JWT · RBAC', 'giới hạn đăng nhập sai · hạn mức AI/giờ · Zod · audit log'], 60, 290, 830, 84, 'sec', size=F)
    rt = b.rect(['Route REST: /api/auth · /stories · /testcases', '/runs · /reports · /projects · /jira/*'], 60, 400, 830, 84, 'proc', size=F)
    wh = b.rect(['Route webhook', 'POST /api/jira/webhook', 'không JWT,', 'kiểm tra mã bí mật'], 910, 290, 280, 194, 'sec', size=F, bold_first=True)
    b.frame('Lớp service nghiệp vụ', 60, 520, 780, 330, 'proc', size=F)
    names = [('StoryService', 'YC1 – chỉ đọc'), ('TestCaseService', 'YC2, 3, 4, 7'), ('RunService', 'YC5, YC15'),
             ('ReportService', 'YC6, YC9'), ('SprintService', 'YC14'), ('ParameterService', 'YC11'),
             ('ScriptService', 'YC10, sandbox'), ('AuditService', 'nhật ký')]
    svc = {}
    for i, (n, d) in enumerate(names):
        r, c = divmod(i, 3)
        svc[n] = b.rect([n, d], 80 + c * 250, 560 + r * 92, 230, 76, 'proc', size=F - 1, bold_first=True)
    b.frame('Tích hợp Jira (một chiều)', 870, 520, 320, 370, 'jira', size=F)
    js = b.rect(['JiraService', 'YC1, 8, 13, 14'], 890, 560, 280, 70, 'jira', size=F - 1, bold_first=True)
    b.rect(['Đồng bộ định kỳ', 'JIRA_SYNC_MINUTES'], 890, 640, 280, 70, 'jira', size=F - 1, bold_first=True)
    b.rect(['Tách Description', 'mô tả + acceptance criteria'], 890, 720, 280, 70, 'jira', size=F - 1, bold_first=True)
    b.rect(['Ánh xạ dữ liệu', 'priority, story point, sprint'], 890, 800, 280, 70, 'jira', size=F - 1, bold_first=True)
    b.frame('AI Service (module riêng)', 60, 880, 780, 220, 'ai', size=F)
    a1 = b.rect(['Che dữ liệu nhạy cảm', '(PII)'], 80, 920, 340, 72, 'ai', size=F)
    a2 = b.rect(['Chống prompt injection,', 'ghép prompt'], 470, 920, 340, 72, 'ai', size=F)
    a3 = b.rect(['LLMProvider', '(Strategy)'], 470, 1012, 340, 72, 'ai', size=F)
    a4 = b.rect(['Kiểm tra JSON schema,', 'thử lại'], 80, 1012, 340, 72, 'ai', size=F)
    dal = b.rect(['Truy cập dữ liệu', 'better-sqlite3,', 'prepared statement'], 870, 930, 320, 110, 'data', size=F, bold_first=True)
    pwf = b.frame('Playwright Worker', 30, 1250, 310, 170, 'ext', size=F)
    pw = b.rect(['@playwright/test', 'Chrome, timeout,', 'env tối thiểu'], 50, 1290, 270, 110, 'ext', size=F - 1, bold_first=True)
    aut = b.rect(['«hệ thống ngoài»', 'Web cần test'], 370, 1290, 220, 110, 'ext', size=F, bold_first=True)
    llm = b.rect(['«hệ thống ngoài»', 'LLM API', 'Gemini · Claude · …'], 620, 1290, 250, 110, 'ext', size=F, bold_first=True)
    db = b.cyl(['CSDL', 'SQLite / PostgreSQL', '14 bảng'], 900, 1260, 290, 160)
    L = b.link
    L([(460, 197), (460, 290)], label='HTTPS + JWT', lpos=(560, 232), size=17)
    L([(460, 374), (460, 400)])
    L([(450, 484), (450, 520)])
    L([(860, 484), (860, 595), (890, 595)], label=None)
    L([b.mid(jira, 'bottom'), (1050, 290)], dashed=True, color='#0052CC', label='webhook', lpos=(1050, 250), size=17)
    L([b.mid(wh, 'bottom'), (1050, 520)])
    L([(1170, 595), (1205, 595), (1205, 210)], color='#0052CC')
    b.tag('REST', 1205, 420, size=16)
    L([(450, 850), (450, 880)])
    L([b.mid(a1, 'right'), b.mid(a2, 'left')]); L([b.mid(a2, 'bottom'), b.mid(a3, 'top')]); L([b.mid(a3, 'left'), b.mid(a4, 'right')])
    L([(840, 800), (855, 800), (855, 985), (870, 985)])
    L([(1030, 890), (1030, 930)])
    L([b.mid(dal, 'bottom'), (1030, 1272)])
    L([b.mid(a3, 'bottom'), (640, 1170), (745, 1170), b.mid(llm, 'top')], label='prompt đã che PII', lpos=(745, 1195), size=16)
    sy = b.mid(svc['ScriptService'], 'left')[1]
    L([b.mid(svc['ScriptService'], 'left'), (45, sy), (45, 1232), (270, 1232), (270, 1290)], label='script đã kiểm tra tĩnh', lpos=(160, 1208), size=16)
    L([b.mid(pw, 'right'), b.mid(aut, 'left')])
    b.tag('Mỗi YC nằm trong một service riêng; route chỉ kiểm tra quyền rồi gọi service. Không ghi ngược lên Jira.', 620, 1455, size=16, bg=False, italic=True)
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
    app = b.rect(['Container app', 'Node.js 21 · Express 5', 'Playwright + Chromium', 'CPU ≤ 2 · RAM ≤ 2 GB', 'no-new-privileges'], 240, 470, 380, 200, 'proc', size=F, bold_first=True)
    vol = b.cyl(['Volume app-data', 'CSDL app.db', 'ảnh chụp lỗi'], 680, 490, 230, 160)
    llm = b.rect(['«hệ thống ngoài»', 'LLM API', 'Gemini · Claude · OpenAI'], 40, 930, 320, 110, 'ext', size=F, bold_first=True)
    aut = b.rect(['«hệ thống ngoài»', 'Web cần test', 'saucedemo.com'], 410, 930, 320, 110, 'ext', size=F, bold_first=True)
    jira = b.rect(['«hệ thống ngoài»', 'Jira Cloud', 'REST API · webhook'], 780, 930, 320, 110, 'jira', size=F, bold_first=True)
    b.note(['app/.env (chỉ trên máy chủ, không commit): JWT_SECRET, khóa LLM,', 'JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_WEBHOOK_SECRET'], 100, 1090, 950, 76, size=18)
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
    ai, h_ai = b.uml_class('AIService', ['-provider: LLMProvider'], ['+generateTestCases(story, userId)', '+generateScript(tc, baseUrl, userId)',
                           '-callWithRetry(prompt, schema)', '-insertLog(entry)'], 30, 80, 560, **K)
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
               ('PromptBuilder', [], ['+buildTestCasePrompt()', '+buildScriptPrompt()']), ('Schemas', ['testCaseSchema', 'generateResultSchema', 'scriptResultSchema'], [])]
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
    tc, h_tc = b.uml_class('TestCaseService', [], ['+saveAiResult(story, tcs, logId, userId)', '+create() · update() · remove()', '+submit(ids) · review(id)', '+history(id)'], 30, 720, 560, **K)
    sc, h_sc = b.uml_class('ScriptService', ['-FORBIDDEN: mẫu mã bị cấm'], ['+generate(tcId, userId)', '+save(tcId, code)', '+run(tcId, userId)', '+staticCheck(code)'], 640, 800, 530, **K)
    rn, h_rn = b.uml_class('RunService', [], ['+record(tcId, result, extra)', '+reportFix(runId, input)'], 640, 1025, 530, **K)
    b.link([(640, 860), (590, 860)], head='open', label='đọc test case', lpos=(615, 840) if False else (700, 785), size=16)
    b.link([(905, 976), (905, 1025)], head='open')
    b.tag('ghi lần chạy', 915, 1000, size=16, bg=False, anchor='start')
    b.link([(1170, 900), (1185, 900), (1185, 60), (300, 60), (300, 80)], head='open', label='generateScript()', lpos=(800, 60), size=16)
    b.tag('Route POST /stories/:id/generate: StoryService.assertReady → AIService.generateTestCases → TestCaseService.saveAiResult', 600, 1165, size=16, bg=False, italic=True)
    return b


@diagram('Lop_TichHopJira', 'Sơ đồ lớp – tích hợp Jira')
def lop_jira():
    b = Board(1200, 1130)
    b.title('Sơ đồ lớp – tích hợp Jira một chiều (Jira → hệ thống)', size=26)
    K = dict(size=18, row=26)
    b.uml_class('AdminRoutes', [], ['GET /jira/info', 'POST /jira/test  (jira:connect)', 'POST /jira/import  (jira:import)', 'POST /projects/:id/jira-sync'], 30, 80, 560, stereo='route', **K)
    b.uml_class('WebhookRoute', [], ['POST /api/jira/webhook?secret=…', '(không qua JWT)'], 30, 320, 560, stereo='route', kind='sec', **K)
    b.uml_class('Scheduler', ['JIRA_SYNC_MINUTES = 5'], ['setInterval(syncAll)'], 30, 500, 560, stereo='server.js', **K)
    _, h_jc = b.uml_class('JiraCloud', ['REST v3: /project, /search/jql, /field', 'Agile: /board, /board/{id}/sprint'], ['webhook: jira:issue_*, sprint_*'],
                          640, 80, 530, stereo='hệ thống ngoài', kind='jira', **K)
    _, h_js = b.uml_class('JiraService', ['-config.jira: baseUrl, email, apiToken', '-MOCK_PROJECTS (Jira giả lập)'],
                          ['+testConnection()', '+importProject(key, userId)', '+syncProject(projectId, userId)', '+syncAll(userId)',
                           '+checkWebhookSecret(secret)', '+handleWebhook(body)', '-fetchProject · fetchStories · fetchSprints',
                           '-saveProjectMeta · saveSprints · saveStories'], 640, 300, 530, stereo='service', kind='jira', **K)
    b.uml_class('DescriptionParser', [], ['+adfLines(adf): string[]', '+splitDescription(adf)', '+mapPriority(name)'], 640, 690, 530, stereo='module', kind='jira', **K)
    b.uml_class('StoryService', [], ['+list(filter)', '+get(id)', '+markReviewed(id)', '+assertReady(story)'], 30, 680, 270, **K)
    b.uml_class('SprintService', [], ['+list(projectId)', '+burndown(id)', '-storyProgress()'], 320, 680, 270, **K)
    b.uml_class('Bảng dữ liệu', ['projects (jira_key, synced_at) · project_members · modules', 'sprints (jira_id, state)',
                'user_stories (code, jira_status, synced_at, changed_at, archived)'], [], 30, 910, 1140, stereo='CSDL', kind='data', **K)
    L = b.link
    L([(590, 170), (615, 170), (615, 340), (640, 340)], head='open', label='gọi', lpos=(615, 255), size=16)
    L([(590, 390), (640, 390)], head='open', label='gọi', lpos=(615, 374), size=16)
    L([(590, 560), (640, 560)], head='open')
    L([(905, 300), (905, 80 + h_jc)], head='open', color='#0052CC', label='HTTPS, Basic auth', lpos=(1010, 262), size=16)
    L([(1000, 80), (1000, 62), (15, 62), (15, 380), (30, 380)], dashed=True, color='#0052CC', label='webhook khi story, sprint đổi', lpos=(500, 62), size=16)
    L([(905, 300 + h_js), (905, 690)], head='open', dashed=True, label='«use»', lpos=(960, 657), size=16)
    L([(1170, 600), (1185, 600), (1185, 970), (1170, 970)], head='open', label='ghi', lpos=(1185, 800), size=16)
    L([(165, 856), (165, 910)], head='open', label='đọc', lpos=(200, 883), size=16)
    L([(455, 830), (455, 910)], head='open', label='đọc', lpos=(490, 870), size=16)
    b.tag('StoryService, SprintService chỉ đọc: hệ thống không có API tạo, sửa, xóa user story hay sprint.', 600, 1108, size=16, bg=False, italic=True)
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
             ('s', 'R', 'assertReady: còn trên Jira, đủ AC'),
             ('m', 'R', 'AI', 'generateTestCases(story)'),
             ('s', 'AI', 'maskPII() + detectInjection()'), ('s', 'AI', 'buildTestCasePrompt(max)'),
             ('loop', 'tối đa 1 + AI_MAX_RETRY lần'), ('m', 'AI', 'L', 'complete(prompt)'), ('r', 'L', 'AI', 'JSON thô'),
             ('s', 'AI', 'JSON.parse + Zod schema'), ('end',),
             ('m', 'AI', 'DB', 'INSERT ai_logs'), ('r', 'AI', 'R', 'testCases, aiLogId'),
             ('m', 'R', 'TC', 'saveAiResult(story, testCases)'), ('m', 'TC', 'DB', 'thay Nháp cũ, INSERT'),
             ('m', 'R', 'DB', 'INSERT audit_logs'), ('r', 'R', 'T', '200: danh sách test case Nháp')]
    b.w, b.h = sequence(b, parts, steps, **SEQ)
    return b


@diagram('TuanTu_DuyetTestCase', 'Sơ đồ tuần tự – Gửi duyệt và duyệt test case (YC3, YC4)')
def tt_duyet():
    b = Board(10, 10)
    b.title('Sơ đồ tuần tự – Gửi duyệt và duyệt test case (YC3 + YC4)', size=26)
    parts = [('T', 'Tester', 'actor'), ('Q', 'QA Lead', 'actor'), ('S', 'TestCaseService', 'box'), ('DB', 'CSDL', 'data')]
    steps = [('m', 'T', 'S', 'submit([id…])'), ('m', 'S', 'DB', 'kiểm trạng thái DRAFT/RETURNED'), ('m', 'S', 'DB', 'UPDATE PENDING_REVIEW'),
             ('r', 'S', 'T', 'đã gửi duyệt n test case'), ('m', 'Q', 'S', 'mở hàng đợi duyệt'), ('r', 'S', 'Q', 'danh sách Chờ duyệt'),
             ('alt', 'Trả lại'), ('m', 'Q', 'S', 'review(RETURNED, ghi chú)'), ('s', 'S', 'ghi chú rỗng → lỗi 400 (QĐ4)'),
             ('m', 'S', 'DB', 'RETURNED; reviews, audit_logs'), ('r', 'S', 'T', 'hiển thị ghi chú trả lại'),
             ('else', 'Duyệt'), ('m', 'Q', 'S', 'review(APPROVED)'), ('m', 'S', 'DB', 'APPROVED; reviews, audit_logs'), ('end',)]
    b.w, b.h = sequence(b, parts, steps, gap=330, head_w=200, size=19, row=58)
    return b


@diagram('TuanTu_ChayScript', 'Sơ đồ tuần tự – Sinh và chạy script Playwright (YC10)')
def tt_script():
    b = Board(10, 10)
    b.title('Sơ đồ tuần tự – Sinh và chạy script Playwright (YC10)', size=26)
    parts = [('T', 'Tester', 'actor'), ('S', 'ScriptService', 'box'), ('DB', 'CSDL', 'data'), ('AI', 'AI Service', 'ai'),
             ('W', 'Playwright\nWorker', 'ext'), ('APP', 'Web cần test', 'ext')]
    steps = [('m', 'T', 'S', 'Sinh script (TC Đã duyệt)'), ('m', 'S', 'AI', 'generateScript(tc, baseUrl)'), ('r', 'AI', 'S', 'mã Playwright'),
             ('m', 'S', 'DB', 'lưu automation_scripts'), ('m', 'T', 'S', 'Chạy tự động'),
             ('s', 'S', 'staticCheck: chặn fs, child_process, eval'),
             ('s', 'S', 'ghi file tạm <mã>-<ngẫu nhiên>.spec.js'), ('m', 'S', 'W', 'spawn playwright test (timeout)'),
             ('m', 'W', 'APP', 'mở Chrome, thao tác'), ('r', 'APP', 'W', 'giao diện'), ('r', 'W', 'S', 'báo cáo JSON (+ ảnh khi lỗi)'),
             ('s', 'S', 'xóa file tạm'), ('m', 'S', 'DB', 'INSERT test_runs'), ('r', 'S', 'T', 'Pass / Fail')]
    b.w, b.h = sequence(b, parts, steps, **SEQ)
    return b


@diagram('TuanTu_DongBoJira', 'Sơ đồ tuần tự – Đồng bộ user story từ Jira (YC1, YC8)')
def tt_jira():
    b = Board(10, 10)
    b.title('Sơ đồ tuần tự – Đồng bộ user story, sprint từ Jira (YC1, YC8)', size=26)
    parts = [('QT', 'QA Lead /\nTester', 'actor'), ('WH', 'Route webhook\n/ jira-sync', 'box'), ('JS', 'JiraService', 'jira'),
             ('DB', 'CSDL', 'data'), ('J', 'Jira Cloud', 'jira'), ('PO', 'PO / BA', 'actor')]
    steps = [('m', 'PO', 'J', 'tạo / sửa Story (có AC)'),
             ('alt', 'Jira gọi webhook'), ('m', 'J', 'WH', 'POST /api/jira/webhook?secret=…'), ('s', 'WH', 'checkWebhookSecret (sai → 401)'),
             ('else', 'Đồng bộ ngay, hoặc định kỳ 5 phút'), ('m', 'QT', 'WH', 'POST /projects/:id/jira-sync'), ('end',),
             ('m', 'WH', 'JS', 'syncProject(id)'),
             ('m', 'JS', 'J', 'GET /project, /user/assignable'), ('m', 'JS', 'J', 'GET /board, /board/{id}/sprint'),
             ('m', 'JS', 'J', 'POST /search/jql (Story)'), ('r', 'J', 'JS', 'Summary, ADF, Priority, SP, sprint'),
             ('s', 'JS', 'splitDescription → mô tả + AC'),
             ('m', 'JS', 'DB', 'lưu sprint, thành viên'), ('m', 'JS', 'DB', 'đọc story cũ'),
             ('opt', 'nội dung đổi, đã có test case'), ('m', 'JS', 'DB', 'changed_at = now'), ('end',),
             ('m', 'JS', 'DB', 'mất trên Jira → archived'), ('r', 'JS', 'WH', 'số mới, cập nhật, lưu trữ'),
             ('r', 'WH', 'QT', 'kết quả + cảnh báo'),
             ('m', 'QT', 'DB', 'Tester: POST /stories/:id/reviewed')]
    b.w, b.h = sequence(b, parts, steps, **SEQ)
    return b


@diagram('LuongManHinh', 'Sơ đồ luồng màn hình')
def luong_man_hinh():
    b = Board(1200, 1180)
    b.title('Sơ đồ luồng màn hình', size=26)
    mh = lambda code, name, x, y, k='user', w=300: b.rect([code, name], x, y, w, 76, k, size=20, bold_first=True)
    m1 = mh('MH01', 'Đăng nhập', 450, 70)
    m2 = mh('MH02', 'Tổng quan & báo cáo', 450, 200)
    biz = [('MH14', 'Sprint (từ Jira)'), ('MH03', 'User story (từ Jira)'), ('MH06', 'Tra cứu test case'), ('MH07', 'Duyệt test case'), ('MH08', 'Kết quả chạy test')]
    ys = [340, 450, 560, 670, 780]
    ids = [mh(c, n, 120, y) for (c, n), y in zip(biz, ys)]
    m4 = mh('MH04', 'Chi tiết user story', 520, 395)
    m5 = mh('MH05', 'Chi tiết test case', 520, 725, 'proc')
    b.tag('(4 tab: chi tiết · lịch sử · chạy test · script)', 670, 820, size=17, bg=False, italic=True)
    L = b.link
    L([b.mid(m1, 'bottom'), b.mid(m2, 'top')])
    L([b.mid(m2, 'left'), (60, 238), (60, 818)], head='none')
    for i, y in zip(ids, ys):
        L([(60, y + 38), (120, y + 38)])
    L([(420, 378), (470, 378), (470, 420), (520, 420)])
    L([(420, 488), (470, 488), (470, 446), (520, 446)])
    L([b.mid(m4, 'bottom'), b.mid(m5, 'top')])
    for y in (598, 708, 818):
        L([(420, y), (480, y)], head='none')
    L([(480, 598), (480, 818)], head='none')
    L([(480, 763), (520, 763)])
    adm = [('MH09', 'Thay đổi quy định', 'gray'), ('MH10', 'Nhật ký AI', 'gray'), ('MH11', 'Dự án & Jira', 'jira'),
           ('MH12', 'Người dùng', 'gray'), ('MH13', 'Nhật ký hoạt động', 'gray')]
    b.frame('Quản trị (theo quyền)', 880, 300, 290, 560, 'gray', size=18)
    for i, (c, n, k) in enumerate(adm):
        mh(c, n, 900, 345 + i * 100, k, w=250)
    L([b.mid(m2, 'right'), (1025, 238), (1025, 300)])
    b.tag('Màu: xanh dương – nghiệp vụ · tím – hộp thoại test case · xanh Jira – đồng bộ · xám – quản trị', 600, 900, size=17, bg=False, italic=True)
    b.tag('MH03, MH14 chỉ đọc dữ liệu đồng bộ từ Jira; nút Đồng bộ từ Jira chỉ có ở Admin, QA Lead.', 600, 935, size=17, bg=False, italic=True)
    b.h = 970
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
    b.title('Tháp kiểm thử tự động: 82 test chạy trên CI', size=26)
    b.trap(['E2E – Playwright (9)', 'luồng qua giao diện thật'], 290, 80, 520, 120, 100, 'ai', size=20)
    b.trap(['API / tích hợp – supertest (50)', 'quy định, phân quyền, bảo mật,', 'sprint, đồng bộ Jira'], 190, 200, 720, 140, 100, 'proc', size=20)
    b.trap(['Unit – node:test (23)', 'che PII, chống injection,', 'kiểm tra tĩnh, AI mock, schema'], 90, 340, 920, 140, 100, 'done', size=20)
    b.tag('Thêm 8 test Playwright mẫu (Page Object) trên saucedemo.com', 550, 520, size=18, bg=False, italic=True)
    return b


@diagram('CI_Pipeline', 'Quy trình CI trên GitHub Actions')
def ci():
    b = Board(1100, 760)
    b.title('Quy trình CI trên GitHub Actions', size=26)
    p = b.rect(['git push / Pull Request'], 350, 70, 400, 70, 'user', size=20, bold_first=True)
    u = b.rect(['Job 1: Unit & API test', 'npm ci → npm test (73 test)'], 330, 200, 440, 100, 'proc', size=20, bold_first=True)
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
