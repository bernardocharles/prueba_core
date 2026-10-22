import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, FileCode2, FileText, Hash, KeyRound, Building2, CalendarDays, CreditCard } from "lucide-react";
import { db } from "@/lib/db";
import type { ContactInfo } from "@/lib/routing-engine";
import { getCurrentUser } from "@/lib/session";
import { formatMXN } from "@/lib/utils";
import { AutoRefresh } from "@/components/auto-refresh";
import { CHANNEL_META, ChannelTile, StatusBadge } from "@/components/channel-badge";
import { IconTile, Notice, Row, Section } from "@/components/ios";
import { RetryButton } from "@/components/retry-button";

export const dynamic = "force-dynamic";

const fileHref = (key: string) => `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const ticket = await db.ticket.findFirst({ where: { id: params.id, userId: user.id } });
  if (!ticket) notFound();

  const contact = (ticket.contactInfo ?? {}) as Partial<ContactInfo>;
  const waiting = ticket.status === "PROCESSING" || ticket.status === "WAITING_VENDOR_RESPONSE";

  return (
    <main className="space-y-7 pt-2 md:pt-6">
      <AutoRefresh active={waiting} intervalMs={3000} />

      <Link href="/dashboard" className="press -ml-1 inline-flex items-center text-body text-primary">
        <ChevronLeft className="h-6 w-6" strokeWidth={2.4} /> Facturas
      </Link>

      <header className="flex flex-col items-center gap-3 text-center">
        <div className="scale-150 pb-2">
          <ChannelTile channel={ticket.channelUsed} />
        </div>
        <div>
          <h1 className="text-title-2">{ticket.storeName ?? "Comercio sin identificar"}</h1>
          <p className="mt-1 text-[40px] font-semibold leading-tight tracking-tight tabular-nums">{formatMXN(ticket.totalAmount)}</p>
        </div>
        <StatusBadge status={ticket.status} />
      </header>

      {ticket.status === "FAILED" && ticket.failureReason && (
        <Notice tone="error" icon={AlertTriangle}>
          {ticket.failureReason}
        </Notice>
      )}
      {waiting && (
        <p className="text-center text-subhead text-muted-foreground">
          {ticket.channelUsed ? `Solicitud enviada por ${CHANNEL_META[ticket.channelUsed].label}. ` : ""}
          Esta pantalla se actualiza sola cuando llegue la factura.
        </p>
      )}

      {(ticket.invoiceXmlUrl || ticket.invoicePdfUrl) && (
        <Section header="Factura">
          {ticket.invoicePdfUrl && (
            <Row href={fileHref(ticket.invoicePdfUrl)} external leading={<IconTile icon={FileText} color="red" />} title="Ver PDF" subtitle="Representación impresa" />
          )}
          {ticket.invoiceXmlUrl && (
            <Row href={fileHref(ticket.invoiceXmlUrl)} external leading={<IconTile icon={FileCode2} color="indigo" />} title="Descargar XML" subtitle="Comprobante fiscal CFDI 4.0" />
          )}
        </Section>
      )}

      <Section header="Ticket">
        <Row leading={<IconTile icon={CalendarDays} color="orange" />} title="Fecha" trailing={ticket.ticketDate?.toLocaleDateString("es-MX", { dateStyle: "long", timeZone: "UTC" }) ?? "—"} />
        <Row leading={<IconTile icon={Hash} color="gray" />} title="Folio" trailing={<span className="font-mono text-subhead">{ticket.ticketFolio ?? "—"}</span>} />
        <Row leading={<IconTile icon={KeyRound} color="gray" />} title="Código" trailing={<span className="font-mono text-subhead">{ticket.billingCode ?? "—"}</span>} />
        <Row leading={<IconTile icon={Building2} color="blue" />} title="RFC emisor" trailing={<span className="font-mono text-subhead">{ticket.vendorRfc ?? "—"}</span>} />
        {ticket.channelUsed && (
          <Row
            leading={<IconTile icon={CHANNEL_META[ticket.channelUsed].icon} color={CHANNEL_META[ticket.channelUsed].color} />}
            title="Canal"
            trailing={contact.phone ?? contact.email ?? CHANNEL_META[ticket.channelUsed].label}
          />
        )}
      </Section>

      <Section header="Foto">
        <a href={fileHref(ticket.imageUrl)} className="block bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por URL firmada */}
          <img src={fileHref(ticket.imageUrl)} alt="Foto del ticket" className="mx-auto max-h-80 object-contain" />
        </a>
      </Section>

      {(ticket.status === "FAILED" || ticket.status === "PENDING") && (
        <div className="flex justify-center">
          <RetryButton ticketId={ticket.id} label={ticket.status === "PENDING" ? "Solicitar factura" : "Reintentar"} />
        </div>
      )}
    </main>
  );
}
