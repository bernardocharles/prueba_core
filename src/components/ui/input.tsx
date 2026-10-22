import * as React from "react";
import { cn } from "@/lib/utils";

/** Input "plain" para filas de formulario agrupado: sin borde, alineado a la derecha como en Ajustes de iOS. */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "w-full min-w-0 bg-transparent text-right text-body text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
