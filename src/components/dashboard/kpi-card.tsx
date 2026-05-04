"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumberTicker } from "@/components/effects/number-ticker";
import { Card, CardContent } from "@/components/ui/card";

interface KPICardProps {
  title: string;
  value: number;
  change?: number | null;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  trend?: "up-good" | "up-bad" | "neutral";
  compact?: boolean;
}

export function KPICard({
  title,
  value,
  change,
  prefix = "₹",
  suffix,
  icon,
  trend = "up-good",
  compact = false,
}: KPICardProps) {
  const isPositive = change !== null && change !== undefined && change > 0;
  const isNegative = change !== null && change !== undefined && change < 0;

  const changeColor =
    trend === "up-good"
      ? isPositive
        ? "text-positive"
        : isNegative
          ? "text-negative"
          : "text-fg-muted"
      : trend === "up-bad"
        ? isPositive
          ? "text-negative"
          : isNegative
            ? "text-positive"
            : "text-fg-muted"
        : "text-fg-muted";

  return (
    <Card className="relative overflow-hidden">
      <CardContent className={cn("p-4", compact && "p-3")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-fg-muted mb-1.5">
              {title}
            </p>
            <div className="flex items-baseline gap-1">
              {prefix && (
                <span className="text-[13px] font-mono text-fg-muted">{prefix}</span>
              )}
              <span className="text-2xl font-mono font-semibold tabular-nums text-fg">
                <NumberTicker value={value} />
              </span>
              {suffix && (
                <span className="text-[13px] font-mono text-fg-muted">{suffix}</span>
              )}
            </div>

            {change !== null && change !== undefined && (
              <div className={cn("flex items-center gap-0.5 mt-1.5 text-[12px] font-mono", changeColor)}>
                {isPositive ? (
                  <ArrowUp className="h-3 w-3" />
                ) : isNegative ? (
                  <ArrowDown className="h-3 w-3" />
                ) : null}
                <span>
                  {Math.abs(change).toFixed(1)}% vs last month
                </span>
              </div>
            )}
          </div>

          {icon && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-bg-subtle border border-border text-fg-muted">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
