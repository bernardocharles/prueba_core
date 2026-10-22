import { Worker, type Job } from "bullmq";
import type { ChannelType } from "@prisma/client";
import { db } from "@/lib/db";
import { QUEUES, getQueue, redisConnection, type TicketJob } from "@/lib/queue";
import { routeTicket, ticketToRoutingInput } from "@/lib/routing-engine";

const QUEUE_BY_CHANNEL: Record<ChannelType, (typeof QUEUES)[keyof typeof QUEUES]> = {
  EMAIL: QUEUES.email,
  WHATSAPP: QUEUES.whatsapp,
  WEB_SCRAPE: QUEUES.webScrape,
  DIRECT_API: QUEUES.directApi,
};

async function dispatch(job: Job<TicketJob>) {
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: job.data.ticketId } });
  if (ticket.status === "COMPLETED") return;

  const decision = routeTicket(ticketToRoutingInput(ticket));
  if (!decision.channel) {
    await db.ticket.update({
      where: { id: ticket.id },
      data: { status: "FAILED", failureReason: decision.warnings.join(" ") },
    });
    return;
  }

  await db.ticket.update({
    where: { id: ticket.id },
    data: { status: "PROCESSING", channelUsed: decision.channel, failureReason: null },
  });
  await getQueue(QUEUE_BY_CHANNEL[decision.channel]).add(decision.channel, { ticketId: ticket.id });
}

export function startDispatcher() {
  return new Worker<TicketJob>(QUEUES.dispatch, dispatch, { connection: redisConnection(), concurrency: 10 });
}
