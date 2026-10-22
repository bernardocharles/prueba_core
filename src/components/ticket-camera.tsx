"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Camera, Check, ImageIcon, Loader2, ScanLine, Sun, XCircle } from "lucide-react";
import type { ChannelType } from "@prisma/client";
import { parseTicket, type ParseTicketResult } from "@/app/actions/parse-ticket";
import { requestInvoice } from "@/app/actions/request-invoice";
import { ticketCorrectionsSchema, type TicketCorrections, type TicketCorrectionsOutput } from "@/lib/schemas";
import { formatMXN } from "@/lib/utils";
import { CHANNEL_META, ChannelTile } from "@/components/channel-badge";
import { FieldRow, LargeTitle, Notice, Row, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [sentVia, setSentVia] = useState<{ channel: ChannelType; ticketId: string } | null>(null);
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
      setSentVia({ channel: res.channel, ticketId: parsed.ticketId });
    }),
  );

  const errors = form.formState.errors;
  const channel = parsed?.routing.channel ?? null;

  const pickers = (
    <>
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
    </>
  );

  // ── Confirmación ──────────────────────────────────────────────
  if (sentVia) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 text-center">
        <span className="flex h-20 w-20 animate-in zoom-in-50 items-center justify-center rounded-full bg-success text-white duration-300">
          <Check className="h-10 w-10" strokeWidth={3} />
        </span>
        <div className="space-y-1">
          <h1 className="text-title-2">Solicitud enviada</h1>
          <p className="mx-auto max-w-xs text-subhead text-muted-foreground">
            Pedimos tu factura por {CHANNEL_META[sentVia.channel].label}. Te avisamos en cuanto el comercio responda.
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Button asChild size="lg">
            <Link href={`/tickets/${sentVia.ticketId}`}>Ver estado</Link>
          </Button>
          <Button size="lg" variant="tinted" onClick={reset}>
            Escanear otro ticket
          </Button>
        </div>
      </div>
    );
  }

  // ── Inicio ────────────────────────────────────────────────────
  if (!preview) {
    return (
      <div className="space-y-7">
        <LargeTitle title="Escanear" subtitle="Funciona con cualquier ticket de México" />
        <div className="flex flex-col items-center gap-6 rounded-[var(--radius)] bg-card px-6 py-10 text-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-b from-primary to-indigo text-white shadow-lg shadow-primary/25">
            <ScanLine className="h-12 w-12" strokeWidth={1.8} />
          </span>
          <div className="space-y-1">
            <p className="text-headline">Toma una foto del ticket completo</p>
            <p className="mx-auto max-w-xs text-subhead text-muted-foreground">
              Leemos la tienda, el total, el folio y cómo facturar. Tú sólo confirmas.
            </p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-3">
            <Button size="lg" onClick={() => cameraRef.current?.click()}>
              <Camera /> Tomar foto
            </Button>
            <Button size="lg" variant="tinted" onClick={() => galleryRef.current?.click()}>
              <ImageIcon /> Elegir de Fotos
            </Button>
          </div>
        </div>
        <Section header="Consejos" footer="Los tickets térmicos se borran con el tiempo: escanéalos el mismo día.">
          <Row leading={<Tip icon={Sun} />} title="Buena luz, sin reflejos" />
          <Row leading={<Tip icon={ScanLine} />} title="Que se vea el ticket completo" />
        </Section>
        {error && (
          <Notice tone="error" icon={XCircle}>
            {error}
          </Notice>
        )}
        {pickers}
      </div>
    );
  }

  // ── Lectura y revisión ────────────────────────────────────────
  return (
    <form onSubmit={onSubmit} className="space-y-7 pt-4 md:pt-8">
      <div className="flex items-center gap-4 px-1">
        <div className="relative h-24 w-[72px] shrink-0 overflow-hidden rounded-xl bg-muted shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob: local */}
          <img src={preview} alt="Ticket" className="h-full w-full object-cover" />
          {reading && <div className="absolute inset-x-0 top-0 h-1/3 animate-[scan_1.4s_ease-in-out_infinite] bg-gradient-to-b from-primary/0 via-primary/40 to-primary/0" />}
        </div>
        <div className="min-w-0">
          {reading ? (
            <>
              <p className="text-headline">Leyendo ticket…</p>
              <p className="text-subhead text-muted-foreground">Esto toma unos segundos</p>
            </>
          ) : parsed ? (
            <>
              <p className="truncate text-title-2">{parsed.data.tienda_nombre ?? "Comercio sin identificar"}</p>
              <p className="text-subhead text-muted-foreground">
                {formatMXN(parsed.data.monto_total)}
                {parsed.data.rfc_emisor && <span className="font-mono"> · {parsed.data.rfc_emisor}</span>}
              </p>
            </>
          ) : (
            <p className="text-headline">No se pudo leer</p>
          )}
        </div>
      </div>

      {reading && <ReviewSkeleton />}

      {parsed && (
        <>
          <Section header="Datos del ticket" footer="Revisa que coincidan con el ticket; puedes corregirlos.">
            <FieldRow label="Folio" error={errors.ticketFolio?.message}>
              <Input {...form.register("ticketFolio")} className="font-mono" placeholder="Opcional" />
            </FieldRow>
            <FieldRow label="Código" error={errors.billingCode?.message}>
              <Input {...form.register("billingCode")} className="font-mono" placeholder="Opcional" />
            </FieldRow>
            <FieldRow label="Fecha" error={errors.ticketDate?.message}>
              <Input type="date" {...form.register("ticketDate")} />
            </FieldRow>
            <FieldRow label="Total" error={errors.totalAmount?.message}>
              <Input type="number" step="0.01" inputMode="decimal" {...form.register("totalAmount")} placeholder="0.00" />
            </FieldRow>
          </Section>

          <Section header="Contacto del comercio">
            <FieldRow label="WhatsApp" error={errors.whatsapp?.message}>
              <Input type="tel" {...form.register("whatsapp")} placeholder="+52…" />
            </FieldRow>
            <FieldRow label="Correo" error={errors.email?.message}>
              <Input type="email" autoCapitalize="none" {...form.register("email")} placeholder="facturas@…" />
            </FieldRow>
          </Section>

          <Section
            header="Enviaremos la solicitud por"
            footer={parsed.routing.warnings.length ? undefined : "Incluye la foto del ticket y tu Constancia de Situación Fiscal."}
          >
            <Row
              leading={<ChannelTile channel={channel} />}
              title={channel ? CHANNEL_META[channel].label : "Facturación manual"}
              subtitle={parsed.routing.candidates.find((c) => c.channel === channel)?.reason ?? "No encontramos un canal automático"}
            />
          </Section>

          {parsed.routing.warnings.map((w) => (
            <Notice key={w} tone="warning" icon={AlertTriangle}>
              {w}
            </Notice>
          ))}
        </>
      )}

      {error && (
        <Notice tone="error" icon={XCircle}>
          {error}
        </Notice>
      )}

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+52px)] z-30 -mx-4 flex flex-col gap-3 bg-gradient-to-t from-background from-70% to-transparent px-4 pb-3 pt-8 md:bottom-0 md:-mx-6 md:px-6 md:pb-6">
        {parsed && (
          <Button type="submit" size="lg" disabled={sending} className="shadow-lg shadow-primary/20">
            {sending && <Loader2 className="animate-spin" />}
            Solicitar factura
          </Button>
        )}
        {!reading && (
          <Button type="button" size="lg" variant="gray" onClick={reset} disabled={sending}>
            {parsed ? "Cancelar" : "Intentar con otra foto"}
          </Button>
        )}
      </div>
      {pickers}
    </form>
  );
}

function Tip({ icon: Icon }: { icon: typeof Sun }) {
  return (
    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-muted text-primary">
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

function ReviewSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="mx-4 h-3 w-28 animate-pulse rounded bg-muted" />
      <div className="space-y-px overflow-hidden rounded-[var(--radius)] bg-card">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex h-11 items-center justify-between px-4">
            <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
