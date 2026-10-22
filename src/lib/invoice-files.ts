import JSZip from "jszip";
import { cfdiReceptorRfc } from "./cfdi";
import { db } from "./db";
import { buildKey, putObject } from "./storage";

export type IncomingFile = { filename: string; contentType: string; content: Buffer };

const isXml = (f: IncomingFile) => /xml/i.test(f.contentType) || /\.xml$/i.test(f.filename);
const isPdf = (f: IncomingFile) => /pdf/i.test(f.contentType) || /\.pdf$/i.test(f.filename);
const isZip = (f: IncomingFile) => /zip/i.test(f.contentType) || /\.zip$/i.test(f.filename);

/** Muchos comercios mandan XML+PDF dentro de un .zip. */
async function expandZips(files: IncomingFile[]): Promise<IncomingFile[]> {
  const out: IncomingFile[] = [];
  for (const f of files) {
    if (!isZip(f)) {
      out.push(f);
      continue;
    }
    const zip = await JSZip.loadAsync(f.content);
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const name = entry.name.split("/").pop() ?? entry.name;
      const contentType = /\.xml$/i.test(name) ? "application/xml" : /\.pdf$/i.test(name) ? "application/pdf" : "";
      if (contentType) out.push({ filename: name, contentType, content: await entry.async("nodebuffer") });
    }
  }
  return out;
}

/**
 * Guarda XML/PDF recibidos de un comercio y actualiza el ticket.
 * El ticket sólo pasa a COMPLETED con un XML CFDI cuyo receptor sea el RFC del usuario:
 * el XML es el comprobante fiscal válido; el PDF es sólo su representación impresa.
 */
export async function attachInvoiceFiles(ticketId: string, incoming: IncomingFile[]) {
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  const profiles = await db.taxProfile.findMany({ where: { userId: ticket.userId }, select: { rfc: true } });
  const userRfcs = new Set(profiles.map((p) => p.rfc));

  const files = await expandZips(incoming);
  const xml = files.find((f) => isXml(f) && userRfcs.has(cfdiReceptorRfc(f.content.toString("utf8")) ?? ""));
  const pdf = files.find(isPdf);

  if (!xml && !pdf) return { completed: false, reason: "Sin XML CFDI válido para el receptor ni PDF" };

  const data: { invoiceXmlUrl?: string; invoicePdfUrl?: string } = {};
  if (xml) {
    data.invoiceXmlUrl = await putObject(buildKey(ticket.userId, "invoices", "application/xml", `${ticket.id}`), xml.content, "application/xml");
  }
  if (pdf) {
    data.invoicePdfUrl = await putObject(buildKey(ticket.userId, "invoices", "application/pdf", `${ticket.id}`), pdf.content, "application/pdf");
  }

  const completed = Boolean(xml || ticket.invoiceXmlUrl);
  await db.ticket.update({
    where: { id: ticket.id },
    data: { ...data, ...(completed ? { status: "COMPLETED", failureReason: null } : {}) },
  });
  return { completed, reason: completed ? null : "Se recibió PDF; falta el XML" };
}
