/**
 * Motor del tablero de análisis: combina gastos importados (Excel) y compras (tickets),
 * concilia ambos y calcula indicadores según los filtros. Función pura: la página hace las consultas.
 */
import { inferCategory } from "./categories";
import { reconcile, storeKey } from "./reconcile";

export type Origin = "all" | "expenses" | "purchases";

export type Filters = {
  year: number;
  month: number | null; // 1-12
  origin: Origin;
  store: string | null; // storeKey
  category: string | null;
};

export type ExpenseIn = { id: string; date: Date; amount: number; concept: string; vendor: string | null; category: string | null };
export type TicketIn = {
  id: string;
  ticketDate: Date | null;
  createdAt: Date;
  totalAmount: number | null;
  storeName: string | null;
  category: string | null;
  status: string;
};
export type LimitIn = { id: string; scope: "TOTAL" | "CATEGORY" | "STORE"; scopeValue: string | null; period: "MONTHLY" | "YEARLY"; amount: number };

export type Movement = {
  id: string;
  kind: "expense" | "purchase";
  date: Date;
  store: string;
  storeKey: string;
  category: string;
  concept: string;
  amount: number;
  /** El gasto tiene un ticket asociado (o es un ticket). */
  matched: boolean;
  /** Existe factura emitida (ticket COMPLETED). */
  invoiced: boolean;
  ticketId: string | null;
};

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());

export function buildMovements(expenses: ExpenseIn[], tickets: TicketIn[]) {
  const matches = reconcile(
    expenses,
    tickets.map((t) => ({ id: t.id, date: t.ticketDate, amount: t.totalAmount, store: t.storeName })),
  );
  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  const matchedTickets = new Set(matches.values());

  const fromExpense = (e: ExpenseIn): Movement => {
    const ticket = matches.has(e.id) ? ticketById.get(matches.get(e.id)!)! : null;
    const store = e.vendor || ticket?.storeName || e.concept;
    return {
      id: e.id,
      kind: "expense",
      date: e.date,
      store: titleCase(store),
      storeKey: storeKey(store),
      category: e.category || inferCategory(e.vendor, e.concept),
      concept: e.concept,
      amount: e.amount,
      matched: Boolean(ticket),
      invoiced: ticket?.status === "COMPLETED",
      ticketId: ticket?.id ?? null,
    };
  };
  const fromTicket = (t: TicketIn): Movement => ({
    id: t.id,
    kind: "purchase",
    date: t.ticketDate ?? t.createdAt,
    store: t.storeName ?? "Comercio sin identificar",
    storeKey: storeKey(t.storeName),
    category: t.category || inferCategory(t.storeName),
    concept: "Ticket",
    amount: t.totalAmount ?? 0,
    matched: true,
    invoiced: t.status === "COMPLETED",
    ticketId: t.id,
  });

  const expenseMovs = expenses.map(fromExpense);
  const ticketMovs = tickets.map(fromTicket);
  return {
    expenses: expenseMovs,
    purchases: ticketMovs,
    /** Gasto real sin doble conteo: gastos + tickets que no aparecen en el Excel. */
    combined: [...expenseMovs, ...ticketMovs.filter((m) => !matchedTickets.has(m.id))],
  };
}

const inYear = (d: Date, y: number) => d.getUTCFullYear() === y;
const inMonth = (d: Date, m: number) => d.getUTCMonth() + 1 === m;

function topN(movs: Movement[], key: (m: Movement) => string, label: (m: Movement) => string, n = 6) {
  const map = new Map<string, { key: string; label: string; value: number; count: number }>();
  for (const m of movs) {
    const k = key(m);
    const cur = map.get(k) ?? { key: k, label: label(m), value: 0, count: 0 };
    cur.value += m.amount;
    cur.count++;
    map.set(k, cur);
  }
  const sorted = [...map.values()].sort((a, b) => b.value - a.value);
  if (sorted.length <= n) return sorted;
  const rest = sorted.slice(n - 1);
  return [
    ...sorted.slice(0, n - 1),
    { key: "__otros", label: `Otros (${rest.length})`, value: rest.reduce((s, r) => s + r.value, 0), count: rest.reduce((s, r) => s + r.count, 0) },
  ];
}

const sum = (movs: Movement[]) => Math.round(movs.reduce((s, m) => s + m.amount, 0) * 100) / 100;

export function limitWindow(limit: Pick<LimitIn, "period">, filters: Pick<Filters, "year" | "month">, today = new Date()) {
  if (limit.period === "YEARLY") return { year: filters.year, month: null };
  const month = filters.month ?? (filters.year === today.getUTCFullYear() ? today.getUTCMonth() + 1 : 12);
  return { year: filters.year, month };
}

