import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

// Instancia diferida: el constructor falla sin credenciales, y este módulo también
// se importa desde código que no llama al modelo (normalizadores, tests).
let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic());

export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5-5";

// Si los clasificadores de seguridad rechazan la solicitud, el API la re-ejecuta
// en el modelo de respaldo recomendado (server-side fallback).
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class AIExtractionError extends Error {}

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

type Attachment = { kind: "pdf"; data: Buffer } | { kind: "image"; data: Buffer; mediaType: ImageMediaType };

/** Una llamada de extracción estructurada (visión/PDF → JSON validado con Zod). */
export async function extractStructured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  instruction: string;
  attachment: Attachment;
}): Promise<z.infer<T>> {
  const fileBlock: Anthropic.ContentBlockParam =
    opts.attachment.kind === "pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: opts.attachment.data.toString("base64") },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: opts.attachment.mediaType, data: opts.attachment.data.toString("base64") },
        };

  const params = {
    model: AI_MODEL,
    max_tokens: 16000,
    system: opts.system,
    output_config: { effort: "medium" as const, format: zodOutputFormat(opts.schema) },
    messages: [{ role: "user" as const, content: [fileBlock, { type: "text" as const, text: opts.instruction }] }],
  };

  const response = await anthropic().messages.parse(
    { ...params, fallbacks: "default" } as typeof params,
    { headers: { "anthropic-beta": FALLBACK_BETA } },
  );

  if (response.stop_reason === "refusal") {
    throw new AIExtractionError("El modelo rechazó procesar el documento");
  }
  if (response.stop_reason === "max_tokens") {
    throw new AIExtractionError("Respuesta del modelo truncada");
  }
  if (!response.parsed_output) {
    throw new AIExtractionError("No se pudo interpretar la respuesta del modelo");
  }
  return response.parsed_output as z.infer<T>;
}

export function imageMediaType(mime: string): ImageMediaType {
  switch (mime) {
    case "image/png":
    case "image/webp":
    case "image/gif":
      return mime;
    default:
      // HEIC u otros: el cliente convierte a JPEG antes de subir (ver ticket-camera)
      return "image/jpeg";
  }
}
