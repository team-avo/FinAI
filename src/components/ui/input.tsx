import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-8 w-full rounded bg-bg-elevated border border-border px-3 py-1",
        "text-[13px] text-fg placeholder:text-fg-subtle",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:border-border-strong focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-accent)_20%,transparent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-[13px] file:font-medium",
        className,
      )}
      {...props}
    />
  );
}
