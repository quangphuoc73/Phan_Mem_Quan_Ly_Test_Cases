"""Vẽ sơ đồ tuần tự UML (sequence diagram) theo danh sách bước, tự xếp tọa độ."""


def sequence(b, parts, steps, x0=40, y0=80, gap=240, row=56, head_w=200, head_h=62, size=18):
    """parts: [(khóa, tên, 'actor' | 'box' | 'ext' | 'data')]
    steps:
      ('m', a, b, chữ)      gọi (nét liền, mũi tên đặc)
      ('r', a, b, chữ)      trả về (nét đứt, mũi tên mở)
      ('s', a, chữ)         tự gọi chính mình
      ('loop' | 'alt' | 'opt', chữ) mở khung · ('else', chữ) nhánh khác · ('end',) đóng khung
      ('note', a, chữ)      ghi chú cạnh đường đời
    """
    xs = {k: x0 + head_w / 2 + i * gap for i, (k, _, _) in enumerate(parts)}
    top = y0 + head_h
    y = top + 62
    frames = []
    drawn = []  # vẽ khung sau để khung nằm dưới mũi tên trong SVG
    msgs = []
    for st in steps:
        kind = st[0]
        if kind in ('loop', 'alt', 'opt'):
            frames.append({'kind': kind, 'text': st[1], 'y': y - 16, 'keys': set(), 'elses': []})
            y += 52
        elif kind == 'else':
            frames[-1]['elses'].append((y - 10, st[1]))
            y += 62
        elif kind == 'end':
            f = frames.pop()
            for p in frames:
                p['keys'] |= f['keys']
            drawn.append((f, y - 18))
            y += 34
        elif kind in ('m', 'r'):
            msgs.append((kind, st[1], st[2], st[3], y))
            for f in frames:
                f['keys'] |= {st[1], st[2]}
            y += row
        elif kind == 's':
            msgs.append(('s', st[1], None, st[2], y))
            for f in frames:
                f['keys'].add(st[1])
            y += row + 12
        elif kind == 'note':
            msgs.append(('note', st[1], None, st[2], y))
            y += row + 10
    bottom = y + 10
    width = x0 * 2 + head_w + gap * (len(parts) - 1)

    # đường đời (lifeline) và đầu đường đời
    for k, name, kind in parts:
        cx = xs[k]
        b.link([(cx, top), (cx, bottom)], head='none', dashed=True, color='#888888', width=1.5)
        if kind == 'actor':
            b.person(name, cx, y0 + 26)
        else:
            b.rect(name.split('\n'), cx - head_w / 2, y0, head_w, head_h, kind={'box': 'proc', 'ext': 'ext', 'data': 'data', 'user': 'user', 'jira': 'jira', 'ai': 'ai'}[kind],
                   size=size, bold_first=True)
    # khung loop / alt / opt
    for f, yend in drawn:
        keys = f['keys'] or {parts[0][0]}
        lx = min(xs[k] for k in keys) - 110
        rx = max(xs[k] for k in keys) + 110
        b.frame(f'{f["kind"]} [{f["text"]}]', lx, f['y'], rx - lx, yend - f['y'] + 8, kind='gray', size=size - 1, dashed=False)
        for ey, et in f['elses']:
            b.link([(lx, ey), (rx, ey)], head='none', dashed=True, color='#757575', width=1.5)
            b.tag(f'[{et}]', lx + 14, ey + 13, size=size - 1, bg=False, italic=True, anchor='start')
    # thông điệp
    for kind, a, c, text, my in msgs:
        if kind == 'note':
            b.note([text], xs[a] + 16, my - 18, max(220, len(text) * 8.2), 36, size=15)
        elif kind == 's':
            x = xs[a]
            b.link([(x, my), (x + 44, my), (x + 44, my + 24), (x + 4, my + 24)], head='block')
            b.tag(text, x + 52, my + 12, size=size, anchor='start')
        else:
            x1, x2 = xs[a], xs[c]
            d = 1 if x2 > x1 else -1
            b.link([(x1, my), (x2 - 2 * d, my)], head='block' if kind == 'm' else 'open', dashed=kind == 'r')
            b.tag(text, (x1 + x2) / 2, my - 17, size=size)
    return width, bottom + 20
