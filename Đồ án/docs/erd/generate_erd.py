#!/usr/bin/env python3
"""Sinh sơ đồ ERD (ký hiệu chân chim – crow's foot) bằng draw.io, ĐỌC TRỰC TIẾP từ app/src/db/schema.sql.

- Cột, kiểu dữ liệu, PK, FK, UK, NOT NULL, bản số của từng quan hệ đều lấy từ lược đồ thật (nạp schema.sql vào SQLite
  trong bộ nhớ rồi đọc PRAGMA), nên sơ đồ luôn khớp CSDL.
- Mỗi bảng dùng hình "table" chuẩn của draw.io; đường nối đi từ dòng khóa ngoại tới dòng khóa chính, draw.io tự định tuyến.
- Hình SVG được XUẤT BẰNG draw.io CLI (draw.io Desktop) từ chính file .drawio, nên hình trong báo cáo giống hệt khi mở bằng draw.io.
- Đồng thời sinh mục "Lược đồ quan hệ" và "Từ điển dữ liệu" của chương 4 (docs/04_ThietKe.md, giữa hai dấu
  <!-- SCHEMA:BEGIN --> và <!-- SCHEMA:END -->); ý nghĩa từng cột lấy từ chú thích "--" trong schema.sql.

Bản số:
  - Phía bảng cha: FK NOT NULL → "đúng 1" (||); FK cho phép NULL → "0 hoặc 1" (|o)
  - Phía bảng con: FK có UNIQUE → "0 hoặc 1"; ngược lại → "0 hoặc nhiều" (o{)

Chạy:  python3 docs/erd/generate_erd.py   (cần draw.io Desktop: /Applications/draw.io.app hoặc lệnh drawio)
"""
import re
import shutil
import sqlite3
import subprocess
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).parent
DOCS = OUT.parent
SCHEMA = DOCS.parent / 'app' / 'src' / 'db' / 'schema.sql'
CHAPTER = DOCS / '04_ThietKe.md'
FONT = 'Times New Roman'

# Nhóm bảng theo nghiệp vụ, mỗi nhóm một cột (từ trái sang phải) và màu riêng
GROUPS = [
    ('Requirement, dự án, người dùng', '#dae8fc', '#6c8ebf',
     ['projects', 'modules', 'project_members', 'users', 'sync_logs', 'parameters', 'audit_logs', 'sprints']),
    ('Requirement và AI', '#e1d5e7', '#9673a6',
     ['user_stories', 'requirement_versions', 'impact_analyses', 'ai_proposals', 'ai_logs']),
    ('Test case', '#d5e8d4', '#82b366',
     ['test_cases', 'test_case_acs', 'test_case_versions', 'recheck_logs', 'reviews', 'test_suites', 'test_suite_items', 'automation_scripts']),
    ('Test Run, regression, kiểm thử lại', '#fff2cc', '#d6b656',
     ['test_runs', 'test_run_items', 'test_executions', 'fix_reports', 'regression_sets', 'regression_items']),
]
EXT = {'sprints', 'automation_scripts'}  # ngoài MVP (YC20, YC19)

# Khóa ngoại chỉ ghi nhận "ai làm" – bản rút gọn không vẽ cho dễ đọc (có ghi chú dưới hình); bản đầy đủ vẽ hết
WHO = {'created_by', 'changed_by', 'updated_by', 'user_id', 'reviewer_id', 'executed_by', 'decided_by', 'confirmed_by',
       'closed_by', 'reported_by', 'check_kept_by', 'assignee_id'}

