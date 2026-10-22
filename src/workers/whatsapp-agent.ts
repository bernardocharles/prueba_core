import { Worker, type Job } from "bullmq";
import twilio from "twilio";
import { db } from "@/lib/db";
import { buildInvoiceRequestText } from "@/lib/invoice-request";
import { QUEUES, redisConnection, type TicketJob } from "@/lib/queue";
import type { ContactInfo } from "@/lib/routing-engine";
import { signedUrl } from "@/lib/storage";
import { UnrecoverableAgentError, handleAgentFailure, loadTicketContext } from "./shared";

let twilioClient: ReturnType<typeof twilio> | undefined;
const client = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new UnrecoverableAgentError("Credenciales de Twilio no configuradas");
  }
  return (twilioClient ??= twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN));
};

// Códigos de Twilio que no se resuelven reintentando
// 21211/21614: número inválido · 63003: no es usuario de WhatsApp
// 63016: fuera de la ventana de 24 h → requiere plantilla aprobada (TWILIO_WHATSAPP_CONTENT_SID)
const PERMANENT_ERRORS = new Set([21211, 21614, 63003, 63016]);

async function sendInvoiceRequest(job: Job<TicketJob>) {
  const ctx = await loadTicketContext(job.data.ticketId);
  if (!ctx) return;
  const { ticket, profile } = ctx;
  const phone = (ticket.contactInfo as ContactInfo | null)?.phone;
  if (!phone) throw new UnrecoverableAgentError("El ticket no tiene WhatsApp de facturación");

  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new UnrecoverableAgentError("TWILIO_WHATSAPP_FROM no está configurado");
  const to = `whatsapp:${phone}`;

  // Twilio descarga los adjuntos al momento del envío; 1 h de vigencia es de sobra
  const [ticketUrl, csfUrl] = await Promise.all([signedUrl(ticket.imageUrl), signedUrl(profile.csfPdfUrl!)]);
  const text = buildInvoiceRequestText(profile, ticket);

  try {
    // WhatsApp admite un solo adjunto por mensaje: texto + foto del ticket, luego la CSF
    const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;
    if (contentSid) {
      // Plantilla aprobada por Meta, necesaria para iniciar conversación fuera de la ventana de 24 h.
      // Variables esperadas: {{1}} mensaje completo, {{2}} URL de la foto del ticket.
      await client().messages.create({
        from,
        to,
        contentSid,
        contentVariables: JSON.stringify({ 1: text, 2: ticketUrl }),
      });
    } else {
      await client().messages.create({ from, to, body: text, mediaUrl: [ticketUrl] });
    }
    await client().messages.create({
      from,
      to,
      body: `Constancia de Situación Fiscal - ${profile.rfc}`,
      mediaUrl: [csfUrl],
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code && PERMANENT_ERRORS.has(code)) {
      throw new UnrecoverableAgentError(`Twilio ${code}: ${(err as Error).message}`);
    }
    throw err;
  }

  await db.ticket.update({ where: { id: ticket.id }, data: { status: "WAITING_VENDOR_RESPONSE" } });
}

export function startWhatsAppAgent() {
  const worker = new Worker<TicketJob>(QUEUES.whatsapp, sendInvoiceRequest, {
    connection: redisConnection(),
    concurrency: 5,
    limiter: { max: 1, duration: 1000 },
  });
  worker.on("failed", (job, err) => void handleAgentFailure(job, err));
  return worker;
}
