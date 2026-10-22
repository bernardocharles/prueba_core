"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MONTHS } from "./format";

type Option = { value: string; label: string };

/** Filtros del tablero en una fila: viven en la URL, así que se comparten y sobreviven a recargas. */
export function FilterBar({
  years,
  stores,
  categories,
}: {
  years: number[];
  stores: { key: string; label: string }[];
  categories: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  };

  const origin = params.get("origen") ?? "";
  const active = ["mes", "tienda", "categoria", "origen"].some((k) => params.get(k));

  return (
    <div className="space-y-3">
      {/* Control segmentado: origen de los datos */}
      <div className="flex rounded-[10px] bg-muted p-0.5" role="tablist" aria-label="Origen">
        {[
          { v: "", l: "Todo" },
          { v: "gastos", l: "Gastos" },
          { v: "compras", l: "Compras" },
        ].map(({ v, l }) => (
          <button
            key={l}
            role="tab"
            aria-selected={origin === v}
            onClick={() => set("origen", v || null)}
            className={cn(
              "flex-1 rounded-[8px] py-1.5 text-subhead font-medium transition-all",
              origin === v ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#636366]" : "text-muted-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        <Pill
          label="Año"
          value={params.get("anio") ?? String(years[0])}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          onChange={(v) => set("anio", v)}
          alwaysActive
        />
        <Pill
          label="Mes"
          value={params.get("mes") ?? ""}
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          onChange={(v) => set("mes", v)}
          allLabel="Todo el año"
        />
        <Pill
          label="Categoría"
          value={params.get("categoria") ?? ""}
          options={categories.map((c) => ({ value: c, label: c }))}
          onChange={(v) => set("categoria", v)}
          allLabel="Todas"
        />
        <Pill
          label="Tienda"
          value={params.get("tienda") ?? ""}
          options={stores.map((s) => ({ value: s.key, label: s.label }))}
          onChange={(v) => set("tienda", v)}
          allLabel="Todas"
        />
        {active && (
          <button
            onClick={() => start(() => router.replace(`${pathname}?${params.get("anio") ? `anio=${params.get("anio")}` : ""}`, { scroll: false }))}
            className="press flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-subhead text-primary"
          >
            Limpiar
          </button>
        )}
        {pending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}

/** Píldora con <select> nativo encima: abre el picker del sistema en iOS/Android. */
function Pill({
  label,
  value,
  options,
  onChange,
  allLabel,
  alwaysActive,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string | null) => void;
  allLabel?: string;
  alwaysActive?: boolean;
}) {
  const selected = options.find((o) => o.value === value);
  const on = Boolean(selected) && (alwaysActive || value !== "");
  return (
    <div
      className={cn(
        "relative flex h-8 shrink-0 items-center gap-1 rounded-full pl-3 text-subhead font-medium transition-colors",
        on && !alwaysActive ? "bg-primary pr-1 text-primary-foreground" : "bg-card pr-2.5 text-foreground",
      )}
    >
      <span className={cn(!on && "text-muted-foreground")}>{on ? selected!.label : label}</span>
      {on && !alwaysActive ? (
        <button
          aria-label={`Quitar filtro ${label}`}
          onClick={() => onChange(null)}
          className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/20"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      ) : (
        <ChevronDown className="h-3.5 w-3.5 opacity-60" strokeWidth={2.5} />
      )}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn("absolute inset-0 cursor-pointer opacity-0", on && !alwaysActive && "right-8")}
      >
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
