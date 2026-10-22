"use server";

import { extractCsfData, CsfValidationError, type CsfData } from "@/lib/ocr/csf";
import { AIExtractionError } from "@/lib/ai";
import { getCurrentUser } from "@/lib/session";
import { buildKey, putObject } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024;

export type ParseCsfResult = { ok: true; data: CsfData & { csfKey: string } } | { ok: false; error: string };

/** Recibe el PDF de la CSF, lo guarda y extrae RFC, razón social limpia, CP y régimen. */
export async function parseCsf(formData: FormData): Promise<ParseCsfResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No se recibió ningún archivo" };
  if (file.type !== "application/pdf") return { ok: false, error: "La CSF debe ser un PDF" };
  if (file.size > MAX_BYTES) return { ok: false, error: "El PDF excede 10 MB" };

  const pdf = Buffer.from(await file.arrayBuffer());
  // Firma mágica %PDF: no confiar sólo en el MIME que manda el navegador
  if (pdf.subarray(0, 4).toString() !== "%PDF") return { ok: false, error: "El archivo no es un PDF válido" };

  try {
    const user = await getCurrentUser();
    const [data, csfKey] = await Promise.all([
      extractCsfData(pdf),
      putObject(buildKey(user.id, "csf", "application/pdf"), pdf, "application/pdf"),
    ]);
    return { ok: true, data: { ...data, csfKey } };
  } catch (err) {
    if (err instanceof CsfValidationError || err instanceof AIExtractionError) return { ok: false, error: err.message };
    console.error("[parse-csf]", err);
    return { ok: false, error: "No se pudo procesar la constancia. Intenta de nuevo." };
  }
}
