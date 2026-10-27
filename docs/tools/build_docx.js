// Xuất báo cáo ra Word (BaoCaoDoAn.docx) từ cùng các chương Markdown, để chỉnh sửa bằng Word.
// Sơ đồ Mermaid được Chrome vẽ (từ BaoCaoDoAn.html) rồi chụp thành ảnh PNG; hình .svg (DFD) cũng được đổi sang PNG.
// Chạy: cd docs/tools && npm install && npm run build && npm run docx
// Sửa thông tin trang bìa trong cover.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { marked } = require('marked');
const {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, LevelFormat, PageBreak, PageNumber,
  Packer, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType, ExternalHyperlink,
} = require('docx');
const COVER = require('./cover');

const DOCS = path.join(__dirname, '..');
const FILES = fs.readdirSync(DOCS).filter((f) => /^\d\d[a-z]?_.*\.md$/.test(f)).sort();
const HTML = path.join(DOCS, 'BaoCaoDoAn.html');
const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe']
  .find((p) => fs.existsSync(p));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'baocao-docx-'));

const FONT = 'Times New Roman';
const PAGE_W = 11906; // A4, đơn vị DXA
const MARGIN = 1134; // 2 cm
const CONTENT_W = PAGE_W - 2 * MARGIN;
const MAX_IMG_PX = 620; // chiều rộng ảnh tối đa (px ở 96 dpi) ≈ chiều rộng vùng chữ

if (!CHROME) throw new Error('Cần Google Chrome để vẽ sơ đồ Mermaid và đổi SVG sang PNG.');
if (!fs.existsSync(HTML)) throw new Error('Chưa có BaoCaoDoAn.html: chạy "npm run build" trước.');

// ---------- Ảnh ----------
const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

function screenshot(html, w, h) {
  const page = path.join(TMP, `shot-${Math.random().toString(36).slice(2)}.html`);
  const png = page.replace(/\.html$/, '.png');
  fs.writeFileSync(page, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
    `--window-size=${Math.ceil(w)},${Math.ceil(h)}`, `--screenshot=${png}`, `file://${page}`], { stdio: 'ignore' });
  return fs.readFileSync(png);
}

function svgToPng(svg) {
  const vb = svg.match(/viewBox="([\d.\s-]+)"/);
  const [, , w, h] = vb ? vb[1].trim().split(/\s+/).map(Number) : [0, 0, 800, 600];
  const fixed = svg.replace(/<svg([^>]*?)>/, (m, a) => `<svg${a.replace(/\s(width|height|style)="[^"]*"/g, '')} width="${w}" height="${h}">`);
  return screenshot(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style>${fixed}`, w, h);
}

// Lấy các sơ đồ Mermaid đã vẽ (theo thứ tự xuất hiện) từ DOM của BaoCaoDoAn.html
function renderMermaid() {
  const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--virtual-time-budget=20000', '--dump-dom', `file://${HTML}`],
    { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const blocks = [...dom.matchAll(/<pre class="mermaid"[^>]*>([\s\S]*?)<\/pre>/g)].map((m) => m[1]);
  // Ảnh của mermaid dùng CSS nhúng trong <style> của chính SVG nên chụp riêng từng SVG vẫn giữ đúng định dạng
  return blocks.map((b) => {
    const svg = b.match(/<svg[\s\S]*<\/svg>/);
    return svg ? svgToPng(svg[0]) : null;
  });
}

function imageParagraph(buf, alt) {
  const { w, h } = pngSize(buf);
  const scale = Math.min(1, MAX_IMG_PX / (w / 2)); // ảnh chụp ở tỷ lệ 2x
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 }, keepNext: false,
    children: [new ImageRun({ type: 'png', data: buf, transformation: { width: Math.round((w / 2) * scale), height: Math.round((h / 2) * scale) }, altText: { title: alt, description: alt, name: alt } })],
  });
}

// ---------- Chữ trong dòng ----------
const decode = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

function inline(tokens, style = {}) {
  const out = [];
  for (const t of tokens || []) {
    switch (t.type) {
      case 'strong': out.push(...inline(t.tokens, { ...style, bold: true })); break;
      case 'em': out.push(...inline(t.tokens, { ...style, italics: true })); break;
      case 'del': out.push(...inline(t.tokens, { ...style, strike: true })); break;
      case 'codespan':
        out.push(new TextRun({ text: decode(t.text), font: 'Consolas', size: 20, shading: { type: ShadingType.CLEAR, fill: 'F1F3F7', color: 'auto' }, ...style }));
        break;
      case 'br': out.push(new TextRun({ break: 1 })); break;
      case 'link':
        if (/^https?:/.test(t.href)) {
          out.push(new ExternalHyperlink({ link: t.href, children: inline(t.tokens, { ...style, color: '1D4ED8', underline: {} }) }));
        } else out.push(...inline(t.tokens, style)); // liên kết giữa các chương: giữ chữ
        break;
      case 'html':
        if (/<br\s*\/?>/i.test(t.text)) out.push(new TextRun({ break: 1 }));
        break;
      case 'image': break; // ảnh trong dòng được xử lý ở cấp đoạn
      case 'text':
      case 'escape':
        if (t.tokens) out.push(...inline(t.tokens, style));
        else out.push(new TextRun({ text: decode(t.text), ...style }));
        break;
      default:
        if (t.text) out.push(new TextRun({ text: decode(t.text), ...style }));
    }
  }
  return out;
}

