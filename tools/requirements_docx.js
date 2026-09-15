// Builds docs/requirements-map.docx from docs/requirements-map.md.
// Run: node tools/requirements_docx.js
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType,
  WidthType, ShadingType, BorderStyle, PageOrientation, LevelFormat, Footer, PageNumber,
} = require('docx');

const md = fs.readFileSync(path.join(__dirname, '..', 'docs', 'requirements-map.md'), 'utf8');

// ---- palette (matches the website) ----
const NAVY = '0B3D5C', ORANGE = 'B84F0C', INK = '1C2B36', MUTED = '4F5F6B', SKY = 'E9F6FA', LINE = 'E6DDCF';
const STATUS = { 'Met': ['2E7D32', 'E8F3E6'], 'Needs input': ['9A6B00', 'FFF4D6'], 'Pending': ['5B6470', 'ECEFF2'] };

// ---- parse the markdown ----
const lines = md.split('\n');
const sections = [];
let cur = null;
for (const line of lines) {
  if (line.startsWith('## ')) { cur = { title: line.slice(3).trim(), rows: [], todo: [] }; sections.push(cur); continue; }
  if (!cur) continue;
  if (line.startsWith('| ') && !line.startsWith('| Requirement') && !line.startsWith('|---')) {
    const cells = line.slice(1, -1).split(' | ').map(c => c.trim().replace(/\\\|/g, '|'));
    if (cells.length === 4) cur.rows.push(cells);
  }
  const m = line.match(/^(\d+)\. (.*)$/);
  if (m) cur.todo.push(m[2]);
}

// inline markdown (`code`, _italic_, bullets) -> TextRuns
function runs(text, base = {}) {
  const out = [];
  const parts = text.split(/(`[^`]+`|_[^_]+_)/g).filter(Boolean);
  for (const p of parts) {
    if (p.startsWith('`')) out.push(new TextRun({ text: p.slice(1, -1), font: 'Consolas', size: 17, color: NAVY, ...base }));
    else if (p.startsWith('_') && p.endsWith('_')) out.push(new TextRun({ text: p.slice(1, -1), italics: true, color: MUTED, ...base }));
    else out.push(new TextRun({ text: p, ...base }));
  }
  return out;
}
function cellParas(text, opts = {}) {
  // "• a • b" lists become separate paragraphs
  if (text.includes('• ')) {
    return text.split('• ').map(s => s.trim()).filter(Boolean).map(s =>
      new Paragraph({ children: [new TextRun({ text: '• ', color: ORANGE, bold: true }), ...runs(s, opts)], spacing: { after: 40 } }));
  }
  return [new Paragraph({ children: runs(text, opts), spacing: { after: 0 } })];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };
const COLS = [3400, 4300, 1400, 4460]; // DXA, sums to 13560 (landscape letter, 1" margins)

function headerCell(t, w) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, borders, shading: { type: ShadingType.CLEAR, fill: SKY, color: 'auto' },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: t.toUpperCase(), bold: true, size: 16, color: NAVY, characterSpacing: 20 })] })],
  });
}
function cell(children, w) {
  return new TableCell({ width: { size: w, type: WidthType.DXA }, borders, margins: { top: 100, bottom: 100, left: 120, right: 120 }, children });
}
function statusCell(s, w) {
  const [fg, bg] = STATUS[s] || [INK, 'FFFFFF'];
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, borders, margins: { top: 100, bottom: 100, left: 120, right: 120 },
    shading: { type: ShadingType.CLEAR, fill: bg, color: 'auto' },
    children: [new Paragraph({ children: [new TextRun({ text: s, bold: true, color: fg, size: 18 })] })],
  });
}

function table(rows) {
  return new Table({
    columnWidths: COLS, width: { size: COLS.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: ['Requirement', 'Where on the site', 'Status', 'Notes'].map((t, i) => headerCell(t, COLS[i])) }),
      ...rows.map(([req, where, status, note]) => new TableRow({
        cantSplit: true,
        children: [
          cell(cellParas(req, { bold: true }).map((p, i) => i === 0 ? p : p), COLS[0]),
          cell(cellParas(where), COLS[1]),
          statusCell(status, COLS[2]),
          cell(cellParas(note || '—', { color: MUTED, size: 18 }), COLS[3]),
        ],
      })),
    ],
  });
}

