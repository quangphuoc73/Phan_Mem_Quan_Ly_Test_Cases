"""Thư viện vẽ chung cho các sơ đồ trong docs/sodo: mỗi hình được ghi đồng thời ra draw.io (mxGraph XML) và SVG.

Dựa trên Canvas của docs/hientrang/generate_hientrang.py, thêm các hình cần cho sơ đồ kiến trúc, triển khai,
lớp (UML class), tuần tự (UML sequence), trạng thái (UML state machine) và hoạt động.
"""
import math
import sys
from pathlib import Path
from xml.sax.saxutils import escape

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'hientrang'))
import generate_hientrang  # noqa: E402
from generate_hientrang import Canvas, FONT, FILL, STROKE, EXT_FILL, EXT_STROKE, attr  # noqa: E402

OUT = Path(__file__).parent

# Bảng màu thống nhất cho mọi sơ đồ
C = {
    'proc': (FILL, STROKE),              # xử lý, hoạt động của hệ thống
    'ext': (EXT_FILL, EXT_STROKE),       # hệ thống ngoài
    'user': ('#E3F2FD', '#1E88E5'),      # người dùng, giao diện
    'data': ('#E8F5E9', '#43A047'),      # dữ liệu, CSDL
    'sec': ('#FDECEA', '#E53935'),       # bảo mật
    'ai': ('#F3E5F5', '#8E24AA'),        # AI
    'jira': ('#E3F0FF', '#0052CC'),      # Jira
    'gray': ('#F5F5F5', '#757575'),
    'done': ('#E8F5E9', '#2E7D32'),
    'warn': ('#FFF8E1', '#F9A825'),
}


