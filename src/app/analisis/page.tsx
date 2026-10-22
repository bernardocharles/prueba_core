import Link from "next/link";
import { AlertTriangle, ChartColumn, FileSpreadsheet, Gauge, Receipt, ShieldCheck, Upload } from "lucide-react";
import { buildAnalytics, filtersHref, parseFilters } from "@/lib/analytics";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Meter, RankBars } from "@/components/analytics/bars";
import { FilterBar } from "@/components/analytics/filter-bar";
import { money, MONTHS } from "@/components/analytics/format";
import { DeleteButton, LimitForm } from "@/components/analytics/limit-form";
import { MonthlyChart } from "@/components/analytics/monthly-chart";
import { EmptyState, IconTile, LargeTitle, Row, Section } from "@/components/ios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const ORIGIN_LABEL = { all: "Gasto total", expenses: "Gastos importados", purchases: "Compras con ticket" } as const;
const SCOPE_LABEL = { TOTAL: "Todo el gasto", CATEGORY: "", STORE: "" } as const;

export default async function AnalisisPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await getCurrentUser();
  const filters = parseFilters(searchParams);
  const [expenses, tickets, limits, imports] = await Promise.all([
    db.expense.findMany({ where: { userId: user.id } }),
    db.ticket.findMany({
      where: { userId: user.id, status: { not: "FAILED" } },
      select: { id: true, ticketDate: true, createdAt: true, totalAmount: true, storeName: true, category: true, status: true },
    }),
    db.spendingLimit.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.expenseImport.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const a = buildAnalytics({ expenses, tickets, limits }, filters);
  const href = (patch: Parameters<typeof filtersHref>[1]) => filtersHref(filters, patch);
  const storeLabel = (key: string | null) => a.options.stores.find((s) => s.key === key)?.label ?? key;
  const period = filters.month ? `${MONTHS[filters.month - 1]} ${filters.year}` : String(filters.year);
  const scopeText = [filters.category, filters.store && storeLabel(filters.store)].filter(Boolean).join(" · ");
  const hasData = expenses.length > 0 || tickets.length > 0;

  return (
    <main className="space-y-6">
      <LargeTitle
        title="Análisis"
        subtitle="Gastos vs compras facturadas"
        action={
          <Button asChild size="sm" variant="tinted">
            <Link href="/analisis/importar">
              <Upload /> Importar
            </Link>
          </Button>
        }
      />

      {!hasData ? (
        <EmptyState
          icon={ChartColumn}
          title="Aún no hay datos"
          message="Importa un Excel con tus gastos y escanea tickets para comparar cuánto gastas contra lo que ya está facturado."
          action={
            <Button asChild>
              <Link href="/analisis/importar">
                <FileSpreadsheet /> Importar Excel
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <FilterBar years={a.options.years} stores={a.options.stores} categories={a.options.categories} />

          {/* Cifra principal: una por vista */}
          <section className="px-1">
            <p className="text-subhead text-muted-foreground">
              {ORIGIN_LABEL[filters.origin]} · {period}
              {scopeText && ` · ${scopeText}`}
            </p>
            <p className="mt-0.5 text-[48px] font-bold leading-[1.1] tracking-tight">{money(a.total)}</p>
            <p className="text-subhead text-muted-foreground">
              {a.count} movimientos{a.count > 0 && ` · promedio ${money(a.average)}`}
            </p>
          </section>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Gastos (Excel)" value={money(a.expenseTotal)} swatch="var(--series-1)" />
            <Stat label="Compras (tickets)" value={money(a.purchaseTotal)} swatch="var(--series-2)" />
            <Stat
              label="Cobertura de facturas"
              value={a.coverage === null ? "—" : `${Math.round(a.coverage * 100)}%`}
              icon={ShieldCheck}
              tone={a.coverage === null ? undefined : a.coverage >= 0.8 ? "success" : a.coverage >= 0.5 ? "warning" : "destructive"}
              hint="ya facturado"
            />
            <Stat
              label="Sin factura"
              value={money(a.withoutInvoice.amount)}
              icon={AlertTriangle}
              tone={a.withoutInvoice.count ? "warning" : undefined}
              hint={`${a.withoutInvoice.count} gastos por facturar`}
            />
          </div>

          <Section
            header={`Gastos vs compras · ${filters.year}`}
            headerAction={
              filters.month && (
                <Link href={href({ mes: null })} scroll={false} className="text-subhead text-primary">
                  Ver todo el año
                </Link>
              )
            }
          >
            <div className="p-4 pb-3">
              <MonthlyChart data={a.monthly} selected={filters.month} monthHrefs={a.monthly.map((m) => href({ mes: filters.month === m.month ? null : m.month }))} />
              <details className="group mt-3 text-footnote">
                <summary className="cursor-pointer list-none text-primary">Ver como tabla</summary>
                <table className="mt-2 w-full tabular-nums">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 text-left font-medium">Mes</th>
                      <th className="py-1 text-right font-medium">Gastos</th>
                      <th className="py-1 text-right font-medium">Compras</th>
                      <th className="py-1 text-right font-medium">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.monthly.map((m) => (
                      <tr key={m.month} className="border-t">
                        <td className="py-1">{MONTHS[m.month - 1]}</td>
                        <td className="py-1 text-right">{money(m.expenses)}</td>
                        <td className="py-1 text-right">{money(m.purchases)}</td>
                        <td className="py-1 text-right">{money(m.expenses - m.purchases)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          </Section>

          <Section header="Límites" footer={a.limits.length ? "Los mensuales usan el mes filtrado (o el actual). El gasto se cuenta una sola vez aunque esté en el Excel y en un ticket." : "Define un tope mensual o anual para todo tu gasto, una categoría o una tienda."}>
            {a.limits.map((l) => (
              <div key={l.id} className="pl-4">
                <div className="row-sep space-y-2 border-t py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <IconTile icon={Gauge} color={l.status === "over" ? "red" : l.status === "warning" ? "orange" : "blue"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body">{l.scope === "TOTAL" ? SCOPE_LABEL.TOTAL : l.scope === "STORE" ? storeLabel(l.scopeValue) : l.scopeValue}</p>
                      <p className="text-footnote text-muted-foreground">
                        {l.period === "MONTHLY" ? `Mensual · ${MONTHS[(l.window.month ?? 1) - 1].slice(0, 3).toLowerCase()}` : `Anual · ${l.window.year}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-subhead tabular-nums">
                        {money(l.spent)} <span className="text-muted-foreground">/ {money(l.amount)}</span>
                      </p>
                      <p className={cn("text-footnote font-semibold", l.status === "over" ? "text-destructive" : l.status === "warning" ? "text-warning" : "text-muted-foreground")}>
                        {l.status === "over" ? `Excedido ${money(l.spent - l.amount)}` : `${Math.round(l.pct * 100)}% usado`}
                      </p>
                    </div>
                    <DeleteButton id={l.id} kind="limit" label="Eliminar límite" />
                  </div>
                  <div className="pl-[42px]">
                    <Meter pct={l.pct} status={l.status} />
                  </div>
                </div>
              </div>
            ))}
            <LimitForm stores={a.options.stores} categories={a.options.categories} />
          </Section>

          <div className="grid gap-6 md:grid-cols-2">
            <Section header="Por categoría">
              <RankBars items={a.topCategories} activeKey={filters.category} hrefFor={(k) => (k === "__otros" ? null : href({ categoria: filters.category === k ? null : k }))} />
            </Section>
            <Section header="Por tienda">
              <RankBars items={a.topStores} activeKey={filters.store} hrefFor={(k) => (k === "__otros" ? null : href({ tienda: filters.store === k ? null : k }))} />
            </Section>
          </div>

          <Section header={`Movimientos · ${a.movements.length}`} footer={a.movements.length > 20 ? `Mostrando los 20 más recientes de ${a.movements.length}. Usa los filtros para acotar.` : undefined}>
            {a.movements.length === 0 && <p className="px-4 py-6 text-center text-subhead text-muted-foreground">Sin movimientos para estos filtros</p>}
            {a.movements.slice(0, 20).map((m) => (
              <Row
                key={`${m.kind}-${m.id}`}
                href={m.ticketId ? `/tickets/${m.ticketId}` : undefined}
                leading={<IconTile icon={m.kind === "purchase" ? Receipt : FileSpreadsheet} color={m.kind === "purchase" ? "orange" : "blue"} />}
                title={m.store}
                subtitle={
                  <span className="flex items-center gap-1.5">
                    {m.date.toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" })} · {m.category}
                  </span>
                }
                trailing={
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="tabular-nums text-foreground">{money(m.amount, true)}</span>
                    {m.invoiced ? (
                      <Badge variant="success">Facturado</Badge>
                    ) : m.kind === "expense" ? (
                      <Badge variant={m.matched ? "warning" : "secondary"}>{m.matched ? "En proceso" : "Sin ticket"}</Badge>
                    ) : (
                      <Badge variant="warning">En proceso</Badge>
                    )}
                  </span>
                }
              />
            ))}
          </Section>

          {imports.length > 0 && (
            <Section header="Archivos importados">
              {imports.map((i) => (
                <Row
                  key={i.id}
                  leading={<IconTile icon={FileSpreadsheet} color="green" />}
                  title={i.fileName}
                  subtitle={`${i.rowCount} gastos · ${i.createdAt.toLocaleDateString("es-MX", { dateStyle: "medium" })}`}
                  trailing={<DeleteButton id={i.id} kind="import" label="Eliminar importación" />}
                />
              ))}
            </Section>
          )}
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
  swatch,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  swatch?: string;
  icon?: typeof ShieldCheck;
  tone?: "success" | "warning" | "destructive";
}) {
  const toneCls = { success: "text-success", warning: "text-warning", destructive: "text-destructive" };
  return (
    <div className="rounded-[var(--radius)] bg-card p-4">
      <p className="flex items-center gap-1.5 text-footnote text-muted-foreground">
        {swatch && <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: swatch }} />}
        {Icon && <Icon className={cn("h-3.5 w-3.5", tone && toneCls[tone])} />}
        {label}
      </p>
      <p className="mt-1 truncate text-title-2">{value}</p>
      {hint && <p className="mt-0.5 truncate text-caption text-muted-foreground">{hint}</p>}
    </div>
  );
}
