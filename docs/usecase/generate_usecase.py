#!/usr/bin/env python3
"""
Sinh sơ đồ use case tổng quát (mục 3.1, Chương 3 – Phân tích) bằng draw.io, theo ký hiệu UML.

Chạy:  python3 docs/usecase/generate_usecase.py
Kết quả: docs/usecase/UseCaseTongQuat.drawio (mở bằng draw.io để sửa) và UseCaseTongQuat.svg (chèn vào báo cáo).

Quyền của từng tác nhân lấy theo ma trận PERMISSIONS trong app/src/middleware/auth.js và bảng 3.2:
- "Người dùng" là tác nhân trừu tượng: mọi vai trò đều đăng nhập, tra cứu, xuất Excel, xem báo cáo, kết quả chạy, user story, sprint.
- User story và sprint chỉ đồng bộ một chiều từ Jira (UC22); PO/BA viết story trên Jira nên trong hệ thống chỉ có quyền của Người dùng.
- Developer báo đã sửa lỗi (UC21, YC15) để Tester kiểm thử lại.
- Admin, PO/BA, Developer, Tester tổng quát hóa thành Người dùng; QA Lead tổng quát hóa thành Tester
  (có toàn bộ quyền của Tester và thêm quyền duyệt).
"""
import math
import sys
from pathlib import Path
from xml.sax.saxutils import escape

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'hientrang'))
import generate_hientrang  # noqa: E402
from generate_hientrang import Canvas, FONT, FILL, STROKE  # noqa: E402

OUT = Path(__file__).parent
UC_W, UC_H = 232, 66
COL = {'L': 330, 'M': 575, 'R': 820}


def Y(y):
    """Giãn trục dọc để chữ to vẫn không chạm nhau (bố cục trang dọc)."""
    return round(y * 1.2)


