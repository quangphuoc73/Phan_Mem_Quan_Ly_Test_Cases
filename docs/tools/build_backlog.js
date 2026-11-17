// Sinh docs/agile/ProductBacklog.xlsx từ ProductBacklog.csv (nguồn duy nhất, dùng để nhập Jira/Trello).
// Excel cài vùng Việt Nam dùng dấu ";" ngăn cột nên mở file CSV sẽ dồn vào một cột; bản .xlsx để đọc và in.
// Chạy: cd docs/tools && npm run backlog
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const DIR = path.join(__dirname, '..', 'agile');
const CSV = path.join(DIR, 'ProductBacklog.csv');
const OUT = path.join(DIR, 'ProductBacklog.xlsx');

// CSV theo RFC 4180: trường có dấu phẩy nằm trong ngoặc kép, "" là một dấu ngoặc kép
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(field), (field = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field), rows.push(row), (row = []), (field = '');
    } else field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows.filter((r) => r.some((v) => v !== ''));
}

const COLUMNS = [
  { header: 'Mã', width: 8 },
  { header: 'Loại', width: 8 },
  { header: 'Epic', width: 20 },
  { header: 'User story', width: 70 },
  { header: 'Story point', width: 11 },
  { header: 'Ưu tiên (MoSCoW)', width: 17 },
  { header: 'Sprint', width: 10 },
  { header: 'Yêu cầu', width: 10 },
];
const BORDER = { style: 'thin', color: { argb: 'FF999999' } };
const BOX = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

function styleHeader(row) {
  row.font = { bold: true };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.eachCell((c) => ((c.fill = HEAD_FILL), (c.border = BOX)));
}

async function main() {
  const [, ...data] = parseCsv(fs.readFileSync(CSV, 'utf8').replace(/^﻿/, ''));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nhóm đồ án SE104';

  const ws = wb.addWorksheet('Product Backlog', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUMNS;
  styleHeader(ws.getRow(1));
  for (const r of data) {
    const row = ws.addRow([r[0], r[1], r[2], r[3], Number(r[4]) || null, r[5], r[6] || '–', r[7]]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell({ includeEmpty: true }, (c) => (c.border = BOX));
    [5, 7, 8].forEach((i) => (row.getCell(i).alignment = { vertical: 'top', horizontal: 'center' }));
    if (r[5].startsWith("Won't")) row.font = { color: { argb: 'FF808080' }, italic: true };
  }
  ws.autoFilter = { from: 'A1', to: `H${data.length + 1}` };
  // In: A4 ngang, vừa 1 trang theo chiều rộng, lặp lại dòng tiêu đề
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' };

  // Tổng hợp theo sprint bằng công thức, sửa CSV rồi chạy lại là số liệu tự đúng
  const sum = wb.addWorksheet('Theo sprint');
  sum.columns = [{ header: 'Sprint', width: 16 }, { header: 'Số story', width: 10 }, { header: 'Tổng story point', width: 18 }];
  styleHeader(sum.getRow(1));
  const sprints = [...new Set(data.map((r) => r[6]).filter(Boolean))].sort();
  const last = data.length + 1;
  sprints.forEach((s) => sum.addRow([s,
    { formula: `COUNTIF('Product Backlog'!G2:G${last},"${s}")` },
    { formula: `SUMIF('Product Backlog'!G2:G${last},"${s}",'Product Backlog'!E2:E${last})` }]));
  sum.addRow(["Won't (bản này)",
    { formula: `COUNTIF('Product Backlog'!F2:F${last},"Won't*")` },
    { formula: `SUMIF('Product Backlog'!F2:F${last},"Won't*",'Product Backlog'!E2:E${last})` }]);
  const total = sum.addRow(['Tổng', { formula: `SUM(B2:B${sprints.length + 2})` }, { formula: `SUM(C2:C${sprints.length + 2})` }]);
  total.font = { bold: true };
  sum.eachRow((row) => row.eachCell((c) => (c.border = BOX)));

  await wb.xlsx.writeFile(OUT);
  console.log(`Đã tạo ${OUT} (${data.length} story)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