export function buildAnalytics(
  input: { expenses: ExpenseIn[]; tickets: TicketIn[]; limits: LimitIn[] },
  filters: Filters,
  today = new Date(),
) {
  const all = buildMovements(input.expenses, input.tickets);
  const pool = filters.origin === "expenses" ? all.expenses : filters.origin === "purchases" ? all.purchases : all.combined;

  const byDimension = (m: Movement) =>
    (!filters.store || m.storeKey === filters.store) && (!filters.category || m.category === filters.category);
  const byPeriod = (m: Movement) => inYear(m.date, filters.year) && (!filters.month || inMonth(m.date, filters.month));

  const filtered = pool.filter((m) => byPeriod(m) && byDimension(m)).sort((a, b) => b.date.getTime() - a.date.getTime());
  const expensesInScope = all.expenses.filter((m) => byPeriod(m) && byDimension(m));
  const purchasesInScope = all.purchases.filter((m) => byPeriod(m) && byDimension(m));

  const expenseTotal = sum(expensesInScope);
  const invoicedExpenses = expensesInScope.filter((m) => m.invoiced);
  const withoutInvoice = expensesInScope.filter((m) => !m.invoiced);

  // Serie mensual del año: gastos (Excel) vs compras (tickets), respetando tienda/categoría
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    expenses: sum(all.expenses.filter((m) => inYear(m.date, filters.year) && inMonth(m.date, i + 1) && byDimension(m))),
    purchases: sum(all.purchases.filter((m) => inYear(m.date, filters.year) && inMonth(m.date, i + 1) && byDimension(m))),
  }));

  const limits = input.limits.map((l) => {
    const w = limitWindow(l, filters, today);
    const spent = sum(
      all.combined.filter(
        (m) =>
          inYear(m.date, w.year) &&
          (!w.month || inMonth(m.date, w.month)) &&
          (l.scope === "TOTAL" || (l.scope === "CATEGORY" ? m.category === l.scopeValue : m.storeKey === l.scopeValue)),
      ),
    );
    const pct = l.amount > 0 ? spent / l.amount : 0;
    return { ...l, spent, pct, window: w, status: pct >= 1 ? ("over" as const) : pct >= 0.8 ? ("warning" as const) : ("ok" as const) };
  });

  // Opciones de filtros: todos los valores existentes (no sólo los filtrados) para no "perder" opciones
  const everything = [...all.expenses, ...all.purchases];
  const stores = [...new Map(everything.filter((m) => m.storeKey).map((m) => [m.storeKey, m.store])).entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  const categories = [...new Set(everything.map((m) => m.category))].sort((a, b) => a.localeCompare(b, "es"));
  const years = [...new Set([...everything.map((m) => m.date.getUTCFullYear()), today.getUTCFullYear()])].sort((a, b) => b - a);

  return {
    total: sum(filtered),
    count: filtered.length,
    average: filtered.length ? sum(filtered) / filtered.length : 0,
    expenseTotal,
    purchaseTotal: sum(purchasesInScope),
    invoicedTotal: sum(purchasesInScope.filter((m) => m.invoiced)),
    coverage: expenseTotal > 0 ? sum(invoicedExpenses) / expenseTotal : null,
    withoutInvoice: { count: withoutInvoice.length, amount: sum(withoutInvoice) },
    monthly,
    topStores: topN(filtered, (m) => m.storeKey || m.store, (m) => m.store),
    topCategories: topN(filtered, (m) => m.category, (m) => m.category, 8),
    movements: filtered,
    limits,
    options: { stores, categories, years },
  };
}

export type Analytics = ReturnType<typeof buildAnalytics>;

export function parseFilters(sp: Record<string, string | string[] | undefined>, today = new Date()): Filters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) || null;
  const year = Number(one("anio"));
  const month = Number(one("mes"));
  const origin = one("origen");
  return {
    year: Number.isInteger(year) && year > 2000 ? year : today.getUTCFullYear(),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
    origin: origin === "gastos" ? "expenses" : origin === "compras" ? "purchases" : "all",
    store: one("tienda"),
    category: one("categoria"),
  };
}

/** Construye la URL del tablero cambiando sólo los filtros indicados (null = quitar). */
export function filtersHref(current: Filters, patch: Partial<Record<"anio" | "mes" | "origen" | "tienda" | "categoria", string | number | null>>) {
  const base: Record<string, string | number | null> = {
    anio: current.year,
    mes: current.month,
    origen: current.origin === "expenses" ? "gastos" : current.origin === "purchases" ? "compras" : null,
    tienda: current.store,
    categoria: current.category,
    ...patch,
  };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v !== null && v !== undefined && v !== "") qs.set(k, String(v));
  return `/analisis?${qs}`;
}
