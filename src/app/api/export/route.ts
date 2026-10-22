import JSZip from "jszip";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";

const slug = (s: string | null) =>
  (s ?? "sin-nombre").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").slice(0, 40);

/** GET /api/export?month=YYYY-MM → ZIP con XML/PDF del mes + resumen CSV para el contador. */
export async function GET(req: Request) {
  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return new NextResponse("Parámetro month inválido (YYYY-MM)", { status: 400 });

  const user = await getCurrentUser();
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));

  const tickets = await db.ticket.findMany({
    where: { userId: user.id, status: "COMPLETED", ticketDate: { gte: start, lt: end } },
    orderBy: { ticketDate: "asc" },
  });

  const zip = new JSZip();
  const csv = ["fecha,comercio,rfc_emisor,folio,total,xml,pdf"];
  for (const t of tickets) {
    const base = `${t.ticketDate?.toISOString().slice(0, 10)}_${slug(t.storeName)}_${slug(t.ticketFolio ?? t.id.slice(0, 8))}`;
    if (t.invoiceXmlUrl) zip.file(`${base}.xml`, await getObject(t.invoiceXmlUrl));
    if (t.invoicePdfUrl) zip.file(`${base}.pdf`, await getObject(t.invoicePdfUrl));
    csv.push(
      [
        t.ticketDate?.toISOString().slice(0, 10),
        `"${(t.storeName ?? "").replace(/"/g, '""')}"`,
        t.vendorRfc ?? "",
        t.ticketFolio ?? "",
        t.totalAmount?.toFixed(2) ?? "",
        t.invoiceXmlUrl ? `${base}.xml` : "",
        t.invoicePdfUrl ? `${base}.pdf` : "",
      ].join(","),
    );
  }
  // BOM para que Excel abra el CSV con acentos correctos
  zip.file("resumen.csv", "﻿" + csv.join("\n"));

  const body = await zip.generateAsync({ type: "arraybuffer" });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="facturas-${month}.zip"`,
    },
  });
}
