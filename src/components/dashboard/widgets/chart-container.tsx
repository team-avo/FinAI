"use client";

import { useEffect, useRef, useState } from "react";

interface ChartContainerProps {
  children: (size: { width: number; height: number }) => React.ReactNode;
  /** Min height in px so the wrapper has a definite size while measuring. */
  minHeight?: number;
  className?: string;
}

/**
 * ResizeObserver-backed wrapper for Recharts inside react-grid-layout.
 *
 * Recharts' ResponsiveContainer measures its parent on mount and caches the
 * result. When the parent has 0 width during the first frame (because rgl
 * hasn't applied its transform yet), the chart never re-measures and renders
 * empty. This wrapper:
 *   1. Mounts an empty container with min-height
 *   2. Observes its size with ResizeObserver
 *   3. Renders the chart only once size is known, with explicit pixel
 *      dimensions, and re-renders when the parent resizes.
 */
export function ChartContainer({ children, minHeight = 200, className }: ChartContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSize({ width, height });
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: "100%", height: "100%", minHeight }}
    >
      {size ? children(size) : null}
    </div>
  );
}
