"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Landmark,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NumberTicker } from "@/components/effects/number-ticker";
import { WidgetCard } from "@/components/dashboard/grid/widget-card";
import { DrillDownModal, useDrillStack } from "./drill-down-modal";
import { formatINR, cn } from "@/lib/utils";
import type { DashboardAggregate, ExpenseRecord, InvoiceRecord } from "@/lib/dashboard/types";

interface WidgetProps {
  data: DashboardAggregate;
  editing?: boolean;
  onRemove?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue MTD
// ─────────────────────────────────────────────────────────────────────────────
export function RevenueMtdWidget({ data, editing, onRemove }: WidgetProps) {
  const drill = useDrillStack({ title: "Revenue (MTD)", content: null });
  const r = data.revenue;
  const change = r.lastMonthMtd > 0 ? ((r.mtd - r.lastMonthMtd) / r.lastMonthMtd) * 100 : null;

  const openDrill = () => {
    drill.openAt({
      title: `Revenue · ${format(new Date(), "MMMM yyyy")}`,
      eyebrow: "Revenue",
      subtitle: `${formatINR(r.mtd)} collected this month`,
      content: <RevenueDrillContent data={data} push={drill.push} />,
    });
  };

  return (
    <>
      <WidgetCard
        title="Revenue · MTD"
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        editing={editing}
        onRemove={onRemove}
        clickable
        onClick={openDrill}
      >
        <KpiBody value={r.mtd} change={change} trend="up-good" subline={`Last month: ${formatINR(r.lastMonthMtd)}`} />
      </WidgetCard>
      <DrillDownModal open={drill.open} onOpenChange={drill.setOpen} levels={drill.levels} onPop={drill.pop} />
    </>
  );
}

function RevenueDrillContent({
  data,
  push,
}: {
  data: DashboardAggregate;
  push: (lvl: { title: string; eyebrow?: string; subtitle?: string; content: React.ReactNode }) => void;
}) {
  const monthly = data.trend.monthly;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="MTD" value={data.revenue.mtd} />
        <StatTile label="QTD" value={data.revenue.qtd} />
        <StatTile label="YTD" value={data.revenue.ytd} />
      </div>

      <div>
        <SectionHeader title="6-month trend" />
        <div className="rounded-md border border-border bg-bg-elevated p-3">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
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
                formatter={(v) => formatINR(Number(v ?? 0))}
              />
              <Bar dataKey="revenue" fill="var(--color-accent)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <SectionHeader title="Revenue by customer · this month" />
        <div className="rounded-md border border-border bg-bg-elevated divide-y divide-border/40">
          {data.customers.topByRevenue.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                push({
                  title: c.name,
                  eyebrow: "Customer",
                  subtitle: `${c.invoiceCount} invoices · avg pay ${c.averagePaymentDays} days`,
                  content: <CustomerDrillContent customerId={c.id} data={data} />,
                })
              }
              className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-bg-subtle transition-colors text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-fg truncate">{c.name}</p>
                <p className="text-[11px] font-mono text-fg-muted">{c.state} · {c.invoiceCount} invoices</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-[13px] font-semibold text-positive tabular-nums">
                  {formatINR(c.totalRevenue)}
                </p>
                {c.outstanding > 0 && (
                  <p className="text-[11px] font-mono text-fg-muted">
                    {formatINR(c.outstanding)} due
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomerDrillContent({ customerId, data }: { customerId: string; data: DashboardAggregate }) {
  const customer = data.customers.all.find((c) => c.id === customerId);
  const invoices = data.invoices.all.filter((i) => i.customerId === customerId);
  if (!customer) return <p>Customer not found</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total Revenue" value={customer.totalRevenue} />
        <StatTile label="Outstanding" value={customer.outstanding} accent={customer.outstanding > 0 ? "warning" : "neutral"} />
        <StatTile label="Avg. Pay Days" value={customer.averagePaymentDays} prefix="" suffix=" days" />
      </div>
      <div>
        <SectionHeader title={`All invoices · ${invoices.length}`} />
        <div className="rounded-md border border-border bg-bg-elevated overflow-hidden">
          <div className="grid grid-cols-[100px_1fr_100px_100px_100px] gap-3 px-3.5 py-2 text-[10px] font-mono uppercase tracking-wider text-fg-subtle border-b border-border/60">
            <span>Number</span>
            <span>Description</span>
            <span>Date</span>
            <span>Status</span>
            <span className="text-right">Amount</span>
          </div>
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="grid grid-cols-[100px_1fr_100px_100px_100px] gap-3 px-3.5 py-2 text-[12px] border-b border-border/30 last:border-0 hover:bg-bg-subtle"
            >
              <span className="font-mono text-fg-muted">{inv.number}</span>
              <span className="text-fg truncate">{inv.lines[0]?.description ?? "—"}</span>
              <span className="font-mono text-fg-muted">{format(new Date(inv.issueDate), "dd MMM")}</span>
              <span className={cn("text-[11px] uppercase tracking-wider font-mono", statusColor(inv.status))}>
                {inv.status}
              </span>
              <span className="font-mono text-fg text-right tabular-nums">{formatINR(inv.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Expenses MTD
// ─────────────────────────────────────────────────────────────────────────────
export function ExpensesMtdWidget({ data, editing, onRemove }: WidgetProps) {
  const drill = useDrillStack({ title: "Expenses MTD", content: null });
  const e = data.expenses;
  const change = e.lastMonthMtd > 0 ? ((e.mtd - e.lastMonthMtd) / e.lastMonthMtd) * 100 : null;

  return (
    <>
      <WidgetCard
        title="Expenses · MTD"
        icon={<TrendingDown className="h-3.5 w-3.5" />}
        editing={editing}
        onRemove={onRemove}
        clickable
        onClick={() =>
          drill.openAt({
            title: `Expenses · ${format(new Date(), "MMMM yyyy")}`,
            eyebrow: "Expenses",
            subtitle: `${formatINR(e.mtd)} spent across ${data.expensesData.byCategory.length} categories`,
            content: <ExpensesDrillContent data={data} push={drill.push} />,
          })
        }
      >
        <KpiBody value={e.mtd} change={change} trend="up-bad" subline={`Last month: ${formatINR(e.lastMonthMtd)}`} />
      </WidgetCard>
      <DrillDownModal open={drill.open} onOpenChange={drill.setOpen} levels={drill.levels} onPop={drill.pop} />
    </>
  );
}

function ExpensesDrillContent({
  data,
  push,
}: {
  data: DashboardAggregate;
  push: (lvl: { title: string; eyebrow?: string; subtitle?: string; content: React.ReactNode }) => void;
}) {
  const cats = data.expensesData.byCategory;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="MTD" value={data.expenses.mtd} accent="warning" />
        <StatTile label="QTD" value={data.expenses.qtd} accent="warning" />
        <StatTile label="YTD" value={data.expenses.ytd} accent="warning" />
      </div>

      <div>
        <SectionHeader title="By category · click to drill in" />
        <div className="rounded-md border border-border bg-bg-elevated divide-y divide-border/40">
          {cats.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() =>
                push({
                  title: c.name,
                  eyebrow: `Category · ${c.code}`,
                  subtitle: `${c.count} entries · ${formatINR(c.amount)} this month`,
                  content: <CategoryDrillContent categoryCode={c.code} data={data} />,
                })
              }
              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-bg-subtle transition-colors text-left"
            >
              <div className="w-1 h-9 rounded-full bg-accent/60 shrink-0" style={{ opacity: 0.3 + c.pctOfTotal / 100 }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-[13px] text-fg truncate">{c.name}</p>
                  <span className="text-[10px] font-mono text-fg-subtle">{c.code}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-1 rounded-full bg-bg-subtle overflow-hidden max-w-[200px]">
                    <div className="h-full bg-accent" style={{ width: `${Math.min(100, c.pctOfTotal)}%` }} />
                  </div>
                  <span className="text-[11px] font-mono text-fg-muted">
                    {c.pctOfTotal.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-[13px] font-semibold text-fg tabular-nums">
                  {formatINR(c.amount)}
                </p>
                <p className="text-[11px] font-mono text-fg-muted">{c.count} txns</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryDrillContent({
  categoryCode,
  data,
}: {
  categoryCode: string;
  data: DashboardAggregate;
}) {
  const all = data.expensesData.all.filter((e) => e.categoryCode === categoryCode);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = all.filter((e) => new Date(e.date) >= monthStart);
  const total = thisMonth.reduce((s, e) => s + e.totalAmount, 0);

  // Group by vendor
  const byVendor = new Map<string, { name: string; total: number; count: number; items: ExpenseRecord[] }>();
  for (const e of thisMonth) {
    const v = byVendor.get(e.vendorId) ?? { name: e.vendorName, total: 0, count: 0, items: [] };
    v.total += e.totalAmount;
    v.count += 1;
    v.items.push(e);
    byVendor.set(e.vendorId, v);
  }
  const vendors = Array.from(byVendor.values()).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Spent · MTD" value={total} accent="warning" />
        <StatTile label="Transactions" value={thisMonth.length} prefix="" />
        <StatTile label="Vendors" value={vendors.length} prefix="" />
      </div>

      <div>
        <SectionHeader title="By vendor" />
        <div className="rounded-md border border-border bg-bg-elevated divide-y divide-border/40">
          {vendors.map((v) => (
            <div key={v.name} className="px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-fg">{v.name}</p>
                  <p className="text-[11px] font-mono text-fg-muted">{v.count} transactions</p>
                </div>
                <p className="font-mono text-[13px] font-semibold text-fg tabular-nums">
                  {formatINR(v.total)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader title={`All transactions this month · ${thisMonth.length}`} />
        <div className="rounded-md border border-border bg-bg-elevated overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_80px_120px] gap-3 px-3.5 py-2 text-[10px] font-mono uppercase tracking-wider text-fg-subtle border-b border-border/60">
            <span>Date</span>
            <span>Vendor</span>
            <span>Source</span>
            <span className="text-right">Amount</span>
          </div>
          {thisMonth.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[80px_1fr_80px_120px] gap-3 px-3.5 py-2 text-[12px] border-b border-border/30 last:border-0"
            >
              <span className="font-mono text-fg-muted">{format(new Date(e.date), "dd MMM")}</span>
              <span className="text-fg truncate">{e.vendorName}</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle">
                {e.source.replace("_", " ")}
              </span>
              <span className="font-mono text-fg text-right tabular-nums">{formatINR(e.totalAmount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Net Profit MTD
// ─────────────────────────────────────────────────────────────────────────────
export function NetProfitMtdWidget({ data, editing, onRemove }: WidgetProps) {
  const drill = useDrillStack({ title: "Net Profit MTD", content: null });
  const np = data.profitability.netProfitMtd;
  const margin = data.profitability.grossMarginPct;

  return (
    <>
      <WidgetCard
        title="Net Profit · MTD"
        icon={<BarChart3 className="h-3.5 w-3.5" />}
        editing={editing}
        onRemove={onRemove}
        clickable
        onClick={() =>
          drill.openAt({
            title: "Net Profit · This month",
            eyebrow: "Profitability",
            subtitle: `${formatINR(np)} on ${formatINR(data.revenue.mtd)} revenue · ${margin.toFixed(1)}% margin`,
            content: <ProfitDrillContent data={data} />,
          })
        }
      >
        <KpiBody
          value={np}
          change={null}
          trend={np >= 0 ? "up-good" : "up-bad"}
          subline={`${margin.toFixed(1)}% margin`}
        />
      </WidgetCard>
      <DrillDownModal open={drill.open} onOpenChange={drill.setOpen} levels={drill.levels} onPop={drill.pop} />
    </>
  );
}

function ProfitDrillContent({ data }: { data: DashboardAggregate }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Revenue" value={data.revenue.mtd} accent="positive" />
        <StatTile label="Expenses" value={data.expenses.mtd} accent="warning" />
        <StatTile label="Net Profit" value={data.profitability.netProfitMtd} accent="positive" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Gross Margin" value={data.profitability.grossMarginPct} prefix="" suffix="%" />
        <StatTile label="Expense Ratio" value={data.profitability.expenseRatioPct} prefix="" suffix="%" />
      </div>

      <div>
        <SectionHeader title="6-month profit trend" />
        <div className="rounded-md border border-border bg-bg-elevated p-3">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.trend.monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
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
                formatter={(v) => formatINR(Number(v ?? 0))}
              />
              <Bar dataKey="revenue" fill="var(--color-accent)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expenses" fill="var(--color-fg-muted)" opacity={0.5} radius={[2, 2, 0, 0]} />
              <Bar dataKey="netProfit" fill="var(--color-positive)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Outstanding Receivables
// ─────────────────────────────────────────────────────────────────────────────
export function OutstandingReceivablesWidget({ data, editing, onRemove }: WidgetProps) {
  const drill = useDrillStack({ title: "Outstanding", content: null });
  const r = data.receivables;

  return (
    <>
      <WidgetCard
        title="Outstanding"
        icon={<ArrowUpRight className="h-3.5 w-3.5" />}
        editing={editing}
        onRemove={onRemove}
        clickable
        onClick={() =>
          drill.openAt({
            title: "Outstanding receivables",
            eyebrow: "Receivables",
            subtitle: `${formatINR(r.totalOutstanding)} unpaid · ${r.overdueCount} overdue`,
            content: <OutstandingDrillContent data={data} />,
          })
        }
      >
        <KpiBody
          value={r.totalOutstanding}
          change={null}
          trend="neutral"
          subline={`${r.overdueCount} overdue · ${formatINR(r.overdueAmount)}`}
          sublineColor={r.overdueCount > 0 ? "text-negative" : "text-fg-muted"}
        />
      </WidgetCard>
      <DrillDownModal open={drill.open} onOpenChange={drill.setOpen} levels={drill.levels} onPop={drill.pop} />
    </>
  );
}

function OutstandingDrillContent({ data }: { data: DashboardAggregate }) {
  const r = data.receivables;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total Outstanding" value={r.totalOutstanding} />
        <StatTile label="Overdue" value={r.overdueAmount} accent="negative" />
        <StatTile label="Avg. Pay Days" value={r.averageDaysToPay} prefix="" suffix=" days" />
      </div>
      <div>
        <SectionHeader title={`Overdue invoices · ${r.topOverdue.length}`} />
        <div className="rounded-md border border-border bg-bg-elevated divide-y divide-border/40">
          {r.topOverdue.map((inv) => (
            <InvoiceRow key={inv.id} inv={inv} highlight />
          ))}
        </div>
      </div>
      <div>
        <SectionHeader title="By customer" />
        <div className="rounded-md border border-border bg-bg-elevated divide-y divide-border/40">
          {r.customerOutstanding.map((c) => (
            <div key={c.customerId} className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-[13px] text-fg">{c.name}</span>
              <span className="font-mono text-[13px] font-semibold text-warning tabular-nums">
                {formatINR(c.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bank Balance
// ─────────────────────────────────────────────────────────────────────────────
export function BankBalanceWidget({ data, editing, onRemove }: WidgetProps) {
  const drill = useDrillStack({ title: "Bank Balance", content: null });
  const c = data.cash;

  return (
    <>
      <WidgetCard
        title="Bank Balance"
        icon={<Landmark className="h-3.5 w-3.5" />}
        editing={editing}
        onRemove={onRemove}
        clickable
        onClick={() =>
          drill.openAt({
            title: "Bank balances",
            eyebrow: "Cash position",
            subtitle: `${c.accounts.length} accounts · net flow ${formatINR(c.netCashFlowMtd)} this month`,
            content: <BankDrillContent data={data} />,
          })
        }
      >
        <div className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className="text-[13px] font-mono text-fg-muted">₹</span>
            <span className="text-2xl font-mono font-semibold tabular-nums text-fg">
              <NumberTicker value={c.totalBalance} />
            </span>
          </div>
          <div className="space-y-1">
            {c.accounts.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-fg-subtle truncate">{a.bank} {a.accountNumberMasked}</span>
                <span className="text-fg-muted tabular-nums">{formatINR(a.balance, { compact: true })}</span>
              </div>
            ))}
          </div>
        </div>
      </WidgetCard>
      <DrillDownModal open={drill.open} onOpenChange={drill.setOpen} levels={drill.levels} onPop={drill.pop} />
    </>
  );
}

function BankDrillContent({ data }: { data: DashboardAggregate }) {
  const c = data.cash;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total Balance" value={c.totalBalance} accent="positive" />
        <StatTile label="Inflows MTD" value={c.inflowsMtd} accent="positive" />
        <StatTile label="Outflows MTD" value={c.outflowsMtd} accent="warning" />
      </div>

      <div>
        <SectionHeader title="Accounts" />
        <div className="rounded-md border border-border bg-bg-elevated divide-y divide-border/40">
          {c.accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-3.5 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-bg-subtle border border-border text-fg-muted">
                <Banknote className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-fg">{a.name}</p>
                <p className="text-[11px] font-mono text-fg-muted">{a.bank} · {a.accountNumberMasked}</p>
              </div>
              <p className="font-mono text-[14px] font-semibold text-fg tabular-nums">
                {formatINR(a.balance)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader title="Daily cash flow · this month" />
        <div className="rounded-md border border-border bg-bg-elevated p-3">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={c.dailyFlow.map((d) => ({ ...d, day: d.date.slice(8, 10) }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-fg-muted)" }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => formatINR(Math.abs(v), { compact: true })}
                tick={{ fontSize: 10, fill: "var(--color-fg-muted)" }}
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
                formatter={(v) => formatINR(Number(v ?? 0))}
              />
              <Bar dataKey="inflow" fill="var(--color-positive)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="outflow" fill="var(--color-negative)" opacity={0.5} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ─────────────────────────────────────────────────────────────────────────────

function KpiBody({
  value,
  change,
  trend,
  subline,
  sublineColor,
}: {
  value: number;
  change: number | null;
  trend: "up-good" | "up-bad" | "neutral";
  subline?: string;
  sublineColor?: string;
}) {
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;
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
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1">
        <span className="text-[13px] font-mono text-fg-muted">₹</span>
        <span className="text-3xl font-mono font-semibold tabular-nums text-fg leading-none">
          <NumberTicker value={value} />
        </span>
      </div>
      {change !== null && (
        <div className={cn("flex items-center gap-0.5 text-[11px] font-mono", changeColor)}>
          {isPositive ? (
            <ArrowUp className="h-3 w-3" />
          ) : isNegative ? (
            <ArrowDown className="h-3 w-3" />
          ) : null}
          <span>{Math.abs(change).toFixed(1)}% vs last month</span>
        </div>
      )}
      {subline && (
        <p className={cn("text-[11px] font-mono", sublineColor ?? "text-fg-subtle")}>{subline}</p>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  prefix = "₹",
  suffix,
  accent = "neutral",
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  accent?: "neutral" | "positive" | "warning" | "negative";
}) {
  const valueColor =
    accent === "positive"
      ? "text-positive"
      : accent === "warning"
        ? "text-warning"
        : accent === "negative"
          ? "text-negative"
          : "text-fg";
  return (
    <div className="rounded-md border border-border bg-bg-elevated p-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle mb-1.5">{label}</p>
      <div className="flex items-baseline gap-1">
        {prefix && <span className="text-[12px] font-mono text-fg-muted">{prefix}</span>}
        <span className={cn("text-xl font-mono font-semibold tabular-nums", valueColor)}>
          {prefix === "₹"
            ? formatINR(value).replace("₹", "")
            : value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
        </span>
        {suffix && <span className="text-[12px] font-mono text-fg-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h4 className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle mb-2">{title}</h4>
  );
}

function statusColor(status: InvoiceRecord["status"]) {
  switch (status) {
    case "paid":
      return "text-positive";
    case "overdue":
      return "text-negative";
    case "partial":
      return "text-warning";
    case "sent":
      return "text-accent";
    default:
      return "text-fg-muted";
  }
}

function InvoiceRow({ inv, highlight }: { inv: InvoiceRecord; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[100px_1fr_120px_100px] gap-3 px-3.5 py-2.5 text-[12px]",
        highlight && "bg-negative/5",
      )}
    >
      <span className="font-mono text-fg-muted">{inv.number}</span>
      <span className="text-fg truncate">{inv.customerName}</span>
      <span className="font-mono text-fg-muted">
        {inv.daysOverdue > 0 ? <span className="text-negative">{inv.daysOverdue} days late</span> : format(new Date(inv.dueDate), "dd MMM")}
      </span>
      <span className="font-mono text-fg text-right tabular-nums">{formatINR(inv.amountDue)}</span>
    </div>
  );
}
