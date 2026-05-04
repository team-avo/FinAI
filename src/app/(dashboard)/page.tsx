"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CreditCard,
  FileText,
  TrendingUp,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { KPICard } from "@/components/dashboard/kpi-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ExpenseDonut } from "@/components/dashboard/expense-donut";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { GradientMesh } from "@/components/effects/gradient-mesh";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { formatINR } from "@/lib/utils";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

const now = new Date();
const from = startOfMonth(subMonths(now, 5)).toISOString();
const to = endOfMonth(now).toISOString();

export default function DashboardPage() {
  const kpis = trpc.dashboard.kpis.useQuery();
  const chart = trpc.dashboard.revenueChart.useQuery();
  const recentInvoices = trpc.dashboard.recentInvoices.useQuery();
  const recentExpenses = trpc.dashboard.recentExpenses.useQuery();
  const breakdown = trpc.reports.expenseBreakdown.useQuery({ from, to });

  const isLoading =
    kpis.isLoading ||
    chart.isLoading ||
    recentInvoices.isLoading ||
    recentExpenses.isLoading;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Hero Strip */}
      <div className="relative rounded-md border border-border bg-bg-elevated overflow-hidden p-5">
        <GradientMesh className="absolute inset-0 opacity-40" />
        <div className="relative z-10">
          <p className="text-[11px] font-mono uppercase tracking-widest text-fg-muted mb-0.5">
            {format(now, "EEEE, dd MMMM yyyy")}
          </p>
          <h1 className="text-xl font-semibold text-fg">Good{getGreeting()}, AdvertOut</h1>
          <p className="text-[13px] text-fg-muted mt-0.5">
            Here&apos;s your financial snapshot for{" "}
            {format(now, "MMMM yyyy")}.
          </p>
        </div>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="h-[88px] rounded-md" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            title="Revenue (MTD)"
            value={kpis.data?.revenue.current ?? 0}
            change={kpis.data?.revenue.change}
            icon={<TrendingUp className="h-4 w-4" />}
            trend="up-good"
          />
          <KPICard
            title="Expenses (MTD)"
            value={kpis.data?.expenses.current ?? 0}
            change={kpis.data?.expenses.change}
            icon={<CreditCard className="h-4 w-4" />}
            trend="up-bad"
          />
          <KPICard
            title="Net Profit (MTD)"
            value={kpis.data?.netProfit.current ?? 0}
            icon={<BarChart3 className="h-4 w-4" />}
            trend="up-good"
          />
          <KPICard
            title="Outstanding AR"
            value={kpis.data?.outstanding ?? 0}
            icon={<AlertCircle className="h-4 w-4" />}
            trend="neutral"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {chart.isLoading ? (
              <ShimmerSkeleton className="h-[180px] rounded" />
            ) : (
              <RevenueChart data={chart.data ?? []} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {breakdown.isLoading ? (
              <ShimmerSkeleton className="h-[180px] rounded" />
            ) : (
              <ExpenseDonut data={breakdown.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Invoices</CardTitle>
              <Link
                href="/invoices"
                className="flex items-center gap-1 text-[12px] text-fg-muted hover:text-accent transition-colors"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-1">
            {recentInvoices.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <ShimmerSkeleton key={i} className="h-9 rounded" />
                ))}
              </div>
            ) : recentInvoices.data?.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                label="No invoices yet"
                href="/invoices/new"
                action="Create Invoice"
              />
            ) : (
              <div>
                {recentInvoices.data?.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center gap-3 px-4 h-11 hover:bg-bg-subtle transition-colors border-b border-border/50 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-fg truncate">{inv.contactName}</p>
                      <p className="text-[11px] font-mono text-fg-muted">{inv.number}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <InvoiceStatusBadge status={inv.status} />
                      <span className="text-[13px] font-mono tabular-nums text-fg">
                        {formatINR(parseFloat(inv.total))}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Expenses</CardTitle>
              <Link
                href="/expenses"
                className="flex items-center gap-1 text-[12px] text-fg-muted hover:text-accent transition-colors"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-1">
            {recentExpenses.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <ShimmerSkeleton key={i} className="h-9 rounded" />
                ))}
              </div>
            ) : recentExpenses.data?.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="h-5 w-5" />}
                label="No expenses yet"
                href="/expenses/new"
                action="Record Expense"
              />
            ) : (
              <div>
                {recentExpenses.data?.map((exp) => (
                  <Link
                    key={exp.id}
                    href={`/expenses`}
                    className="flex items-center gap-3 px-4 h-11 hover:bg-bg-subtle transition-colors border-b border-border/50 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-fg truncate">
                        {exp.vendorName ?? exp.notes ?? "Expense"}
                      </p>
                      <p className="text-[11px] font-mono text-fg-muted">
                        {format(new Date(exp.date), "dd MMM yyyy")}
                      </p>
                    </div>
                    <span className="text-[13px] font-mono tabular-nums text-negative shrink-0">
                      -{formatINR(parseFloat(exp.totalAmount))}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  label,
  href,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-subtle border border-border text-fg-muted mb-2">
        {icon}
      </div>
      <p className="text-[13px] text-fg-muted">{label}</p>
      <Link
        href={href}
        className="mt-2 text-[12px] text-accent hover:underline"
      >
        {action}
      </Link>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return " morning";
  if (h < 17) return " afternoon";
  return " evening";
}
