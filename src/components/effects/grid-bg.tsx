"use client";

import { cn } from "@/lib/utils";

interface GridBgProps {
  className?: string;
  dotSize?: number;
  gap?: number;
}

export function GridBg({ className, dotSize = 1.5, gap = 28 }: GridBgProps) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: `radial-gradient(circle, var(--color-border-strong) ${dotSize}px, transparent ${dotSize}px)`,
          backgroundSize: `${gap}px ${gap}px`,
          animation: "grid-drift 20s linear infinite",
          willChange: "transform",
        }}
      />
      {/* Radial fade mask — dots fade out toward edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, var(--color-bg) 100%)",
        }}
      />
    </div>
  );
}
