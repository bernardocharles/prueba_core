import { isPersonaMoral } from "./sat-catalogs";

/**
 * Limpieza de Nombre / Razón Social del receptor para CFDI 4.0:
 * - MAYÚSCULAS, espacios normalizados.
 * - Sin régimen capital (S.A. DE C.V., S. DE R.L., S.C., A.C., ...), sólo personas morales.
 *
 * El SAT valida contra el nombre registrado tal cual: se conservan acentos y Ñ.
 */

// Abreviaturas en su forma "canónica"; el patrón tolera puntos/espacios opcionales
// entre letras, así que "SA DE CV", "S.A. de C.V." y "S. A. DE C. V." se reconocen igual.
const REGIMENES_ABREVIADOS = [
  "S.A.P.I. DE C.V.",
  "S.A.P.I.",
  "S.A.B. DE C.V.",
  "S.A.B.",
  "S.A.S. DE C.V.",
  "S.A.S.",
  "S.A. DE C.V.",
  "S.A.",
  "S. DE R.L. DE C.V.",
  "S. DE R.L. MI.",
  "S. DE R.L.",
  "S. EN C. POR A. DE C.V.",
  "S. EN C. POR A.",
  "S. EN C. DE C.V.",
  "S. EN C.",
  "S. EN N.C. DE C.V.",
  "S. EN N.C.",
  "S.C. DE R.L. DE C.V.",
  "S.C. DE R.L.",
  "S.C. DE R.S.",
  "S.C. DE C.V.",
  "S.C.P.",
  "S.C.",
  "A.C.",
  "S.P.R. DE R.L. DE C.V.",
  "S.P.R. DE R.L.",
  "S.P.R. DE R.I.",
  "S.N.C.",
  "I.A.P.",
  "I.B.P.",
];

const REGIMENES_EXTENDIDOS = [
  String.raw`SOCIEDAD AN[OÓ]NIMA PROMOTORA DE INVERSI[OÓ]N DE CAPITAL VARIABLE`,
  String.raw`SOCIEDAD AN[OÓ]NIMA BURS[AÁ]TIL DE CAPITAL VARIABLE`,
  String.raw`SOCIEDAD AN[OÓ]NIMA DE CAPITAL VARIABLE`,
  String.raw`SOCIEDAD AN[OÓ]NIMA`,
  String.raw`SOCIEDAD DE RESPONSABILIDAD LIMITADA DE CAPITAL VARIABLE`,
  String.raw`SOCIEDAD DE RESPONSABILIDAD LIMITADA`,
  String.raw`SOCIEDAD POR ACCIONES SIMPLIFICADA DE CAPITAL VARIABLE`,
  String.raw`SOCIEDAD POR ACCIONES SIMPLIFICADA`,
  String.raw`SOCIEDAD CIVIL`,
  String.raw`ASOCIACI[OÓ]N CIVIL`,
  String.raw`INSTITUCI[OÓ]N DE ASISTENCIA PRIVADA`,
];

const WORDS = new Set(["DE", "EN", "POR"]);

function abbreviationToPattern(abbr: string) {
  return abbr
    .split(/\s+/)
    .map((token) => {
      if (WORDS.has(token)) return token;
      const letters = token.replace(/\./g, "").split("");
      return letters.map((l) => `${l}\\.?`).join("\\s*");
    })
    .join("\\s*");
}

const SUFFIX_PATTERN = [
  ...REGIMENES_ABREVIADOS.map(abbreviationToPattern),
  ...REGIMENES_EXTENDIDOS.map((p) => p.replace(/ /g, "\\s+")),
]
  // más largo primero para que "S.A. DE C.V." gane a "S.A."
  .sort((a, b) => b.length - a.length)
  .join("|");

const TRAILING_REGIMEN = new RegExp(`^(.+?)[\\s,]+(?:${SUFFIX_PATTERN})[\\s.,]*$`, "u");

export function normalizeName(name: string) {
  return name
    .normalize("NFC")
    .toLocaleUpperCase("es-MX")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripRegimenCapital(name: string) {
  let current = normalizeName(name);
  // Repetir por casos como "X, S.A. DE C.V., S.C." (raros pero existen en CSF mal capturadas)
  for (let i = 0; i < 3; i++) {
    const match = current.match(TRAILING_REGIMEN);
    if (!match) break;
    current = match[1].replace(/[\s,.]+$/, "").trim();
  }
  return current;
}

/**
 * @param rfc Si se proporciona y es de persona física (13 caracteres), no se quita
 *            ningún sufijo: sólo se normaliza a mayúsculas.
 */
export function cleanRazonSocial(name: string, rfc?: string) {
  if (rfc && !isPersonaMoral(rfc)) return normalizeName(name);
  return stripRegimenCapital(name);
}
