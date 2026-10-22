"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getDefaultTaxProfile } from "@/lib/invoice-request";
import { normalizeMxPhone } from "@/lib/ocr/ticket";
import { enqueueTicket } from "@/lib/queue";
import { routeTicket, ticketToRoutingInput, type ContactInfo } from "@/lib/routing-engine";
import { ticketCorrectionsSchema, type TicketCorrections } from "@/lib/schemas";
import { getCurrentUser } from "@/lib/session";

/** Aplica las correcciones del usuario al OCR y encola el ticket para facturación. */
export async function requestInvoice(ticketId: string, corrections?: TicketCorrections) {
  const user = await getCurrentUser();
  const ticket = await db.ticket.findFirst({ where: { id: ticketId, userId: user.id } });
  if (!ticket) return { ok: false as const, error: "Ticket no encontrado" };
  if (ticket.status !== "PENDING" && ticket.status !== "FAILED") {
    return { ok: false as const, error: "Este ticket ya está en proceso" };
  }
  if (!(await getDefaultTaxProfile(user.id))) {
    return { ok: false as const, error: "Primero sube tu Constancia de Situación Fiscal" };
  }

  let updated = ticket;
  if (corrections) {
    const parsed = ticketCorrectionsSchema.safeParse(corrections);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    const c = parsed.data;
    const contact = (ticket.contactInfo ?? {}) as ContactInfo;
    updated = await db.ticket.update({
      where: { id: ticket.id },
      data: {
        ticketFolio: c.ticketFolio,
        billingCode: c.billingCode,
        ticketDate: c.ticketDate ? new Date(c.ticketDate) : null,
        totalAmount: c.totalAmount,
        contactInfo: { ...contact, phone: normalizeMxPhone(c.whatsapp), email: c.email?.toLowerCase() ?? null },
      },
    });
  }

  const routing = routeTicket(ticketToRoutingInput(updated));
  if (!routing.channel) return { ok: false as const, error: routing.warnings.at(-1) ?? "Sin canal disponible" };

  await db.ticket.update({ where: { id: ticket.id }, data: { status: "PENDING", failureReason: null } });
  await enqueueTicket(ticket.id);
  revalidatePath("/dashboard");
  return { ok: true as const, channel: routing.channel };
}
