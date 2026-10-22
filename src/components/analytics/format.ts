export const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const mxnCents = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export const money = (n: number, cents = false) => (cents ? mxnCents : mxn).format(n);

/** $1.2 k, $35 k, $1.4 M — para ejes y etiquetas compactas. */
export function compactMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)} k`;
  return `$${Math.round(n)}`;
}

/** Máximo "bonito" del eje (1, 2, 2.5, 5 × 10ⁿ). */
export function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}
