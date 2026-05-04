"use client";

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ExpenseDonut } from "@/components/dashboard/expense-donut";
import { formatINR } from "@/lib/utils";

const PERIODS = [
  { label: "This Month", from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
  { label: "Last Month", from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) },
  { label: "This Year", from: startOfYear(new Date()), to: endOfYear(new Date()) },
  { label: "Last 3 Months", from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) },
  { label: "Last 6 Months", from: startOfMonth(subMonths(new Date(), 5)), to: endOfMonth(new Date()) },
];

export default function ReportsPage() {
  const [periodIdx, setPeriodIdx] = useState(0);
  const period = PERIODS[periodIdx];

  const from = period.from.toISOString();
  const to = period.to.toISOString();

  const pnl = trpc.reports.pnl.useQuery({ from, to });
  const expenseBreakdown = trpc.reports.expenseBreakdown.useQuery({ from, to });
  const outstanding = trpc.reports.outstanding.useQuery();
  const monthlyPnL = trpc.reports.monthlyPnL.useQuery({ months: 6 });

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-fg">Reports</h1>
          <p className="text-[13px] text-fg-muted">
            {format(period.from, "dd MMM yyyy")} — {format(period.to, "dd MMM yyyy")}
          </p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPeriodIdx(i)}
              className={`px-2.5 h-7 text-[12px] rounded border transition-colors ${
                i === periodIdx
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-fg-muted hover:text-fg"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      {pnl.isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Revenue" value={pnl.data?.totalRevenue ?? 0} positive />
          <StatCard label="Total Expenses" value={pnl.data?.totalExpenses ?? 0} negative />
          <StatCard
            label="Net Profit"
            value={pnl.data?.netProfit ?? 0}
            positive={(pnl.data?.netProfit ?? 0) >= 0}
            negative={(pnl.data?.netProfit ?? 0) < 0}
          />
        </div>
      )}

      <Tabs defaultValue="pnl">
        <TabsList>
          <TabsTrigger value="pnl">P&L</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="trend">Trend</TabsTrigger>
        </TabsList>

        {/* P&L Tab */}
        <TabsContent value="pnl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-positive">Revenue</CardTitle></CardHeader>
              <CardContent className="p-0 pb-1">
                {pnl.isLoading ? (
                  <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <ShimmerSkeleton key={i} className="h-8 rounded" />)}</div>
                ) : pnl.data?.revenue.length === 0 ? (
                  <div className="p-4 text-center text-[13px] text-fg-muted">No revenue in this period</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pnl.data?.revenue.map((acc) => (
                        <TableRow key={acc.accountId}>
                          <TableCell>
                            <p className="text-fg">{acc.accountName}</p>
                            <p className="text-[11px] font-mono text-fg-muted">{acc.accountCode}</p>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-positive">
                            {formatINR(acc.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold">
                        <TableCell>Total Revenue</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-positive">
                          {formatINR(pnl.data?.totalRevenue ?? 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-negative">Expenses</CardTitle></CardHeader>
              <CardContent className="p-0 pb-1">
                {pnl.isLoading ? (
                  <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <ShimmerSkeleton key={i} className="h-8 rounded" />)}</div>
                ) : pnl.data?.expenses.length === 0 ? (
                  <div className="p-4 text-center text-[13px] text-fg-muted">No expenses in this period</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pnl.data?.expenses.map((acc) => (
                        <TableRow key={acc.accountId}>
                          <TableCell>
                            <p className="text-fg">{acc.accountName}</p>
                            <p className="text-[11px] font-mono text-fg-muted">{acc.accountCode}</p>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-negative">
                            {formatINR(acc.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold">
                        <TableCell>Total Expenses</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-negative">
                          {formatINR(pnl.data?.totalExpenses ?? 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Expense Breakdown Tab */}
        <TabsContent value="expenses">
          <Card>
            <CardContent className="p-4">
              {expenseBreakdown.isLoading ? (
                <ShimmerSkeleton className="h-[200px] rounded" />
              ) : (
                <ExpenseDonut data={expenseBreakdown.data ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outstanding Tab */}
        <TabsContent value="outstanding">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Outstanding Receivables</CardTitle>
                {outstanding.data && (
                  <span className="text-[13px] font-mono font-semibold text-negative">
                    {formatINR(outstanding.data.totalOutstanding)}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-1">
              {outstanding.isLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <ShimmerSkeleton key={i} className="h-8 rounded" />)}</div>
              ) : outstanding.data?.items.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-fg-muted">
                  No outstanding receivables
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead className="text-right">Amount Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outstanding.data?.items.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-[12px] font-medium text-fg">
                          {inv.number}
                        </TableCell>
                        <TableCell className="text-fg">{inv.contactName}</TableCell>
                        <TableCell className="font-mono text-[12px] text-fg-muted">
                          {inv.dueDate ? format(new Date(inv.dueDate), "dd MMM yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          {inv.daysOverdue > 0 ? (
                            <span className="text-[12px] font-mono text-negative">
                              {inv.daysOverdue}d overdue
                            </span>
                          ) : (
                            <span className="text-[12px] text-fg-muted">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-negative font-semibold">
                          {formatINR(inv.amountDue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trend Tab */}
        <TabsContent value="trend">
          <Card>
            <CardHeader><CardTitle>6-Month Revenue vs Expenses</CardTitle></CardHeader>
            <CardContent>
              {monthlyPnL.isLoading ? (
                <ShimmerSkeleton className="h-[200px] rounded" />
              ) : (
                <RevenueChart data={monthlyPnL.data ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, positive, negative }: { label: string; value: number; positive?: boolean; negative?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wider text-fg-muted mb-1">{label}</p>
        <div className="flex items-center gap-2">
          {positive && !negative && <TrendingUp className="h-4 w-4 text-positive" />}
          {negative && <TrendingDown className="h-4 w-4 text-negative" />}
          <span className={`text-xl font-mono font-semibold tabular-nums ${positive && !negative ? "text-positive" : negative ? "text-negative" : "text-fg"}`}>
            {formatINR(value)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
