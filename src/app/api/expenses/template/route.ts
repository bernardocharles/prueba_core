import { NextResponse } from "next/server";
import { templateWorkbook } from "@/lib/expense-import";

export const runtime = "nodejs";

/** Plantilla .xlsx con las columnas que el importador reconoce y filas de ejemplo. */
export async function GET() {
  const today = new Date();
  const day = (offset: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), Math.max(1, today.getUTCDate() - offset)));
  const body = templateWorkbook([
    [day(0), "Comida con cliente", "Taquería El Tapatío", "Restaurantes", 450],
    [day(1), "Medicamentos", "Farmacia Santa Rita", "Farmacia y salud", 312.4],
    [day(2), "Gasolina", "Gasolinera Servicio Centro", "Combustible", 900],
    [day(3), "Papelería oficina", "Papelería Lumen Centro", "Oficina y papelería", 268],
  ]);
  return new NextResponse(new Uint8Array(body).buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-gastos.xlsx"',
    },
  });
}
