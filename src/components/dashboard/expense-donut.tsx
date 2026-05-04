"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatINR } from "@/lib/utils";

const COLORS = [
  "var(--color-accent)",
  "#38bdf8",
  "#fb923c",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
];

interface DataItem {
  accountName: string | null;
  total: number;
}

export function ExpenseDonut({ data }: { data: DataItem[] }) {
  const chartData = data
    .filter((d) => d.total > 0)
    .slice(0, 7)
    .map((d) => ({ name: d.accountName ?? "Other", value: d.total }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-[13px] text-fg-muted">
        No expenses yet
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "var(--font-geist-mono)",
              color: "var(--color-fg)",
            }}
            formatter={(v) => [formatINR(Number(v ?? 0)), ""] as [string, string]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        {chartData.map((item, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-[12px] text-fg-muted truncate">{item.name}</span>
            <span className="ml-auto text-[12px] font-mono text-fg tabular-nums shrink-0">
              {formatINR(item.value, { compact: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
