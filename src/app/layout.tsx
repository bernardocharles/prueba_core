import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FacturaSmart MX",
  description: "Factura tus tickets de compra con una foto",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen">
        <header className="border-b">
          <nav className="container flex h-14 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Receipt className="h-5 w-5 text-primary" /> FacturaSmart MX
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/dashboard" className="hover:text-primary">Facturas</Link>
              <Link href="/tickets/nuevo" className="hover:text-primary">Nuevo ticket</Link>
              <Link href="/perfil" className="hover:text-primary">Perfil fiscal</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
