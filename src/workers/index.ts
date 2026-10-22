/**
 * Proceso de workers (separado de Next.js): `npm run workers`.
 * Los canales WEB_SCRAPE y DIRECT_API tienen cola pero aún no worker; el
 * enrutador no los elige mientras no estén en ENABLED_CHANNELS.
 */
import type { Worker } from "bullmq";
import { startDispatcher } from "./dispatcher";
import { startEmailAgent, startImapListener } from "./email-agent";
import { startWhatsAppAgent } from "./whatsapp-agent";

const workers: Worker[] = [startDispatcher(), startEmailAgent(), startWhatsAppAgent()];
const imap = await startImapListener();

console.log(`[workers] ${workers.length} workers activos`);

async function shutdown() {
  console.log("[workers] cerrando…");
  await Promise.all(workers.map((w) => w.close()));
  await imap?.logout();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
