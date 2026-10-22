import { describe, expect, it } from "vitest";
import { buildAnalytics, filtersHref, parseFilters, type ExpenseIn, type TicketIn } from "@/lib/analytics";
import { reconcile } from "@/lib/reconcile";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const today = d("2026-10-22");

const expenses: ExpenseIn[] = [
  { id: "e1", date: d("2026-10-20"), amount: 450, concept: "Comida", vendor: "TAQUERIA EL TAPATIO SA DE CV", category: null },
  { id: "e2", date: d("2026-10-21"), amount: 900, concept: "Gasolina", vendor: "Gasolinera Servicio Centro", category: "Combustible" },
  { id: "e3", date: d("2026-09-15"), amount: 1200, concept: "Hotel", vendor: "Hotel Plaza", category: null },
];
const tickets: TicketIn[] = [
  { id: "t1", ticketDate: d("2026-10-20"), createdAt: d("2026-10-20"), totalAmount: 450, storeName: "Taquería El Tapatío", category: "Restaurantes", status: "COMPLETED" },
  { id: "t2", ticketDate: d("2026-10-22"), createdAt: d("2026-10-22"), totalAmount: 312.4, storeName: "Farmacia Santa Rita", category: "Farmacia y salud", status: "WAITING_VENDOR_RESPONSE" },
];

describe("reconcile", () => {
  it("empareja por monto y fecha cercana, 1 a 1", () => {
    const m = reconcile(expenses, tickets.map((t) => ({ id: t.id, date: t.ticketDate, amount: t.totalAmount, store: t.storeName })));
    expect([...m.entries()]).toEqual([["e1", "t1"]]);
  });

  it("no empareja si la fecha está a más de 3 días", () => {
    const m = reconcile([{ ...expenses[0], date: d("2026-10-10") }], [{ id: "t1", date: d("2026-10-20"), amount: 450, store: null }]);
    expect(m.size).toBe(0);
  });
});

describe("buildAnalytics", () => {
  const base = { year: 2026, month: 10, origin: "all" as const, store: null, category: null };

  it("calcula gasto sin doble conteo, cobertura y gastos sin factura", () => {
    const a = buildAnalytics({ expenses, tickets, limits: [] }, base, today);
    // e1 (=t1) + e2 + t2 (no está en el Excel)
    expect(a.total).toBe(1662.4);
    expect(a.expenseTotal).toBe(1350);
    expect(a.purchaseTotal).toBe(762.4);
    expect(a.coverage).toBeCloseTo(450 / 1350);
    expect(a.withoutInvoice).toEqual({ count: 1, amount: 900 });
  });

  it("filtra por origen, categoría y tienda", () => {
    expect(buildAnalytics({ expenses, tickets, limits: [] }, { ...base, origin: "purchases" }, today).total).toBe(762.4);
    expect(buildAnalytics({ expenses, tickets, limits: [] }, { ...base, category: "Combustible" }, today).total).toBe(900);
    const store = buildAnalytics({ expenses, tickets, limits: [] }, base, today).topStores.find((s) => s.label.startsWith("Farmacia"))!;
    expect(buildAnalytics({ expenses, tickets, limits: [] }, { ...base, store: store.key }, today).total).toBe(312.4);
  });

  it("serie mensual compara gastos vs compras en todo el año", () => {
    const a = buildAnalytics({ expenses, tickets, limits: [] }, { ...base, month: null }, today);
    expect(a.monthly[8]).toEqual({ month: 9, expenses: 1200, purchases: 0 });
    expect(a.monthly[9]).toEqual({ month: 10, expenses: 1350, purchases: 762.4 });
  });

  it("evalúa límites mensuales y anuales", () => {
    const a = buildAnalytics(
      {
        expenses,
        tickets,
        limits: [
          { id: "l1", scope: "TOTAL", scopeValue: null, period: "MONTHLY", amount: 1500 },
          { id: "l2", scope: "CATEGORY", scopeValue: "Hospedaje", period: "YEARLY", amount: 1000 },
        ],
      },
      { ...base, month: null },
      today,
    );
    expect(a.limits[0]).toMatchObject({ spent: 1662.4, status: "over", window: { year: 2026, month: 10 } });
    expect(a.limits[1]).toMatchObject({ spent: 1200, status: "over" });
  });
});

describe("parseFilters / filtersHref", () => {
  it("ida y vuelta por la URL", () => {
    const f = parseFilters({ anio: "2025", mes: "3", origen: "gastos", categoria: "Combustible" }, today);
    expect(f).toEqual({ year: 2025, month: 3, origin: "expenses", store: null, category: "Combustible" });
    expect(filtersHref(f, { mes: null })).toBe("/analisis?anio=2025&origen=gastos&categoria=Combustible");
    expect(parseFilters({}, today)).toMatchObject({ year: 2026, month: null, origin: "all" });
  });
});
