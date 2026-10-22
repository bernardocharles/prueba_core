/**
 * Lectura de Excel/CSV de gastos con detección de columnas.
 * Acepta estados de cuenta y hojas de gastos típicas: fecha, concepto, proveedor, categoría, monto.
 */
import * as XLSX from "xlsx";
import { inferCategory } from "./categories";

export { FIELDS, FIELD_LABELS, type ColumnMapping, type Field } from "./expense-fields";
import { FIELDS, type ColumnMapping, type Field } from "./expense-fields";

const HEADER_HINTS: Record<Field, RegExp> = {
  date: /^(fecha|date|dia|f\. ?operaci|fecha de operaci)/,
  amount: /(monto|importe|total|cargo|gasto|amount|valor|retiro)/,
  concept: /(concepto|descrip|detalle|description|movimiento|referencia)/,
  vendor: /(proveedor|tienda|comercio|establecimiento|vendor|razon social|emisor|negocio)/,
  category: /(categor|tipo|rubro|clasific|cuenta contable)/,
};

const MAX_ROWS = 5000;

export type SheetPreview = { sheetName: string; headers: string[]; rows: unknown[][]; mapping: ColumnMapping };

const clean = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function readSheet(buffer: Buffer): SheetPreview {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no tiene hojas");
  const all = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, raw: true, defval: null, blankrows: false });

  // La fila de encabezados es la primera con ≥2 celdas de texto (los estados de cuenta traen un preámbulo)
  const headerIdx = all.findIndex((r) => r.filter((c) => typeof c === "string" && c.trim()).length >= 2);
  if (headerIdx < 0) throw new Error("No se encontraron encabezados de columnas");
  const headers = all[headerIdx].map((h, i) => String(h ?? "").trim() || `Columna ${i + 1}`);
  const rows = all.slice(headerIdx + 1, headerIdx + 1 + MAX_ROWS).filter((r) => r.some((c) => c !== null && c !== ""));
  return { sheetName, headers, rows, mapping: guessMapping(headers) };
}

export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  // Categoría antes que monto: "Tipo de gasto" es categoría aunque contenga "gasto"
  for (const field of ["date", "category", "vendor", "concept", "amount"] as const) {
    const idx = headers.findIndex((h, i) => !used.has(i) && HEADER_HINTS[field].test(clean(h)));
    if (idx >= 0) {
      mapping[field] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

/** "$1,234.50", "1.234,50", "(450.00)", -450 → 1234.5 / 450. Los cargos negativos se toman en valor absoluto. */
export function parseAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v !== 0 ? Math.round(Math.abs(v) * 100) / 100 : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[^\d.,()-]/g, "");
  if (!s) return null;
  // Formato europeo 1.234,50 → 1234.50
  if (/,\d{1,2}$/.test(s) && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s.replace(/[()]/g, ""));
  return Number.isFinite(n) && n !== 0 ? Math.round(Math.abs(n) * 100) / 100 : null;
}

/** Date, serial de Excel, "20/10/2026", "2026-10-20", "20-oct-2026" → Date UTC. Formato mexicano: día primero. */
export function parseDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? new Date(Date.UTC(d.y, d.m - 1, d.d)) : null;
  }
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[\s/-]([a-z]{3})[a-z]*\.?[\s/-](\d{2,4})$/);
  if (m) {
    const month = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"].indexOf(m[2]) + 1;
    if (month) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], month, +m[1]);
  }
  return null;
}

function valid(y: number, m: number, d: number) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

export type ParsedExpense = { date: Date; amount: number; concept: string; vendor: string | null; category: string };

export function applyMapping(rows: unknown[][], mapping: ColumnMapping) {
  if (mapping.date === undefined || mapping.amount === undefined) {
    throw new Error("Selecciona al menos las columnas de Fecha y Monto");
  }
  const expenses: ParsedExpense[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const cell = (r: unknown[], f: Field) => (mapping[f] === undefined ? null : r[mapping[f]!]);
  const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

  rows.forEach((r, i) => {
    const date = parseDate(cell(r, "date"));
    const amount = parseAmount(cell(r, "amount"));
    if (!date) return skipped.push({ row: i + 1, reason: "Fecha inválida" });
    if (amount === null) return skipped.push({ row: i + 1, reason: "Monto inválido" });
    const concept = text(cell(r, "concept"));
    const vendor = text(cell(r, "vendor")) || null;
    expenses.push({
      date,
      amount,
      concept: concept || vendor || "Gasto",
      vendor,
      category: inferCategory(text(cell(r, "category")), vendor, concept),
    });
  });
  return { expenses, skipped };
}

/** Plantilla descargable con columnas sugeridas. */
export function templateWorkbook(rows: (string | number | Date)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([["Fecha", "Concepto", "Proveedor", "Categoría", "Monto"], ...rows], { cellDates: true });
  ws["!cols"] = [{ wch: 12 }, { wch: 32 }, { wch: 28 }, { wch: 20 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gastos");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
