import { z } from "zod";
import { extractStructured } from "../ai";
import { cleanRazonSocial } from "../sat-cleaner";
import { REGIMENES_FISCALES, RFC_REGEX } from "../sat-catalogs";

const CsfExtractionSchema = z.object({
  es_constancia_situacion_fiscal: z.boolean(),
  rfc: z.string().nullable(),
  nombre_o_razon_social: z.string().nullable(),
  regimen_capital: z.string().nullable(),
  codigo_postal: z.string().nullable(),
  regimenes: z.array(z.object({ clave: z.string(), descripcion: z.string() })),
});

const SYSTEM = `Eres un extractor de datos fiscales mexicanos. Lees Constancias de Situación Fiscal (CSF) emitidas por el SAT.
Reglas:
- "rfc": el RFC tal como aparece (12 caracteres persona moral, 13 persona física), sin espacios.
- "nombre_o_razon_social": para persona moral, el campo "Denominación/Razón Social"; para persona física, "Nombre(s)" + "Primer Apellido" + "Segundo Apellido" en ese orden. Cópialo literal.
- "regimen_capital": el campo "Régimen Capital" si existe (ej. "SOCIEDAD ANONIMA DE CAPITAL VARIABLE"), si no, null.
- "codigo_postal": el "Código Postal" del domicilio fiscal, 5 dígitos.
- "regimenes": cada régimen listado en la sección "Regímenes" con su clave numérica SAT de 3 dígitos (601, 612, 626, ...). Si la CSF sólo muestra la descripción, deduce la clave del catálogo c_RegimenFiscal.
- Si el documento no es una CSF, marca es_constancia_situacion_fiscal=false y deja los demás campos en null / [].
Nunca inventes datos que no estén en el documento.`;

export type CsfData = {
  rfc: string;
  razonSocial: string;
  razonSocialOriginal: string;
  codigoPostal: string;
  regimenFiscal: string;
  regimenesDisponibles: { clave: string; descripcion: string }[];
};

export class CsfValidationError extends Error {}

export async function extractCsfData(pdf: Buffer): Promise<CsfData> {
  const raw = await extractStructured({
    schema: CsfExtractionSchema,
    system: SYSTEM,
    instruction: "Extrae los datos fiscales de esta Constancia de Situación Fiscal.",
    attachment: { kind: "pdf", data: pdf },
  });

  if (!raw.es_constancia_situacion_fiscal) {
    throw new CsfValidationError("El PDF no parece ser una Constancia de Situación Fiscal del SAT");
  }

  const rfc = (raw.rfc ?? "").replace(/[\s-]/g, "").toUpperCase();
  if (!RFC_REGEX.test(rfc)) throw new CsfValidationError(`RFC inválido o ilegible: "${raw.rfc ?? ""}"`);

  const codigoPostal = (raw.codigo_postal ?? "").replace(/\D/g, "");
  if (codigoPostal.length !== 5) throw new CsfValidationError("No se encontró un Código Postal fiscal válido");

  const regimenes = raw.regimenes.filter((r) => r.clave in REGIMENES_FISCALES);
  if (regimenes.length === 0) throw new CsfValidationError("No se encontró un Régimen Fiscal válido");

  const original = raw.nombre_o_razon_social ?? "";
  const razonSocial = cleanRazonSocial(original, rfc);
  if (!razonSocial) throw new CsfValidationError("No se encontró el Nombre o Razón Social");

  return {
    rfc,
    razonSocial,
    razonSocialOriginal: original,
    codigoPostal,
    regimenFiscal: regimenes[0].clave,
    regimenesDisponibles: regimenes,
  };
}
