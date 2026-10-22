// Esquemas compartidos cliente/servidor (los archivos "use server" sólo pueden exportar funciones async).
import { z } from "zod";
import { REGIMENES_FISCALES, RFC_REGEX, USOS_CFDI } from "./sat-catalogs";

export const taxProfileSchema = z.object({
  rfc: z.string().trim().toUpperCase().regex(RFC_REGEX, "RFC inválido"),
  razonSocial: z.string().trim().min(1, "Requerido"),
  codigoPostal: z.string().regex(/^\d{5}$/, "Debe tener 5 dígitos"),
  regimenFiscal: z.string().refine((v) => v in REGIMENES_FISCALES, "Régimen no válido"),
  usoCFDI: z.string().refine((v) => v in USOS_CFDI, "Uso de CFDI no válido"),
  csfKey: z.string().min(1),
});

export type TaxProfileInput = z.infer<typeof taxProfileSchema>;

const optionalText = z
  .string()
  .nullable()
  .transform((v) => v?.trim() || null);

export const ticketCorrectionsSchema = z.object({
  ticketFolio: optionalText,
  billingCode: optionalText,
  ticketDate: optionalText.refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida"),
  totalAmount: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number({ error: "Monto inválido" }).positive("Monto inválido").nullable(),
  ),
  whatsapp: optionalText,
  email: optionalText.refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Correo inválido"),
});

export type TicketCorrections = z.input<typeof ticketCorrectionsSchema>;
export type TicketCorrectionsOutput = z.output<typeof ticketCorrectionsSchema>;

export const limitSchema = z
  .object({
    scope: z.enum(["TOTAL", "CATEGORY", "STORE"]),
    scopeValue: z.string().trim().nullable(),
    period: z.enum(["MONTHLY", "YEARLY"]),
    amount: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number({ error: "Monto inválido" }).positive("El límite debe ser mayor a 0")),
  })
  .refine((v) => v.scope === "TOTAL" || Boolean(v.scopeValue), { message: "Elige la categoría o tienda", path: ["scopeValue"] });

export type LimitInput = z.input<typeof limitSchema>;
export type LimitOutput = z.output<typeof limitSchema>;
