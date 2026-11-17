#!/usr/bin/env python3
"""
Sinh hai sơ đồ của Chương 1 – Khảo sát hiện trạng bằng draw.io:

  SoDoToChuc       sơ đồ tổ chức (mục 1.3), các luồng đánh số (1)…(8) theo thứ tự công việc trong một sprint
  QuyTrinhHienTai  sơ đồ hoạt động chia làn theo bộ phận (mục 1.4), bám bảng nghiệp vụ NV1–NV10

Chạy:  python3 docs/hientrang/generate_hientrang.py
Kết quả: <tên>.drawio (mở bằng draw.io để sửa) và <tên>.svg (chèn vào báo cáo) trong docs/hientrang/.
"""
import math
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).parent
FONT = 'Times New Roman'
FILL, STROKE = '#ECECFF', '#9370DB'          # bộ phận / hoạt động
EXT_FILL, EXT_STROKE = '#FFF4DD', '#C9A227'  # đối tác bên ngoài
TEAM_FILL = '#FFFFDE'                        # khung "Đội kiểm thử"
LANE_HEAD = '#F2F2F2'                        # tiêu đề làn


def attr(s):
    return escape(s, {'"': '&quot;'})


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.cells, self.svg, self.n = [], [], 1
        self.geo = {}

    def _id(self):
        self.n += 1
        return f'c{self.n}'

    def _vertex(self, value, style, x, y, w, h):
        cid = self._id()
        self.cells.append(f'<mxCell id="{cid}" value="{attr(value)}" style="{style}" vertex="1" parent="1">'
                          f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        self.geo[cid] = (x, y, w, h)
        return cid

    def _svg_lines(self, lines, cx, cy, size, bold_first=False):
        top = cy - (len(lines) - 1) * size * 0.6
        for i, line in enumerate(lines):
            weight = ' font-weight="bold"' if bold_first and i == 0 else ''
            self.svg.append(f'<text x="{cx:.1f}" y="{top + i * size * 1.2:.1f}" font-size="{size}"{weight} fill="#000" '
                            f'text-anchor="middle" dominant-baseline="middle">{escape(line)}</text>')

    @staticmethod
    def _html(lines, bold_first):
        first = f'<b>{escape(lines[0])}</b>' if bold_first else escape(lines[0])
        return first + ''.join('<br>' + escape(s) for s in lines[1:])

    def box(self, lines, x, y, w, h, external=False, bold_first=True, size=20):
        """Bộ phận (dòng 1 in đậm là tên) hoặc hoạt động (bold_first=False)."""
        fill, stroke = (EXT_FILL, EXT_STROKE) if external else (FILL, STROKE)
        cid = self._vertex(self._html(lines, bold_first),
                           f'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};strokeWidth=2;'
                           f'fontFamily={FONT};fontSize={size};fontColor=#000000;', x, y, w, h)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
        self._svg_lines(lines, x + w / 2, y + h / 2, size, bold_first)
        return cid

    def pill(self, text, x, y, w, h, size=20):
        """Điểm bắt đầu / kết thúc."""
        cid = self._vertex(escape(text), f'rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor={FILL};strokeColor={STROKE};'
                                         f'strokeWidth=2;fontFamily={FONT};fontSize={size};fontStyle=1;fontColor=#000000;', x, y, w, h)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h / 2}" fill="{FILL}" stroke="{STROKE}" stroke-width="2"/>')
        self._svg_lines([text], x + w / 2, y + h / 2, size, True)
        return cid

    def diamond(self, text, x, y, w, h, size=20):
        """Điều kiện rẽ nhánh (câu hỏi)."""
        cid = self._vertex(escape(text), f'rhombus;whiteSpace=wrap;html=1;fillColor={FILL};strokeColor={STROKE};strokeWidth=2;'
                                         f'fontFamily={FONT};fontSize={size};fontColor=#000000;', x, y, w, h)
        pts = [(x + w / 2, y), (x + w, y + h / 2), (x + w / 2, y + h), (x, y + h / 2)]
        self.svg.append(f'<polygon points="{" ".join(f"{a},{b}" for a, b in pts)}" fill="{FILL}" stroke="{STROKE}" stroke-width="2"/>')
        self._svg_lines([text], x + w / 2, y + h / 2, size)
        return cid

    def bar(self, x, y, w, h=8):
        """Thanh đồng bộ: rẽ nhánh song song / hợp nhánh."""
        cid = self._vertex('', 'rounded=0;html=1;fillColor=#000000;strokeColor=none;', x, y, w, h)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#000"/>')
        return cid

    def lanes(self, names, x, y, widths, h, head=50):
        """Các làn dọc, mỗi làn một bộ phận."""
        for name, w in zip(names, widths):
            self._vertex('', 'rounded=0;html=1;fillColor=none;strokeColor=#999999;strokeWidth=1;', x, y, w, h)
            self._vertex(f'<b>{escape(name)}</b>', f'rounded=0;whiteSpace=wrap;html=1;fillColor={LANE_HEAD};strokeColor=#999999;'
                                                   f'fontFamily={FONT};fontSize=20;fontColor=#000000;', x, y, w, head)
            self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="#999" stroke-width="1"/>'
                            f'<rect x="{x}" y="{y}" width="{w}" height="{head}" fill="{LANE_HEAD}" stroke="#999" stroke-width="1"/>')
            self._svg_lines([name], x + w / 2, y + head / 2, 20, True)
            x += w

    def team(self, text, x, y, w, h):
        cid = self._vertex(escape(text), f'rounded=1;arcSize=4;whiteSpace=wrap;html=1;fillColor={TEAM_FILL};strokeColor=#AAAA33;'
                                         f'strokeWidth=2;dashed=1;verticalAlign=top;fontFamily={FONT};fontSize=20;fontStyle=3;'
                                         f'fontColor=#000000;', x, y, w, h)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{TEAM_FILL}" stroke="#AAAA33" '
                        f'stroke-width="2" stroke-dasharray="10 6"/>'
                        f'<text x="{x + w / 2}" y="{y + 24}" font-size="20" font-weight="bold" font-style="italic" '
                        f'text-anchor="middle" dominant-baseline="middle">{escape(text)}</text>')
        return cid

    def flow(self, src, dst, pts, label=None, lpos=None, dashed=False, arrow=True):
        """Luồng: pts là các điểm gấp khúc (điểm đầu nằm trên src, điểm cuối nằm trên dst); lpos: tâm nhãn."""
        sx, sy, sw, sh = self.geo[src]
        tx, ty, tw, th = self.geo[dst]
        (x1, y1), (x2, y2) = pts[0], pts[-1]
        style = (f'edgeStyle=none;html=1;strokeWidth=2;strokeColor=#333333;rounded=0;'
                 f'exitX={(x1 - sx) / sw:.3f};exitY={(y1 - sy) / sh:.3f};exitDx=0;exitDy=0;'
                 f'entryX={(x2 - tx) / tw:.3f};entryY={(y2 - ty) / th:.3f};entryDx=0;entryDy=0;'
                 + ('dashed=1;' if dashed else '')
                 + ('endArrow=block;endFill=1;' if arrow else 'endArrow=none;'))
        way = ''.join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in pts[1:-1])
        self.cells.append(f'<mxCell id="{self._id()}" value="" style="{style}" edge="1" parent="1" source="{src}" target="{dst}">'
                          f'<mxGeometry relative="1" as="geometry"><Array as="points">{way}</Array></mxGeometry></mxCell>')
        da = ' stroke-dasharray="8 6"' if dashed else ''
        px, py = pts[-2]
        ang = math.atan2(y2 - py, x2 - px)
        end = (x2 - 14 * math.cos(ang), y2 - 14 * math.sin(ang)) if arrow else (x2, y2)
        path = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts[:-1] + [end])
        self.svg.append(f'<polyline points="{path}" fill="none" stroke="#333" stroke-width="2"{da}/>')
        if arrow:
            hx, hy = end
            head = [(x2, y2), (hx - 7 * math.sin(ang), hy + 7 * math.cos(ang)), (hx + 7 * math.sin(ang), hy - 7 * math.cos(ang))]
            self.svg.append(f'<polygon points="{" ".join(f"{a:.1f},{b:.1f}" for a, b in head)}" fill="#333"/>')
        if label:
            self.label(label, *lpos)

    def label(self, text, cx, cy):
        lines = text.split('\n')
        bw, bh = max(len(s) for s in lines) * 9 + 14, len(lines) * 22 + 6
        x, y = cx - bw / 2, cy - bh / 2
        value = '<br>'.join(escape(s) for s in lines)
        self.cells.append(f'<mxCell id="{self._id()}" value="{attr(value)}" style="text;html=1;align=center;verticalAlign=middle;'
                          f'labelBackgroundColor=#FFFFFF;fontFamily={FONT};fontSize=18;fontColor=#000000;" vertex="1" parent="1">'
                          f'<mxGeometry x="{x:.0f}" y="{y:.0f}" width="{bw:.0f}" height="{bh:.0f}" as="geometry"/></mxCell>')
        self.svg.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.0f}" height="{bh:.0f}" fill="#fff"/>')
        self._svg_lines(lines, cx, cy, 18)

    def save(self, name, page_name):
        model = ('<mxGraphModel dx="1600" dy="1000" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
                 f'fold="1" page="1" pageScale="1" pageWidth="{self.w}" pageHeight="{self.h}" math="0" shadow="0"><root>'
                 '<mxCell id="0"/><mxCell id="1" parent="0"/>' + ''.join(self.cells) + '</root></mxGraphModel>')
        (OUT / f'{name}.drawio').write_text(
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<mxfile host="generate_hientrang.py" agent="SE104 AI TestCase Manager" version="24.0.0">'
            f'<diagram id="p1" name="{attr(page_name)}">{model}</diagram></mxfile>\n', encoding='utf-8')
        (OUT / f'{name}.svg').write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" '
            f'font-family="{FONT}, Times, serif"><rect width="100%" height="100%" fill="#fff"/>' + ''.join(self.svg) + '</svg>\n',
            encoding='utf-8')


