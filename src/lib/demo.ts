/**
 * Modo demo (DEMO_MODE=true): permite recorrer la app sin API keys.
 * - El OCR devuelve datos ficticios en lugar de llamar a Claude.
 * - Los agentes no envían nada: simulan que el comercio responde con un CFDI de prueba.
 * Todos los comercios y RFC emisores son inventados; el RFC receptor de la CSF demo
 * (EKU9003173C9) es el RFC de pruebas que publica el SAT.
 */
import type { TaxProfile, Ticket } from "@prisma/client";
import type { CsfData } from "./ocr/csf";
import type { TicketData } from "./ocr/ticket";

export const isDemoMode = () => process.env.DEMO_MODE === "true";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);

export async function demoCsfData(): Promise<CsfData> {
  await sleep(1200);
  return {
    rfc: "EKU9003173C9",
    razonSocial: "ESCUELA KEMPER URGATE",
    razonSocialOriginal: "ESCUELA KEMPER URGATE SA DE CV",
    codigoPostal: "06600",
    regimenFiscal: "601",
    regimenesDisponibles: [{ clave: "601", descripcion: "General de Ley Personas Morales" }],
  };
}

const DEMO_TICKETS: TicketData[] = [
  {
    tienda_nombre: "Taquería El Tapatío",
    rfc_emisor: "TAP850101AB1",
    fecha_compra: today(),
    monto_total: 450,
    folio_ticket: "TK-98765",
    codigo_facturacion: "A1B2C3D4",
    forma_pago: "04",
    giro: "Restaurantes",
    canal_sugerido: "WHATSAPP",
    datos_contacto: { url_portal: null, whatsapp: "+525512345678", email: "facturas@eltapatio.example" },
  },
  {
    tienda_nombre: "Farmacia Santa Rita",
    rfc_emisor: "FSR910215KL3",
    fecha_compra: today(),
    monto_total: 312.4,
    folio_ticket: "000184520",
    codigo_facturacion: null,
    forma_pago: "28",
    giro: "Farmacia y salud",
    canal_sugerido: "EMAIL",
    datos_contacto: { url_portal: null, whatsapp: null, email: "facturacion@santarita.example" },
  },
  {
    tienda_nombre: "Gasolinera Servicio Centro",
    rfc_emisor: "GSC020730QW9",
    fecha_compra: today(),
    monto_total: 900,
    folio_ticket: "7731-55",
    codigo_facturacion: "WEB-55120",
    forma_pago: "01",
    giro: "Combustible",
    canal_sugerido: "EMAIL",
    datos_contacto: { url_portal: null, whatsapp: null, email: "facturas@gascentro.example" },
  },
];

let demoIndex = 0;

export async function demoTicketData(): Promise<TicketData> {
  await sleep(1600);
  return DEMO_TICKETS[demoIndex++ % DEMO_TICKETS.length];
}

export function demoCfdiXml(profile: Pick<TaxProfile, "rfc" | "razonSocial" | "codigoPostal" | "regimenFiscal" | "usoCFDI">, ticket: Pick<Ticket, "vendorRfc" | "storeName" | "totalAmount">) {
  const total = (ticket.totalAmount ?? 100).toFixed(2);
  const subtotal = ((ticket.totalAmount ?? 100) / 1.16).toFixed(2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="DEMO" Folio="${Date.now() % 100000}" Fecha="${new Date().toISOString().slice(0, 19)}" SubTotal="${subtotal}" Moneda="MXN" Total="${total}" TipoDeComprobante="I" Exportacion="01" LugarExpedicion="06600">
  <cfdi:Emisor Rfc="${ticket.vendorRfc ?? "DEMO010101AAA"}" Nombre="${(ticket.storeName ?? "COMERCIO DEMO").toUpperCase()}" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${profile.rfc}" Nombre="${profile.razonSocial}" DomicilioFiscalReceptor="${profile.codigoPostal}" RegimenFiscalReceptor="${profile.regimenFiscal}" UsoCFDI="${profile.usoCFDI}"/>
</cfdi:Comprobante>`;
}

/** PDF mínimo válido de una página con texto, para que el visor del teléfono lo abra. */
export function demoPdf(lines: string[]) {
  const esc = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[()\\]/g, "\\$&");
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 56 ${760 - i * 28} Td (${esc(l)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
