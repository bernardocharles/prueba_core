import type { ChannelType, Ticket } from "@prisma/client";
import type { TicketData } from "./ocr/ticket";

/**
 * Portales conocidos con (futuro) script RPA. `scraperId` apunta al script en
 * src/workers/scrapers/<id>.ts; `scraperReady` se activa cuando ese script exista.
 * El match es por nombre comercial porque el RFC impreso a veces es ilegible.
 */
export const KNOWN_PORTALS: { scraperId: string; match: RegExp; scraperReady: boolean }[] = [
  { scraperId: "walmart", match: /WAL-?MART|BODEGA AURRERA|SAM'?S CLUB|SUPERAMA/i, scraperReady: false },
  { scraperId: "oxxo", match: /\bOXXO\b/i, scraperReady: false },
  { scraperId: "soriana", match: /SORIANA/i, scraperReady: false },
  { scraperId: "costco", match: /COSTCO/i, scraperReady: false },
  { scraperId: "homedepot", match: /HOME\s*DEPOT/i, scraperReady: false },
  { scraperId: "pemex", match: /PEMEX/i, scraperReady: false },
  { scraperId: "chedraui", match: /CHEDRAUI/i, scraperReady: false },
  { scraperId: "farmacias-guadalajara", match: /FARMACIAS? GUADALAJARA/i, scraperReady: false },
];

/** Comercios con integración API/PAC directa, por RFC emisor. */
export const DIRECT_API_VENDORS = new Set<string>([]);

export type RouteCandidate = { channel: ChannelType; reason: string; scraperId?: string };

export type RoutingDecision = {
  /** Canal elegido (primer candidato habilitado), o null si ninguno aplica. */
  channel: ChannelType | null;
  /** Todos los candidatos en orden de preferencia, para reintentos con fallback. */
  candidates: RouteCandidate[];
  warnings: string[];
};

export function enabledChannels(env = process.env.ENABLED_CHANNELS): Set<ChannelType> {
  const all: ChannelType[] = ["DIRECT_API", "WEB_SCRAPE", "WHATSAPP", "EMAIL"];
  if (!env) return new Set(all);
  const wanted = env.split(",").map((s) => s.trim().toUpperCase());
  return new Set(all.filter((c) => wanted.includes(c)));
}

/**
 * Orden de preferencia: API directa > portal web con script > WhatsApp > email.
 * Los canales automáticos (API/RPA) van primero porque no dependen de que un humano
 * del comercio responda; WhatsApp antes que email porque suele responderse más rápido.
 */
export function routeTicket(
  ticket: TicketData,
  opts: { enabled?: Set<ChannelType>; today?: Date } = {},
): RoutingDecision {
  const enabled = opts.enabled ?? enabledChannels();
  const candidates: RouteCandidate[] = [];
  const warnings: string[] = [];
  const contact = ticket.datos_contacto;

  if (ticket.rfc_emisor && DIRECT_API_VENDORS.has(ticket.rfc_emisor)) {
    candidates.push({ channel: "DIRECT_API", reason: "Comercio integrado vía API/PAC" });
  }

  const portal = KNOWN_PORTALS.find((p) => ticket.tienda_nombre && p.match.test(ticket.tienda_nombre));
  if (portal?.scraperReady) {
    candidates.push({ channel: "WEB_SCRAPE", reason: `Portal conocido (${portal.scraperId})`, scraperId: portal.scraperId });
  } else if (portal || contact.url_portal) {
    warnings.push(
      `El ticket indica portal web${portal ? ` (${portal.scraperId})` : ""} pero aún no hay script RPA; se usará otro canal si existe.`,
    );
  }

  if (contact.whatsapp) candidates.push({ channel: "WHATSAPP", reason: "WhatsApp de facturación impreso en el ticket" });
  if (contact.email) candidates.push({ channel: "EMAIL", reason: "Correo de facturación impreso en el ticket" });

  if (!ticket.folio_ticket && !ticket.codigo_facturacion) {
    warnings.push("No se detectó folio ni código de facturación; el comercio podría rechazar la solicitud.");
  }

  // Muchos comercios sólo facturan dentro del mes de la compra.
  if (ticket.fecha_compra) {
    const today = opts.today ?? new Date();
    const [y, m] = ticket.fecha_compra.split("-").map(Number);
    if (y !== today.getFullYear() || m !== today.getMonth() + 1) {
      warnings.push("La compra es de un mes anterior; varios comercios ya no permiten facturarla.");
    }
  }

  const chosen = candidates.find((c) => enabled.has(c.channel)) ?? null;
  if (!chosen) {
    warnings.push(
      candidates.length
        ? "Hay canales posibles pero ninguno está habilitado (ENABLED_CHANNELS)."
        : "El ticket no tiene WhatsApp, correo ni portal soportado: requiere facturación manual.",
    );
  }

  return { channel: chosen?.channel ?? null, candidates, warnings };
}

/** Forma de `Ticket.contactInfo` en la base de datos. */
export type ContactInfo = { phone: string | null; email: string | null; portalUrl: string | null };

export function toContactInfo(data: TicketData): ContactInfo {
  return {
    phone: data.datos_contacto.whatsapp,
    email: data.datos_contacto.email,
    portalUrl: data.datos_contacto.url_portal,
  };
}

/** Reconstruye la entrada del enrutador a partir de un Ticket persistido. */
export function ticketToRoutingInput(ticket: Ticket): TicketData {
  const contact = (ticket.contactInfo ?? {}) as Partial<ContactInfo>;
  return {
    tienda_nombre: ticket.storeName,
    rfc_emisor: ticket.vendorRfc,
    fecha_compra: ticket.ticketDate?.toISOString().slice(0, 10) ?? null,
    monto_total: ticket.totalAmount,
    folio_ticket: ticket.ticketFolio,
    codigo_facturacion: ticket.billingCode,
    forma_pago: null,
    canal_sugerido: null,
    datos_contacto: {
      url_portal: contact.portalUrl ?? null,
      whatsapp: contact.phone ?? null,
      email: contact.email ?? null,
    },
  };
}
