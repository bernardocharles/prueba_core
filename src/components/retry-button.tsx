"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw } from "lucide-react";
import { requestInvoice } from "@/app/actions/request-invoice";
import { Button } from "@/components/ui/button";

export function RetryButton({ ticketId, label = "Reintentar" }: { ticketId: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await requestInvoice(ticketId);
          if (!res.ok) alert(res.error);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RotateCw />}
      {label}
    </Button>
  );
}
