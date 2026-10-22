"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Download, FileSpreadsheet, Loader2, XCircle } from "lucide-react";
import { importExpenses, previewExpenseFile, type ExpensePreview } from "@/app/actions/expenses";
import { FIELD_LABELS, FIELDS, type ColumnMapping, type Field } from "@/lib/expense-fields";
import { cn } from "@/lib/utils";
import { FieldRow, Notice, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";

type Preview = Extract<ExpensePreview, { ok: true }>;
type Result = { imported: number; skipped: number; matched: number };

const REQUIRED: Field[] = ["date", "amount"];

export function ExpenseImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, startReading] = useTransition();
  const [importing, startImporting] = useTransition();

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    startReading(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await previewExpenseFile(fd);
      if (!res.ok) return setError(res.error);
      setPreview(res);
      setMapping(res.mapping);
    });
  }

  function runImport() {
    if (!preview) return;
    startImporting(async () => {
      setError(null);
      const res = await importExpenses({ key: preview.key, fileName: preview.fileName, mapping });
      if (!res.ok) return setError(res.error);
      setResult(res);
      setPreview(null);
    });
  }

  if (result) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-[var(--radius)] bg-card px-6 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-white">
          <Check className="h-8 w-8" strokeWidth={3} />
        </span>
        <div>
          <p className="text-title-2">{result.imported} gastos importados</p>
          <p className="mt-1 text-subhead text-muted-foreground">
            {result.matched} coinciden con tickets escaneados
            {result.skipped > 0 && ` · ${result.skipped} filas omitidas por fecha o monto inválido`}
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/analisis">Ver análisis</Link>
          </Button>
          <Button size="lg" variant="tinted" onClick={() => setResult(null)}>
            Importar otro archivo
          </Button>
        </div>
      </div>
    );
  }

  if (preview) {
    const missing = REQUIRED.filter((f) => mapping[f] === undefined);
    return (
      <div className="space-y-7">
        <Section header="Archivo" footer={`${preview.rowCount} filas detectadas. Confirma qué columna corresponde a cada dato.`}>
          <div className="flex items-center gap-3 py-3 pl-4 pr-4">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-success text-white">
              <FileSpreadsheet className="h-[18px] w-[18px]" />
            </span>
            <span className="truncate text-body">{preview.fileName}</span>
          </div>
        </Section>

        <Section header="Columnas" footer="Fecha y Monto son obligatorias; si no hay categoría la inferimos por el nombre de la tienda.">
          {FIELDS.map((f) => (
            <FieldRow key={f} label={FIELD_LABELS[f]}>
              <NativeSelect
                value={mapping[f] ?? ""}
                onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                className={cn(mapping[f] !== undefined && "text-foreground")}
              >
                <option value="">— Ninguna —</option>
                {preview.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </NativeSelect>
            </FieldRow>
          ))}
        </Section>

        <Section header="Vista previa">
          <div className="overflow-x-auto">
            <table className="w-full text-footnote">
              <thead>
                <tr className="text-left text-muted-foreground">
                  {FIELDS.filter((f) => mapping[f] !== undefined).map((f) => (
                    <th key={f} className="whitespace-nowrap px-4 py-2 font-medium">
                      {FIELD_LABELS[f]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((row, r) => (
                  <tr key={r} className="border-t">
                    {FIELDS.filter((f) => mapping[f] !== undefined).map((f) => (
                      <td key={f} className={cn("whitespace-nowrap px-4 py-2", f === "amount" && "text-right tabular-nums")}>
                        {row[mapping[f]!] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {error && (
          <Notice tone="error" icon={XCircle}>
            {error}
          </Notice>
        )}

        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={runImport} disabled={importing || missing.length > 0}>
            {importing && <Loader2 className="animate-spin" />}
            {missing.length ? `Falta: ${missing.map((f) => FIELD_LABELS[f]).join(", ")}` : `Importar ${preview.rowCount} filas`}
          </Button>
          <Button size="lg" variant="gray" onClick={() => setPreview(null)} disabled={importing}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <button
        type="button"
        disabled={reading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "press flex w-full flex-col items-center gap-3 rounded-[var(--radius)] border-2 border-dashed bg-card px-6 py-10 text-center",
          dragging ? "border-primary bg-primary/5" : "border-transparent",
        )}
      >
        {reading ? (
          <>
            <Loader2 className="h-9 w-9 animate-spin text-primary" />
            <span className="text-headline">Leyendo archivo…</span>
          </>
        ) : (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-success/[0.14] text-success">
              <FileSpreadsheet className="h-7 w-7" />
            </span>
            <span className="text-headline">Subir Excel de gastos</span>
            <span className="text-subhead text-muted-foreground">.xlsx, .xls o .csv · máx. 5 MB · hasta 5,000 filas</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <Notice tone="error" icon={XCircle}>
          {error}
        </Notice>
      )}
      <Section
        header="Formato"
        footer="Sirve tu estado de cuenta o tu hoja de gastos: detectamos las columnas automáticamente. Los cargos negativos se toman como gasto."
      >
        <a href="/api/expenses/template" className="press flex items-center gap-3 py-3 pl-4 pr-4 text-body text-primary active:bg-muted">
          <Download className="h-5 w-5" />
          Descargar plantilla de ejemplo
        </a>
      </Section>
    </div>
  );
}
