// Gộp các chương Markdown thành 1 báo cáo HTML (vẽ sơ đồ Mermaid) và xuất PDF bằng Chrome.
// Chạy: cd docs/tools && npm install && npm run build
// Sửa thông tin trang bìa trong cover.js.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { marked } = require('marked');

const COVER = require('./cover');
const BLANK = '..............................';

const DOCS = path.join(__dirname, '..');
const FILES = fs.readdirSync(DOCS).filter((f) => /^\d\d[a-z]?_.*\.md$/.test(f)).sort();
const anchor = (f) => `ch-${f.split('_')[0]}`;

const renderer = new marked.Renderer();
const baseCode = renderer.code.bind(renderer);
const escHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
renderer.code = (token) => (token.lang === 'mermaid' ? `<pre class="mermaid">${escHtml(token.text)}</pre>` : baseCode(token));
renderer.link = ({ href, text }) => {
  const m = href.match(/^(\d\d[a-z]?_[^#)]+\.md)$/);
  if (m) return `<a href="#${anchor(m[1])}">${text}</a>`;
  if (href.startsWith('../')) return `<code>${text}</code>`;
  return `<a href="${href}">${text}</a>`;
};
marked.use({ renderer, gfm: true });

const toc = [];
const chapters = FILES.map((f) => {
  const md = fs.readFileSync(path.join(DOCS, f), 'utf8');
  const title = md.match(/^# (.+)$/m)[1];
  toc.push(`<li><a href="#${anchor(f)}">${title}</a></li>`);
  return `<section class="chapter" id="${anchor(f)}">${marked.parse(md)}</section>`;
});

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Báo cáo đồ án SE104</title>
<style>
  :root { --text:#111; --muted:#555; --border:#999; --soft:#f2f2f2; --bg:#fff; }
  body { margin:0; font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height:1.5; color:var(--text); background:var(--bg); }
  .wrap { max-width: 860px; margin: 0 auto; padding: 0 28px 60px; }
  h1 { font-size: 18pt; text-transform: uppercase; text-align: center; margin: 0 0 18px; }
  h2 { font-size: 14pt; margin-top: 24px; }
  h3 { font-size: 13pt; margin-top: 18px; }
  h4 { font-size: 13pt; font-style: italic; }
  a { color: inherit; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 11.5pt; page-break-inside: auto; }
  th, td { border: 1px solid var(--border); padding: 4px 7px; vertical-align: top; text-align: left; }
  th { background: var(--soft); font-weight: bold; }
  tr { page-break-inside: avoid; }
  code { font-family: Consolas, Menlo, monospace; font-size: 10.5pt; }
  pre { background: #fafafa; border: 1px solid #ccc; padding: 10px 12px; overflow-x: auto; font-size: 10pt; line-height: 1.4; }
  pre code { background: none; padding: 0; }
  pre.mermaid { background: #fff; border: 0; text-align: center; page-break-inside: avoid; }
  blockquote { margin: 10px 0; padding: 2px 12px; border-left: 3px solid var(--border); color: var(--text); }
  img { max-width: 100%; page-break-inside: avoid; }
  p:has(> img) { page-break-inside: avoid; text-align: center; }
  .cover { min-height: 96vh; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; padding: 40px 20px; box-sizing: border-box; border: 1px solid #000; margin: 16px 0 40px; }
  .cover .school { font-weight: bold; font-size: 13pt; line-height: 1.6; }
  .cover .faculty { margin-top: 6px; font-weight: bold; }
  .cover .logo { font-weight: bold; font-size: 24pt; margin: 30px auto; }
  .cover .course { font-size: 14pt; font-weight: bold; }
  .cover .title { font-size: 20pt; font-weight: bold; margin: 18px 0 6px; line-height: 1.35; }
  .cover table { width: auto; margin: 30px auto 0; font-size: 13pt; }
  .cover td { border: 0; padding: 4px 12px; }
  .toc { page-break-after: always; }
  .toc ol { line-height: 2; }
  .chapter { page-break-before: always; }
  @media print { .wrap { max-width: none; padding: 0; } a { text-decoration: none; } @page { size: A4; margin: 20mm 18mm 20mm 25mm; } }
</style></head>
<body><div class="wrap">
  <div class="cover">
    <div><div class="school">${COVER.school}</div><div class="faculty">${COVER.faculty}</div></div>
    <div><div class="logo">UIT</div><div class="course">${COVER.course}</div>
      <div class="title">${COVER.title}</div><div>${COVER.subtitle}</div>
      <table><tr><td colspan="3"><b>Nhóm sinh viên thực hiện:</b></td></tr>
        ${COVER.members.map((m, i) => `<tr><td>${i + 1}.</td><td><b>${m.name || BLANK}</b></td><td>MSSV: ${m.id || BLANK}</td></tr>`).join('')}
        <tr><td colspan="3">Lớp: ${COVER.className}</td></tr>
        <tr><td colspan="3">Giảng viên hướng dẫn: ${COVER.lecturer}</td></tr></table></div>
    <div>${COVER.place}</div>
  </div>
  <div class="toc"><h1>Mục lục</h1><ol>${toc.join('')}</ol></div>
  ${chapters.join('\n')}
</div>
<script src="assets/mermaid.min.js"></script>
<script>
  mermaid.initialize({ startOnLoad: false, theme: 'default', themeVariables: { primaryTextColor: '#000000', textColor: '#000000', lineColor: '#333333' }, securityLevel: 'strict', flowchart: { htmlLabels: true, useMaxWidth: true } });
  mermaid.run().then(() => { document.body.dataset.ready = '1'; }).catch((e) => { document.body.dataset.ready = 'error'; console.error(e); });
</script>
</body></html>`;

fs.mkdirSync(path.join(DOCS, 'assets'), { recursive: true });
fs.copyFileSync(require.resolve('mermaid/dist/mermaid.min.js'), path.join(DOCS, 'assets', 'mermaid.min.js'));
const out = path.join(DOCS, 'BaoCaoDoAn.html');
fs.writeFileSync(out, html);
console.log(`Đã tạo ${out} (${FILES.length} chương)`);

// Xuất PDF bằng Google Chrome chế độ headless (nếu có)
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe']
  .find((p) => fs.existsSync(p));
if (chrome && !process.argv.includes('--no-pdf')) {
  const pdf = path.join(DOCS, 'BaoCaoDoAn.pdf');
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=20000',
    `--print-to-pdf=${pdf}`, `file://${out}`], { stdio: 'ignore' });
  console.log(`Đã tạo ${pdf}`);
} else if (!chrome) {
  console.log('Không tìm thấy Chrome: mở BaoCaoDoAn.html rồi In → Lưu thành PDF.');
}
