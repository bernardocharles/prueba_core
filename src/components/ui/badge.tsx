import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-semibold [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary/[0.12] text-primary dark:bg-primary/20",
        success: "bg-success/[0.14] text-success dark:bg-success/20",
        warning: "bg-warning/[0.14] text-warning dark:bg-warning/20",
        destructive: "bg-destructive/[0.12] text-destructive dark:bg-destructive/20",
        secondary: "bg-muted text-muted-foreground",
        info: "bg-indigo/[0.12] text-indigo dark:bg-indigo/20",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