// ---- counts for the summary ----
const all = sections.flatMap(s => s.rows);
const count = k => all.filter(r => r[2] === k).length;

const children = [
  new Paragraph({ children: [new TextRun({ text: 'DISCOVERY SCHOOL BURUNDI · WEBSITE REDESIGN', bold: true, size: 18, color: ORANGE, characterSpacing: 30 })], spacing: { after: 120 } }),
  new Paragraph({ text: 'Requirements map', heading: HeadingLevel.TITLE }),
  new Paragraph({ children: [new TextRun({ text: "Every requirement from the Headmaster's brief (and the two technical requirements from the project owner), traced to the page and section of the new website where it is met — and what still needs the school's input.", color: MUTED, size: 22 })], spacing: { after: 160 } }),
  new Paragraph({ children: [
    new TextRun({ text: 'Site: ', color: MUTED }), new TextRun({ text: 'https://timmybirds.github.io/discovery-school/', bold: true }),
    new TextRun({ text: '     Prepared: ', color: MUTED }), new TextRun({ text: '14 September 2026', bold: true }),
    new TextRun({ text: '     Pages: ', color: MUTED }), new TextRun({ text: '10', bold: true }),
  ], spacing: { after: 240 } }),
  new Paragraph({ children: [
    new TextRun({ text: `${count('Met')} met`, bold: true, color: STATUS['Met'][0], size: 26 }),
    new TextRun({ text: '   ·   ', color: MUTED, size: 26 }),
    new TextRun({ text: `${count('Needs input')} need the school's input to stay current`, bold: true, color: STATUS['Needs input'][0], size: 26 }),
    new TextRun({ text: '   ·   ', color: MUTED, size: 26 }),
    new TextRun({ text: `${count('Pending')} pending (staff page)`, bold: true, color: STATUS['Pending'][0], size: 26 }),
  ], spacing: { after: 120 } }),
  new Paragraph({ children: [
    new TextRun({ text: 'Met', bold: true, color: STATUS['Met'][0] }), new TextRun({ text: ' = built and live.   ', color: MUTED }),
    new TextRun({ text: 'Needs input', bold: true, color: STATUS['Needs input'][0] }), new TextRun({ text: ' = structure built; the school supplies or confirms content.   ', color: MUTED }),
    new TextRun({ text: 'Pending', bold: true, color: STATUS['Pending'][0] }), new TextRun({ text: ' = placeholder only.', color: MUTED }),
  ], spacing: { after: 200 } }),
];

for (const s of sections) {
  children.push(new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 } }));
  if (s.rows.length) children.push(table(s.rows));
  if (s.todo.length) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Each of these is marked on the site itself with an orange dashed "To complete" box.', color: MUTED })], spacing: { after: 120 } }));
    s.todo.forEach(t => children.push(new Paragraph({ children: runs(t), numbering: { reference: 'todo', level: 0 }, spacing: { after: 80 } })));
  }
}
children.push(new Paragraph({
  children: [new TextRun({ text: "Source of requirements: the Headmaster's brief and the project owner's technical constraints, as given in the original design request. Sections are referenced by file name and anchor (e.g. admissions.html#fees) so they remain valid wherever the site is hosted.", color: MUTED, size: 18 })],
  spacing: { before: 400 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 8 } },
}));

const doc = new Document({
  creator: 'Discovery School Burundi website project',
  title: 'Requirements map — Discovery School Burundi website',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 20, color: INK } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: 'Georgia', size: 52, bold: true, color: NAVY }, paragraph: { spacing: { after: 120 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Georgia', size: 30, bold: true, color: NAVY }, paragraph: { outlineLevel: 0 } },
    ],
  },
  numbering: { config: [{ reference: 'todo', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 480, hanging: 300 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 15840, height: 12240, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1080, right: 1140, bottom: 1080, left: 1140 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      new TextRun({ text: 'Discovery School Burundi — requirements map   ·   page ', color: MUTED, size: 16 }),
      new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 }),
    ] })] }) },
    children,
  }],
});

const out = path.join(__dirname, '..', 'docs', 'requirements-map.docx');
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(out, buf); console.log('wrote', path.relative(process.cwd(), out), buf.length, 'bytes'); });
