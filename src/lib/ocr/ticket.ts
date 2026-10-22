import { z } from "zod";
import { extractStructured, imageMediaType } from "../ai";
import { demoTicketData, isDemoMode } from "../demo";

export const CANALES = ["WEB_SCRAPE", "WHATSAPP", "EMAIL", "PAC_DIRECTO"] as const;

const TicketExtractionSchema = z.object({
  es_ticket: z.boolean(),
  tienda_nombre: z.string().nullable(),
  rfc_emisor: z.string().nullable(),
  fecha_compra: z.string().nullable().describe("YYYY-MM-DD"),
  monto_total: z.number().nullable(),
  folio_ticket: z.string().nullable(),
  codigo_facturacion: z.string().nullable(),
  forma_pago: z.string().nullable(),
  canal_sugerido: z.enum(CANALES).nullable(),
  datos_contacto: z.object({
    url_portal: z.string().nullable(),
    whatsapp: z.string().nullable(),
    email: z.string().nullable(),
  }),
});

export type TicketData = Omit<z.infer<typeof TicketExtractionSchema>, "es_ticket">;

const SYSTEM = `Eres un motor OCR experto en tickets de compra de México (autoservicios, gasolineras, restaurantes, farmacias, tienditas).
Los tickets suelen ser térmicos, arrugados, borrosos o con poca luz: lee con cuidado y usa el contexto para desambiguar caracteres (0/O, 1/I, 5/S, 8/B).
Campos:
- tienda_nombre: nombre comercial (ej. "OXXO", "Gasolinera Pemex 1234").
- rfc_emisor: RFC del comercio emisor (12 o 13 caracteres). No confundir con RFC del cliente si aparece.
- fecha_compra: fecha de la compra en formato YYYY-MM-DD. Los tickets mexicanos usan DD/MM/AAAA.
- monto_total: TOTAL pagado (con IVA) como número, sin símbolo de moneda.
- folio_ticket: folio, número de ticket, transacción o "No. de operación".
- codigo_facturacion: código específico para facturar (WebID, "Código de facturación", "Referencia para facturar", "ID de ticket"). Si no hay uno distinto del folio, null.
- forma_pago: clave SAT c_FormaPago si puedes inferirla (01 Efectivo, 03 Transferencia, 04 Tarjeta de crédito, 28 Tarjeta de débito), si no, el texto impreso.
- datos_contacto.url_portal: sitio web para facturar (ej. "facturacion.tienda.com"); incluye https:// si falta.
- datos_contacto.whatsapp: número de WhatsApp para facturar, sólo si el ticket lo indica explícitamente para facturación o WhatsApp.
- datos_contacto.email: correo para solicitar factura.
- canal_sugerido: WEB_SCRAPE si hay portal web de facturación, si no WHATSAPP si hay WhatsApp, si no EMAIL si hay correo, PAC_DIRECTO sólo si el ticket menciona facturación por API/PAC.
Si un campo no es legible o no existe, usa null. Nunca inventes datos.
Si la imagen no es un ticket de compra, es_ticket=false.`;

export class TicketValidationError extends Error {}

export async function extractTicketData(image: Buffer, mimeType: string): Promise<TicketData> {
  if (isDemoMode()) return demoTicketData();
  const raw = await extractStructured({
    schema: TicketExtractionSchema,
    system: SYSTEM,
    instruction: "Extrae los datos de facturación de este ticket.",
    attachment: { kind: "image", data: image, mediaType: imageMediaType(mimeType) },
  });

  if (!raw.es_ticket) throw new TicketValidationError("La imagen no parece ser un ticket de compra");
  const { es_ticket: _ignored, ...data } = raw;
  return normalizeTicketData(data);
}

/** Limpieza determinista posterior al OCR (separada para poder probarla sin red). */
export function normalizeTicketData(data: TicketData): TicketData {
  const rfc = data.rfc_emisor?.replace(/[\s-]/g, "").toUpperCase() || null;
  return {
    ...data,
    rfc_emisor: rfc && /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/.test(rfc) ? rfc : null,
    fecha_compra: data.fecha_compra && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha_compra) ? data.fecha_compra : null,
    monto_total: data.monto_total != null && data.monto_total > 0 ? Math.round(data.monto_total * 100) / 100 : null,
    datos_contacto: {
      url_portal: normalizeUrl(data.datos_contacto.url_portal),
      whatsapp: normalizeMxPhone(data.datos_contacto.whatsapp),
      email: normalizeEmail(data.datos_contacto.email),
    },
  };
}

function normalizeUrl(url: string | null) {
  if (!url) return null;
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    return new URL(withScheme.trim()).toString();
  } catch {
    return null;
  }
}

function normalizeEmail(email: string | null) {
  const e = email?.trim().toLowerCase();
  return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Normaliza a E.164 México: +52 + 10 dígitos (Twilio ya no requiere el "1" móvil). */
export function normalizeMxPhone(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+52${digits}`;
  if (digits.length === 12 && digits.startsWith("52")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("521")) return `+52${digits.slice(3)}`;
  return null;
}
