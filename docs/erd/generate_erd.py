#!/usr/bin/env python3
"""Sinh sơ đồ ERD (ký hiệu chân chim – crow's foot) dạng draw.io + SVG, ĐỌC TRỰC TIẾP từ app/src/db/schema.sql.

Cột, kiểu dữ liệu, khóa chính (PK), khóa ngoại (FK), duy nhất (UK), NOT NULL và bản số của mỗi quan hệ
đều lấy từ lược đồ thật (nạp schema.sql vào SQLite trong bộ nhớ rồi đọc PRAGMA), nên sơ đồ luôn khớp CSDL.
Script dừng với lỗi nếu có khóa ngoại trong lược đồ mà sơ đồ chưa vẽ và chưa liệt kê trong OMITTED.

Bản số:
  - Phía bảng cha: FK NOT NULL → "đúng 1" (||); FK cho phép NULL → "0 hoặc 1" (|o)
  - Phía bảng con: FK có UNIQUE → "0 hoặc 1" (o|); ngược lại → "0 hoặc nhiều" (o{)

Chạy:  python3 docs/erd/generate_erd.py   → ghi ERD_CSDL.drawio và ERD_CSDL.svg cạnh file này.
Mở / sửa: app.diagrams.net hoặc draw.io Desktop.
"""
import math
import sqlite3
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).parent
SCHEMA = OUT.parent.parent / 'app' / 'src' / 'db' / 'schema.sql'
FONT = 'Times New Roman'
W, HEAD, ROW = 260, 30, 22

# Vị trí bảng (x, y). Bố cục 4 cột, các quan hệ đi qua "kênh" giữa các cột để hạn chế cắt nhau.
C1, C2, C3, C4 = 40, 380, 720, 1120
DX = 60  # dịch toàn bộ sang phải để nhãn ở kênh bên trái không bị cắt
POS = {
    'projects': (C1, 60), 'modules': (C1, 300), 'sprints': (C1, 470), 'audit_logs': (C1, 720), 'parameters': (C1, 980),
    'user_stories': (C2, 60),
    'test_cases': (C3, 60), 'ai_logs': (C3, 520),
    'test_case_versions': (C4, 60), 'reviews': (C4, 290), 'automation_scripts': (C4, 500), 'test_runs': (C4, 760),
    'users': (550, 1050),
}

# Quan hệ: (bảng con, cột FK, tên quan hệ, đường đi). Đường đi là danh sách điểm từ bảng CHA tới bảng CON;
# 'pk' = hàng khóa chính của bảng cha, 'fk' = hàng khóa ngoại của bảng con, số = tọa độ cố định.
# Phần tử thứ 5 (tùy chọn) 'end': đặt nhãn ở đoạn cuối, gần bảng con (khi nhiều quan hệ chung một trục).
REL = [
    ('modules', 'project_id', 'gồm', [('L', 'pk'), (0, 'pk'), (0, 'fk'), ('L', 'fk')]),
    ('sprints', 'project_id', 'chia thành', [('L', 'pk'), (0, 'pk'), (0, 'fk'), ('L', 'fk')]),
    ('user_stories', 'project_id', 'chứa', [('R', 'pk'), (320, 'pk'), (320, 'fk'), ('L', 'fk')]),
    ('user_stories', 'module_id', 'phân loại', [('R', 'pk'), (345, 'pk'), (345, 'fk'), ('L', 'fk')]),
    ('user_stories', 'sprint_id', 'gồm', [('R', 'pk'), (360, 'pk'), (360, 'fk'), ('L', 'fk')]),
    ('test_cases', 'story_id', 'có', [('R', 'pk'), (665, 'pk'), (665, 'fk'), ('L', 'fk')]),
    ('ai_logs', 'story_id', 'đầu vào', [('R', 'pk'), (665, 'pk'), (665, 'fk'), ('L', 'fk')]),
    ('test_cases', 'ai_log_id', 'sinh ra', [('L', 'pk'), (695, 'pk'), (695, 'fk'), ('L', 'fk')]),
    ('test_case_versions', 'test_case_id', 'phiên bản', [('R', 'pk'), (1000, 'pk'), (1000, 'fk'), ('L', 'fk')], 'end'),
    ('reviews', 'test_case_id', 'được duyệt', [('R', 'pk'), (1000, 'pk'), (1000, 'fk'), ('L', 'fk')], 'end'),
    ('automation_scripts', 'test_case_id', 'có script', [('R', 'pk'), (1000, 'pk'), (1000, 'fk'), ('L', 'fk')], 'end'),
    ('test_runs', 'test_case_id', 'kết quả', [('R', 'pk'), (1000, 'pk'), (1000, 'fk'), ('L', 'fk')], 'end'),
    ('automation_scripts', 'ai_log_id', 'sinh ra', [('R', 'fk'), ('L', 'fk')]),
    ('user_stories', 'created_by', 'tạo', [('T', 600), ('B', 600)]),
    ('ai_logs', 'user_id', 'gọi AI', [('T', 760), ('B', 760)]),
    ('reviews', 'reviewer_id', 'duyệt', [('R', 1100), (1400, 1100), (1400, 'fk'), ('R', 'fk')]),
    ('test_runs', 'executed_by', 'chạy', [('R', 1130), (1420, 1130), (1420, 'fk'), ('R', 'fk')]),
    ('audit_logs', 'user_id', 'thao tác', [('L', 1100), (340, 1100), (340, 'fk'), ('R', 'fk')]),
    ('parameters', 'updated_by', 'cập nhật', [('L', 1130), (320, 1130), (320, 'fk'), ('R', 'fk')]),
]
# Các FK tới users chỉ để ghi nhận người tạo/sửa: không vẽ cho sơ đồ dễ đọc, có ghi chú dưới sơ đồ.
OMITTED = {('projects', 'created_by'), ('test_cases', 'created_by'), ('test_case_versions', 'changed_by'),
           ('automation_scripts', 'created_by'), ('test_runs', 'fixed_by')}


