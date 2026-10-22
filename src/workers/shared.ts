import { UnrecoverableError, type Job } from "bullmq";
import { db } from "@/lib/db";
import { getDefaultTaxProfile } from "@/lib/invoice-request";
import type { TicketJob } from "@/lib/queue";

/** Datos que todo agente outbound necesita: ticket + perfil fiscal con CSF (null si ya está facturado). */
export async function loadTicketContext(ticketId: string) {
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  if (ticket.status === "COMPLETED") return null;
  const profile = await getDefaultTaxProfile(ticket.userId);
  if (!profile) throw new UnrecoverableAgentError("El usuario no tiene perfil fiscal registrado");
  if (!profile.csfPdfUrl) throw new UnrecoverableAgentError("El perfil fiscal no tiene la CSF en PDF");
  return { ticket, profile };
}

/** Error que no vale la pena reintentar (datos faltantes, número inválido, etc.); BullMQ no reintenta. */
export class UnrecoverableAgentError extends UnrecoverableError {}

/**
 * Marca FAILED sólo en el último intento (o si el error es irrecuperable), para que
 * el dashboard no muestre fallos transitorios mientras BullMQ reintenta.
 */
export async function handleAgentFailure(job: Job<TicketJob> | undefined, err: Error) {
  if (!job) return;
  console.error(`[${job.queueName}] ticket ${job.data.ticketId} intento ${job.attemptsMade}: ${err.message}`);
  const lastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
  if (!lastAttempt && !(err instanceof UnrecoverableAgentError)) return;
  // Nunca degradar un ticket cuya factura ya llegó mientras el job seguía reintentando
  await db.ticket.updateMany({
    where: { id: job.data.ticketId, status: { not: "COMPLETED" } },
    data: { status: "FAILED", failureReason: err.message.slice(0, 500) },
  });
}
