// Levanta PostgreSQL y Redis locales para desarrollo (sin Docker): `npm run services`.
// Datos persistentes en .data/ (ignorado por git).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const DATA = path.resolve(".data");
const PG_DIR = path.join(DATA, "postgres");
const REDIS_DIR = path.join(DATA, "redis");
const PG_PORT = Number(process.env.PG_PORT ?? 5432);
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const DB_NAME = "facturasmart";

mkdirSync(REDIS_DIR, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: PG_DIR,
  port: PG_PORT,
  user: "postgres",
  password: "postgres",
  persistent: true,
  onLog: () => {},
});

const firstRun = !existsSync(path.join(PG_DIR, "PG_VERSION"));
if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase(DB_NAME);
console.log(`[services] PostgreSQL → postgresql://postgres:postgres@localhost:${PG_PORT}/${DB_NAME}`);

const localRedis = path.join(homedir(), ".local/redis/bin/redis-server");
const redisBin = existsSync(localRedis) ? localRedis : "redis-server";
const redis = spawn(redisBin, ["--port", String(REDIS_PORT), "--dir", REDIS_DIR, "--save", "60", "1", "--appendonly", "no"], {
  stdio: ["ignore", "ignore", "inherit"],
});
redis.on("error", (e) => console.error(`[services] no se pudo iniciar Redis (${redisBin}):`, e.message));
console.log(`[services] Redis → redis://localhost:${REDIS_PORT}`);
console.log("[services] Ctrl+C para detener");

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  redis.kill("SIGTERM");
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
