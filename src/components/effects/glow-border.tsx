"use client";

import { type HTMLAttributes, useRef } from "react";
import { cn } from "@/lib/utils";

interface GlowBorderProps extends HTMLAttributes<HTMLDivElement> {
  glowColor?: string;
  borderColor?: string;
  rounded?: string;
}

export function GlowBorder({
  className,
  children,
  glowColor = "var(--color-accent)",
  borderColor = "var(--color-border)",
  rounded = "var(--radius-md)",
  ...props
}: GlowBorderProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={cn("group relative", className)}
      {...props}
    >
      {/* Glow ring behind the border — only visible on hover/focus-within */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          borderRadius: rounded,
          boxShadow: `0 0 0 1px color-mix(in oklch, ${glowColor} 50%, transparent),
            0 0 20px -4px color-mix(in oklch, ${glowColor} 50%, transparent)`,
        }}
      />
      {/* Actual border */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 transition-colors duration-200"
        style={{
          borderRadius: rounded,
          border: `1px solid ${borderColor}`,
        }}
      />
      {children}
    </div>
  );
}
