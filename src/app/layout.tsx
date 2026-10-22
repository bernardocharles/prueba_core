import type { Metadata, Viewport } from "next";
import { AppNav } from "@/components/app-nav";
import { isDemoMode } from "@/lib/demo";
import "./globals.css";

export const metadata: Metadata = {
  title: "FacturaSmart MX",
  description: "Factura tus tickets de compra con una foto",
  applicationName: "FacturaSmart",
  appleWebApp: { capable: true, title: "FacturaSmart", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemoMode();
  return (
    <html lang="es-MX">
      <body className="min-h-dvh">
        <AppNav demo={demo} />
        <div className="pt-safe mx-auto w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+88px)] md:px-6 md:pb-16">
          {children}
        </div>
      </body>
    </html>
  );
}
