import type { TaxProfile, Ticket } from "@prisma/client";
import { db } from "@/lib/db";
import { demoCfdiXml, demoPdf } from "@/lib/demo";
import { attachInvoiceFiles } from "@/lib/invoice-files";
import { formatMXN } from "@/lib/utils";

/** Modo demo: en vez de enviar, marca "en espera" y simula que el comercio responde en unos segundos. */
export async function simulateVendorReply(ticket: Ticket, profile: TaxProfile) {
  await db.ticket.update({ where: { id: ticket.id }, data: { status: "WAITING_VENDOR_RESPONSE" } });
  setTimeout(async () => {
    try {
      const xml = demoCfdiXml(profile, ticket);
      const pdf = demoPdf([
        "Factura CFDI 4.0 (DEMO)",
        `Emisor: ${ticket.storeName ?? "Comercio demo"}`,
        `Receptor: ${profile.razonSocial} - ${profile.rfc}`,
        `Total: ${formatMXN(ticket.totalAmount)}`,
        "Documento de ejemplo sin validez fiscal",
      ]);
      await attachInvoiceFiles(ticket.id, [
        { filename: "factura.xml", contentType: "application/xml", content: Buffer.from(xml) },
        { filename: "factura.pdf", contentType: "application/pdf", content: pdf },
      ]);
      console.log(`[demo] ticket ${ticket.id} facturado`);
    } catch (err) {
      console.error("[demo]", err);
    }
  }, 6000 + Math.random() * 4000);
}
