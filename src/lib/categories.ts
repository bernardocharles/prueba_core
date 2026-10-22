/** Categorías (giro) para comparar gastos y compras. El orden es el de los filtros. */
export const CATEGORIES = [
  "Restaurantes",
  "Supermercado",
  "Combustible",
  "Farmacia y salud",
  "Transporte",
  "Hospedaje",
  "Tecnología",
  "Oficina y papelería",
  "Servicios",
  "Otros",
] as const;

export type Category = (typeof CATEGORIES)[number];

const RULES: [RegExp, Category][] = [
  [/RESTAUR|TAQUER|CAFE|CAFETER|COMIDA|ALIMENTO|COCINA|BAR\b|PIZZ|SUSHI|STARBUCKS|TACO|BURGER|FONDA/, "Restaurantes"],
  [/SUPER|WAL-?MART|SORIANA|CHEDRAUI|COSTCO|SAM'?S|AURRERA|OXXO|7-?ELEVEN|ABARROT|MERCADO|TIENDA|DESPENSA/, "Supermercado"],
  [/GASOLIN|COMBUSTIBLE|PEMEX|GAS\b|SHELL|MOBIL|BP\b|DIESEL|MAGNA|PREMIUM/, "Combustible"],
  [/FARMAC|SALUD|MEDIC|HOSPITAL|CLINIC|LABORATOR|OPTIC|DENT/, "Farmacia y salud"],
  [/UBER|DIDI|TAXI|AUTOBUS|ADO\b|VUELO|AERO|CASETA|PEAJE|ESTACIONAMIENTO|TRANSPORTE|VIAJE/, "Transporte"],
  [/HOTEL|HOSPEDAJE|AIRBNB|MOTEL|POSADA/, "Hospedaje"],
  [/TECNOLOG|COMPUT|SOFTWARE|ELECTRON|BEST ?BUY|APPLE|CELULAR|STEREN|CYBERPUERTO/, "Tecnología"],
  [/OFICINA|PAPELER|OFFICE ?DEPOT|OFFICEMAX|LUMEN|IMPRES/, "Oficina y papelería"],
  [/SERVICIO|LUZ|CFE|AGUA|TELMEX|INTERNET|TELEFON|RENTA|SUSCRIP|HOME ?DEPOT|FERRET/, "Servicios"],
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Normaliza una categoría escrita a mano (Excel) o infiere el giro a partir del nombre del comercio. */
export function inferCategory(...texts: (string | null | undefined)[]): Category {
  for (const text of texts) {
    if (!text) continue;
    const t = norm(text).trim();
    const exact = CATEGORIES.find((c) => norm(c) === t);
    if (exact) return exact;
    for (const [re, cat] of RULES) if (re.test(t)) return cat;
  }
  return "Otros";
}
