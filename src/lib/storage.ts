import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Los campos *Url del schema guardan la *key* del objeto, no una URL pública.
// Las URLs se firman bajo demanda (dashboard, Twilio, descargas).
//
// STORAGE_DRIVER=local guarda en .data/storage y firma URLs con HMAC servidas por
// /api/storage (desarrollo). Cualquier otro valor usa S3-compatible (producción).

const isLocal = () => process.env.STORAGE_DRIVER === "local";
const LOCAL_ROOT = path.resolve(process.env.LOCAL_STORAGE_DIR ?? ".data/storage");

let s3Client: S3Client | undefined;
const s3 = () =>
  (s3Client ??= new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  }));

const bucket = () => {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET no está configurado");
  return b;
};

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/xml": "xml",
  "text/xml": "xml",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  xml: "application/xml",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

export type FileKind = "csf" | "tickets" | "invoices";

export function buildKey(userId: string, kind: FileKind, contentType: string, name?: string) {
  const ext = EXT[contentType] ?? "bin";
  return `users/${userId}/${kind}/${name ?? randomUUID()}.${ext}`;
}

function localPath(key: string) {
  const full = path.resolve(LOCAL_ROOT, key);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error(`Key inválida: ${key}`);
  return full;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (isLocal()) {
    const file = localPath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return key;
  }
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
  return key;
}

export async function getObject(key: string): Promise<Buffer> {
  if (isLocal()) return readFile(localPath(key));
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error(`Objeto vacío: ${key}`);
  return Buffer.from(await res.Body.transformToByteArray());
}

function localSignature(key: string, exp: number) {
  const secret = process.env.STORAGE_SECRET;
  if (!secret) throw new Error("STORAGE_SECRET no está configurado");
  return createHmac("sha256", secret).update(`${key}:${exp}`).digest("hex");
}

/** Valida una URL firmada del driver local (usada por /api/storage). */
export function verifyLocalSignature(key: string, exp: number, sig: string) {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(localSignature(key, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function signedUrl(key: string, expiresInSeconds = 60 * 60) {
  if (isLocal()) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const params = new URLSearchParams({ key, exp: String(exp), sig: localSignature(key, exp) });
    return `${process.env.APP_URL ?? "http://localhost:3000"}/api/storage?${params}`;
  }
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

/** Las keys siempre empiezan con users/{userId}/ — base del control de acceso. */
export function keyBelongsTo(key: string, userId: string) {
  return key.startsWith(`users/${userId}/`) && !key.includes("..");
}