class Board(Canvas):
    """Canvas có thêm các hình UML và đường tự do."""

    # ---------- hình ----------
    def rect(self, lines, x, y, w, h, kind='proc', size=18, bold_first=False, rounded=True, dashed=False, align='center'):
        fill, stroke = C[kind]
        lines = [lines] if isinstance(lines, str) else lines
        value = self._html(lines, bold_first)
        style = (f'{"rounded=1;arcSize=10;" if rounded else "rounded=0;"}whiteSpace=wrap;html=1;fillColor={fill};'
                 f'strokeColor={stroke};strokeWidth=2;fontFamily={FONT};fontSize={size};fontColor=#000000;align={align};'
                 + ('dashed=1;' if dashed else ''))
        cid = self._vertex(value, style, x, y, w, h)
        da = ' stroke-dasharray="8 5"' if dashed else ''
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{10 if rounded else 0}" fill="{fill}" '
                        f'stroke="{stroke}" stroke-width="2"{da}/>')
        if align == 'left':
            top = y + h / 2 - (len(lines) - 1) * size * 0.6
            for i, s in enumerate(lines):
                wgt = ' font-weight="bold"' if bold_first and i == 0 else ''
                self.svg.append(f'<text x="{x + 12}" y="{top + i * size * 1.2:.1f}" font-size="{size}"{wgt} '
                                f'dominant-baseline="middle">{escape(s)}</text>')
        else:
            self._svg_lines(lines, x + w / 2, y + h / 2, size, bold_first)
        return cid

    def frame(self, title, x, y, w, h, kind='gray', size=18, dashed=True):
        """Khung nhóm (container), tiêu đề ở góc trên trái."""
        fill, stroke = C[kind]
        cid = self._vertex(f'<b>{escape(title)}</b>', f'rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor={fill};'
                           f'strokeColor={stroke};strokeWidth=2;{"dashed=1;" if dashed else ""}verticalAlign=top;align=left;'
                           f'spacingLeft=10;fontFamily={FONT};fontSize={size};fontColor=#000000;opacity=60;', x, y, w, h)
        da = ' stroke-dasharray="10 6"' if dashed else ''
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}" fill-opacity="0.6" '
                        f'stroke="{stroke}" stroke-width="2"{da}/>'
                        f'<text x="{x + 12}" y="{y + 20}" font-size="{size}" font-weight="bold" dominant-baseline="middle">'
                        f'{escape(title)}</text>')
        return cid

    def cyl(self, lines, x, y, w, h, kind='data', size=18):
        """CSDL: hình trụ."""
        fill, stroke = C[kind]
        lines = [lines] if isinstance(lines, str) else lines
        cid = self._vertex(self._html(lines, True), f'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;size=12;'
                           f'fillColor={fill};strokeColor={stroke};strokeWidth=2;fontFamily={FONT};fontSize={size};'
                           f'fontColor=#000000;', x, y, w, h)
        ry = 12
        self.svg.append(f'<path d="M{x},{y + ry} a{w / 2},{ry} 0 0,1 {w},0 v{h - 2 * ry} a{w / 2},{ry} 0 0,1 {-w},0 z" '
                        f'fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
                        f'<path d="M{x},{y + ry} a{w / 2},{ry} 0 0,0 {w},0" fill="none" stroke="{stroke}" stroke-width="2"/>')
        self._svg_lines(lines, x + w / 2, y + h / 2 + ry / 2, size, True)
        return cid

    def trap(self, lines, x, y, w, h, inset, kind='proc', size=18):
        """Hình thang (tháp kiểm thử): đáy trên ngắn hơn đáy dưới 2*inset."""
        fill, stroke = C[kind]
        cid = self._vertex(self._html(lines, True), f'shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;'
                           f'fixedSize=1;size={inset};fillColor={fill};strokeColor={stroke};strokeWidth=2;'
                           f'fontFamily={FONT};fontSize={size};fontColor=#000000;', x, y, w, h)
        pts = [(x + inset, y), (x + w - inset, y), (x + w, y + h), (x, y + h)]
        self.svg.append(f'<polygon points="{" ".join(f"{a},{b}" for a, b in pts)}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
        self._svg_lines(lines, x + w / 2, y + h / 2, size, True)
        return cid

    def dot(self, cx, cy, final=False):
        """Nút bắt đầu (chấm đen) / kết thúc (chấm đen có viền) của sơ đồ trạng thái, hoạt động."""
        r = 14
        if final:
            cid = self._vertex('', 'ellipse;shape=endState;fillColor=#000000;strokeColor=#000000;html=1;', cx - r, cy - r, 2 * r, 2 * r)
            self.svg.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff" stroke="#000" stroke-width="2"/>'
                            f'<circle cx="{cx}" cy="{cy}" r="{r - 5}" fill="#000"/>')
        else:
            cid = self._vertex('', 'ellipse;fillColor=#000000;strokeColor=none;html=1;', cx - r, cy - r, 2 * r, 2 * r)
            self.svg.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#000"/>')
        return cid

    def note(self, lines, x, y, w, h, size=16):
        cid = self._vertex(self._html(lines, False), f'shape=note;whiteSpace=wrap;html=1;size=16;fillColor=#FFFDE7;'
                           f'strokeColor=#BDB76B;fontFamily={FONT};fontSize={size};fontColor=#000000;align=left;spacingLeft=8;', x, y, w, h)
        f = 16
        self.svg.append(f'<path d="M{x},{y} h{w - f} l{f},{f} v{h - f} h{-w} z" fill="#FFFDE7" stroke="#BDB76B" stroke-width="1.5"/>'
                        f'<path d="M{x + w - f},{y} v{f} h{f}" fill="none" stroke="#BDB76B" stroke-width="1.5"/>')
        top = y + h / 2 - (len(lines) - 1) * size * 0.6
        for i, s in enumerate(lines):
            self.svg.append(f'<text x="{x + 10}" y="{top + i * size * 1.2:.1f}" font-size="{size}" dominant-baseline="middle">{escape(s)}</text>')
        return cid

    def person(self, name, cx, cy, size=17):
        """Tác nhân UML (hình người), tên ở dưới."""
        cid = self._vertex(escape(name), f'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;'
                           f'fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=2;fontFamily={FONT};fontSize={size};fontStyle=1;',
                           cx - 16, cy - 32, 32, 64)
        self.svg.append(f'<g stroke="#000" stroke-width="2" fill="none"><circle cx="{cx}" cy="{cy - 24}" r="8" fill="#fff"/>'
                        f'<line x1="{cx}" y1="{cy - 16}" x2="{cx}" y2="{cy + 8}"/><line x1="{cx - 16}" y1="{cy - 8}" x2="{cx + 16}" y2="{cy - 8}"/>'
                        f'<line x1="{cx}" y1="{cy + 8}" x2="{cx - 14}" y2="{cy + 32}"/><line x1="{cx}" y1="{cy + 8}" x2="{cx + 14}" y2="{cy + 32}"/></g>'
                        f'<text x="{cx}" y="{cy + 48}" font-size="{size}" font-weight="bold" text-anchor="middle" dominant-baseline="middle">{escape(name)}</text>')
        return cid

    def uml_class(self, name, attrs, methods, x, y, w, stereo=None, kind='proc', row=22, size=15):
        """Lớp UML 3 ngăn: tên (kèm «stereotype»), thuộc tính, phương thức."""
        fill, stroke = C[kind]
        head = 30 + (18 if stereo else 0)
        h = head + max(1, len(attrs)) * row + 8 + max(1, len(methods)) * row + 8
        title = (f'<i>«{escape(stereo)}»</i><br>' if stereo else '') + f'<b>{escape(name)}</b>'
        body = '<br>'.join(escape(a) for a in attrs) or '&nbsp;'
        ops = '<br>'.join(escape(m) for m in methods) or '&nbsp;'
        value = (f'<p style="margin:0;margin-top:4px;text-align:center;">{title}</p><hr size="1"/>'
                 f'<p style="margin:0;margin-left:6px;">{body}</p><hr size="1"/><p style="margin:0;margin-left:6px;">{ops}</p>')
        cid = self._vertex(value, f'verticalAlign=top;align=left;overflow=fill;html=1;whiteSpace=wrap;fillColor={fill};'
                           f'strokeColor={stroke};strokeWidth=2;fontFamily={FONT};fontSize={size};fontColor=#000000;', x, y, w, h)
        a_y = y + head
        m_y = a_y + max(1, len(attrs)) * row + 8
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
                        f'<line x1="{x}" y1="{a_y}" x2="{x + w}" y2="{a_y}" stroke="{stroke}" stroke-width="1.5"/>'
                        f'<line x1="{x}" y1="{m_y}" x2="{x + w}" y2="{m_y}" stroke="{stroke}" stroke-width="1.5"/>')
        if stereo:
            self.svg.append(f'<text x="{x + w / 2}" y="{y + 15}" font-size="{size - 1}" font-style="italic" text-anchor="middle" '
                            f'dominant-baseline="middle">«{escape(stereo)}»</text>')
        self.svg.append(f'<text x="{x + w / 2}" y="{y + head - 14}" font-size="{size + 1}" font-weight="bold" text-anchor="middle" '
                        f'dominant-baseline="middle">{escape(name)}</text>')
        for i, a in enumerate(attrs):
            self.svg.append(f'<text x="{x + 8}" y="{a_y + 4 + (i + 0.5) * row:.1f}" font-size="{size}" dominant-baseline="middle">{escape(a)}</text>')
        for i, m in enumerate(methods):
            self.svg.append(f'<text x="{x + 8}" y="{m_y + 4 + (i + 0.5) * row:.1f}" font-size="{size}" dominant-baseline="middle">{escape(m)}</text>')
        return cid, h

    def diamond(self, text, x, y, w, h, size=18):
        """Điều kiện rẽ nhánh; chữ nhiều dòng tách bằng \\n."""
        lines = text.split('\n') if text else []
        cid = self._vertex('<br>'.join(escape(t) for t in lines), f'rhombus;whiteSpace=wrap;html=1;fillColor={FILL};strokeColor={STROKE};'
                           f'strokeWidth=2;fontFamily={FONT};fontSize={size};fontColor=#000000;', x, y, w, h)
        pts = [(x + w / 2, y), (x + w, y + h / 2), (x + w / 2, y + h), (x, y + h / 2)]
        self.svg.append(f'<polygon points="{" ".join(f"{a},{b}" for a, b in pts)}" fill="{FILL}" stroke="{STROKE}" stroke-width="2"/>')
        if lines:
            self._svg_lines(lines, x + w / 2, y + h / 2, size)
        return cid

    # ---------- đường ----------
    def link(self, pts, label=None, lpos=None, head='block', dashed=False, color='#333333', width=2, size=16, src=None, dst=None):
        """Đường gấp khúc theo các điểm cho trước.
        head: block (mũi tên đặc) · open (mũi tên mở – phụ thuộc, trả về) · triangle (tổng quát hóa) · none."""
        (x1, y1), (x2, y2) = pts[0], pts[-1]
        ends = {'block': 'endArrow=block;endFill=1;', 'open': 'endArrow=open;endFill=0;', 'triangle': 'endArrow=block;endFill=0;endSize=14;',
                'none': 'endArrow=none;'}[head]
        style = f'edgeStyle=none;html=1;rounded=0;strokeWidth={width};strokeColor={color};{ends}' + ('dashed=1;' if dashed else '')
        conn = ''
        if src and dst:
            sx, sy, sw, sh = self.geo[src]
            tx, ty, tw, th = self.geo[dst]
            style += (f'exitX={(x1 - sx) / sw:.3f};exitY={(y1 - sy) / sh:.3f};exitDx=0;exitDy=0;'
                      f'entryX={(x2 - tx) / tw:.3f};entryY={(y2 - ty) / th:.3f};entryDx=0;entryDy=0;')
            conn = f' source="{src}" target="{dst}"'
        way = ''.join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in pts[1:-1])
        self.cells.append(f'<mxCell id="{self._id()}" value="" style="{style}" edge="1" parent="1"{conn}><mxGeometry relative="1" as="geometry">'
                          f'<mxPoint x="{x1}" y="{y1}" as="sourcePoint"/><mxPoint x="{x2}" y="{y2}" as="targetPoint"/>'
                          f'<Array as="points">{way}</Array></mxGeometry></mxCell>')
        px, py = pts[-2]
        ang = math.atan2(y2 - py, x2 - px)
        L = 16 if head == 'triangle' else 13
        end = (x2 - L * math.cos(ang), y2 - L * math.sin(ang)) if head in ('block', 'triangle') else (x2, y2)
        da = ' stroke-dasharray="8 5"' if dashed else ''
        self.svg.append(f'<polyline points="{" ".join(f"{a:.1f},{b:.1f}" for a, b in pts[:-1] + [end])}" fill="none" '
                        f'stroke="{color}" stroke-width="{width}"{da}/>')
        hx, hy = end
        W = 9 if head == 'triangle' else 7
        tri = [(x2, y2), (hx - W * math.sin(ang), hy + W * math.cos(ang)), (hx + W * math.sin(ang), hy - W * math.cos(ang))]
        poly = ' '.join(f'{a:.1f},{b:.1f}' for a, b in tri)
        if head == 'block':
            self.svg.append(f'<polygon points="{poly}" fill="{color}"/>')
        elif head == 'triangle':
            self.svg.append(f'<polygon points="{poly}" fill="#fff" stroke="{color}" stroke-width="2"/>')
        elif head == 'open':
            bx, by = x2 - 13 * math.cos(ang), y2 - 13 * math.sin(ang)
            a1 = (bx - 7 * math.sin(ang), by + 7 * math.cos(ang))
            a2 = (bx + 7 * math.sin(ang), by - 7 * math.cos(ang))
            self.svg.append(f'<polyline points="{a1[0]:.1f},{a1[1]:.1f} {x2:.1f},{y2:.1f} {a2[0]:.1f},{a2[1]:.1f}" fill="none" '
                            f'stroke="{color}" stroke-width="{width}"/>')
        if label:
            self.tag(label, *(lpos or ((x1 + x2) / 2, (y1 + y2) / 2)), size=size)

    def tag(self, text, cx, cy, size=16, bg=True, bold=False, italic=False, anchor='middle'):
        """Nhãn chữ (nhiều dòng tách bằng \\n), nền trắng để không bị đường cắt."""
        lines = text.split('\n')
        bw = max(len(s) for s in lines) * size * 0.5 + 12
        bh = len(lines) * size * 1.2 + 6
        x = cx - bw / 2 if anchor == 'middle' else cx if anchor == 'start' else cx - bw
        y = cy - bh / 2
        st = 'fontStyle=1;' if bold else 'fontStyle=2;' if italic else ''
        al = {'middle': 'center', 'start': 'left', 'end': 'right'}[anchor]
        self.cells.append(f'<mxCell id="{self._id()}" value="{attr("<br>".join(escape(s) for s in lines))}" style="text;html=1;'
                          f'align={al};verticalAlign=middle;{"labelBackgroundColor=#FFFFFF;" if bg else ""}{st}fontFamily={FONT};'
                          f'fontSize={size};fontColor=#000000;" vertex="1" parent="1"><mxGeometry x="{x:.0f}" y="{y:.0f}" '
                          f'width="{bw:.0f}" height="{bh:.0f}" as="geometry"/></mxCell>')
        if bg:
            self.svg.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.0f}" height="{bh:.0f}" fill="#fff" fill-opacity="0.92"/>')
        top = cy - (len(lines) - 1) * size * 0.6
        tx = cx if anchor == 'middle' else x + 6 if anchor == 'start' else x + bw - 6
        wgt = ' font-weight="bold"' if bold else ' font-style="italic"' if italic else ''
        for i, s in enumerate(lines):
            self.svg.append(f'<text x="{tx:.1f}" y="{top + i * size * 1.2:.1f}" font-size="{size}"{wgt} text-anchor="{anchor}" '
                            f'dominant-baseline="middle">{escape(s)}</text>')

    def title(self, text, x=30, y=34, size=24):
        self.cells.append(f'<mxCell id="{self._id()}" value="{attr("<b>" + escape(text) + "</b>")}" style="text;html=1;align=left;'
                          f'fontFamily={FONT};fontSize={size};" vertex="1" parent="1"><mxGeometry x="{x}" y="{y - 18}" width="1200" '
                          f'height="36" as="geometry"/></mxCell>')
        self.svg.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="bold" dominant-baseline="middle">{escape(text)}</text>')

    # ---------- ghép cạnh ----------
    def mid(self, cid, side):
        """Điểm giữa một cạnh: top / bottom / left / right."""
        x, y, w, h = self.geo[cid]
        return {'top': (x + w / 2, y), 'bottom': (x + w / 2, y + h), 'left': (x, y + h / 2), 'right': (x + w, y + h / 2)}[side]

    def at(self, cid, side, t):
        """Điểm trên một cạnh theo tỷ lệ t (0..1)."""
        x, y, w, h = self.geo[cid]
        return {'top': (x + w * t, y), 'bottom': (x + w * t, y + h), 'left': (x, y + h * t), 'right': (x + w, y + h * t)}[side]


def save(board, name, page):
    generate_hientrang.OUT = OUT
    board.save(name, page)
