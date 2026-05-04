"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/lib/utils";

interface DataPoint {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
}

function formatMonth(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-IN", { month: "short" });
}

export function RevenueChart({ data }: { data: DataPoint[] }) {
  const formatted = data.map((d) => ({ ...d, month: formatMonth(d.month) }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={formatted} barGap={2} barSize={12}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="rgba(255,255,255,0.05)"
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "var(--color-fg-muted)", fontFamily: "var(--font-geist-mono)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-fg-muted)", fontFamily: "var(--font-geist-mono)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatINR(v, { compact: true })}
          width={55}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "var(--font-geist-mono)",
            color: "var(--color-fg)",
          }}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          formatter={(val, name) => [
            formatINR(Number(val ?? 0)),
            String(name) === "revenue" ? "Revenue" : String(name) === "expenses" ? "Expenses" : "Net Profit",
          ] as [string, string]}
        />
        <Bar dataKey="revenue" fill="var(--color-accent)" radius={[2, 2, 0, 0]} opacity={0.9} />
        <Bar dataKey="expenses" fill="var(--color-fg-muted)" radius={[2, 2, 0, 0]} opacity={0.4} />
      </BarChart>
    </ResponsiveContainer>
  );
}
