import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "flex min-h-[72px] w-full rounded bg-bg-elevated border border-border px-3 py-2",
        "text-[13px] text-fg placeholder:text-fg-subtle",
        "transition-all duration-150 resize-none",
        "focus-visible:outline-none focus-visible:border-border-strong focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-accent)_20%,transparent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
