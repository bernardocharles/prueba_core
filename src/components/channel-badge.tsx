import type { ChannelType, TicketStatus } from "@prisma/client";
import { CheckCircle2, Clock, Globe, Loader2, Mail, MessageCircle, Plug, XCircle } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";

export const CHANNEL_META: Record<ChannelType, { label: string; icon: typeof Mail }> = {
  EMAIL: { label: "Correo", icon: Mail },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle },
  WEB_SCRAPE: { label: "Portal web", icon: Globe },
  DIRECT_API: { label: "API directa", icon: Plug },
};

export function ChannelBadge({ channel }: { channel: ChannelType }) {
  const { label, icon: Icon } = CHANNEL_META[channel];
  return (
    <Badge variant="secondary">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

const STATUS_META: Record<TicketStatus, { label: string; variant: BadgeProps["variant"]; icon: typeof Mail }> = {
  PENDING: { label: "Pendiente", variant: "outline", icon: Clock },
  PROCESSING: { label: "Procesando", variant: "info", icon: Loader2 },
  WAITING_VENDOR_RESPONSE: { label: "Esperando al comercio", variant: "warning", icon: Clock },
  COMPLETED: { label: "Facturado", variant: "default", icon: CheckCircle2 },
  FAILED: { label: "Falló", variant: "destructive", icon: XCircle },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { label, variant, icon: Icon } = STATUS_META[status];
  return (
    <Badge variant={variant}>
      <Icon className={status === "PROCESSING" ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
      {label}
    </Badge>
  );
}
