import Link from "next/link";
import type { Ticket } from "@prisma/client";
import { Archive, Camera, FileWarning, Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { formatMXN } from "@/lib/utils";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChannelTile, StatusBadge } from "@/components/channel-badge";
import { EmptyState, IconTile, LargeTitle, Row, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const IN_FLIGHT = new Set(["PENDING", "PROCESSING", "WAITING_VENDOR_RESPONSE"]);

const monthKey = (t: Ticket) => (t.ticketDate ?? t.createdAt).toISOString().slice(0, 7);
const monthLabel = (key: string) => {
  const label = new Date(`${key}-01T12:00:00Z`).toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const shortDate = (d: Date | null) =>
  d?.toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }) ?? "Sin fecha";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [tickets, profile] = await Promise.all([
    db.ticket.findMany({ where: { userId: user.id }, orderBy: [{ ticketDate: "desc" }, { createdAt: "desc" }] }),
    db.taxProfile.findFirst({ where: { userId: user.id }, orderBy: { isDefault: "desc" } }),
  ]);

  const byMonth = new Map<string, Ticket[]>();
  for (const t of tickets) byMonth.set(monthKey(t), [...(byMonth.get(monthKey(t)) ?? []), t]);
  const months = [...byMonth.keys()].sort().reverse();

  const thisMonth = new Date().toISOString().slice(0, 7);
  const invoicedThisMonth = (byMonth.get(thisMonth) ?? [])
    .filter((t) => t.status === "COMPLETED")
    .reduce((s, t) => s + (t.totalAmount ?? 0), 0);
  const inFlight = tickets.filter((t) => IN_FLIGHT.has(t.status)).length;
  const failed = tickets.filter((t) => t.status === "FAILED").length;

  return (
    <main className="space-y-7">
      <AutoRefresh active={tickets.some((t) => t.status === "PROCESSING" || t.status === "WAITING_VENDOR_RESPONSE")} intervalMs={4000} />

      <LargeTitle
        title="Facturas"
        subtitle={profile ? `${profile.razonSocial} · ${profile.rfc}` : "Configura tu perfil fiscal para empezar"}
        action={
          <Button asChild size="sm" variant="tinted" className="hidden md:inline-flex">
            <Link href="/tickets/nuevo">
              <Camera /> Escanear
            </Link>
          </Button>
        }
      />

      {!profile && (
        <Section footer="Necesitamos tu Constancia de Situación Fiscal para pedir facturas a tu nombre.">
          <Row
            href="/perfil"
            leading={<IconTile icon={FileWarning} color="orange" />}
            title="Subir Constancia de Situación Fiscal"
          />
        </Section>
      )}

      {tickets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Widget label="Facturado este mes" value={formatMXN(invoicedThisMonth)} accent="text-success" wide />
          <Widget label="En proceso" value={String(inFlight)} accent="text-primary" />
          <Widget label="Atención" value={String(failed)} accent={failed ? "text-destructive" : "text-muted-foreground"} />
        </div>
      )}

      {tickets.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="Sin tickets todavía"
          message="Toma una foto de un ticket y nosotros pedimos la factura por ti."
          action={
            <Button asChild>
              <Link href="/tickets/nuevo">
                <Camera /> Escanear ticket
              </Link>
            </Button>
          }
        />
      )}

      {months.map((key) => {
        const rows = byMonth.get(key)!;
        const completed = rows.filter((t) => t.status === "COMPLETED");
        return (
          <Section
            key={key}
            header={monthLabel(key)}
            headerAction={
              completed.length > 0 && (
                <a href={`/api/export?month=${key}`} className="press flex items-center gap-1 text-subhead text-primary">
                  <Archive className="h-4 w-4" /> Exportar
                </a>
              )
            }
            footer={`${completed.length} de ${rows.length} facturados · ${formatMXN(completed.reduce((s, t) => s + (t.totalAmount ?? 0), 0))}`}
          >
            {rows.map((t) => (
              <Row
                key={t.id}
                href={`/tickets/${t.id}`}
                leading={<ChannelTile channel={t.channelUsed} />}
                title={t.storeName ?? "Comercio sin identificar"}
                subtitle={
                  <span className="flex items-center gap-1.5">
                    {shortDate(t.ticketDate)}
                    <span aria-hidden>·</span>
                    <StatusBadge status={t.status} />
                  </span>
                }
                trailing={<span className="tabular-nums text-foreground">{formatMXN(t.totalAmount)}</span>}
              />
            ))}
          </Section>
        );
      })}
    </main>
  );
}

function Widget({ label, value, accent, wide }: { label: string; value: string; accent: string; wide?: boolean }) {
  return (
    <div className={`rounded-[var(--radius)] bg-card p-4 ${wide ? "col-span-2 sm:col-span-1" : ""}`}>
      <p className="text-footnote text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-title-2 tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}
