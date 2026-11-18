// 2.5 Import (Plus): bank CSV and OFX/QFX exports, parsed on the device. Amounts come out in the Plaid
// convention (positive = money out). Rows that match an existing transaction on date, amount and merchant are skipped.
import { normalizeMerchantText } from "./categorize";
import { daysBetween } from "./dates";
import { toCents, type Cents } from "./money";
import type { Transaction } from "./types";

export type ImportFormat = "td" | "rbc" | "scotiabank" | "bmo" | "cibc" | "ofx" | "generic";

export interface ImportedRow {
  date: Date;
  amount: Cents;
  merchantName: string;
}

export interface ParsedImport {
  format: ImportFormat;
  rows: ImportedRow[];
  // lines that looked like data but couldn't be read
  skipped: number;
}

// split CSV text into rows of fields, honouring quotes and doubled quotes
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  // walk character by character so commas and newlines inside quotes stay put
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row.map((f) => f.trim()));
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row.map((f) => f.trim()));
  return rows;
}

// "2027-01-05", "20270105", "1/5/2027" (North American month first) -> local date
export function parseBankDate(value: string): Date | null {
  const s = value.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/) ?? s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else return null;
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

// a money cell; blank cells are null
function money(value: string | undefined): Cents | null {
  if (!value || !/\d/.test(value)) return null;
  return toCents(value);
}

const isDate = (v: string | undefined) => !!v && parseBankDate(v) !== null;
const isMoneyOrBlank = (v: string | undefined) => v === undefined || v === "" || money(v) !== null;