def so_do_to_chuc():
    c = Canvas(1100, 1000)
    kh = c.box(['Khách hàng', '(đối tác bên ngoài)'], 410, 30, 280, 90, external=True)
    pm = c.box(['Product Owner / BA', 'Viết user story'], 410, 230, 280, 90)
    qal = c.box(['QA Lead', 'Phân công, duyệt test case,', 'tổng hợp báo cáo'], 60, 430, 320, 110)
    dev = c.box(['Developer', 'Lập trình, sửa lỗi'], 720, 440, 320, 90)
    team = c.team('Đội kiểm thử', 60, 660, 980, 170)
    t1 = c.box(['Tester', 'Viết & chạy test case'], 110, 710, 360, 90)
    t2 = c.box(['Automation Tester', 'Viết script tự động'], 630, 710, 360, 90)
    ai = c.box(['Nhà cung cấp AI', '(đối tác bên ngoài)'], 410, 890, 280, 90, external=True)

    # (1) → (8): thứ tự công việc trong một sprint
    c.flow(kh, pm, [(510, 120), (510, 230)], '(1) yêu cầu', (430, 175))
    c.flow(pm, qal, [(410, 275), (220, 275), (220, 430)], '(2) user story', (300, 275))
    c.flow(pm, dev, [(690, 275), (880, 275), (880, 440)], '(2) user story', (800, 275))
    c.flow(qal, team, [(130, 540), (130, 660)], '(3) phân công', (130, 600))
    c.flow(dev, team, [(820, 530), (820, 660)], '(4) bản build', (820, 600))
    c.flow(team, dev, [(960, 660), (960, 530)], '(5) báo lỗi', (960, 600))
    c.flow(team, qal, [(310, 660), (310, 540)], '(6) kết quả test,\nkết quả chạy script', (310, 600))
    c.flow(qal, kh, [(110, 430), (110, 75), (410, 75)], '(7) báo cáo chất lượng', (230, 75))
    c.flow(pm, kh, [(590, 230), (590, 120)], '(8) nghiệm thu', (670, 175))
    # Hiện trạng: Tester và Automation Tester tự dùng AI bên ngoài
    c.flow(ai, t1, [(470, 890), (470, 845), (290, 845), (290, 800)], 'dịch vụ LLM', (380, 845), dashed=True)
    c.flow(ai, t2, [(630, 890), (630, 845), (810, 845), (810, 800)], 'dịch vụ LLM', (720, 845), dashed=True)
    c.save('SoDoToChuc', 'Sơ đồ tổ chức')


