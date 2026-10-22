import { db } from "./db";

/**
 * Placeholder de autenticación: resuelve (o crea) el usuario de DEMO_USER_EMAIL.
 * Sustituir por NextAuth / Supabase Auth antes de producción.
 */
export async function getCurrentUser() {
  const email = process.env.DEMO_USER_EMAIL;
  if (!email) throw new Error("DEMO_USER_EMAIL no está configurado");
  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Usuario Demo" },
  });
}
