"use client";

import { animate, useInView, useMotionValue, useTransform } from "motion/react";
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

export function NumberTicker({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.5,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20px 0px" });

  const rounded = useTransform(motionValue, (v) => {
    const formatted = v.toFixed(decimals);
    return `${prefix}${Number(formatted).toLocaleString("en-IN")}${suffix}`;
  });

  useEffect(() => {
    if (!inView) return;
    animate(motionValue, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
  }, [inView, value, duration, motionValue]);

  return (
    <motion.span
      ref={ref}
      className={cn("font-mono tabular-nums", className)}
      style={{ ...({} as object) }}
    >
      {/* We use the motion value directly via useTransform */}
      <MotionText motionValue={rounded} />
    </motion.span>
  );
}

function MotionText({ motionValue }: { motionValue: ReturnType<typeof useTransform<number, string>> }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    return motionValue.on("change", (v) => {
      if (ref.current) ref.current.textContent = v;
    });
  }, [motionValue]);

  return <span ref={ref} />;
}

// Re-export motion to avoid separate import in consumers
import { motion } from "motion/react";