def quy_trinh_hien_tai():
    # Làn (tâm x): PO/BA 140 · QA Lead 390 · Tester 650 · Developer 910 · Automation Tester 1170
    c = Canvas(1320, 1420)
    c.lanes(['PO / BA', 'QA Lead', 'Tester', 'Developer', 'Automation Tester'], 20, 20, [240, 260, 260, 260, 260], 1380)
    act = lambda lines, cx, cy, w=230, h=80: c.box(lines, cx - w / 2, cy - h / 2, w, h, bold_first=False, size=18)

    s = c.pill('Bắt đầu sprint', 60, 105, 160, 50)
    a = act(['Tạo user story', 'trên Jira (NV1)'], 140, 220, 210, 70)
    b = act(['Lập kế hoạch sprint,', 'chọn story, phân công (NV9)'], 390, 320, 240, 70)
    f1 = c.bar(330, 396, 680)
    t_viet = act(['Viết test case trên Excel', '(NV2); một số người dán', 'story vào ChatGPT'], 650, 485, 230, 90)
    d_code = act(['Lập trình chức năng'], 910, 485, 210, 70)
    t_gui = act(['Gửi file Excel cho', 'QA Lead qua chat/email'], 650, 595, 230, 70)
    q_xem = act(['Xem file, nhận xét qua', 'chat (không lưu vết) (NV4)'], 390, 595, 240, 70)
    q_dat = c.diamond('Đạt?', 340, 660, 100, 80)
    t_sua = act(['Sửa đè file Excel', '(_v2, _final) (NV3)'], 650, 700, 230, 70)
    d_build = act(['Bàn giao bản build', 'lên môi trường test'], 910, 700, 210, 70)
    f2 = c.bar(330, 796, 900)
    t_chay = act(['Chạy test thủ công trên', 'bản build, tô màu kết quả', 'trên Excel (NV5)'], 650, 885, 230, 90)
    a_viet = act(['Đọc test case trên Excel,', 'viết lại thành script; nhờ', 'ChatGPT/Copilot (NV7)'], 1170, 885, 236, 90)
    t_loi = c.diamond('Có lỗi?', 590, 960, 120, 80)
    a_chay = act(['Chạy script (cuối sprint);', 'Fail thì báo lỗi'], 1170, 1000, 236, 70)
    t_bug = act(['Tạo bug trên Jira, ghi', 'mã bug vào Excel (NV6)'], 650, 1100, 190, 70)
    d_sua = act(['Sửa lỗi'], 910, 1100, 210, 60)
    j = c.bar(330, 1176, 900)
    q_bc = act(['Tổng hợp báo cáo bằng tay', 'từ nhiều file Excel (1–2 giờ),', 'gửi khách hàng (NV8)'], 390, 1265, 240, 90)
    e = c.pill('Kết thúc sprint', 310, 1350, 160, 44)

    c.flow(s, a, [(140, 155), (140, 185)])
    c.flow(a, b, [(140, 255), (140, 320), (270, 320)])
    c.flow(b, f1, [(390, 355), (390, 396)])
    c.flow(f1, t_viet, [(650, 404), (650, 440)])
    c.flow(f1, d_code, [(910, 404), (910, 450)])
    c.flow(t_viet, t_gui, [(650, 530), (650, 560)])
    c.flow(t_gui, q_xem, [(535, 595), (510, 595)])
    c.flow(q_xem, q_dat, [(390, 630), (390, 660)])
    c.flow(q_dat, t_sua, [(440, 700), (535, 700)], 'Chưa đạt', (488, 682))
    c.flow(t_sua, t_gui, [(650, 665), (650, 630)])
    c.flow(d_code, d_build, [(910, 520), (910, 665)])
    c.flow(q_dat, f2, [(390, 740), (390, 796)], 'Đạt', (420, 768))
    c.flow(d_build, f2, [(910, 735), (910, 796)])
    c.flow(f2, t_chay, [(650, 804), (650, 840)])
    c.flow(f2, a_viet, [(1170, 804), (1170, 840)])
    c.flow(t_chay, t_loi, [(650, 930), (650, 960)])
    c.flow(a_viet, a_chay, [(1170, 930), (1170, 965)])
    c.flow(t_loi, t_bug, [(650, 1040), (650, 1065)], 'Có', (675, 1052))
    c.flow(t_bug, d_sua, [(745, 1100), (805, 1100)])
    c.flow(d_sua, t_chay, [(910, 1070), (910, 900), (765, 900)], 'bản build mới', (910, 1010))
    c.flow(t_loi, j, [(590, 1000), (535, 1000), (535, 1176)], 'Không', (535, 1130))
    c.flow(a_chay, j, [(1170, 1035), (1170, 1176)])
    c.flow(j, q_bc, [(390, 1184), (390, 1220)])
    c.flow(q_bc, e, [(390, 1310), (390, 1350)])
    c.save('QuyTrinhHienTai', 'Quy trình hiện tại')


def main():
    so_do_to_chuc()
    quy_trinh_hien_tai()
    print(f'Đã tạo SoDoToChuc và QuyTrinhHienTai (.drawio, .svg) trong {OUT}')


if __name__ == '__main__':
    main()
