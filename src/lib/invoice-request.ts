import type { TaxProfile, Ticket } from "@prisma/client";
import { db } from "./db";
import { regimenLabel, usoCfdiLabel } from "./sat-catalogs";
import { formatMXN } from "./utils";

/** Texto formal compartido por los agentes de WhatsApp y email. */
export function buildInvoiceRequestText(profile: TaxProfile, ticket: Ticket) {
  const ticketLines = [
    ticket.ticketFolio && `- Folio: ${ticket.ticketFolio}`,
    ticket.billingCode && `- Código de facturación: ${ticket.billingCode}`,
    ticket.ticketDate && `- Fecha: ${ticket.ticketDate.toISOString().slice(0, 10)}`,
    ticket.totalAmount != null && `- Total: ${formatMXN(ticket.totalAmount)}`,
  ].filter(Boolean);

  return [
    "Hola, solicito de su apoyo para la emisión de la factura correspondiente al ticket adjunto.",
    "Adjunto la fotografía del ticket y la Constancia de Situación Fiscal.",
    ...(ticketLines.length ? ["", "Datos del ticket:", ...ticketLines] : []),
    "",
    "Datos Fiscales:",
    `- RFC: ${profile.rfc}`,
    `- Razón Social: ${profile.razonSocial}`,
    `- CP Fiscal: ${profile.codigoPostal}`,
    `- Régimen Fiscal: ${regimenLabel(profile.regimenFiscal)}`,
    `- Uso de CFDI: ${usoCfdiLabel(profile.usoCFDI)}`,
    "",
    "Muchas gracias.",
  ].join("\n");
}

/** Etiqueta corta que viaja en el asunto del correo para asociar respuestas. */
export function ticketTag(ticketId: string) {
  return `FS-${ticketId.slice(0, 8).toUpperCase()}`;
}

export async function getDefaultTaxProfile(userId: string) {
  return db.taxProfile.findFirst({ where: { userId }, orderBy: { isDefault: "desc" } });
}
