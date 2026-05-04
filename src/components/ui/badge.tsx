import type { HTMLAttributes } from "react";
import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider font-mono transition-colors",
  {
    variants: {
      variant: {
        default: "bg-bg-subtle text-fg-muted border border-border",
        accent: "bg-accent/10 text-accent border border-accent/20",
        positive: "bg-positive/10 text-positive border border-positive/20",
        negative: "bg-negative/10 text-negative border border-negative/20",
        warning: "bg-warning/10 text-warning border border-warning/20",
        info: "bg-info/10 text-info border border-info/20",
        ghost: "bg-transparent text-fg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };

export function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    draft: { label: "Draft", variant: "default" },
    sent: { label: "Sent", variant: "info" },
    paid: { label: "Paid", variant: "positive" },
    overdue: { label: "Overdue", variant: "negative" },
    cancelled: { label: "Cancelled", variant: "ghost" },
    partial: { label: "Partial", variant: "warning" },
  };

  const cfg = map[status] ?? { label: status, variant: "default" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