# Bản rút gọn: chỉ hiện khóa và vài thuộc tính tiêu biểu
EXTRA = {
    'users': ['username', 'role'], 'projects': ['code', 'jira_key'], 'modules': ['name'], 'project_members': [],
    'sync_logs': ['source', 'status'], 'parameters': ['value'], 'audit_logs': ['action'], 'sprints': ['name'],
    'user_stories': ['code', 'title', 'current_version', 'archived', 'check_reason'],
    'requirement_versions': ['version', 'changes'], 'impact_analyses': ['from_version', 'to_version'],
    'ai_proposals': ['type', 'source_part', 'status'], 'ai_logs': ['task', 'status'],
    'test_cases': ['code', 'status', 'version', 'req_version', 'needs_review'], 'test_case_acs': [],
    'test_case_versions': ['version'], 'recheck_logs': ['reason'], 'reviews': ['decision'], 'test_suites': ['name'],
    'test_suite_items': [], 'automation_scripts': [], 'test_runs': ['run_type', 'build', 'status'],
    'test_run_items': ['tc_version'], 'test_executions': ['result', 'tc_version'], 'fix_reports': ['build', 'status'],
    'regression_sets': ['status'], 'regression_items': ['priority', 'mandatory', 'removed'],
}


def attr(s):
    return escape(str(s), {'"': '&quot;', '\n': '&#10;'})


# ---------------------------------------------------------------------------
# Đọc lược đồ thật và chú thích
# ---------------------------------------------------------------------------
def read_schema():
    sql = SCHEMA.read_text(encoding='utf-8')
    db = sqlite3.connect(':memory:')
    db.executescript(sql)
    tables = {}
    for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid"):
        cols = [dict(name=r[1], type=r[2] or 'TEXT', notnull=bool(r[3]) or bool(r[5]), pk=bool(r[5]), default=r[4])
                for r in db.execute(f'PRAGMA table_info({name})')]
        fks = {}
        for r in db.execute(f'PRAGMA foreign_key_list({name})'):
            fks[r[3]] = dict(table=r[2], on_delete=r[6])
        uniq = set()
        for idx in db.execute(f'PRAGMA index_list({name})'):
            if idx[2]:
                icols = [r[2] for r in db.execute(f'PRAGMA index_info({idx[1]})')]
                if len(icols) == 1:
                    uniq.add(icols[0])
        for c in cols:
            c['fk'] = fks.get(c['name'])
            c['uk'] = c['name'] in uniq and not c['pk']
        tables[name] = cols
    return tables, comments(sql)


def comments(sql):
    """Chú thích của bảng (dòng -- ngay trước CREATE TABLE) và của từng cột (-- cuối dòng)."""
    out = {}
    lines = sql.splitlines()
    for i, line in enumerate(lines):
        m = re.match(r'CREATE TABLE IF NOT EXISTS (\w+)', line)
        if not m:
            continue
        name = m.group(1)
        j, head = i - 1, []
        while j >= 0 and lines[j].startswith('--'):
            head.insert(0, lines[j].lstrip('- ').strip())
            j -= 1
        cols = {}
        k = i + 1
        while k < len(lines) and not lines[k].startswith(');'):
            cm = re.match(r'\s+(\w+)\s+[A-Z].*?--\s*(.+)$', lines[k])
            if cm and cm.group(1) not in ('PRIMARY', 'UNIQUE', 'CHECK'):
                cols[cm.group(1)] = cm.group(2).strip()
            k += 1
        checks = {}
        body = '\n'.join(lines[i:k])
        for cm in re.finditer(r'(\w+)\s+IN\s*\(([^)]*)\)', body):
            checks[cm.group(1)] = cm.group(2).replace("'", '')
        out[name] = dict(head=' '.join(head), cols=cols, checks=checks)
    return out


# ---------------------------------------------------------------------------
# Dựng file draw.io
# ---------------------------------------------------------------------------
def key_label(c):
    k = []
    if c['pk']:
        k.append('PK')
    if c['fk']:
        k.append('FK')
    if c['uk']:
        k.append('UK')
    return ', '.join(k)


def shown_cols(table, cols, full):
    if full:
        return cols, 0
    keep = [c for c in cols if c['pk'] or c['fk'] or c['uk'] or c['name'] in EXTRA.get(table, [])]
    return keep, len(cols) - len(keep)