// ---------- Khối ----------
let mermaidImages = [];
let mermaidIdx = 0;
let firstChapter = true;

function headingLevel(depth) {
  return [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][Math.min(depth, 4) - 1];
}

function table(t) {
  const cols = t.header.length;
  const widths = Array(cols).fill(Math.floor(CONTENT_W / cols));
  // chia chiều rộng theo độ dài nội dung: cột ngắn (STT, mã, luồng) hẹp, cột mô tả rộng
  if (cols >= 2) {
    const lens = [t.header, ...t.rows].reduce((acc, row) => row.map((c, i) => Math.max(acc[i] || 0, Math.min(c.text.length, 60))), []);
    const total = lens.reduce((a, b) => a + Math.max(b, 6), 0);
    lens.forEach((l, i) => { widths[i] = Math.floor((CONTENT_W * Math.max(l, 6)) / total); });
    // cột tối thiểu đủ cho chữ ngắn như "STT", "BM10", "QĐ12" không bị bẻ dòng
    const MIN = 820;
    const short = widths.map((w) => w < MIN);
    const need = short.reduce((a, s, i) => a + (s ? MIN - widths[i] : 0), 0);
    const pool = widths.reduce((a, w, i) => a + (short[i] ? 0 : w), 0);
    widths.forEach((w, i) => { widths[i] = short[i] ? MIN : Math.floor(w - (need * w) / pool); });
  }
  widths[cols - 1] = CONTENT_W - widths.slice(0, -1).reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'B8C0CC' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (c, i, head) => new TableCell({
    borders, width: { size: widths[i], type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: 'E8EDF5', color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ spacing: { after: 0, line: 260 }, children: inline(c.tokens, { size: 22, ...(head ? { bold: true } : {}) }) })],
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: t.header.map((c, i) => cell(c, i, true)) }),
      ...t.rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })),
    ],
  });
}

function list(t, level = 0) {
  const out = [];
  for (const item of t.items) {
    let first = true;
    for (const child of item.tokens) {
      if (child.type === 'list') { out.push(...list(child, level + 1)); continue; }
      const runs = child.tokens ? inline(child.tokens) : [new TextRun(decode(child.text || ''))];
      if (item.task) runs.unshift(new TextRun(item.checked ? '☑ ' : '☐ '));
      out.push(new Paragraph({
        children: runs, spacing: { after: 60 },
        ...(first ? { numbering: { reference: t.ordered ? 'numbers' : 'bullets', level, instance: t.ordered ? listInstance : undefined } }
          : { indent: { left: 720 * (level + 1) } }),
      }));
      first = false;
    }
  }
  return out;
}
let listInstance = 0;

function blocks(tokens) {
  const out = [];
  for (const t of tokens) {
    switch (t.type) {
      case 'heading': {
        const isChapter = t.depth === 1;
        if (isChapter && !firstChapter) out.push(new Paragraph({ children: [new PageBreak()] }));
        if (isChapter) firstChapter = false;
        out.push(new Paragraph({ heading: headingLevel(t.depth), children: inline(t.tokens) }));
        break;
      }
      case 'paragraph': {
        const imgs = t.tokens.filter((x) => x.type === 'image');
        if (imgs.length) {
          for (const im of imgs) {
            const file = path.join(DOCS, decodeURI(im.href));
            if (!fs.existsSync(file)) continue;
            const buf = file.endsWith('.svg') ? svgToPng(fs.readFileSync(file, 'utf8')) : fs.readFileSync(file);
            if (!file.endsWith('.svg') && !file.endsWith('.png')) continue;
            out.push(imageParagraph(buf, im.text || path.basename(file)));
            if (im.text) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: im.text, italics: true, size: 22 })] }));
          }
          const rest = t.tokens.filter((x) => x.type !== 'image' && !(x.type === 'text' && !x.text.trim()));
          if (rest.length) out.push(new Paragraph({ children: inline(rest) }));
        } else {
          out.push(new Paragraph({ children: inline(t.tokens), spacing: { after: 120 } }));
        }
        break;
      }
      case 'list': listInstance += 1; out.push(...list(t)); break;
      case 'table': out.push(table(t), new Paragraph({ spacing: { after: 60 }, children: [] })); break;
      case 'code':
        if (t.lang === 'mermaid') {
          const img = mermaidImages[mermaidIdx++];
          if (img) out.push(imageParagraph(img, 'Sơ đồ'));
        } else {
          const lines = t.text.split('\n');
          lines.forEach((ln, i) => out.push(new Paragraph({
            spacing: { after: 0, line: 240 }, shading: { type: ShadingType.CLEAR, fill: 'F1F3F7', color: 'auto' },
            keepLines: true, keepNext: i < lines.length - 1,
            children: [new TextRun({ text: ln || ' ', font: 'Consolas', size: 18 })],
          })));
          out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        }
        break;
      case 'blockquote':
        for (const p of t.tokens) {
          out.push(new Paragraph({
            indent: { left: 360 }, spacing: { after: 80 },
            border: { left: { style: BorderStyle.SINGLE, size: 18, color: '1D4ED8', space: 8 } },
            shading: { type: ShadingType.CLEAR, fill: 'EEF3FF', color: 'auto' },
            children: p.tokens ? inline(p.tokens, { color: '1E3A8A' }) : [],
          }));
        }
        break;
      case 'hr':
        out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'B8C0CC', space: 1 } }, children: [] }));
        break;
      case 'html':
        break; // chú thích HTML (VD: <!-- DFD:BEGIN -->) không đưa vào Word
      case 'space': break;
      default:
        if (t.text) out.push(new Paragraph({ children: [new TextRun(decode(t.text))] }));
    }
  }
  return out;
}