def attr(s):
    return escape(s, {'"': '&quot;'})


def read_schema():
    db = sqlite3.connect(':memory:')
    db.executescript(SCHEMA.read_text(encoding='utf-8'))
    tables = {}
    for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
        cols = [dict(name=r[1], type=r[2] or 'TEXT', notnull=bool(r[3]) or bool(r[5]), pk=bool(r[5]))
                for r in db.execute(f'PRAGMA table_info({name})')]
        fks = {r[3]: r[2] for r in db.execute(f'PRAGMA foreign_key_list({name})')}  # cột → bảng cha
        uniq = set()
        for idx in db.execute(f'PRAGMA index_list({name})'):
            if idx[2]:  # unique
                icols = [r[2] for r in db.execute(f'PRAGMA index_info({idx[1]})')]
                if len(icols) == 1:
                    uniq.add(icols[0])
        for c in cols:
            c['fk'] = fks.get(c['name'])
            c['uk'] = c['name'] in uniq and not c['pk']
        tables[name] = cols
    return tables


def row_y(table, col, tables):
    i = next(k for k, c in enumerate(tables[table]) if c['name'] == col)
    return POS[table][1] + HEAD + i * ROW + ROW / 2


def height(table, tables):
    return HEAD + len(tables[table]) * ROW


def resolve(points, parent, child, fk, tables):
    """Đổi đặc tả đường đi thành tọa độ thật."""
    pk = next(c['name'] for c in tables[parent] if c['pk'])
    out = []
    for i, (a, b) in enumerate(points):
        tbl = parent if i == 0 else child
        x0, y0 = POS[tbl]
        y = row_y(parent, pk, tables) if b == 'pk' else row_y(child, fk, tables) if b == 'fk' else b
        if a == 'L':
            out.append((x0, y))
        elif a == 'R':
            out.append((x0 + W, y))
        elif a == 'T':
            out.append((b, y0))
        elif a == 'B':
            out.append((b, y0 + height(tbl, tables)))
        else:
            out.append((a, y))
    return out


# ---------------------------------------------------------------------------
class Out:
    def __init__(self, w, h):
        self.w, self.h, self.cells, self.svg, self.n = w, h, [], [], 1

    def nid(self):
        self.n += 1
        return f'e{self.n}'


def marker_svg(p, d, kind):
    """Vẽ ký hiệu chân chim tại điểm p (trên cạnh bảng); d = vectơ đơn vị hướng từ bảng ra ngoài đường."""
    (x, y), (dx, dy) = p, d
    nx, ny = -dy, dx
    at = lambda t, s=0: (x + dx * t + nx * s, y + dy * t + ny * s)
    line = lambda a, b: f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#000" stroke-width="1.4"/>'
    bar = lambda t: line(at(t, -7), at(t, 7))
    circle = lambda t: f'<circle cx="{at(t)[0]:.1f}" cy="{at(t)[1]:.1f}" r="4.5" fill="#fff" stroke="#000" stroke-width="1.4"/>'
    parts = []
    if kind == 'one':           # ||  đúng 1
        parts += [bar(7), bar(13)]
    elif kind == 'zero_one':    # |o  0 hoặc 1
        parts += [bar(7), circle(18)]
    elif kind == 'zero_many':   # o{  0 hoặc nhiều
        parts += [line(at(0, -8), at(12)), line(at(0, 8), at(12)), line(at(0), at(12)), circle(18)]
    return ''.join(parts)


