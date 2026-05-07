"use client";

import { animate, useInView, useMotionValue } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface NumberTickerProps {
  value: number;
  /** Text shown before the number (e.g. "₹"). */
  prefix?: string;
  /** Text shown after the number (e.g. "K"). */
  suffix?: string;
  /** Decimal places. Defaults to 0. */
  decimals?: number;
  /** Animation duration in seconds. Defaults to 1.5. */
  duration?: number;
  className?: string;
}

function formatValue(v: number, decimals: number, prefix: string, suffix: string) {
  const fixed = Number(v.toFixed(decimals));
  return `${prefix}${fixed.toLocaleString("en-IN")}${suffix}`;
}

export function NumberTicker({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.5,
  className,
}: NumberTickerProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(value);
  const inView = useInView(spanRef, { once: true, margin: "0px 0px -20px 0px" });

  // Subscribe motion → DOM textContent
  useEffect(() => {
    return motionValue.on("change", (v) => {
      if (spanRef.current) {
        spanRef.current.textContent = formatValue(v, decimals, prefix, suffix);
      }
    });
  }, [motionValue, decimals, prefix, suffix]);

  // Run the count-up when in view (and reset to 0 first so it ticks)
  useEffect(() => {
    if (!inView) return;
    motionValue.set(0);
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [inView, value, duration, motionValue]);

  // Render with the final value as initial textContent so the number is
  // visible immediately even if the motion subscription hasn't run yet.
  return (
    <span ref={spanRef} className={cn("font-mono tabular-nums", className)}>
      {formatValue(value, decimals, prefix, suffix)}
    </span>
  );
}
