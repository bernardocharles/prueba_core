/**
 * Prueba de integración del OCR contra fotos reales en public/samples/.
 * Llama al API de Claude (cuesta tokens): se salta si no hay ANTHROPIC_API_KEY o no hay muestras.
 *
 * Por cada imagen `X.jpg` puede existir `X.expected.json` con los campos esperados
 * (subconjunto de TicketData). Sin ese archivo sólo se valida que se reconozca como ticket.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractTicketData, type TicketData } from "@/lib/ocr/ticket";

const DIR = path.resolve("public/samples");
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const samples = existsSync(DIR) ? readdirSync(DIR).filter((f) => path.extname(f).toLowerCase() in MIME) : [];
const enabled = Boolean(process.env.ANTHROPIC_API_KEY) && samples.length > 0;

describe.skipIf(!enabled)("OCR de tickets (muestras reales)", () => {
  it.each(samples)("%s", async (file) => {
    const ext = path.extname(file).toLowerCase();
    const data = await extractTicketData(readFileSync(path.join(DIR, file)), MIME[ext]);

    const expectedPath = path.join(DIR, file.slice(0, -ext.length) + ".expected.json");
    if (!existsSync(expectedPath)) {
      console.info(`[${file}] sin .expected.json; resultado:\n${JSON.stringify(data, null, 2)}`);
      expect(data.tienda_nombre).toBeTruthy();
      return;
    }

    const expected = JSON.parse(readFileSync(expectedPath, "utf8")) as Partial<TicketData>;
    const { datos_contacto: expectedContact, monto_total: expectedTotal, ...rest } = expected;
    expect(data).toMatchObject(rest);
    if (expectedTotal != null) expect(data.monto_total).toBeCloseTo(expectedTotal, 2);
    if (expectedContact) expect(data.datos_contacto).toMatchObject(expectedContact);
  });
});
