import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { applyMapping, guessMapping, parseAmount, parseDate, readSheet } from "@/lib/expense-import";
import { inferCategory } from "@/lib/categories";

const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe("parseAmount", () => {
  it.each([
    [450, 450],
    [-450.5, 450.5],
    ["$1,234.50", 1234.5],
    ["1.234,50", 1234.5],
    ["(89.90)", 89.9],
    ["-312.40 MXN", 312.4],
    ["", null],
    [0, null],
    ["abc", null],
  ])("%s → %s", (input, expected) => expect(parseAmount(input)).toBe(expected));
});

describe("parseDate", () => {
  it.each([
    ["20/10/2026", "2026-10-20"],
    ["2026-10-20", "2026-10-20"],
    ["5-oct-2026", "2026-10-05"],
    ["05/10/26", "2026-10-05"],
    [46315, "2026-10-20"], // serial de Excel
    ["31/02/2026", null],
    ["mañana", null],
  ])("%s → %s", (input, expected) => expect(iso(parseDate(input))).toBe(expected));
});

describe("guessMapping", () => {
  it("detecta columnas en español", () => {
    expect(guessMapping(["Fecha de operación", "Descripción", "Comercio", "Tipo de gasto", "Importe"])).toEqual({
      date: 0,
      concept: 1,
      vendor: 2,
      category: 3,
      amount: 4,
    });
  });
});

describe("readSheet + applyMapping", () => {
  it("lee un xlsx con preámbulo, omite filas inválidas e infiere categoría", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Estado de cuenta octubre"],
      [],
      ["Fecha", "Concepto", "Proveedor", "Monto"],
      ["20/10/2026", "Comida con cliente", "Taquería El Tapatío", "$450.00"],
      ["21/10/2026", "Gasolina", "Gasolinera Servicio Centro", -900],
      ["xx", "Fila mala", "", 10],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
    const sheet = readSheet(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    expect(sheet.headers).toEqual(["Fecha", "Concepto", "Proveedor", "Monto"]);

    const { expenses, skipped } = applyMapping(sheet.rows, sheet.mapping);
    expect(expenses).toHaveLength(2);
    expect(expenses[0]).toMatchObject({ amount: 450, vendor: "Taquería El Tapatío", category: "Restaurantes" });
    expect(expenses[1]).toMatchObject({ amount: 900, category: "Combustible" });
    expect(skipped).toEqual([{ row: 3, reason: "Fecha inválida" }]);
  });

  it("exige fecha y monto", () => {
    expect(() => applyMapping([], { concept: 0 })).toThrow(/Fecha y Monto/);
  });
});

describe("inferCategory", () => {
  it("respeta la categoría escrita y si no, infiere por nombre", () => {
    expect(inferCategory("farmacia y salud")).toBe("Farmacia y salud");
    expect(inferCategory("", "PEMEX ES 1234")).toBe("Combustible");
    expect(inferCategory(null, "Cosa rara")).toBe("Otros");
  });
});
