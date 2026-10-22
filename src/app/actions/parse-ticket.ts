"use server";

import { AIExtractionError } from "@/lib/ai";
import { db } from "@/lib/db";
import { extractTicketData, TicketValidationError, type TicketData } from "@/lib/ocr/ticket";
import { routeTicket, toContactInfo, type RoutingDecision } from "@/lib/routing-engine";
import { getCurrentUser } from "@/lib/session";
import { buildKey, putObject } from "@/lib/storage";

const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ParseTicketResult =
  | { ok: true; ticketId: string; data: TicketData; routing: RoutingDecision }
  | { ok: false; error: string };

/** Sube la foto del ticket, extrae sus datos con visión y crea el Ticket en PENDING. */
export async function parseTicket(formData: FormData): Promise<ParseTicketResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No se recibió ninguna imagen" };
  if (!ACCEPTED.has(file.type)) return { ok: false, error: "Formato no soportado (usa JPG, PNG o WEBP)" };
  if (file.size > MAX_BYTES) return { ok: false, error: "La imagen excede 12 MB" };

  try {
    const user = await getCurrentUser();
    const image = Buffer.from(await file.arrayBuffer());
    const [data, imageKey] = await Promise.all([
      extractTicketData(image, file.type),
      putObject(buildKey(user.id, "tickets", file.type), image, file.type),
    ]);

    const ticket = await db.ticket.create({
      data: {
        userId: user.id,
        imageUrl: imageKey,
        storeName: data.tienda_nombre,
        vendorRfc: data.rfc_emisor,
        ticketDate: data.fecha_compra ? new Date(data.fecha_compra) : null,
        totalAmount: data.monto_total,
        ticketFolio: data.folio_ticket,
        billingCode: data.codigo_facturacion,
        contactInfo: toContactInfo(data),
      },
    });

    return { ok: true, ticketId: ticket.id, data, routing: routeTicket(data) };
  } catch (err) {
    if (err instanceof TicketValidationError || err instanceof AIExtractionError) return { ok: false, error: err.message };
    console.error("[parse-ticket]", err);
    return { ok: false, error: "No se pudo leer el ticket. Intenta con una foto más nítida." };
  }
}
