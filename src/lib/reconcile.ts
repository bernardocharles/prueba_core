/**
 * Conciliación gastos (Excel) ↔ compras (tickets): mismo importe (±1% o $1),
 * fecha a ±3 días y, como desempate, parecido del nombre del comercio.
 * Asignación 1 a 1, mejores pares primero.
 */
export type ReconcileExpense = { id: string; date: Date; amount: number; vendor: string | null; concept: string };
export type ReconcileTicket = { id: string; date: Date | null; amount: number | null; store: string | null };

const DAY = 86_400_000;
const MAX_DAYS = 3;

export function storeKey(name: string | null | undefined) {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\b(S\.?A\.?|DE|C\.?V\.?|S\.? DE R\.?L\.?|SUC(URSAL)?\.?|TIENDA|NO\.?)\b/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string) {
  const ta = new Set(a.split(" ").filter((t) => t.length > 2));
  const tb = new Set(b.split(" ").filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

/** @returns expenseId → ticketId */
export function reconcile(expenses: ReconcileExpense[], tickets: ReconcileTicket[]) {
  const pairs: { e: string; t: string; score: number }[] = [];
  for (const e of expenses) {
    const eStore = storeKey(e.vendor ?? e.concept);
    for (const t of tickets) {
      if (!t.date || t.amount == null) continue;
      const days = Math.abs(e.date.getTime() - t.date.getTime()) / DAY;
      const diff = Math.abs(e.amount - t.amount);
      if (days > MAX_DAYS || diff > Math.max(1, e.amount * 0.01)) continue;
      const sim = tokenSimilarity(eStore, storeKey(t.store));
      pairs.push({ e: e.id, t: t.id, score: (diff / e.amount) * 100 + days * 0.5 - sim * 2 });
    }
  }
  pairs.sort((a, b) => a.score - b.score);
  const matched = new Map<string, string>();
  const usedTickets = new Set<string>();
  for (const p of pairs) {
    if (matched.has(p.e) || usedTickets.has(p.t)) continue;
    matched.set(p.e, p.t);
    usedTickets.add(p.t);
  }
  return matched;
}