class UseCaseCanvas(Canvas):
    def actor(self, name, cx, cy):
        """Tác nhân: hình người, tên ở dưới; geo là khung bao hình người."""
        cid = self._vertex(escape(name), f'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;'
                                         f'outlineConnect=0;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=2;'
                                         f'fontFamily={FONT};fontSize=20;fontStyle=1;fontColor=#000000;',
                           cx - 20, cy - 40, 40, 80)
        self.svg.append(f'<g stroke="#000" stroke-width="2" fill="none">'
                        f'<circle cx="{cx}" cy="{cy - 30}" r="10" fill="#fff"/>'
                        f'<line x1="{cx}" y1="{cy - 20}" x2="{cx}" y2="{cy + 10}"/>'
                        f'<line x1="{cx - 20}" y1="{cy - 10}" x2="{cx + 20}" y2="{cy - 10}"/>'
                        f'<line x1="{cx}" y1="{cy + 10}" x2="{cx - 18}" y2="{cy + 40}"/>'
                        f'<line x1="{cx}" y1="{cy + 10}" x2="{cx + 18}" y2="{cy + 40}"/></g>')
        self.svg.append(f'<text x="{cx}" y="{cy + 58}" font-size="20" font-weight="bold" text-anchor="middle" '
                        f'dominant-baseline="middle">{escape(name)}</text>')
        return cid

    def usecase(self, code, name, col, cy):
        cx = COL[col]
        x, y = cx - UC_W / 2, cy - UC_H / 2
        lines = [f'{code} {name}'] if len(code) + len(name) < 19 else [code, name]
        cid = self._vertex('<br>'.join(escape(s) for s in lines),
                           f'ellipse;whiteSpace=wrap;html=1;fillColor={FILL};strokeColor={STROKE};strokeWidth=2;'
                           f'fontFamily={FONT};fontSize=19;fontColor=#000000;', x, y, UC_W, UC_H)
        self.svg.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{UC_W / 2}" ry="{UC_H / 2}" fill="{FILL}" stroke="{STROKE}" stroke-width="2"/>')
        self._svg_lines(lines, cx, cy, 19)
        return cid

    def system(self, title, x, y, w, h):
        self._vertex(f'<b>{escape(title)}</b>', f'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFF4;strokeColor=#666666;'
                                                f'strokeWidth=2;verticalAlign=top;fontFamily={FONT};fontSize=22;fontColor=#000000;',
                     x, y, w, h)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#FFFFF4" stroke="#666" stroke-width="2"/>'
                        f'<text x="{x + w / 2}" y="{y + 22}" font-size="22" font-weight="bold" text-anchor="middle" '
                        f'dominant-baseline="middle">{escape(title)}</text>')

    def external(self, lines, x, y, w, h):
        cid = self.box(lines, x, y, w, h, external=True, size=19)
        return cid

    def _side(self, cid, other):
        """Điểm giữa cạnh trái/phải của hình cid, phía gần hình other."""
        x, y, w, h = self.geo[cid]
        ox = self.geo[other][0] + self.geo[other][2] / 2
        right = ox > x + w / 2
        return (x + w if right else x, y + h / 2), (1 if right else 0)

    def assoc(self, a, b):
        """Liên kết tác nhân – use case: đường thẳng, không mũi tên, nối vào cạnh trái/phải của hai hình."""
        (x1, y1), ex = self._side(a, b)
        (x2, y2), nx = self._side(b, a)
        self.cells.append(f'<mxCell id="{self._id()}" value="" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#333333;'
                          f'exitX={ex};exitY=0.5;exitDx=0;exitDy=0;entryX={nx};entryY=0.5;entryDx=0;entryDy=0;" '
                          f'edge="1" parent="1" source="{a}" target="{b}"><mxGeometry relative="1" as="geometry"/></mxCell>')
        self.svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#333" stroke-width="1.5"/>')

    def assoc_down(self, a, b):
        """Liên kết dọc: từ đáy hình a xuống đỉnh hình b (dùng khi hệ thống ngoài nằm dưới khung hệ thống)."""
        ax, ay, aw, ah = self.geo[a]
        bx, by, bw, _ = self.geo[b]
        self.cells.append(f'<mxCell id="{self._id()}" value="" style="endArrow=none;html=1;strokeWidth=1.5;strokeColor=#333333;'
                          f'exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;" '
                          f'edge="1" parent="1" source="{a}" target="{b}"><mxGeometry relative="1" as="geometry"/></mxCell>')
        self.svg.append(f'<line x1="{ax + aw / 2}" y1="{ay + ah}" x2="{bx + bw / 2}" y2="{by}" stroke="#333" stroke-width="1.5"/>')

    def generalize(self, child, parent, pts):
        """Tổng quát hóa: nét liền, đầu tam giác rỗng ở phía tác nhân cha."""
        sx, sy, sw, sh = self.geo[child]
        tx, ty, tw, th = self.geo[parent]
        (x1, y1), (x2, y2) = pts[0], pts[-1]
        way = ''.join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in pts[1:-1])
        self.cells.append(f'<mxCell id="{self._id()}" value="" style="edgeStyle=none;html=1;endArrow=block;endFill=0;endSize=14;'
                          f'strokeWidth=2;strokeColor=#000000;exitX={(x1 - sx) / sw:.3f};exitY={(y1 - sy) / sh:.3f};exitDx=0;exitDy=0;'
                          f'entryX={(x2 - tx) / tw:.3f};entryY={(y2 - ty) / th:.3f};entryDx=0;entryDy=0;" edge="1" parent="1" '
                          f'source="{child}" target="{parent}"><mxGeometry relative="1" as="geometry">'
                          f'<Array as="points">{way}</Array></mxGeometry></mxCell>')
        px, py = pts[-2]
        ang = math.atan2(y2 - py, x2 - px)
        bx, by = x2 - 16 * math.cos(ang), y2 - 16 * math.sin(ang)
        path = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts[:-1] + [(bx, by)])
        tri = [(x2, y2), (bx - 9 * math.sin(ang), by + 9 * math.cos(ang)), (bx + 9 * math.sin(ang), by - 9 * math.cos(ang))]
        self.svg.append(f'<polyline points="{path}" fill="none" stroke="#000" stroke-width="2"/>'
                        f'<polygon points="{" ".join(f"{a:.1f},{b:.1f}" for a, b in tri)}" fill="#fff" stroke="#000" stroke-width="2"/>')


