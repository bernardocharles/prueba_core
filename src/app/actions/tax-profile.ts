"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cleanRazonSocial } from "@/lib/sat-cleaner";
import { taxProfileSchema, type TaxProfileInput } from "@/lib/schemas";
import { getCurrentUser } from "@/lib/session";

export async function saveTaxProfile(input: TaxProfileInput) {
  const parsed = taxProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const data = parsed.data;
  const user = await getCurrentUser();

  if (!data.csfKey.startsWith(`users/${user.id}/csf/`)) return { ok: false as const, error: "CSF inválida" };

  const existing = await db.taxProfile.findUnique({ where: { rfc: data.rfc } });
  if (existing && existing.userId !== user.id) {
    return { ok: false as const, error: "Este RFC ya está registrado en otra cuenta" };
  }

  const fields = {
    // Se vuelve a limpiar en servidor: el usuario pudo editar el nombre en el formulario
    razonSocial: cleanRazonSocial(data.razonSocial, data.rfc),
    codigoPostal: data.codigoPostal,
    regimenFiscal: data.regimenFiscal,
    usoCFDI: data.usoCFDI,
    csfPdfUrl: data.csfKey,
    isDefault: true,
  };

  await db.$transaction([
    db.taxProfile.updateMany({ where: { userId: user.id, rfc: { not: data.rfc } }, data: { isDefault: false } }),
    db.taxProfile.upsert({
      where: { rfc: data.rfc },
      update: fields,
      create: { ...fields, rfc: data.rfc, userId: user.id },
    }),
  ]);

  revalidatePath("/dashboard");
  return { ok: true as const };
}
