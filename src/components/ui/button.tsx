"use client";

import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none text-[13px]",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-fg hover:bg-accent/90 shadow-[0_0_16px_-4px_var(--color-accent)]",
        secondary:
          "bg-bg-elevated text-fg border border-border hover:bg-bg-subtle hover:border-border-strong",
        ghost: "text-fg-muted hover:text-fg hover:bg-bg-elevated",
        destructive: "bg-negative/10 text-negative border border-negative/30 hover:bg-negative/20",
        outline: "border border-border text-fg hover:bg-bg-elevated hover:border-border-strong",
        link: "text-accent underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        xs: "h-6 px-2 text-[11px] rounded-sm",
        sm: "h-7 px-3",
        default: "h-8 px-4",
        lg: "h-9 px-5 text-sm",
        icon: "h-8 w-8",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
