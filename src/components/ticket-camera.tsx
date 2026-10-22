"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Camera, CheckCircle2, ImageUp, Loader2, XCircle } from "lucide-react";
import type { ChannelType } from "@prisma/client";
import { parseTicket, type ParseTicketResult } from "@/app/actions/parse-ticket";
import { requestInvoice } from "@/app/actions/request-invoice";
import { ticketCorrectionsSchema, type TicketCorrections, type TicketCorrectionsOutput } from "@/lib/schemas";
import { formatMXN } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChannelBadge, CHANNEL_META } from "@/components/channel-badge";
import { FormField } from "@/components/form-field";

const MAX_SIDE = 2000;

/**
 * Reduce la foto a ≤2000px y la recodifica a JPEG: las fotos de celular pesan 4-10 MB
 * y 2000px es suficiente para leer un ticket térmico. También convierte HEIC en Safari.
 */
async function prepareImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    if (!blob) throw new Error("toBlob falló");
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file; // el servidor valida el formato
  }
}

type Parsed = Extract<ParseTicketResult, { ok: true }>;

export function TicketCamera() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentVia, setSentVia] = useState<ChannelType | null>(null);
  const [reading, startReading] = useTransition();
  const [sending, startSending] = useTransition();

  const form = useForm<TicketCorrections, unknown, TicketCorrectionsOutput>({ resolver: zodResolver(ticketCorrectionsSchema) });

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setParsed(null);
    setError(null);
    setSentVia(null);
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    reset();
    if (!file.type.startsWith("image/")) return setError("Selecciona una imagen del ticket.");
    setPreview(URL.createObjectURL(file));

    startReading(async () => {
      const fd = new FormData();
      fd.append("file", await prepareImage(file));
      const result = await parseTicket(fd);
      if (!result.ok) return setError(result.error);
      setParsed(result);
      const d = result.data;
      form.reset({
        ticketFolio: d.folio_ticket,
        billingCode: d.codigo_facturacion,
        ticketDate: d.fecha_compra,
        totalAmount: d.monto_total,
        whatsapp: d.datos_contacto.whatsapp,
        email: d.datos_contacto.email,
      });
    });
  }

  const onSubmit = form.handleSubmit((values) =>
    startSending(async () => {
      if (!parsed) return;
      setError(null);
      const res = await requestInvoice(parsed.ticketId, values);
      if (!res.ok) return setError(res.error);
      setSentVia(res.channel);
    }),
  );

  const errors = form.formState.errors;
  const channel = parsed?.routing.channel;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo ticket</CardTitle>
        <CardDescription>Toma una foto nítida del ticket completo, con buena luz y sin reflejos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!preview && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" onClick={() => cameraRef.current?.click()}>
              <Camera /> Tomar foto
            </Button>
            <Button size="lg" variant="outline" onClick={() => galleryRef.current?.click()}>
              <ImageUp /> Subir imagen
            </Button>
          </div>
        )}
        {/* capture="environment" abre directo la cámara trasera en iOS/Android */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {preview && (
          <div className="grid gap-6 md:grid-cols-[minmax(0,240px)_1fr]">
            <div className="relative overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: local, next/image no aplica */}
              <img src={preview} alt="Ticket" className="max-h-96 w-full object-contain" />
              {reading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  Leyendo ticket…
                </div>
              )}
            </div>

            {parsed && !sentVia && (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <p className="text-lg font-semibold">{parsed.data.tienda_nombre ?? "Comercio no identificado"}</p>
                  <p className="text-sm text-muted-foreground">
                    RFC emisor: <span className="font-mono">{parsed.data.rfc_emisor ?? "—"}</span> · Total detectado:{" "}
                    {formatMXN(parsed.data.monto_total)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Folio / No. de ticket" error={errors.ticketFolio?.message}>
                    <Input {...form.register("ticketFolio")} className="font-mono" />
                  </FormField>
                  <FormField label="Código de facturación" error={errors.billingCode?.message}>
                    <Input {...form.register("billingCode")} className="font-mono" />
                  </FormField>
                  <FormField label="Fecha de compra" error={errors.ticketDate?.message}>
                    <Input type="date" {...form.register("ticketDate")} />
                  </FormField>
                  <FormField label="Total (MXN)" error={errors.totalAmount?.message}>
                    <Input type="number" step="0.01" inputMode="decimal" {...form.register("totalAmount")} />
                  </FormField>
                  <FormField label="WhatsApp de facturación" error={errors.whatsapp?.message}>
                    <Input type="tel" {...form.register("whatsapp")} placeholder="+52…" />
                  </FormField>
                  <FormField label="Correo de facturación" error={errors.email?.message}>
                    <Input type="email" {...form.register("email")} />
                  </FormField>
                </div>

                <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Canal sugerido:</span>
                    {channel ? <ChannelBadge channel={channel} /> : <Badge variant="warning">Manual</Badge>}
                  </div>
                  {parsed.routing.warnings.map((w) => (
                    <p key={w} className="flex gap-2 text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {w}
                    </p>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={sending}>
                    {sending && <Loader2 className="animate-spin" />}
                    Solicitar factura
                  </Button>
                  <Button type="button" variant="ghost" onClick={reset} disabled={sending}>
                    Otro ticket
                  </Button>
                </div>
              </form>
            )}

            {sentVia && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md bg-primary/10 p-3 text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  Solicitud enviada por {CHANNEL_META[sentVia].label}. Te avisaremos cuando llegue la factura.
                </div>
                <div className="flex gap-2">
                  <Button asChild>
                    <Link href="/dashboard">Ver mis facturas</Link>
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    Otro ticket
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center justify-between gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <span className="flex items-center gap-2">
              <XCircle className="h-4 w-4 shrink-0" />
              {error}
            </span>
            {!parsed && (
              <Button size="sm" variant="outline" onClick={reset}>
                Reintentar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

