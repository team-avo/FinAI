"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface SpotlightProps {
  className?: string;
  children: React.ReactNode;
  /** Spotlight radius in px. Defaults to 350. */
  radius?: number;
  /** Spotlight color. Defaults to accent lime. */
  color?: string;
}

export function Spotlight({
  className,
  children,
  radius = 350,
  color = "var(--color-accent)",
}: SpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const overlay = overlayRef.current;
      if (!container || !overlay) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      overlay.style.background = `radial-gradient(${radius}px circle at ${x}px ${y}px,
        color-mix(in oklch, ${color} 12%, transparent) 0%,
        transparent 100%
      )`;
    },
    [radius, color],
  );

  const handleMouseLeave = useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.style.background = "transparent";
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-10 transition-[background] duration-300"
        aria-hidden
      />
      {children}
    </div>
  );
}