def build(tables, full):
    W = 300 if full else 250
    ROW, HEAD, GAP, COLGAP = (22, 30, 34, 150) if full else (24, 30, 36, 170)
    fs = 12 if full else 14
    cells = []
    row_id = {}   # (bảng, cột) → id dòng
    pk_row = {}   # bảng → id dòng khóa chính đầu tiên
    nid = [1]

    def new_id(prefix):
        nid[0] += 1
        return f'{prefix}{nid[0]}'

    x = 40
    for gname, fill, stroke, names in GROUPS:
        y = 70
        cells.append(f'<mxCell id="{new_id("g")}" value="{attr(gname)}" style="text;html=1;fontSize={fs + 4};fontStyle=1;'
                     f'fontFamily={FONT};align=left;verticalAlign=middle;" vertex="1" parent="1">'
                     f'<mxGeometry x="{x}" y="20" width="{W + 60}" height="30" as="geometry"/></mxCell>')
        for t in names:
            cols, hidden = shown_cols(t, tables[t], full)
            rows = len(cols) + (1 if hidden else 0)
            h = HEAD + rows * ROW
            tid = new_id('t')
            title = t + (' (mở rộng)' if t in EXT else '')
            dash = 'dashed=1;' if t in EXT else ''
            cells.append(f'<mxCell id="{tid}" value="{attr(title)}" style="shape=table;startSize={HEAD};container=1;collapsible=0;'
                         f'childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=1;align=center;resizeLast=1;html=1;'
                         f'fillColor={fill};strokeColor={stroke};fontFamily={FONT};fontSize={fs + 1};{dash}" vertex="1" parent="1">'
                         f'<mxGeometry x="{x}" y="{y}" width="{W}" height="{h}" as="geometry"/></mxCell>')
            ry = HEAD
            for c in cols:
                rid = new_id('r')
                row_id[(t, c['name'])] = rid
                if c['pk'] and t not in pk_row:
                    pk_row[t] = rid
                bold = 'fontStyle=1;' if c['pk'] else 'fontStyle=2;' if c['fk'] else ''
                under = 'fontStyle=5;' if c['pk'] else ''
                name = c['name'] + (f": {c['type']}{'' if not c['notnull'] or c['pk'] else ' NN'}" if full else '')
                cells.append(f'<mxCell id="{rid}" value="" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;'
                             f'fillColor=none;collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;top=0;left=0;'
                             f'right=0;bottom={1 if c["pk"] else 0};" vertex="1" parent="{tid}">'
                             f'<mxGeometry y="{ry}" width="{W}" height="{ROW}" as="geometry"/></mxCell>')
                cells.append(f'<mxCell id="{new_id("k")}" value="{attr(key_label(c))}" style="shape=partialRectangle;connectable=0;'
                             f'fillColor=none;top=0;left=0;bottom=0;right=0;{bold}overflow=hidden;html=1;fontFamily={FONT};fontSize={fs - 1};"'
                             f' vertex="1" parent="{rid}"><mxGeometry width="52" height="{ROW}" as="geometry">'
                             f'<mxRectangle width="52" height="{ROW}" as="alternateBounds"/></mxGeometry></mxCell>')
                cells.append(f'<mxCell id="{new_id("n")}" value="{attr(name)}" style="shape=partialRectangle;connectable=0;fillColor=none;'
                             f'top=0;left=0;bottom=0;right=0;align=left;spacingLeft=6;{under or bold}overflow=hidden;html=1;'
                             f'fontFamily={FONT};fontSize={fs};" vertex="1" parent="{rid}"><mxGeometry x="52" width="{W - 52}" '
                             f'height="{ROW}" as="geometry"><mxRectangle width="{W - 52}" height="{ROW}" as="alternateBounds"/>'
                             f'</mxGeometry></mxCell>')
                ry += ROW
            if hidden:
                rid = new_id('r')
                cells.append(f'<mxCell id="{rid}" value="" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;'
                             f'fillColor=none;collapsible=0;dropTarget=0;top=0;left=0;right=0;bottom=0;" vertex="1" parent="{tid}">'
                             f'<mxGeometry y="{ry}" width="{W}" height="{ROW}" as="geometry"/></mxCell>')
                cells.append(f'<mxCell id="{new_id("n")}" value="… {hidden} thuộc tính khác" style="shape=partialRectangle;'
                             f'connectable=0;fillColor=none;top=0;left=0;bottom=0;right=0;align=left;spacingLeft=58;fontStyle=2;'
                             f'fontColor=#666666;html=1;fontFamily={FONT};fontSize={fs - 1};" vertex="1" parent="{rid}">'
                             f'<mxGeometry width="{W}" height="{ROW}" as="geometry"><mxRectangle width="{W}" height="{ROW}" '
                             f'as="alternateBounds"/></mxGeometry></mxCell>')
            y += h + GAP
        x += W + COLGAP

    # Quan hệ: từ dòng FK (bảng con) tới dòng PK (bảng cha)
    rels = 0
    omitted = []
    for t, cols in tables.items():
        for c in cols:
            if not c['fk']:
                continue
            parent = c['fk']['table']
            if not full and c['name'] in WHO:
                omitted.append(f'{t}.{c["name"]}')
                continue
            if (t, c['name']) not in row_id or parent not in pk_row:
                raise SystemExit(f'Thiếu dòng để vẽ quan hệ {t}.{c["name"]} → {parent}')
            parent_end = 'ERmandOne' if c['notnull'] else 'ERzeroToOne'
            child_end = 'ERzeroToOne' if (c['uk'] or (c['pk'] and len([x for x in cols if x['pk']]) == 1)) else 'ERzeroToMany'
            cells.append(f'<mxCell id="{new_id("e")}" style="edgeStyle=entityRelationEdgeStyle;fontSize=12;html=1;endArrow={child_end};'
                         f'startArrow={parent_end};endFill=0;startFill=0;rounded=0;strokeColor=#555555;" edge="1" parent="1" '
                         f'source="{pk_row[parent]}" target="{row_id[(t, c["name"])]}"><mxGeometry relative="1" as="geometry"/></mxCell>')
            rels += 1
    note = ('Bản rút gọn: chỉ hiện khóa (PK, FK, UK) và vài thuộc tính tiêu biểu; không vẽ các khóa ngoại ghi nhận người thao tác '
            f'(tham chiếu users): {", ".join(sorted(omitted))}. Bảng viền nét đứt thuộc phần mở rộng ngoài MVP.') if not full else \
        'Bản đầy đủ: mọi cột kèm kiểu dữ liệu (NN = NOT NULL) và mọi khóa ngoại. Bảng viền nét đứt thuộc phần mở rộng ngoài MVP.'
    total_w = x
    cells.append(f'<mxCell id="{new_id("note")}" value="{attr(note)}" style="text;html=1;whiteSpace=wrap;fontSize={fs};fontStyle=2;'
                 f'fontFamily={FONT};align=left;verticalAlign=top;" vertex="1" parent="1">'
                 f'<mxGeometry x="40" y="{max_y(cells) + 30}" width="{total_w - 80}" height="80" as="geometry"/></mxCell>')
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="generate_erd.py" agent="SE104 AI TestCase Manager">'
           f'<diagram id="erd" name="ERD"><mxGraphModel grid="1" gridSize="10" page="0"><root><mxCell id="0"/>'
           f'<mxCell id="1" parent="0"/>{"".join(cells)}</root></mxGraphModel></diagram></mxfile>\n')
    return xml, rels, omitted


