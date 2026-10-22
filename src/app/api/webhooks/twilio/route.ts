import twilio from "twilio";
import { db } from "@/lib/db";
import { attachInvoiceFiles, type IncomingFile } from "@/lib/invoice-files";
import { normalizeMxPhone } from "@/lib/ocr/ticket";

export const runtime = "nodejs";

const emptyTwiml = () => new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });

/** Respuestas entrantes de comercios por WhatsApp (Twilio "A message comes in"). */
export async function POST(req: Request) {
  const form = await req.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));

  const signature = req.headers.get("x-twilio-signature") ?? "";
  const url = process.env.TWILIO_WEBHOOK_URL ?? req.url;
  if (!twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN ?? "", signature, url, params)) {
    return new Response("Firma inválida", { status: 403 });
  }

  const numMedia = Number(params.NumMedia ?? 0);
  const phone = normalizeMxPhone(params.From?.replace(/^whatsapp:/, "") ?? null);
  if (!numMedia || !phone) return emptyTwiml();

  const ticket = await db.ticket.findFirst({
    where: { channelUsed: "WHATSAPP", status: "WAITING_VENDOR_RESPONSE", contactInfo: { path: ["phone"], equals: phone } },
    orderBy: { updatedAt: "desc" },
  });
  if (!ticket) return emptyTwiml();

  // Los media de Twilio requieren Basic Auth con las credenciales de la cuenta
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const files: IncomingFile[] = [];
  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = params[`MediaUrl${i}`];
    if (!mediaUrl) continue;
    const res = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) continue;
    const contentType = params[`MediaContentType${i}`] ?? res.headers.get("content-type") ?? "";
    files.push({ filename: `media-${i}`, contentType, content: Buffer.from(await res.arrayBuffer()) });
  }

  const result = await attachInvoiceFiles(ticket.id, files);
  console.log(`[whatsapp-inbound] ticket ${ticket.id}: ${result.completed ? "COMPLETED" : result.reason}`);
  return emptyTwiml();
}
