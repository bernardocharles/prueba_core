import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ExpenseImporter } from "@/components/analytics/expense-importer";
import { LargeTitle } from "@/components/ios";

export default function ImportarPage() {
  return (
    <main className="space-y-5 pt-2 md:pt-6">
      <Link href="/analisis" className="press -ml-1 inline-flex items-center text-body text-primary">
        <ChevronLeft className="h-6 w-6" strokeWidth={2.4} /> Análisis
      </Link>
      <LargeTitle title="Importar gastos" subtitle="Compáralos contra tus tickets y facturas" className="pt-0 md:pt-0" />
      <ExpenseImporter />
    </main>
  );
}