def max_y(cells):
    ys = [int(m.group(1)) + int(m.group(2)) for c in cells
          for m in [re.search(r'parent="1"><mxGeometry x="\d+" y="(\d+)" width="\d+" height="(\d+)"', c)] if m]
    return max(ys) if ys else 0


def drawio_cli():
    for p in ('/Applications/draw.io.app/Contents/MacOS/draw.io', shutil.which('drawio'), shutil.which('draw.io')):
        if p and Path(p).exists():
            return p
    raise SystemExit('Không tìm thấy draw.io Desktop. Cài: brew install --cask drawio')


def export_svg(drawio_file):
    svg = drawio_file.with_suffix('.svg')
    subprocess.run([drawio_cli(), '-x', '-f', 'svg', '-o', str(svg), str(drawio_file)], check=True, capture_output=True)
    return svg


# ---------------------------------------------------------------------------
# Lược đồ quan hệ và từ điển dữ liệu cho chương 4
# ---------------------------------------------------------------------------
def schema_markdown(tables, notes, rels):
    order = [t for _, _, _, names in GROUPS for t in names]
    lines = [f'### Lược đồ quan hệ ({len(tables)} bảng, {rels} khóa ngoại)\n',
             'Sinh tự động từ `app/src/db/schema.sql`. Khóa chính in đậm, khóa ngoại in nghiêng; cột vừa là khóa chính vừa là khóa ngoại '
             'in đậm nghiêng. Bảng đánh dấu (mở rộng) thuộc phần ngoài MVP.\n']
    for t in order:
        def fmt(c):
            n = c['name']
            if c['pk'] and c['fk']:
                return f'***{n}***'
            if c['pk']:
                return f'**{n}**'
            if c['fk']:
                return f'*{n}*'
            return n
        lines.append(f'- `{t}`{" (mở rộng)" if t in EXT else ""} ({", ".join(fmt(c) for c in tables[t])})')
    lines.append('\n### Từ điển dữ liệu\n')
    lines.append('Sinh tự động từ `schema.sql` (ý nghĩa lấy từ chú thích của từng cột). Kiểu: INTEGER, TEXT (ngày giờ lưu dạng TEXT ISO, '
                 'danh sách lưu JSON); khi chuyển PostgreSQL đổi TEXT JSON thành JSONB.\n')
    for t in order:
        n = notes.get(t, {})
        lines.append(f'**{t}**{" (mở rộng)" if t in EXT else ""}' + (f' – {n.get("head")}' if n.get('head') else '') + '\n')
        lines.append('| Thuộc tính | Kiểu | Ràng buộc | Ý nghĩa |\n|---|---|---|---|')
        for c in tables[t]:
            cons = []
            if c['pk']:
                cons.append('PK')
            if c['fk']:
                od = c['fk']['on_delete']
                cons.append(f"FK → {c['fk']['table']}" + (f' ({od})' if od and od != 'NO ACTION' else ''))
            if c['uk']:
                cons.append('UNIQUE')
            if c['notnull'] and not c['pk']:
                cons.append('NOT NULL')
            if c['default'] is not None:
                cons.append(f"mặc định {c['default']}")
            chk = n.get('checks', {}).get(c['name'])
            if chk:
                cons.append(f'∈ {{{chk}}}')
            meaning = n.get('cols', {}).get(c['name'], '')
            lines.append(f"| {c['name']} | {c['type']} | {'; '.join(cons)} | {meaning} |")
        lines.append('')
    return '\n'.join(lines) + '\n'


