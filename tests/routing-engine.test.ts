import { describe, expect, it } from "vitest";
import type { ChannelType } from "@prisma/client";
import type { TicketData } from "@/lib/ocr/ticket";
import { enabledChannels, routeTicket } from "@/lib/routing-engine";

const today = new Date("2026-10-22T12:00:00Z");
const ALL = new Set<ChannelType>(["DIRECT_API", "WEB_SCRAPE", "WHATSAPP", "EMAIL"]);

function ticket(overrides: Partial<TicketData> = {}, contact: Partial<TicketData["datos_contacto"]> = {}): TicketData {
  return {
    tienda_nombre: "Restaurante El Tapatío",
    rfc_emisor: "TAP850101XYZ",
    fecha_compra: "2026-10-20",
    monto_total: 450,
    folio_ticket: "TK-98765",
    codigo_facturacion: "A1B2C3D4",
    forma_pago: "04",
    giro: null,
    canal_sugerido: null,
    datos_contacto: { url_portal: null, whatsapp: null, email: null, ...contact },
    ...overrides,
  };
}

describe("routeTicket", () => {
  it("prefiere WhatsApp sobre email", () => {
    const r = routeTicket(ticket({}, { whatsapp: "+525512345678", email: "f@x.com" }), { enabled: ALL, today });
    expect(r.channel).toBe("WHATSAPP");
    expect(r.candidates.map((c) => c.channel)).toEqual(["WHATSAPP", "EMAIL"]);
    expect(r.warnings).toEqual([]);
  });

  it("usa email si sólo hay correo", () => {
    expect(routeTicket(ticket({}, { email: "f@x.com" }), { enabled: ALL, today }).channel).toBe("EMAIL");
  });

  it("salta canales deshabilitados y usa el siguiente", () => {
    const enabled = new Set<ChannelType>(["EMAIL"]);
    const r = routeTicket(ticket({}, { whatsapp: "+525512345678", email: "f@x.com" }), { enabled, today });
    expect(r.channel).toBe("EMAIL");
  });

  it("portal conocido sin script → avisa y cae a otro canal", () => {
    const r = routeTicket(ticket({ tienda_nombre: "OXXO SUC. CENTRO" }, { email: "f@oxxo.com" }), { enabled: ALL, today });
    expect(r.channel).toBe("EMAIL");
    expect(r.warnings.some((w) => w.includes("oxxo"))).toBe(true);
  });

  it("sin contacto → null y requiere manual", () => {
    const r = routeTicket(ticket(), { enabled: ALL, today });
    expect(r.channel).toBeNull();
    expect(r.warnings.at(-1)).toMatch(/manual/);
  });

  it("advierte compras de meses anteriores y tickets sin folio", () => {
    const r = routeTicket(
      ticket({ fecha_compra: "2026-09-30", folio_ticket: null, codigo_facturacion: null }, { email: "f@x.com" }),
      { enabled: ALL, today },
    );
    expect(r.warnings).toHaveLength(2);
  });
});

describe("enabledChannels", () => {
  it("parsea ENABLED_CHANNELS", () => {
    expect([...enabledChannels("email, whatsapp")]).toEqual(["WHATSAPP", "EMAIL"]);
    expect(enabledChannels(undefined).size).toBe(4);
  });
});