DRAWIO_MARK = {'one': 'ERmandOne', 'zero_one': 'ERzeroToOne', 'zero_many': 'ERzeroToMany'}


def build():
    tables = read_schema()
    missing = [(t, c['name']) for t, cols in tables.items() for c in cols if c['fk']
               and (t, c['name']) not in {(r[0], r[1]) for r in REL} and (t, c['name']) not in OMITTED]
    assert not missing, f'Khóa ngoại chưa có trên sơ đồ: {missing}'
    assert set(POS) == set(tables), f'Bảng chưa có vị trí: {set(tables) ^ set(POS)}'

    o = Out(1440 + DX, 1330)
    o.svg.append(f'<text x="40" y="34" font-size="22" font-weight="bold">Sơ đồ ERD – CSDL AI TestCase Manager</text>')
    o.cells.append(f'<mxCell id="title" value="&lt;b&gt;Sơ đồ ERD – CSDL AI TestCase Manager&lt;/b&gt;" style="text;html=1;align=left;fontFamily={FONT};fontSize=22;" vertex="1" parent="1"><mxGeometry x="40" y="10" width="700" height="34" as="geometry"/></mxCell>')
    ids = {}
    for t, cols in tables.items():
        x, y = POS[t]
        h = height(t, tables)
        tid = ids[t] = o.nid()
        o.cells.append(f'<mxCell id="{tid}" value="{t}" style="swimlane;fontStyle=1;horizontal=1;startSize={HEAD};collapsible=0;html=1;fillColor=#F2F2F2;strokeColor=#000000;fontFamily={FONT};fontSize=15;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{W}" height="{h}" as="geometry"/></mxCell>')
        o.svg.append(f'<rect x="{x}" y="{y}" width="{W}" height="{h}" fill="#fff" stroke="#000" stroke-width="1.2"/>'
                     f'<rect x="{x}" y="{y}" width="{W}" height="{HEAD}" fill="#F2F2F2" stroke="#000" stroke-width="1.2"/>'
                     f'<text x="{x + W / 2}" y="{y + 20}" font-size="15" font-weight="bold" text-anchor="middle">{t}</text>')
        for i, c in enumerate(cols):
            key = ' '.join(k for k, v in (('PK', c['pk']), ('FK', c['fk']), ('UK', c['uk'])) if v)
            typ = c['type'] + ('' if c['notnull'] or c['pk'] else ' NULL')
            ry = y + HEAD + i * ROW
            name = f'<u>{c["name"]}</u>' if c['pk'] else c['name']
            left = f'<b>{key}</b>&nbsp;' if key else ''
            o.cells.append(f'<mxCell id="{o.nid()}" value="{attr(left)}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=6;fontFamily={FONT};fontSize=12;" vertex="1" parent="{tid}"><mxGeometry x="0" y="{HEAD + i * ROW}" width="46" height="{ROW}" as="geometry"/></mxCell>')
            o.cells.append(f'<mxCell id="{o.nid()}" value="{attr(name)}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=4;fontFamily={FONT};fontSize=12;" vertex="1" parent="{tid}"><mxGeometry x="46" y="{HEAD + i * ROW}" width="130" height="{ROW}" as="geometry"/></mxCell>')
            o.cells.append(f'<mxCell id="{o.nid()}" value="{attr(typ)}" style="text;html=1;strokeColor=none;fillColor=none;align=right;verticalAlign=middle;spacingRight=8;fontFamily={FONT};fontSize=11;fontColor=#444444;" vertex="1" parent="{tid}"><mxGeometry x="150" y="{HEAD + i * ROW}" width="{W - 150}" height="{ROW}" as="geometry"/></mxCell>')
            if i:
                o.cells.append(f'<mxCell id="{o.nid()}" value="" style="line;strokeColor=#DDDDDD;strokeWidth=1;html=1;" vertex="1" parent="{tid}"><mxGeometry x="0" y="{HEAD + i * ROW - 1}" width="{W}" height="2" as="geometry"/></mxCell>')
            if i:
                o.svg.append(f'<line x1="{x}" y1="{ry}" x2="{x + W}" y2="{ry}" stroke="#DDD" stroke-width="0.8"/>')
            o.svg.append(f'<text x="{x + 8}" y="{ry + 15}" font-size="12" font-weight="bold">{key}</text>'
                         f'<text x="{x + 52}" y="{ry + 15}" font-size="12"{" text-decoration=\"underline\"" if c["pk"] else ""}>{c["name"]}</text>'
                         f'<text x="{x + W - 8}" y="{ry + 15}" font-size="11" fill="#444" text-anchor="end">{typ}</text>')

    for child, fk, label, spec, *opt in REL:
        col = next(c for c in tables[child] if c['name'] == fk)
        parent = col['fk']
        pts = resolve(spec, parent, child, fk, tables)
        start = 'one' if col['notnull'] else 'zero_one'
        end = 'zero_one' if col['uk'] else 'zero_many'
        # draw.io: nối vào bảng thật, điểm vào/ra theo tỷ lệ trên cạnh bảng
        def rel(pt, t):
            x, y = POS[t]
            return (pt[0] - x) / W, (pt[1] - y) / height(t, tables)
        ex, ey = rel(pts[0], parent)
        nx, ny = rel(pts[-1], child)
        way = ''.join(f'<mxPoint x="{a}" y="{b}"/>' for a, b in pts[1:-1])
        o.cells.append(
            f'<mxCell id="{o.nid()}" value="{attr(label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;jumpStyle=arc;'
            f'startArrow={DRAWIO_MARK[start]};endArrow={DRAWIO_MARK[end]};startFill=0;endFill=0;startSize=10;endSize=10;'
            f'exitX={ex:.4f};exitY={ey:.4f};exitDx=0;exitDy=0;entryX={nx:.4f};entryY={ny:.4f};entryDx=0;entryDy=0;'
            f'fontFamily={FONT};fontSize=12;labelBackgroundColor=#FFFFFF;" edge="1" parent="1" source="{ids[parent]}" target="{ids[child]}">'
            f'<mxGeometry relative="1" as="geometry"><Array as="points">{way}</Array></mxGeometry></mxCell>')
        o.svg.append('<polyline points="' + ' '.join(f'{a:.1f},{b:.1f}' for a, b in pts) + '" fill="none" stroke="#000" stroke-width="1.2"/>')
        unit = lambda a, b: ((b[0] - a[0]) / (math.hypot(b[0] - a[0], b[1] - a[1]) or 1), (b[1] - a[1]) / (math.hypot(b[0] - a[0], b[1] - a[1]) or 1))
        o.svg.append(marker_svg(pts[0], unit(pts[0], pts[1]), start))
        o.svg.append(marker_svg(pts[-1], unit(pts[-1], pts[-2]), end))
        # nhãn ở giữa đoạn dài nhất
        seg = (pts[-2], pts[-1]) if opt == ['end'] else max(zip(pts, pts[1:]), key=lambda s: math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]))
        mx, my = (seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2
        tw = len(label) * 6.5 + 8
        o.svg.append(f'<rect x="{mx - tw / 2:.1f}" y="{my - 9:.1f}" width="{tw:.1f}" height="17" fill="#fff"/>'
                     f'<text x="{mx:.1f}" y="{my + 4:.1f}" font-size="12" font-style="italic" text-anchor="middle">{escape(label)}</text>')

    note = ('Ký hiệu: PK khóa chính · FK khóa ngoại · UK duy nhất · NULL cho phép rỗng. Bản số: || đúng một · |o không hoặc một · '
            'o{ không hoặc nhiều. Các cột created_by, changed_by, fixed_by cũng là FK tới users (không vẽ cho dễ đọc).')
    o.svg.append(f'<text x="40" y="1300" font-size="12" fill="#333">{escape(note)}</text>')
    o.cells.append(f'<mxCell id="note" value="{attr(note)}" style="text;html=1;align=left;whiteSpace=wrap;fontFamily={FONT};fontSize=12;" vertex="1" parent="1"><mxGeometry x="40" y="1285" width="1320" height="30" as="geometry"/></mxCell>')
    return o, tables


def main():
    o, tables = build()
    model = ('<mxGraphModel dx="1400" dy="1330" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" '
             f'page="1" pageScale="1" pageWidth="{o.w}" pageHeight="{o.h}" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
             + ''.join(o.cells) + '</root></mxGraphModel>')
    (OUT / 'ERD_CSDL.drawio').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="generate_erd.py" agent="SE104 AI TestCase Manager" '
                                         f'version="24.0.0"><diagram id="erd" name="ERD">{model}</diagram></mxfile>\n', encoding='utf-8')
    (OUT / 'ERD_CSDL.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {o.w} {o.h}" width="{o.w}" height="{o.h}" '
                                      f'font-family="{FONT}, Times, serif"><rect width="100%" height="100%" fill="#fff"/><g transform="translate({DX},0)">'
                                      + ''.join(o.svg) + '</g></svg>\n', encoding='utf-8')
    nfk = sum(1 for cols in tables.values() for c in cols if c['fk'])
    print(f'Đã tạo ERD_CSDL.drawio / .svg: {len(tables)} bảng, {len(REL)} quan hệ được vẽ, {nfk} khóa ngoại trong lược đồ')


if __name__ == '__main__':
    main()
