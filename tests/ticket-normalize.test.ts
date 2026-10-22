import { describe, expect, it } from "vitest";
import { cfdiReceptorRfc } from "@/lib/cfdi";
import { normalizeMxPhone, normalizeTicketData, type TicketData } from "@/lib/ocr/ticket";

describe("normalizeMxPhone", () => {
  it.each([
    ["55 1234 5678", "+525512345678"],
    ["+52 1 55 1234 5678", "+525512345678"],
    ["+5215512345678", "+525512345678"],
    ["525512345678", "+525512345678"],
    ["12345", null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeMxPhone(input)).toBe(expected);
  });
});

describe("normalizeTicketData", () => {
  const base: TicketData = {
    tienda_nombre: "OXXO",
    rfc_emisor: "cco 860523 1n4",
    fecha_compra: "20/10/2026",
    monto_total: 89.499,
    folio_ticket: "123",
    codigo_facturacion: null,
    forma_pago: "01",
    canal_sugerido: "WEB_SCRAPE",
    datos_contacto: { url_portal: "facturacion.oxxo.com", whatsapp: null, email: " Facturas@Tienda.MX " },
  };

  it("limpia RFC, URL, email; descarta fecha mal formada; redondea monto", () => {
    const n = normalizeTicketData(base);
    expect(n.rfc_emisor).toBe("CCO8605231N4");
    expect(n.fecha_compra).toBeNull();
    expect(n.monto_total).toBe(89.5);
    expect(n.datos_contacto.url_portal).toBe("https://facturacion.oxxo.com/");
    expect(n.datos_contacto.email).toBe("facturas@tienda.mx");
  });
});

describe("cfdiReceptorRfc", () => {
  it("lee el RFC del receptor de un CFDI 4.0", () => {
    const xml = `<?xml version="1.0"?><cfdi:Comprobante Version="4.0"><cfdi:Emisor Rfc="EKU9003173C9"/><cfdi:Receptor Rfc="xaxx010101000" Nombre="X"/></cfdi:Comprobante>`;
    expect(cfdiReceptorRfc(xml)).toBe("XAXX010101000");
  });
  it("null si no es CFDI", () => {
    expect(cfdiReceptorRfc("<html/>")).toBeNull();
  });
});