// ---------- Trang bìa, mục lục ----------
function cover() {
  const lines = (s) => s.split('<br>');
  const p = (text, opts = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, ...opts.p, children: [new TextRun({ text, bold: true, size: 26, ...opts.r })] });
  const BLANK = '..............................';
  const info = [
    ['Nhóm sinh viên thực hiện:', ''],
    ...COVER.members.map((m, i) => [`${i + 1}. ${m.name || BLANK}`, `MSSV: ${m.id || BLANK}`]),
    ['Lớp:', COVER.className], ['Giảng viên hướng dẫn:', COVER.lecturer],
  ];
  return [
    ...lines(COVER.school).map((s) => p(s)),
    p(COVER.faculty, { p: { spacing: { after: 1400 } } }),
    p('UIT', { r: { size: 56, color: '1D4ED8' }, p: { spacing: { after: 1000 } } }),
    p(COVER.course, { r: { size: 28 }, p: { spacing: { after: 400 } } }),
    ...lines(COVER.title).map((s) => p(s, { r: { size: 40, color: '1D4ED8' } })),
    p(COVER.subtitle, { r: { bold: false, italics: true }, p: { spacing: { after: 1000 } } }),
    ...info.map(([k, v]) => new Paragraph({ indent: { left: 2000 }, spacing: { after: 80 }, children: [new TextRun({ text: `${k} `, size: 26 }), new TextRun({ text: v, bold: true, size: 26 })] })),
    p(COVER.place, { r: { bold: false }, p: { spacing: { before: 1600 } } }),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('MỤC LỤC')] }),
    new Paragraph({ children: [new TextRun({ text: 'Trong Word: nhấn chuột phải vào mục lục → Update Field (Cập nhật trường) để cập nhật số trang.', italics: true, size: 20, color: '5B6478' })] }),
    new TableOfContents('Mục lục', { hyperlink: true, headingStyleRange: '1-3' }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ---------- Ghép ----------
async function main() {
  mermaidImages = renderMermaid();
  const body = [];
  for (const f of FILES) body.push(...blocks(marked.lexer(fs.readFileSync(path.join(DOCS, f), 'utf8'), { gfm: true })));
  const mdCount = FILES.reduce((n, f) => n + (fs.readFileSync(path.join(DOCS, f), 'utf8').match(/```mermaid/g) || []).length, 0);
  if (mdCount !== mermaidImages.filter(Boolean).length) console.warn(`Cảnh báo: có ${mdCount} sơ đồ Mermaid nhưng chỉ vẽ được ${mermaidImages.filter(Boolean).length}.`);

  const level = (lvl, fmt, text) => ({ level: lvl, format: fmt, text, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (lvl + 1), hanging: 360 } } } });
  const doc = new Document({
    creator: 'Nhóm đồ án SE104', title: 'Báo cáo đồ án SE104 – AI TestCase Manager',
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: 26 }, paragraph: { spacing: { line: 300 } } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: FONT, size: 36, bold: true, color: '1D4ED8' }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 240 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 34, bold: true, color: '1D4ED8' }, paragraph: { spacing: { before: 120, after: 240 }, outlineLevel: 0, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true }, paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 1, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 27, bold: true }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2, keepNext: true } },
        { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, italics: true }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 3, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [0, 1, 2, 3].map((l) => level(l, LevelFormat.BULLET, ['•', '◦', '▪', '•'][l])) },
        { reference: 'numbers', levels: [0, 1, 2, 3].map((l) => level(l, l % 2 ? LevelFormat.LOWER_LETTER : LevelFormat.DECIMAL, `%${l + 1}.`)) },
      ],
    },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 22 })] })] }) },
      children: [...cover(), ...body],
    }],
  });
  const out = path.join(DOCS, 'BaoCaoDoAn.docx');
  fs.writeFileSync(out, await Packer.toBuffer(doc));
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`Đã tạo ${out} (${FILES.length} chương, ${mermaidImages.filter(Boolean).length} sơ đồ Mermaid)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
