import type { ChannelType, TicketStatus } from "@prisma/client";
import { CheckCircle2, Clock, Globe, Loader2, Mail, MessageCircle, Plug, Receipt, XCircle, type LucideIcon } from "lucide-react";
import { IconTile, type TileColor } from "@/components/ios";
import { Badge, type BadgeProps } from "@/components/ui/badge";

export const CHANNEL_META: Record<ChannelType, { label: string; icon: LucideIcon; color: TileColor }> = {
  EMAIL: { label: "Correo", icon: Mail, color: "blue" },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle, color: "green" },
  WEB_SCRAPE: { label: "Portal web", icon: Globe, color: "indigo" },
  DIRECT_API: { label: "API directa", icon: Plug, color: "teal" },
};

export function ChannelBadge({ channel }: { channel: ChannelType }) {
  const { label, icon: Icon } = CHANNEL_META[channel];
  return (
    <Badge variant="secondary">
      <Icon />
      {label}
    </Badge>
  );
}

export function ChannelTile({ channel }: { channel: ChannelType | null }) {
  if (!channel) return <IconTile icon={Receipt} color="gray" />;
  const { icon, color } = CHANNEL_META[channel];
  return <IconTile icon={icon} color={color} />;
}

export const STATUS_META: Record<TicketStatus, { label: string; variant: BadgeProps["variant"]; icon: LucideIcon }> = {
  PENDING: { label: "Pendiente", variant: "secondary", icon: Clock },
  PROCESSING: { label: "Enviando", variant: "info", icon: Loader2 },
  WAITING_VENDOR_RESPONSE: { label: "En espera", variant: "warning", icon: Clock },
  COMPLETED: { label: "Facturado", variant: "success", icon: CheckCircle2 },
  FAILED: { label: "Requiere atención", variant: "destructive", icon: XCircle },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { label, variant, icon: Icon } = STATUS_META[status];
  return (
    <Badge variant={variant}>
      <Icon className={status === "PROCESSING" ? "animate-spin" : undefined} />
      {label}
    </Badge>
  );
}
