"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, FileText, Loader2, UploadCloud, XCircle } from "lucide-react";
import { parseCsf } from "@/app/actions/parse-csf";
import { saveTaxProfile } from "@/app/actions/tax-profile";
import type { CsfData } from "@/lib/ocr/csf";
import { REGIMENES_FISCALES, USOS_CFDI } from "@/lib/sat-catalogs";
import { taxProfileSchema, type TaxProfileInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { FormField } from "@/components/form-field";

const MAX_BYTES = 10 * 1024 * 1024;

type Phase = { name: "idle" } | { name: "parsing"; fileName: string } | { name: "review"; csf: CsfData } | { name: "saved" };

export function CsfUploader({ onSaved }: { onSaved?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, startSaving] = useTransition();

  const form = useForm<TaxProfileInput>({ resolver: zodResolver(taxProfileSchema) });

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.type !== "application/pdf") return setError("Selecciona el PDF de tu Constancia de Situación Fiscal.");
    if (file.size > MAX_BYTES) return setError("El PDF excede 10 MB.");

    setPhase({ name: "parsing", fileName: file.name });
    const fd = new FormData();
    fd.append("file", file);
    const result = await parseCsf(fd);
    if (!result.ok) {
      setPhase({ name: "idle" });
      return setError(result.error);
    }

    const { csfKey, ...csf } = result.data;
    form.reset({
      rfc: csf.rfc,
      razonSocial: csf.razonSocial,
      codigoPostal: csf.codigoPostal,
      regimenFiscal: csf.regimenFiscal,
      usoCFDI: "G03",
      csfKey,
    });
    setPhase({ name: "review", csf });
  }

  const onSubmit = form.handleSubmit((values) =>
    startSaving(async () => {
      const res = await saveTaxProfile(values);
      if (!res.ok) return setError(res.error);
      setPhase({ name: "saved" });
      onSaved?.();
    }),
  );

  const errors = form.formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Constancia de Situación Fiscal</CardTitle>
        <CardDescription>
          Sube el PDF de tu CSF del SAT. Extraemos RFC, nombre, CP y régimen fiscal para tus facturas CFDI 4.0.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(phase.name === "idle" || phase.name === "parsing") && (
          <button
            type="button"
            disabled={phase.name === "parsing"}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleFile(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/60",
            )}
          >
            {phase.name === "parsing" ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium">Leyendo {phase.fileName}…</span>
                <span className="text-xs text-muted-foreground">Esto toma unos segundos</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Arrastra tu CSF aquí o haz clic para seleccionarla</span>
                <span className="text-xs text-muted-foreground">PDF, máximo 10 MB</span>
              </>
            )}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {phase.name === "review" && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
              <FileText className="h-4 w-4 shrink-0" />
              <span>Revisa los datos extraídos antes de guardarlos.</span>
            </div>

            <FormField label="RFC" error={errors.rfc?.message}>
              <Input {...form.register("rfc")} className="font-mono uppercase" />
            </FormField>

            <FormField
              label="Nombre / Razón Social (CFDI 4.0)"
              error={errors.razonSocial?.message}
              hint={
                phase.csf.razonSocialOriginal !== phase.csf.razonSocial
                  ? `En la CSF: "${phase.csf.razonSocialOriginal}". Se omite el régimen capital, como exige CFDI 4.0.`
                  : undefined
              }
            >
              <Input {...form.register("razonSocial")} className="uppercase" />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Código Postal fiscal" error={errors.codigoPostal?.message}>
                <Input {...form.register("codigoPostal")} inputMode="numeric" maxLength={5} />
              </FormField>
              <FormField label="Régimen Fiscal" error={errors.regimenFiscal?.message}>
                <NativeSelect {...form.register("regimenFiscal")}>
                  {(phase.csf.regimenesDisponibles.length > 1
                    ? phase.csf.regimenesDisponibles.map((r) => r.clave)
                    : Object.keys(REGIMENES_FISCALES)
                  ).map((clave) => (
                    <option key={clave} value={clave}>
                      {clave} - {REGIMENES_FISCALES[clave]}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>

            <FormField label="Uso de CFDI predeterminado" error={errors.usoCFDI?.message}>
              <NativeSelect {...form.register("usoCFDI")}>
                {Object.entries(USOS_CFDI).map(([clave, desc]) => (
                  <option key={clave} value={clave}>
                    {clave} - {desc}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Guardar perfil fiscal
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPhase({ name: "idle" })} disabled={saving}>
                Subir otra
              </Button>
            </div>
          </form>
        )}

        {phase.name === "saved" && (
          <div className="flex items-center gap-2 rounded-md bg-primary/10 p-3 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Perfil fiscal guardado. Ya puedes facturar tus tickets.
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

