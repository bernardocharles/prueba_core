import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { keyBelongsTo, signedUrl } from "@/lib/storage";

export const runtime = "nodejs";

/** Descarga protegida: valida que la key sea del usuario y redirige a una URL firmada corta. */
export async function GET(_req: Request, { params }: { params: { key: string[] } }) {
  const user = await getCurrentUser();
  const key = params.key.map(decodeURIComponent).join("/");
  if (!keyBelongsTo(key, user.id)) return new NextResponse("No encontrado", { status: 404 });
  return NextResponse.redirect(await signedUrl(key, 300));
}
