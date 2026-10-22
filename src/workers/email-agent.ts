import { Worker, type Job } from "bullmq";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { attachInvoiceFiles } from "@/lib/invoice-files";
import { buildInvoiceRequestText, ticketTag } from "@/lib/invoice-request";
import { QUEUES, redisConnection, type TicketJob } from "@/lib/queue";
import type { ContactInfo } from "@/lib/routing-engine";
import { getObject } from "@/lib/storage";
import { UnrecoverableAgentError, handleAgentFailure, loadTicketContext } from "./shared";

// ─── Outbound: solicitud de factura vía Resend ─────────────────────────

let resendClient: Resend | undefined;
const resend = () => {
  if (!process.env.RESEND_API_KEY) throw new UnrecoverableAgentError("RESEND_API_KEY no está configurado");
  return (resendClient ??= new Resend(process.env.RESEND_API_KEY));
};

/** facturas@dominio → facturas+fs-1a2b3c4d@dominio (plus addressing). */
function trackingAddress(ticketId: string) {
  const inbound = process.env.INBOUND_EMAIL_ADDRESS;
  if (!inbound) throw new UnrecoverableAgentError("INBOUND_EMAIL_ADDRESS no está configurado");
  const [user, domain] = inbound.split("@");
  return `${user}+${ticketTag(ticketId).toLowerCase()}@${domain}`;
}

async function sendInvoiceRequest(job: Job<TicketJob>) {
  const ctx = await loadTicketContext(job.data.ticketId);
  if (!ctx) return;
  const { ticket, profile } = ctx;
  const to = (ticket.contactInfo as ContactInfo | null)?.email;
  if (!to) throw new UnrecoverableAgentError("El ticket no tiene correo de facturación");

  const [ticketImage, csf] = await Promise.all([getObject(ticket.imageUrl), getObject(profile.csfPdfUrl!)]);
  const imageExt = ticket.imageUrl.split(".").pop() ?? "jpg";
  const folio = ticket.ticketFolio ?? ticket.billingCode ?? "s/n";

  const { error } = await resend().emails.send({
    from: process.env.RESEND_FROM ?? "FacturaSmart MX <facturas@facturasmart.app>",
    to,
    replyTo: trackingAddress(ticket.id),
    subject: `Solicitud de factura - Ticket ${folio} [${ticketTag(ticket.id)}]`,
    text: buildInvoiceRequestText(profile, ticket),
    attachments: [
      { filename: `ticket-${folio}.${imageExt}`, content: ticketImage },
      { filename: `CSF-${profile.rfc}.pdf`, content: csf },
    ],
  });
  // Errores 4xx de Resend (dirección inválida, dominio no verificado) no se arreglan reintentando
  if (error) {
    const msg = `Resend: ${error.name} - ${error.message}`;
    throw /validation|invalid/i.test(error.name) ? new UnrecoverableAgentError(msg) : new Error(msg);
  }

  await db.ticket.update({ where: { id: ticket.id }, data: { status: "WAITING_VENDOR_RESPONSE" } });
}

export function startEmailAgent() {
  const worker = new Worker<TicketJob>(QUEUES.email, sendInvoiceRequest, {
    connection: redisConnection(),
    concurrency: 5,
    // Respeta límites de envío de Resend
    limiter: { max: 2, duration: 1000 },
  });
  worker.on("failed", (job, err) => void handleAgentFailure(job, err));
  return worker;
}

// ─── Inbound: escucha IMAP y asocia XML/PDF a su ticket ────────────────

const TAG_RE = /FS-([0-9A-F]{8})/i;

function addresses(mail: ParsedMail) {
  const list = [mail.to, mail.cc].flatMap((a) => (a ? (Array.isArray(a) ? a : [a]) : []));
  const delivered = mail.headers.get("delivered-to");
  return [...list.flatMap((a) => a.value.map((v) => v.address ?? "")), String(delivered ?? "")].join(" ");
}

/** Busca el ticket por la etiqueta [FS-xxxxxxxx] (asunto o dirección +tag); si no, por remitente + folio. */
async function findTicketForMail(mail: ParsedMail) {
  const tag = (mail.subject ?? "").match(TAG_RE) ?? addresses(mail).match(TAG_RE);
  if (tag) {
    return db.ticket.findFirst({
      where: { id: { startsWith: tag[1].toLowerCase() }, status: { in: ["WAITING_VENDOR_RESPONSE", "PROCESSING"] } },
    });
  }

  const from = mail.from?.value[0]?.address?.toLowerCase();
  if (!from) return null;
  const candidates = await db.ticket.findMany({
    where: { channelUsed: "EMAIL", status: "WAITING_VENDOR_RESPONSE", contactInfo: { path: ["email"], equals: from } },
    orderBy: { createdAt: "desc" },
  });
  const haystack = `${mail.subject ?? ""} ${mail.text ?? ""}`;
  return candidates.find((t) => t.ticketFolio && haystack.includes(t.ticketFolio)) ?? null;
}

async function processMessage(source: Buffer) {
  const mail = await simpleParser(source);
  if (!mail.attachments.length) return;
  const ticket = await findTicketForMail(mail);
  if (!ticket) return;

  const result = await attachInvoiceFiles(
    ticket.id,
    mail.attachments.map((a) => ({ filename: a.filename ?? "", contentType: a.contentType, content: a.content })),
  );
  console.log(`[email-inbound] ticket ${ticket.id}: ${result.completed ? "COMPLETED" : result.reason}`);
}

export async function startImapListener() {
  if (!process.env.IMAP_HOST || !process.env.IMAP_USER) {
    console.warn("[email-inbound] IMAP no configurado; no se escucharán respuestas por correo");
    return;
  }

  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: true,
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD ?? "" },
    logger: false,
  });

  let syncing = false;
  const sync = async () => {
    if (syncing) return;
    syncing = true;
    try {
      const uids = (await client.search({ seen: false }, { uid: true })) || [];
      for (const uid of uids) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        try {
          if (msg && msg.source) await processMessage(msg.source);
        } catch (err) {
          console.error(`[email-inbound] error procesando uid ${uid}`, err);
        }
        // Se marca leído aunque falle para no re-procesarlo en bucle; queda en el buzón para revisión manual
        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      }
    } finally {
      syncing = false;
    }
  };

  await client.connect();
  await client.mailboxOpen("INBOX");
  client.on("exists", () => void sync().catch((e) => console.error("[email-inbound]", e)));
  // IDLE puede perder eventos si la conexión se cae silenciosamente: barrido de respaldo
  setInterval(() => void sync().catch((e) => console.error("[email-inbound]", e)), 5 * 60_000);
  await sync();
  console.log("[email-inbound] escuchando INBOX");
  return client;
}
