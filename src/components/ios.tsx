import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Título grande de iOS con subtítulo y acción opcional a la derecha. */
export function LargeTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-end justify-between gap-4 px-1 pb-2 pt-4 md:pt-8", className)}>
      <div className="min-w-0">
        <h1 className="text-large-title">{title}</h1>
        {subtitle && <div className="mt-0.5 truncate text-subhead text-muted-foreground">{subtitle}</div>}
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  );
}

/** Lista agrupada "inset" (UITableView.Style.insetGrouped). */
export function Section({
  header,
  headerAction,
  footer,
  children,
  className,
}: {
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-1.5", className)}>
      {(header || headerAction) && (
        <div className="flex items-end justify-between px-4">
          <h2 className="text-footnote text-muted-foreground">{header}</h2>
          {headerAction}
        </div>
      )}
      <div className="overflow-hidden rounded-[var(--radius)] bg-card [&>*:first-child_.row-sep]:border-t-0">
        {children}
      </div>
      {footer && <p className="px-4 text-footnote text-muted-foreground">{footer}</p>}
    </section>
  );
}

const TILE_COLORS = {
  blue: "bg-primary",
  green: "bg-success",
  orange: "bg-warning",
  red: "bg-destructive",
  indigo: "bg-indigo",
  teal: "bg-teal",
  gray: "bg-muted-foreground",
} as const;

export type TileColor = keyof typeof TILE_COLORS;

/** Ícono en "squircle" de color, como en Ajustes. */
export function IconTile({ icon: Icon, color = "blue", size = "md" }: { icon: LucideIcon; color?: TileColor; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-white",
        TILE_COLORS[color],
        size === "md" ? "h-[30px] w-[30px] rounded-[8px]" : "h-11 w-11 rounded-[12px]",
      )}
    >
      <Icon className={size === "md" ? "h-[18px] w-[18px]" : "h-6 w-6"} strokeWidth={2.2} />
    </span>
  );
}

/** Fila de lista: ícono, título/subtítulo, valor a la derecha y chevron si navega. */
export function Row({
  leading,
  title,
  subtitle,
  trailing,
  href,
  external,
  className,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  external?: boolean;
  className?: string;
}) {
  const content = (
    <>
      {leading}
      <div className="row-sep flex min-h-[44px] min-w-0 flex-1 items-center gap-3 border-t py-2.5 pr-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-body">{title}</div>
          {subtitle && <div className="truncate text-subhead text-muted-foreground">{subtitle}</div>}
        </div>
        {trailing && <div className="flex shrink-0 items-center gap-2 text-body text-muted-foreground">{trailing}</div>}
        {href && <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground/60" strokeWidth={2.5} />}
      </div>
    </>
  );
  const base = cn("flex items-center gap-3 pl-4", className);
  if (!href) return <div className={base}>{content}</div>;
  if (external)
    return (
      <a href={href} className={cn(base, "transition-colors active:bg-muted")}>
        {content}
      </a>
    );
  return (
    <Link href={href} className={cn(base, "transition-colors active:bg-muted")}>
      {content}
    </Link>
  );
}

/** Fila de formulario: etiqueta a la izquierda, control a la derecha, error debajo. */
export function FieldRow({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block pl-4">
      <div className="row-sep flex min-h-[44px] items-center gap-4 border-t py-2.5 pr-4">
        <span className="shrink-0 text-body">{label}</span>
        <div className="flex min-w-0 flex-1 justify-end">{children}</div>
      </div>
      {error && <p className="-mt-1 pb-2 pr-4 text-right text-footnote text-destructive">{error}</p>}
    </label>
  );
}

/** Estado vacío centrado con ícono grande. */
export function EmptyState({ icon: Icon, title, message, action }: { icon: LucideIcon; title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] bg-card px-6 py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </span>
      <div>
        <p className="text-headline">{title}</p>
        <p className="mx-auto mt-1 max-w-xs text-subhead text-muted-foreground">{message}</p>
      </div>
      {action}
    </div>
  );
}

/** Mensaje en línea (error / éxito / aviso). */
export function Notice({ tone, icon: Icon, children }: { tone: "error" | "success" | "warning"; icon: LucideIcon; children: React.ReactNode }) {
  const tones = {
    error: "bg-destructive/[0.1] text-destructive",
    success: "bg-success/[0.12] text-success",
    warning: "bg-warning/[0.12] text-warning",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-xl px-4 py-3 text-subhead", tones[tone])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
