import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Select nativo: en iPhone/Android abre el picker del sistema, compatible con react-hook-form `register`.
const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <span className="relative flex min-w-0 flex-1 items-center justify-end gap-1 text-muted-foreground">
      <select
        ref={ref}
        className={cn(
          "w-full min-w-0 appearance-none truncate bg-transparent text-right text-body text-muted-foreground outline-none [direction:rtl] disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
    </span>
  ),
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
