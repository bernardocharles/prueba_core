"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { applyMapping, FIELDS, readSheet, type ColumnMapping } from "@/lib/expense-import";
import { reconcile } from "@/lib/reconcile";
import { getCurrentUser } from "@/lib/session";
import { buildKey, getObject, putObject } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
};

export type ExpensePreview =
  | { ok: true; key: string; fileName: string; headers: string[]; sample: string[][]; rowCount: number; mapping: ColumnMapping }
  | { ok: false; error: string };

const display = (v: unknown) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined ? "" : String(v).slice(0, 60);

/** Paso 1: guarda el archivo y devuelve encabezados, muestra y columnas detectadas. */
export async function previewExpenseFile(formData: FormData): Promise<ExpensePreview> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No se recibió ningún archivo" };
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!TYPES[ext]) return { ok: false, error: "Sube un archivo .xlsx, .xls o .csv" };
  if (file.size > MAX_BYTES) return { ok: false, error: "El archivo excede 5 MB" };

  try {
    const user = await getCurrentUser();
    const buffer = Buffer.from(await file.arrayBuffer());
    const sheet = readSheet(buffer);
    if (!sheet.rows.length) return { ok: false, error: "La hoja no tiene filas de datos" };
    const key = await putObject(buildKey(user.id, "imports", TYPES[ext]), buffer, TYPES[ext]);
    return {
      ok: true,
      key,
      fileName: file.name,
      headers: sheet.headers,
      sample: sheet.rows.slice(0, 5).map((r) => sheet.headers.map((_, i) => display(r[i]))),
      rowCount: sheet.rows.length,
      mapping: sheet.mapping,
    };
  } catch (err) {
    console.error("[expenses:preview]", err);
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo leer el archivo" };
  }
}

/** Paso 2: importa con el mapeo confirmado y concilia contra los tickets del usuario. */
export async function importExpenses(input: { key: string; fileName: string; mapping: ColumnMapping }) {
  const user = await getCurrentUser();
  if (!input.key.startsWith(`users/${user.id}/imports/`)) return { ok: false as const, error: "Archivo inválido" };

  const mapping: ColumnMapping = {};
  for (const f of FIELDS) {
    const v = input.mapping[f];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0) mapping[f] = v;
  }

  try {
    const { rows } = readSheet(await getObject(input.key));
    const { expenses, skipped } = applyMapping(rows, mapping);
    if (!expenses.length) return { ok: false as const, error: "Ninguna fila tiene fecha y monto válidos" };

    const batch = await db.expenseImport.create({
      data: {
        userId: user.id,
        fileName: input.fileName.slice(0, 200),
        rowCount: expenses.length,
        expenses: { createMany: { data: expenses.map((e) => ({ ...e, userId: user.id })) } },
      },
      include: { expenses: true },
    });

    const tickets = await db.ticket.findMany({
      where: { userId: user.id },
      select: { id: true, ticketDate: true, totalAmount: true, storeName: true },
    });
    const matched = reconcile(
      batch.expenses,
      tickets.map((t) => ({ id: t.id, date: t.ticketDate, amount: t.totalAmount, store: t.storeName })),
    ).size;

    revalidatePath("/analisis");
    return { ok: true as const, imported: expenses.length, skipped: skipped.length, matched };
  } catch (err) {
    console.error("[expenses:import]", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "No se pudo importar" };
  }
}

export async function deleteExpenseImport(id: string) {
  const user = await getCurrentUser();
  await db.expenseImport.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/analisis");
}
