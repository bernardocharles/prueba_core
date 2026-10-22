import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge debe conocer la escala tipográfica iOS de tailwind.config.ts; si no,
// trata "text-body" como color y elimina el color real (p. ej. text-primary-foreground).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["large-title", "title-2", "headline", "body", "subhead", "footnote", "caption"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMXN(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
}