def main():
    tables, notes = read_schema()
    missing = set(tables) - {t for _, _, _, names in GROUPS for t in names}
    if missing:
        raise SystemExit(f'Bảng chưa xếp vào nhóm nào: {", ".join(sorted(missing))}')
    for name, full in (('ERD_CSDL', False), ('ERD_CSDL_DayDu', True)):
        xml, rels, omitted = build(tables, full)
        f = OUT / f'{name}.drawio'
        f.write_text(xml, encoding='utf-8')
        export_svg(f)
        print(f'{name}: {len(tables)} bảng, {rels} quan hệ được vẽ' + (f', {len(omitted)} khóa ngoại người thao tác không vẽ' if omitted else ''))
    total_fk = sum(1 for cols in tables.values() for c in cols if c['fk'])
    text = CHAPTER.read_text(encoding='utf-8')
    block = ('<!-- SCHEMA:BEGIN (sinh tự động bởi docs/erd/generate_erd.py, đừng sửa tay) -->\n'
             f'{schema_markdown(tables, notes, total_fk)}<!-- SCHEMA:END -->\n')
    if '<!-- SCHEMA:BEGIN' in text:
        text = re.sub(r'<!-- SCHEMA:BEGIN.*?<!-- SCHEMA:END -->\n', lambda _: block, text, flags=re.S)
    else:
        text = re.sub(r'### Lược đồ quan hệ.*?(?=Lược đồ đầy đủ: )', lambda _: block + '\n', text, flags=re.S)
    CHAPTER.write_text(text, encoding='utf-8')
    print(f'Đã cập nhật lược đồ quan hệ và từ điển dữ liệu ({len(tables)} bảng, {total_fk} khóa ngoại) trong {CHAPTER.name}')


if __name__ == '__main__':
    main()
