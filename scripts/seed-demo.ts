/**
 * Datos de demostración para el tablero de análisis: `npm run seed:demo`.
 * Sólo corre con DEMO_MODE=true. Todos los comercios son ficticios.
 * Genera ~10 meses de tickets, un Excel de gastos (importado con el mismo
 * importador que usa la app) y algunos límites.
 */
import { db } from "@/lib/db";
import { demoCfdiXml, demoPdf, isDemoMode } from "@/lib/demo";
import { applyMapping, readSheet, templateWorkbook } from "@/lib/expense-import";
import { getCurrentUser } from "@/lib/session";
import { buildKey, putObject } from "@/lib/storage";

if (!isDemoMode()) {
  console.error("seed:demo sólo corre con DEMO_MODE=true");
  process.exit(1);
}

// PRNG determinista para que la demo sea reproducible
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const STORES = [
  { name: "Taquería El Tapatío", rfc: "TAP850101AB1", category: "Restaurantes", min: 180, max: 650 },
  { name: "Café La Esquina", rfc: "CLE120304HJ8", category: "Restaurantes", min: 60, max: 220 },
  { name: "Gasolinera Servicio Centro", rfc: "GSC020730QW9", category: "Combustible", min: 500, max: 1400 },
  { name: "Farmacia Santa Rita", rfc: "FSR910215KL3", category: "Farmacia y salud", min: 120, max: 900 },
  { name: "Super Mercado Del Valle", rfc: "SMV990101PL2", category: "Supermercado", min: 300, max: 2200 },
  { name: "Papelería Lumen Centro", rfc: "PLC050505ZX1", category: "Oficina y papelería", min: 80, max: 600 },
  { name: "Hotel Plaza Bajío", rfc: "HPB070707RT4", category: "Hospedaje", min: 1400, max: 3200 },
  { name: "Tecno Store Polanco", rfc: "TSP101010MN5", category: "Tecnología", min: 600, max: 7800 },
];

const user = await getCurrentUser();
let profile = await db.taxProfile.findFirst({ where: { userId: user.id } });
if (!profile) {
  const csf = await putObject(buildKey(user.id, "csf", "application/pdf"), demoPdf(["Constancia de Situación Fiscal (DEMO)"]), "application/pdf");
  profile = await db.taxProfile.create({
    data: { userId: user.id, rfc: "EKU9003173C9", razonSocial: "ESCUELA KEMPER URGATE", codigoPostal: "06600", regimenFiscal: "601", csfPdfUrl: csf },
  });
}

await db.ticket.deleteMany({ where: { userId: user.id } });
await db.expenseImport.deleteMany({ where: { userId: user.id } });
await db.spendingLimit.deleteMany({ where: { userId: user.id } });

// PNG 1×1 como foto del ticket
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const imageKey = await putObject(buildKey(user.id, "tickets", "image/png", "demo-ticket"), png, "image/png");

const now = new Date();
const rows: (string | number | Date)[][] = [];
let ticketCount = 0;

for (let back = 9; back >= 0; back--) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() - back;
  const daysInMonth = back === 0 ? now.getUTCDate() : new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const n = 9 + Math.floor(rand() * 8);
  for (let i = 0; i < n; i++) {
    const store = rand() < 0.08 ? STORES[6] : rand() < 0.06 ? STORES[7] : pick(STORES.slice(0, 6));
    const date = new Date(Date.UTC(y, m, 1 + Math.floor(rand() * daysInMonth)));
    const amount = Math.round((store.min + rand() * (store.max - store.min)) * 100) / 100;
    const inExcel = rand() < 0.85;
    const hasTicket = rand() < 0.7;

    if (inExcel) rows.push([date, `Compra ${store.category.toLowerCase()}`, store.name, store.category, -amount]);
    if (hasTicket) {
      const status = back === 0 && rand() < 0.4 ? "WAITING_VENDOR_RESPONSE" : rand() < 0.94 ? "COMPLETED" : "FAILED";
      const t = await db.ticket.create({
        data: {
          userId: user.id,
          imageUrl: imageKey,
          storeName: store.name,
          vendorRfc: store.rfc,
          category: store.category,
          ticketDate: date,
          totalAmount: amount,
          ticketFolio: `T-${Math.floor(rand() * 900000 + 100000)}`,
          channelUsed: rand() < 0.5 ? "WHATSAPP" : "EMAIL",
          status,
          failureReason: status === "FAILED" ? "El comercio no respondió en 5 días" : null,
          contactInfo: { phone: null, email: "facturas@comercio.example", portalUrl: null },
        },
      });
      if (status === "COMPLETED") {
        const xml = await putObject(buildKey(user.id, "invoices", "application/xml", t.id), Buffer.from(demoCfdiXml(profile, t)), "application/xml");
        const pdf = await putObject(buildKey(user.id, "invoices", "application/pdf", t.id), demoPdf(["Factura CFDI 4.0 (DEMO)", store.name, `$${amount}`]), "application/pdf");
        await db.ticket.update({ where: { id: t.id }, data: { invoiceXmlUrl: xml, invoicePdfUrl: pdf } });
      }
      ticketCount++;
    }
  }
}

// Gastos sin ticket típicos de un estado de cuenta
for (let back = 9; back >= 0; back--) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 5));
  rows.push([date, "Internet fibra", "Telecom Hogar", "Servicios", -699]);
  rows.push([date, "Viaje de trabajo", "Taxi Ejecutivo", "Transporte", -(Math.round(rand() * 400) + 150)]);
}

// Pasa por el mismo flujo que un Excel real: generar .xlsx → leer → mapear
const xlsx = templateWorkbook(rows);
const sheet = readSheet(xlsx);
const { expenses } = applyMapping(sheet.rows, sheet.mapping);
await db.expenseImport.create({
  data: {
    userId: user.id,
    fileName: "gastos-tarjeta-empresarial.xlsx",
    rowCount: expenses.length,
    expenses: { createMany: { data: expenses.map((e) => ({ ...e, userId: user.id })) } },
  },
});

await db.spendingLimit.createMany({
  data: [
    { userId: user.id, scope: "TOTAL", scopeValue: null, period: "MONTHLY", amount: 12000 },
    { userId: user.id, scope: "CATEGORY", scopeValue: "Restaurantes", period: "MONTHLY", amount: 2500 },
    { userId: user.id, scope: "CATEGORY", scopeValue: "Combustible", period: "YEARLY", amount: 20000 },
  ],
});

console.log(`[seed:demo] ${ticketCount} tickets, ${expenses.length} gastos importados, 3 límites`);
process.exit(0);
