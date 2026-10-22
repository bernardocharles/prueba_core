"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, FileUp, Loader2, XCircle } from "lucide-react";
import { parseCsf } from "@/app/actions/parse-csf";
import { saveTaxProfile } from "@/app/actions/tax-profile";
import type { CsfData } from "@/lib/ocr/csf";
import { REGIMENES_FISCALES, USOS_CFDI } from "@/lib/sat-catalogs";
import { taxProfileSchema, type TaxProfileInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { FieldRow, Notice, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";

const MAX_BYTES = 10 * 1024 * 1024;

type Phase = { name: "idle" } | { name: "parsing"; fileName: string } | { name: "review"; csf: CsfData } | { name: "saved" };

export function CsfUploader({ hasProfile }: { hasProfile: boolean }) {
  const router = useRouter();
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
      router.refresh();
    }),
  );

  const errors = form.formState.errors;

  if (phase.name === "review") {
    const { csf } = phase;
    const regimenes = csf.regimenesDisponibles.length > 1 ? csf.regimenesDisponibles.map((r) => r.clave) : Object.keys(REGIMENES_FISCALES);
    return (
      <form onSubmit={onSubmit} className="space-y-7">
        <Section
          header="Datos fiscales detectados"
          footer={
            csf.razonSocialOriginal !== csf.razonSocial
              ? `En tu CSF aparece “${csf.razonSocialOriginal}”. CFDI 4.0 pide el nombre sin el régimen capital.`
              : "Revisa que coincidan exactamente con tu constancia."
          }
        >
          <FieldRow label="RFC" error={errors.rfc?.message}>
            <Input {...form.register("rfc")} className="font-mono uppercase" autoCapitalize="characters" />
          </FieldRow>
          <FieldRow label="Nombre" error={errors.razonSocial?.message}>
            <Input {...form.register("razonSocial")} className="uppercase" autoCapitalize="characters" />
          </FieldRow>
          <FieldRow label="C.P. fiscal" error={errors.codigoPostal?.message}>
            <Input {...form.register("codigoPostal")} inputMode="numeric" maxLength={5} />
          </FieldRow>
        </Section>

        <Section header="Para tus facturas">
          <FieldRow label="Régimen" error={errors.regimenFiscal?.message}>
            <NativeSelect {...form.register("regimenFiscal")}>
              {regimenes.map((clave) => (
                <option key={clave} value={clave}>
                  {clave} · {REGIMENES_FISCALES[clave]}
                </option>
              ))}
            </NativeSelect>
          </FieldRow>
          <FieldRow label="Uso de CFDI" error={errors.usoCFDI?.message}>
            <NativeSelect {...form.register("usoCFDI")}>
              {Object.entries(USOS_CFDI).map(([clave, desc]) => (
                <option key={clave} value={clave}>
                  {clave} · {desc}
                </option>
              ))}
            </NativeSelect>
          </FieldRow>
        </Section>

        {error && (
          <Notice tone="error" icon={XCircle}>
            {error}
          </Notice>
        )}

        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Guardar perfil fiscal
          </Button>
          <Button type="button" size="lg" variant="gray" onClick={() => setPhase({ name: "idle" })} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {phase.name === "saved" && (
        <Notice tone="success" icon={Check}>
          Perfil fiscal guardado. Ya puedes facturar tus tickets.
        </Notice>
      )}
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
          "press flex w-full flex-col items-center justify-center gap-3 rounded-[var(--radius)] border-2 border-dashed bg-card px-6 py-9 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-transparent",
        )}
      >
        {phase.name === "parsing" ? (
          <>
            <Loader2 className="h-9 w-9 animate-spin text-primary" />
            <span className="text-headline">Leyendo constancia…</span>
            <span className="max-w-[16rem] truncate text-subhead text-muted-foreground">{phase.fileName}</span>
          </>
        ) : (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-primary/[0.12] text-primary">
              <FileUp className="h-7 w-7" />
            </span>
            <span className="text-headline">{hasProfile ? "Actualizar Constancia" : "Subir Constancia de Situación Fiscal"}</span>
            <span className="text-subhead text-muted-foreground">PDF descargado del SAT · máx. 10 MB</span>
          </>
        )}
      </button>
      {error && (
        <Notice tone="error" icon={XCircle}>
          {error}
        </Notice>
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
    </div>
  );
}
