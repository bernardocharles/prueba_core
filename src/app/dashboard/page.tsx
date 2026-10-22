import Link from "next/link";
import type { Ticket } from "@prisma/client";
import { Archive, FileCode2, FileText, Plus, Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { formatMXN } from "@/lib/utils";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChannelBadge, StatusBadge } from "@/components/channel-badge";
import { RetryButton } from "@/components/retry-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const IN_FLIGHT = new Set(["PROCESSING", "WAITING_VENDOR_RESPONSE"]);

const monthKey = (t: Ticket) => (t.ticketDate ?? t.createdAt).toISOString().slice(0, 7);

const monthLabel = (key: string) =>
  new Date(`${key}-01T12:00:00Z`).toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });

const fileHref = (key: string) => `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [tickets, profile] = await Promise.all([
    db.ticket.findMany({ where: { userId: user.id }, orderBy: [{ ticketDate: "desc" }, { createdAt: "desc" }] }),
    db.taxProfile.findFirst({ where: { userId: user.id }, orderBy: { isDefault: "desc" } }),
  ]);

  const byMonth = new Map<string, Ticket[]>();
  for (const t of tickets) byMonth.set(monthKey(t), [...(byMonth.get(monthKey(t)) ?? []), t]);
  const months = [...byMonth.keys()].sort().reverse();

  const count = (s: Ticket["status"]) => tickets.filter((t) => t.status === s).length;
  const stats = [
    { label: "Facturados", value: count("COMPLETED") },
    { label: "En proceso", value: tickets.filter((t) => IN_FLIGHT.has(t.status)).length },
    { label: "Pendientes", value: count("PENDING") },
    { label: "Fallidos", value: count("FAILED") },
  ];

  return (
    <main className="container space-y-6 py-8">
      <AutoRefresh active={tickets.some((t) => IN_FLIGHT.has(t.status))} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mis facturas</h1>
          <p className="text-sm text-muted-foreground">
            {profile ? `${profile.razonSocial} · ${profile.rfc}` : "Sin perfil fiscal"}
          </p>
        </div>
        <Button asChild>
          <Link href="/tickets/nuevo">
            <Plus /> Nuevo ticket
          </Link>
        </Button>
      </div>

      {!profile && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            Antes de facturar, sube tu Constancia de Situación Fiscal.
            <Button asChild size="sm" variant="outline">
              <Link href="/perfil">Subir CSF</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {tickets.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <Receipt className="h-10 w-10" />
            Aún no tienes tickets. Toma una foto de tu primer ticket para empezar.
          </CardContent>
        </Card>
      )}

      {months.map((key) => {
        const rows = byMonth.get(key)!;
        const completed = rows.filter((t) => t.status === "COMPLETED");
        const total = completed.reduce((sum, t) => sum + (t.totalAmount ?? 0), 0);
        return (
          <Card key={key}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="capitalize">{monthLabel(key)}</CardTitle>
                <CardDescription>
                  {completed.length} de {rows.length} facturados · {formatMXN(total)}
                </CardDescription>
              </div>
              {completed.length > 0 && (
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/export?month=${key}`}>
                    <Archive /> Exportar ZIP
                  </a>
                </Button>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Comercio</th>
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 font-medium">Canal</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 text-right font-medium">Archivos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((t) => (
                    <tr key={t.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">{t.storeName ?? "—"}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {t.vendorRfc ?? ""} {t.ticketFolio ? `· ${t.ticketFolio}` : ""}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {t.ticketDate?.toLocaleDateString("es-MX", { timeZone: "UTC" }) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMXN(t.totalAmount)}</td>
                      <td className="px-4 py-3">{t.channelUsed ? <ChannelBadge channel={t.channelUsed} /> : "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                        {t.status === "FAILED" && t.failureReason && (
                          <p className="mt-1 max-w-xs text-xs text-destructive">{t.failureReason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {t.invoiceXmlUrl && (
                            <Button asChild size="sm" variant="outline">
                              <a href={fileHref(t.invoiceXmlUrl)} title="Descargar XML">
                                <FileCode2 /> XML
                              </a>
                            </Button>
                          )}
                          {t.invoicePdfUrl && (
                            <Button asChild size="sm" variant="outline">
                              <a href={fileHref(t.invoicePdfUrl)} title="Descargar PDF">
                                <FileText /> PDF
                              </a>
                            </Button>
                          )}
                          {t.status === "FAILED" && <RetryButton ticketId={t.id} />}
                          {t.status === "PENDING" && <RetryButton ticketId={t.id} label="Solicitar" />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </main>
  );
}
