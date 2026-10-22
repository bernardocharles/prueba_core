import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

export const QUEUES = {
  /** Decide el canal y re-encola en la cola del agente correspondiente. */
  dispatch: "ticket-dispatch",
  email: "agent-email",
  whatsapp: "agent-whatsapp",
  webScrape: "agent-web-scrape",
  directApi: "agent-direct-api",
} as const;

export type TicketJob = { ticketId: string };

let connection: IORedis | undefined;

export function redisConnection(): ConnectionOptions {
  // BullMQ exige maxRetriesPerRequest=null en conexiones usadas por Workers
  connection ??= new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
  return connection;
}

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: { age: 7 * 24 * 3600 },
  removeOnFail: { age: 30 * 24 * 3600 },
};

const queues = new Map<string, Queue<TicketJob>>();

export function getQueue(name: (typeof QUEUES)[keyof typeof QUEUES]) {
  let q = queues.get(name);
  if (!q) {
    q = new Queue<TicketJob>(name, { connection: redisConnection(), defaultJobOptions });
    queues.set(name, q);
  }
  return q;
}

/**
 * jobId fijo por ticket evita encolarlo dos veces por doble clic. Si ya hay un job
 * terminado (reintento manual tras FAILED), se elimina para poder re-encolar.
 */
export async function enqueueTicket(ticketId: string) {
  const queue = getQueue(QUEUES.dispatch);
  const jobId = `dispatch-${ticketId}`;
  const existing = await queue.getJob(jobId);
  if (existing && ((await existing.isCompleted()) || (await existing.isFailed()))) await existing.remove();
  await queue.add("dispatch", { ticketId }, { jobId });
}
