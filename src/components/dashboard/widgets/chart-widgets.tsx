"use client";

import { BarChart3, PieChart as PieIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WidgetCard } from "@/components/dashboard/grid/widget-card";
import { DrillDownModal, useDrillStack } from "./drill-down-modal";
import { ChartContainer } from "./chart-container";
import { formatINR } from "@/lib/utils";
import type { DashboardAggregate } from "@/lib/dashboard/types";

interface WidgetProps {
  data: DashboardAggregate;
  editing?: boolean;
  onRemove?: () => void;
}

const CHART_COLORS = [
  "var(--color-accent)",
  "#a3e635",
  "#86efac",
  "#67e8f9",
  "#fbbf24",
  "#f97316",
  "#fb7185",
  "#c084fc",
  "#94a3b8",
  "#d1d5db",
];

// ─────────────────────────────────────────────────────────────────────────────
// Revenue vs Expenses (6-month bar)
// ─────────────────────────────────────────────────────────────────────────────
export function RevenueVsExpensesWidget({ data, editing, onRemove }: WidgetProps) {
  return (
    <WidgetCard
      title="Revenue vs Expenses"
      subtitle="Last 6 months"
      icon={<BarChart3 className="h-3.5 w-3.5" />}
      editing={editing}
      onRemove={onRemove}
    >
      <ChartContainer minHeight={200}>
        {({ width, height }) => (
        <ResponsiveContainer width={width} height={height}>
        <BarChart data={data.trend.monthly} barGap={4} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: "var(--color-fg-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatINR(v, { compact: true })}
            tick={{ fontSize: 11, fill: "var(--color-fg-muted)" }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              fontSize: 12,
            }}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            formatter={(v, name) => [
              formatINR(Number(v ?? 0)),
              name === "revenue" ? "Revenue" : name === "expenses" ? "Expenses" : "Net Profit",
            ]}
          />
          <Bar dataKey="revenue" fill="var(--color-accent)" radius={[2, 2, 0, 0]} opacity={0.95} isAnimationActive={false} />
          <Bar dataKey="expenses" fill="var(--color-fg-muted)" opacity={0.45} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="netProfit" fill="var(--color-positive)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
        )}
      </ChartContainer>
    </WidgetCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Expenses by Category (donut + drill)
// ─────────────────────────────────────────────────────────────────────────────
export function ExpensesByCategoryWidget({ data, editing, onRemove }: WidgetProps) {
  const drill = useDrillStack({ title: "Expenses by Category", content: null });
  const cats = data.expensesData.byCategory.slice(0, 8);
  const chartData = cats.map((c, i) => ({
    name: c.name,
    value: c.amount,
    code: c.code,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const total = chartData.reduce((s, c) => s + c.value, 0);

  return (
    <>
      <WidgetCard
        title="Expenses by Category"
        subtitle={`${formatINR(total, { compact: true })} this month`}
        icon={<PieIcon className="h-3.5 w-3.5" />}
        editing={editing}
        onRemove={onRemove}
        clickable
        onClick={() =>
          drill.openAt({
            title: "Expense breakdown",
            eyebrow: "Categories",
            subtitle: `${cats.length} categories · ${formatINR(total)} total`,
            content: <CategoryBreakdownDrill data={data} />,
          })
        }
      >
        <div className="grid grid-cols-[1fr_140px] gap-3 h-full">
          <div className="min-w-0">
            <div className="space-y-1.5">
              {chartData.slice(0, 6).map((c) => (
                <div key={c.code} className="flex items-center gap-2 text-[12px]">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-fg-muted truncate flex-1 min-w-0">{c.name}</span>
                  <span className="font-mono text-fg tabular-nums shrink-0">
                    {formatINR(c.value, { compact: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <ChartContainer minHeight={140}>
            {({ width, height }) => (
            <ResponsiveContainer width={width} height={height}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="100%"
                stroke="var(--color-bg-elevated)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v, name) => [formatINR(Number(v ?? 0)), String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
            )}
          </ChartContainer>
        </div>
      </WidgetCard>
      <DrillDownModal open={drill.open} onOpenChange={drill.setOpen} levels={drill.levels} onPop={drill.pop} />
    </>
  );
}

function CategoryBreakdownDrill({ data }: { data: DashboardAggregate }) {
  const cats = data.expensesData.byCategory;
  const total = cats.reduce((s, c) => s + c.amount, 0);
  const chartData = cats.map((c, i) => ({
    name: c.name,
    value: c.amount,
    code: c.code,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-bg-elevated p-3">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="90%"
              label={({ percent }: { percent?: number }) => percent && percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ""}
              labelLine={false}
              stroke="var(--color-bg-elevated)"
              strokeWidth={2}
              fontSize={11}
            >
              {chartData.map((e, i) => (
                <Cell key={i} fill={e.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(v, name) => [formatINR(Number(v ?? 0)), String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-md border border-border bg-bg-elevated overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_80px_120px] gap-3 px-3.5 py-2 text-[10px] font-mono uppercase tracking-wider text-fg-subtle border-b border-border/60">
          <span>Category</span>
          <span className="text-right">Amount</span>
          <span className="text-right">% of total</span>
          <span className="text-right">vs Last</span>
        </div>
        {cats.map((c, i) => (
          <div
            key={c.code}
            className="grid grid-cols-[1fr_120px_80px_120px] gap-3 px-3.5 py-2.5 text-[12px] border-b border-border/30 last:border-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="text-fg truncate">{c.name}</span>
              <span className="text-[10px] font-mono text-fg-subtle">{c.code}</span>
            </div>
            <span className="font-mono text-fg text-right tabular-nums">{formatINR(c.amount)}</span>
            <span className="font-mono text-fg-muted text-right tabular-nums">
              {((c.amount / total) * 100).toFixed(1)}%
            </span>
            <span
              className={`font-mono text-right tabular-nums text-[11px] ${
                c.vsLastMonthChangePct === null
                  ? "text-fg-subtle"
                  : c.vsLastMonthChangePct > 0
                    ? "text-negative"
                    : "text-positive"
              }`}
            >
              {c.vsLastMonthChangePct === null
                ? "—"
                : `${c.vsLastMonthChangePct > 0 ? "+" : ""}${c.vsLastMonthChangePct.toFixed(0)}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
