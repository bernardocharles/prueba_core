"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { limitSchema, type LimitInput } from "@/lib/schemas";
import { getCurrentUser } from "@/lib/session";

export async function createLimit(input: LimitInput) {
  const parsed = limitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const user = await getCurrentUser();
  const { scope, scopeValue, period, amount } = parsed.data;
  await db.spendingLimit.create({
    data: { userId: user.id, scope, scopeValue: scope === "TOTAL" ? null : scopeValue, period, amount },
  });
  revalidatePath("/analisis");
  return { ok: true as const };
}

export async function deleteLimit(id: string) {
  const user = await getCurrentUser();
  await db.spendingLimit.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/analisis");
}
