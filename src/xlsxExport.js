// Builds a formatted Excel (.xlsx) file with no outside libraries.
//
// Why this exists: a CSV is plain text, so it can't carry bold, alignment,
// number formats or column widths — whatever app opens it decides how it
// looks. An .xlsx can carry all of that, so the export looks the same in
// Excel, Numbers and Google Sheets: real dates shown as dd-mm-yyyy,
// amounts like 100,000.00, bold summary figures, right-aligned numbers.
//
// An .xlsx is just a zip of small XML files, so this writes those files and
// zips them (stored, uncompressed — these files are tiny).

const DAY_MS = 86400000;

// ---------- zip (stored / uncompressed) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

// ---------- small helpers ----------
const esc = (s) =>
  String(s)
    // control characters aren't allowed in XML and would corrupt the file
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const COLS = ["A", "B", "C", "D", "E"];

// "2026-10-01" -> Excel's date number (days since 1899-12-30)
function excelDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return null;
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / DAY_MS);
}

// ---------- styles ----------
// Everything visual lives here: fonts, fills, borders, number formats.
const FONT = {
  base: '<font><sz val="11"/><color rgb="FF1B2A24"/><name val="Calibri"/><family val="2"/></font>',
  bold: '<font><b/><sz val="11"/><color rgb="FF1B2A24"/><name val="Calibri"/><family val="2"/></font>',
  title: '<font><b/><sz val="18"/><color rgb="FF16302A"/><name val="Calibri"/><family val="2"/></font>',
  sub: '<font><sz val="10"/><color rgb="FF6B6A63"/><name val="Calibri"/><family val="2"/></font>',
  section: '<font><b/><sz val="12"/><color rgb="FF16302A"/><name val="Calibri"/><family val="2"/></font>',
  headWhite: '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>',
  note: '<font><i/><sz val="10"/><color rgb="FF6B6A63"/><name val="Calibri"/><family val="2"/></font>',
};
const FONT_KEYS = Object.keys(FONT);
const FILLS = [
  '<fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FF16302A"/><bgColor indexed="64"/></patternFill></fill>', // 2: dark green
  '<fill><patternFill patternType="solid"><fgColor rgb="FFEDE6D3"/><bgColor indexed="64"/></patternFill></fill>', // 3: parchment
];
const BORDERS = [
  "<border><left/><right/><top/><bottom/><diagonal/></border>",
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FFE1D8BE"/></bottom><diagonal/></border>', // 1: light row line
  '<border><left/><right/><top/><bottom style="medium"><color rgb="FF16302A"/></bottom><diagonal/></border>', // 2: section underline
  '<border><left/><right/><top style="medium"><color rgb="FF16302A"/></top><bottom style="thin"><color rgb="FF16302A"/></bottom><diagonal/></border>', // 3: net balance
];
// 164: dd-mm-yyyy   165: 1,234.50 with negatives in red   (id 4 is the built-in #,##0.00)
const NUMFMTS = '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd\\-mm\\-yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00;[Red]\\-#,##0.00"/></numFmts>';

const STYLE_SPECS = {
  default:       { font: "base" },
  title:         { font: "title", v: "center" },
  subtitle:      { font: "sub" },
  section:       { font: "section", border: 2 },
  label:         { font: "base", border: 1 },
  labelBold:     { font: "bold", border: 1 },
  // every summary figure is bold, as the labels beside them are not
  amount:        { font: "bold", border: 1, fmt: 4, h: "right" },
  amountBold:    { font: "bold", border: 1, fmt: 4, h: "right" },
  amountRed:     { font: "bold", border: 1, fmt: 165, h: "right" },
  netLabel:      { font: "bold", border: 3, fill: 3 },
  netAmount:     { font: "bold", border: 3, fill: 3, fmt: 165, h: "right" },
  note:          { font: "note" },
  headLeft:      { font: "headWhite", fill: 2, h: "left", v: "center" },
  headRight:     { font: "headWhite", fill: 2, h: "right", v: "center" },
  cellDate:      { font: "base", border: 1, fmt: 164, h: "left" },
  cellText:      { font: "base", border: 1 },
  cellAmount:    { font: "base", border: 1, fmt: 4, h: "right" },
};
const STYLE_NAMES = Object.keys(STYLE_SPECS);
const S = Object.fromEntries(STYLE_NAMES.map((n, i) => [n, i])); // name -> style index

