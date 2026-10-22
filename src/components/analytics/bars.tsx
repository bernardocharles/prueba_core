import Link from "next/link";
import { cn } from "@/lib/utils";
import { money } from "./format";

/**
 * Ranking horizontal (una sola medida → un solo tono). Cada fila filtra el tablero;
 * la fila activa se resalta y las demás se atenúan.
 */
export function RankBars({
  items,
  hrefFor,
  activeKey,
  empty = "Sin datos para estos filtros",
}: {
  items: { key: string; label: string; value: number; count: number }[];
  hrefFor: (key: string) => string | null;
  activeKey: string | null;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="px-4 py-6 text-center text-subhead text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-0.5 p-2">
      {items.map((item) => {
        const href = hrefFor(item.key);
        const dim = activeKey !== null && activeKey !== item.key;
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-subhead">{item.label}</span>
              <span className="shrink-0 text-subhead tabular-nums">{money(item.value)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--series-1)_14%,transparent)]">
              <div className="h-full rounded-full bg-series-1" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
            <span className="sr-only">{item.count} movimientos</span>
          </>
        );
        const cls = cn("block rounded-xl px-2.5 py-2 transition-opacity", dim && "opacity-40", href && "press active:bg-muted hover:bg-muted/60");
        return (
          <li key={item.key}>
            {href ? (
              <Link href={href} scroll={false} className={cls} title={`${item.count} movimientos`}>
                {content}
              </Link>
            ) : (
              <div className={cls}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const METER = {
  ok: { fill: "bg-primary", track: "bg-primary/15" },
  warning: { fill: "bg-warning", track: "bg-warning/15" },
  over: { fill: "bg-destructive", track: "bg-destructive/15" },
} as const;

/** Medidor de límite: el relleno cambia de tono por severidad; la pista es el mismo tono, más claro. */
export function Meter({ pct, status }: { pct: number; status: keyof typeof METER }) {
  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full", METER[status].track)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", METER[status].fill)} style={{ width: `${Math.min(100, pct * 100)}%` }} />
    </div>
  );
}
