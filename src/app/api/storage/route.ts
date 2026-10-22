import { NextResponse } from "next/server";
import { CONTENT_TYPE_BY_EXT, getObject, verifyLocalSignature } from "@/lib/storage";

export const runtime = "nodejs";

/** Sirve archivos del driver local mediante URL firmada (equivalente a una presigned URL de S3). */
export async function GET(req: Request) {
  if (process.env.STORAGE_DRIVER !== "local") return new NextResponse("No encontrado", { status: 404 });

  const params = new URL(req.url).searchParams;
  const key = params.get("key") ?? "";
  if (!verifyLocalSignature(key, Number(params.get("exp")), params.get("sig") ?? "")) {
    return new NextResponse("Firma inválida o expirada", { status: 403 });
  }

  try {
    const body = await getObject(key);
    const ext = key.split(".").pop() ?? "";
    return new NextResponse(new Uint8Array(body).buffer as ArrayBuffer, {
      headers: {
        "Content-Type": CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${key.split("/").pop()}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}