function stylesXml() {
  const xfs = STYLE_NAMES.map((n) => {
    const sp = STYLE_SPECS[n];
    const align = sp.h || sp.v ? `<alignment${sp.h ? ` horizontal="${sp.h}"` : ""}${sp.v ? ` vertical="${sp.v}"` : ""}/>` : "";
    return `<xf numFmtId="${sp.fmt || 0}" fontId="${FONT_KEYS.indexOf(sp.font)}" fillId="${sp.fill || 0}" borderId="${sp.border || 0}" xfId="0"` +
      ` applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${align ? ' applyAlignment="1">' + align + "</xf>" : "/>"}`;
  }).join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + NUMFMTS +
    `<fonts count="${FONT_KEYS.length}">${FONT_KEYS.map((k) => FONT[k]).join("")}</fonts>` +
    `<fills count="${FILLS.length}">${FILLS.join("")}</fills>` +
    `<borders count="${BORDERS.length}">${BORDERS.join("")}</borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${STYLE_NAMES.length}">${xfs}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}

// ---------- the workbook ----------
// title/subtitle: strings. summary: [{ label, value|null, bold?, redNegative?, net? }]
// notes: [string]. rows: [{ date (YYYY-MM-DD), category, note, paymentMethod, amount }]
export function buildExpenseWorkbook({
  title, subtitle, currency = "", summary = [], notes = [], rows = [],
  emptyMessage = "No expenses this month", sheetName = "Track It",
}) {
  const strings = [];
  const stringIndex = new Map();
  const sst = (text) => {
    const t = String(text ?? "");
    if (!stringIndex.has(t)) { stringIndex.set(t, strings.length); strings.push(t); }
    return stringIndex.get(t);
  };

  const sheetRows = [];
  let r = 0;
  const addRow = (cells, ht) => {
    r += 1;
    const xml = cells.map(([col, kind, value, style]) => {
      const ref = `${col}${r}`;
      if (kind === "s") return `<c r="${ref}" s="${S[style]}" t="s"><v>${sst(value)}</v></c>`;
      if (kind === "n") return `<c r="${ref}" s="${S[style]}"><v>${value}</v></c>`;
      return `<c r="${ref}" s="${S[style]}"/>`; // blank, but styled (so borders/fills run across)
    }).join("");
    sheetRows.push(`<row r="${r}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${xml}</row>`);
  };
  const blank = () => { r += 1; };
  const across = (style, first) => COLS.map((c, i) => [c, i === 0 && first != null ? "s" : "b", first, style]);

  addRow([["A", "s", title, "title"]], 30);
  addRow([["A", "s", subtitle, "subtitle"]]);
  blank();

  addRow(across("section", "SUMMARY"));
  for (const line of summary) {
    const lStyle = line.net ? "netLabel" : line.bold ? "labelBold" : "label";
    const vStyle = line.net ? "netAmount" : line.bold ? "amountBold" : line.redNegative ? "amountRed" : "amount";
    const hasValue = line.value != null && Number.isFinite(Number(line.value));
    addRow([
      ["A", "s", line.label, lStyle],
      ["B", "b", null, lStyle], ["C", "b", null, lStyle], ["D", "b", null, lStyle],
      hasValue ? ["E", "n", Number(line.value), vStyle] : ["E", "b", null, vStyle],
    ]);
  }
  for (const n of notes) addRow([["A", "s", n, "note"]]);
  blank();

  addRow([
    ["A", "s", "Date", "headLeft"], ["B", "s", "Category", "headLeft"], ["C", "s", "Note", "headLeft"],
    ["D", "s", "Payment method", "headLeft"], ["E", "s", currency ? `Amount (${currency})` : "Amount", "headRight"],
  ], 22);

  if (rows.length === 0) {
    addRow([["A", "s", emptyMessage, "note"]]);
  } else {
    for (const x of rows) {
      const d = excelDate(x.date);
      addRow([
        d != null ? ["A", "n", d, "cellDate"] : ["A", "s", x.date || "", "cellText"],
        ["B", "s", x.category || "", "cellText"],
        ["C", "s", x.note || "", "cellText"],
        ["D", "s", x.paymentMethod || "", "cellText"],
        Number.isFinite(Number(x.amount)) ? ["E", "n", Number(x.amount), "cellAmount"] : ["E", "b", null, "cellAmount"],
      ]);
    }
  }

  const sheetXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<dimension ref="A1:E${r}"/>` +
    '<sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="16"/>' +
    '<cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/>' +
    '<col min="3" max="3" width="34" customWidth="1"/><col min="4" max="4" width="20" customWidth="1"/>' +
    '<col min="5" max="5" width="18" customWidth="1"/></cols>' +
    `<sheetData>${sheetRows.join("")}</sheetData>` +
    '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>';

  const sstXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">` +
    strings.map((t) => `<si><t xml:space="preserve">${esc(t)}</t></si>`).join("") + "</sst>";

  const enc = new TextEncoder();
  const file = (name, text) => ({ name, data: enc.encode(text) });
  return zipStore([
    file("[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>'),
    file("_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    file("xl/workbook.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${esc(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    file("xl/_rels/workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>'),
    file("xl/styles.xml", stylesXml()),
    file("xl/sharedStrings.xml", sstXml),
    file("xl/worksheets/sheet1.xml", sheetXml),
  ]);
}