def build():
    c = UseCaseCanvas(1160, Y(1440))
    c.system('Hệ thống AI TestCase Manager', 200, Y(190), 750, Y(1120))

    # Cột L: dùng chung (Người dùng), riêng Developer, riêng Admin · cột M: Admin dùng chung với Tester, QA Lead
    # cột R: riêng Tester (gần dịch vụ ngoài) và riêng QA Lead
    uc = {}
    for code, name, col, y in [
        ('UC01', 'Đăng nhập', 'L', 240), ('UC13', 'Tra cứu test case', 'L', 310),
        ('UC14', 'Xuất Excel', 'L', 380), ('UC15', 'Xem báo cáo', 'L', 450),
        ('UC20', 'Xem kết quả chạy test', 'L', 520), ('UC04', 'Xem user story', 'L', 590),
        ('UC19', 'Theo dõi sprint', 'L', 660), ('UC21', 'Báo đã sửa lỗi', 'L', 760),
        ('UC02', 'Quản lý người dùng', 'L', 1150), ('UC03', 'Khai báo URL cần test', 'L', 1225),
        ('UC06', 'Sinh test case bằng AI', 'R', 240), ('UC11', 'Sinh script Playwright', 'R', 310),
        ('UC12', 'Chạy script tự động', 'R', 380), ('UC07', 'Soạn thảo test case', 'R', 450),
        ('UC08', 'Gửi duyệt', 'R', 520), ('UC10', 'Ghi kết quả chạy test', 'R', 590),
        ('UC05', 'Xem lại khi story đổi', 'R', 670),
        ('UC17', 'Xem nhật ký AI', 'M', 840), ('UC16', 'Thay đổi quy định', 'M', 915),
        ('UC18', 'Xem nhật ký hoạt động', 'M', 990), ('UC22', 'Đồng bộ từ Jira', 'M', 1065),
        ('UC09', 'Duyệt / trả lại', 'R', 1150),
    ]:
        uc[code] = c.usecase(code, name, col, Y(y))

    user = c.actor('Người dùng', 100, Y(420))
    dev = c.actor('Developer', 100, Y(760))
    po = c.actor('PO / BA', 100, Y(880))
    admin = c.actor('Admin', 100, Y(1060))
    tester = c.actor('Tester', 1060, Y(880))
    qa = c.actor('QA Lead', 1060, Y(1100))
    llm = c.external(['«hệ thống ngoài»', 'Dịch vụ LLM'], 965, Y(220), 170, 70)
    pw = c.external(['«hệ thống ngoài»', 'Playwright', 'Worker'], 965, Y(330), 170, 90)
    jira = c.external(['«hệ thống ngoài»', 'Jira Cloud'], 480, Y(1350), 190, 70)

    for code in ['UC01', 'UC13', 'UC14', 'UC15', 'UC20', 'UC04', 'UC19']:
        c.assoc(user, uc[code])
    c.assoc(dev, uc['UC21'])
    for code in ['UC02', 'UC03', 'UC17', 'UC16', 'UC18', 'UC22']:
        c.assoc(admin, uc[code])
    for code in ['UC06', 'UC11', 'UC12', 'UC07', 'UC08', 'UC10', 'UC05', 'UC17']:
        c.assoc(tester, uc[code])
    for code in ['UC09', 'UC16', 'UC18', 'UC22']:
        c.assoc(qa, uc[code])
    c.assoc(uc['UC06'], llm)
    c.assoc(uc['UC11'], llm)
    c.assoc(uc['UC12'], pw)
    c.assoc_down(uc['UC22'], jira)

    # Tổng quát hóa (con → cha)
    # Developer, PO/BA, Admin nhập chung một trục, một đầu tam giác
    for child, y in [(dev, 760), (po, 880), (admin, 1060)]:
        c.generalize(child, user, [(80, Y(y)), (30, Y(y)), (30, Y(420)), (80, Y(420))])
    c.generalize(tester, user, [(1080, Y(880) - 16), (1145, Y(880) - 16), (1145, 30), (100, 30), (100, Y(420) - 40)])
    c.generalize(qa, tester, [(1080, Y(1100)), (1120, Y(1100)), (1120, Y(880) + 16), (1080, Y(880) + 16)])
    return c


def main():
    generate_hientrang.OUT = OUT  # Canvas.save ghi vào thư mục của script này
    build().save('UseCaseTongQuat', 'Sơ đồ use case tổng quát')
    print(f'Đã tạo UseCaseTongQuat.drawio / .svg trong {OUT}')


if __name__ == '__main__':
    main()
