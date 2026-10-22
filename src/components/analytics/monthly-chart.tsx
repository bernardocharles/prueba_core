"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compactMoney, money, MONTHS, niceMax } from "./format";

type Point = { month: number; expenses: number; purchases: number };

const SERIES = [
  { key: "expenses", name: "Gastos (Excel)", color: "var(--series-1)" },
  { key: "purchases", name: "Compras (tickets)", color: "var(--series-2)" },
] as const;

const H = 200;
const PAD = { top: 12, right: 4, bottom: 24, left: 44 };

/** Rectángulo con sólo las esquinas superiores redondeadas (anclado a la línea base). */
function bar(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * Barras agrupadas mensuales: Gastos vs Compras. Hover/tap muestra el detalle;
 * clic (o segundo tap en móvil) filtra el tablero por ese mes.
 */
export function MonthlyChart({ data, monthHrefs, selected }: { data: Point[]; monthHrefs: string[]; selected: number | null }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(...data.flatMap((d) => [d.expenses, d.purchases])));
  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / 12;
  const gap = 2; // separación de superficie entre barras adyacentes
  const barW = Math.max(3, Math.min(16, (band * 0.7 - gap) / 2));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const short = width < 520;
  const point = active !== null ? data[active] : null;

  return (
    <div ref={ref} className="relative select-none" onPointerLeave={() => setActive(null)}>
      <svg width={width} height={H} role="img" aria-label="Gastos contra compras por mes" className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="hsl(var(--grid))" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {compactMoney(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const dim = selected !== null && selected !== d.month;
          return (
            <g key={d.month} opacity={dim ? 0.35 : 1} className="transition-opacity">
              {active === i && <rect x={cx - band / 2} y={PAD.top} width={band} height={plotH} rx={6} fill="hsl(var(--muted))" opacity={0.6} />}
              <path d={bar(cx - barW - gap / 2, y(d.expenses), barW, y(0) - y(d.expenses))} fill={SERIES[0].color} />
              <path d={bar(cx + gap / 2, y(d.purchases), barW, y(0) - y(d.purchases))} fill={SERIES[1].color} />
              <text x={cx} y={H - 6} textAnchor="middle" className={`text-[11px] ${selected === d.month ? "fill-foreground font-semibold" : "fill-muted-foreground"}`}>
                {short ? MONTHS[i][0] : MONTHS[i].slice(0, 3)}
              </text>
              {/* Zona táctil: toda la columna del mes, más grande que las barras */}
              <rect
                x={cx - band / 2}
                y={0}
                width={band}
                height={H}
                fill="transparent"
                className="cursor-pointer"
                onPointerEnter={() => setActive(i)}
                onPointerDown={(e) => {
                  if (e.pointerType !== "mouse" && active !== i) {
                    e.preventDefault();
                    setActive(i);
                    return;
                  }
                  router.push(monthHrefs[i], { scroll: false });
                }}
              />
            </g>
          );
        })}
        <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.35} />
      </svg>

      {point && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-44 rounded-xl bg-card px-3 py-2 text-footnote shadow-[0_4px_24px_rgba(0,0,0,0.14)] ring-1 ring-border"
          style={{ left: Math.min(Math.max(PAD.left + band * active + band / 2 - 88, 0), width - 176) }}
        >
          <p className="font-semibold">{MONTHS[active]}</p>
          {SERIES.map((s) => (
            <p key={s.key} className="mt-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
                {s.name.split(" ")[0]}
              </span>
              <span className="tabular-nums">{money(point[s.key], true)}</span>
            </p>
          ))}
          <p className="mt-1 flex justify-between border-t pt-1 text-muted-foreground">
            Diferencia <span className="tabular-nums text-foreground">{money(point.expenses - point.purchases, true)}</span>
          </p>
          <p className="mt-1 text-caption text-primary">{selected === point.month ? "Mes seleccionado · quitar filtro" : "Selecciona para filtrar"}</p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-footnote text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