// a header row's column index for the first name that matches
function column(header: readonly string[], ...patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = header.findIndex((h) => p.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

interface Layout {
  format: ImportFormat;
  // index of the first data row
  from: number;
  read: (cells: string[]) => ImportedRow | null;
}

// row builder; returns null when the date or amount can't be read
function row(date: string | undefined, amount: Cents | null, merchant: string | undefined): ImportedRow | null {
  const d = date ? parseBankDate(date) : null;
  if (!d || amount === null || amount === 0) return null;
  return { date: d, amount, merchantName: (merchant ?? "").replace(/\s+/g, " ").trim() || "Imported" };
}

// work out which bank made the file from its header row, or from the shape of the data when there is none
function detectLayout(rows: readonly string[][]): Layout | null {
  // banks with a header, which may sit under a few lines of preamble
  for (let h = 0; h < Math.min(rows.length, 12); h++) {
    const header = rows[h]!.map((c) => c.toLowerCase());
    const has = (p: RegExp) => header.some((c) => p.test(c));

    if (has(/transaction date/) && has(/description 1/) && has(/cad\$/)) {
      const [date, d1, d2, cad] = [column(header, /transaction date/), column(header, /description 1/), column(header, /description 2/), column(header, /cad\$/)];
      return { format: "rbc", from: h + 1, read: (c) => row(c[date], negate(money(c[cad])), c[d1] || c[d2]) };
    }
    if (has(/date posted/) && has(/transaction amount/)) {
      const [date, amount, desc] = [column(header, /date posted/), column(header, /transaction amount/), column(header, /description/)];
      return { format: "bmo", from: h + 1, read: (c) => row(c[date], negate(money(c[amount])), c[desc]) };
    }
    if (has(/^filter$/) && has(/type of transaction/) && has(/^amount$/)) {
      const [date, desc, sub, type, amount] = [
        column(header, /^date$/),
        column(header, /^description$/),
        column(header, /sub-description/),
        column(header, /type of transaction/),
        column(header, /^amount$/),
      ];
      return {
        format: "scotiabank",
        from: h + 1,
        read: (c) => {
          const value = money(c[amount]);
          if (value === null) return null;
          const kind = (c[type] ?? "").toLowerCase();
          const out = kind.startsWith("debit") ? Math.abs(value) : kind.startsWith("credit") ? -Math.abs(value) : -value;
          return row(c[date], out, [c[desc], c[sub]].filter(Boolean).join(" "));
        },
      };
    }
    // any other export with recognisable columns
    const date = column(header, /^(transaction |posted |posting )?date$/, /date/);
    const amount = column(header, /^amount$/, /amount/);
    const debit = column(header, /debit|withdrawal|money out|paid out/);
    const credit = column(header, /credit|deposit|money in|paid in/);
    const desc = column(header, /description|merchant|payee|name|memo|details/);
    if (date >= 0 && desc >= 0 && (amount >= 0 || (debit >= 0 && credit >= 0)) && !isDate(rows[h]![date])) {
      return {
        format: "generic",
        from: h + 1,
        read: (c) => row(c[date], amount >= 0 ? negate(money(c[amount])) : debitCredit(c[debit], c[credit]), c[desc]),
      };
    }
  }

  // headerless exports: judge by the first row's shape
  const first = rows[0];
  if (!first) return null;
  if (first.length >= 4 && isDate(first[0]) && first[2] === "-" && money(first[1]) !== null) {
    return { format: "scotiabank", from: 0, read: (c) => row(c[0], negate(money(c[1])), c[4] || c[3]) };
  }
  if (first.length >= 4 && isDate(first[0]) && isMoneyOrBlank(first[2]) && isMoneyOrBlank(first[3])) {
    const ymdFirst = /^\d{4}-/.test(first[0]!);
    return { format: ymdFirst ? "cibc" : "td", from: 0, read: (c) => row(c[0], debitCredit(c[2], c[3]), c[1]) };
  }
  return null;
}

// flip a signed bank amount (negative = money out) into the app's convention
function negate(value: Cents | null): Cents | null {
  return value === null ? null : -value;
}

// separate debit and credit columns -> one signed amount (positive = money out)
function debitCredit(debit: string | undefined, credit: string | undefined): Cents | null {
  const out = money(debit);
  const into = money(credit);
  if (out !== null && out !== 0) return Math.abs(out);
  if (into !== null && into !== 0) return -Math.abs(into);
  return null;
}

// one tag's value inside an OFX transaction block (SGML style, closing tags optional)
function ofxTag(block: string, tag: string): string | undefined {
  return block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"))?.[1]?.trim();
}

// OFX/QFX statements: one <STMTTRN> block per transaction
function parseOfx(text: string): ParsedImport {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const rows: ImportedRow[] = [];
  let skipped = 0;
  for (const block of blocks) {
    const amount = money(ofxTag(block, "TRNAMT"));
    const r = row(ofxTag(block, "DTPOSTED"), negate(amount), ofxTag(block, "NAME") || ofxTag(block, "MEMO"));
    if (r) rows.push(r);
    else skipped++;
  }
  return { format: "ofx", rows, skipped };
}

// read a bank export; null when the format isn't recognised
export function parseBankFile(text: string, fileName = ""): ParsedImport | null {
  if (/<OFX>/i.test(text) || /\.(ofx|qfx)$/i.test(fileName)) return parseOfx(text);
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const layout = detectLayout(rows);
  if (!layout) return null;
  const out: ImportedRow[] = [];
  let skipped = 0;
  for (const cells of rows.slice(layout.from)) {
    const r = layout.read(cells);
    if (r) out.push(r);
    else skipped++;
  }
  return { format: layout.format, rows: out, skipped };
}

// date|amount|merchant, the key two entries must share to count as the same
function importKey(date: Date, amount: Cents, merchant: string | null): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}|${amount}|${normalizeMerchantText(merchant ?? "")}`;
}

// rows not already in the app; each existing entry can only cancel out one imported row
export function skipExisting(rows: readonly ImportedRow[], existing: readonly Transaction[]): { fresh: ImportedRow[]; duplicates: number } {
  const counts = new Map<string, number>();
  for (const t of existing) {
    const key = importKey(t.date, t.amount, t.merchantName);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const fresh: ImportedRow[] = [];
  let duplicates = 0;
  for (const r of rows) {
    const key = importKey(r.date, r.amount, r.merchantName);
    const left = counts.get(key) ?? 0;
    if (left > 0) {
      counts.set(key, left - 1);
      duplicates++;
    } else fresh.push(r);
  }
  return { fresh, duplicates };
}

// oldest and newest day in an import, for the preview
export function importSpan(rows: readonly ImportedRow[]): { from: Date; to: Date } | null {
  if (rows.length === 0) return null;
  let from = rows[0]!.date;
  let to = from;
  for (const r of rows) {
    if (daysBetween(r.date, from) > 0) from = r.date;
    if (daysBetween(to, r.date) > 0) to = r.date;
  }
  return { from, to };
}
