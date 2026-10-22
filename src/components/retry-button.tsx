"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw } from "lucide-react";
import { requestInvoice } from "@/app/actions/request-invoice";
import { Button } from "@/components/ui/button";

export function RetryButton({ ticketId, label = "Reintentar" }: { ticketId: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Button
        size="lg"
        variant="tinted"
        className="max-w-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await requestInvoice(ticketId);
            if (!res.ok) setError(res.error);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <RotateCw />}
        {label}
      </Button>
      {error && <p className="text-footnote text-destructive">{error}</p>}
    </div>
  );
}
