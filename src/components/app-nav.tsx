"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Receipt, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Facturas", icon: Receipt, match: (p: string) => p === "/dashboard" || /^\/tickets\/(?!nuevo)/.test(p) },
  { href: "/tickets/nuevo", label: "Escanear", icon: Camera, match: (p: string) => p === "/tickets/nuevo" },
  { href: "/perfil", label: "Perfil", icon: UserRound, match: (p: string) => p.startsWith("/perfil") },
];

export function AppNav({ demo }: { demo: boolean }) {
  const pathname = usePathname();

  return (
    <>
      {/* iPad / escritorio: barra superior translúcida con control segmentado */}
      <header className="material sticky top-0 z-40 hidden border-b md:block">
        <nav className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-headline">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-primary text-white">
              <Receipt className="h-4 w-4" strokeWidth={2.4} />
            </span>
            FacturaSmart
            {demo && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-caption font-semibold text-warning">DEMO</span>}
          </Link>
          <div className="flex rounded-[10px] bg-muted p-0.5">
            {TABS.map(({ href, label, match }) => {
              const active = match(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-[8px] px-4 py-1.5 text-subhead font-medium transition-all",
                    active ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* iPhone / Android: barra de pestañas inferior respetando el home indicator */}
      <nav className="material pb-safe fixed inset-x-0 bottom-0 z-40 border-t md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {TABS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.3 : 1.8} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
