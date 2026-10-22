import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Botones al estilo iOS: filled, tinted (fondo translúcido del tinte) y plain (sólo texto).
const buttonVariants = cva(
  "press inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        tinted: "bg-primary/[0.12] text-primary dark:bg-primary/20",
        destructive: "bg-destructive/[0.12] text-destructive dark:bg-destructive/20",
        gray: "bg-muted text-foreground",
        plain: "text-primary",
        outline: "border border-border bg-card text-foreground",
      },
      size: {
        default: "h-11 rounded-xl px-5 text-body [&_svg]:size-[18px]",
        lg: "h-[52px] w-full rounded-[14px] px-6 text-headline [&_svg]:size-5",
        sm: "h-8 rounded-full px-3.5 text-subhead [&_svg]:size-4",
        icon: "h-11 w-11 rounded-full [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
