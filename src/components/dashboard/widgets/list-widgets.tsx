"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CreditCard,
  FileText,
  Receipt,
  Sparkles,
  Users,
  Wallet,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sun,
  ArrowRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { BriefingContent } from "@/lib/trpc/routers/briefings";
import { WidgetCard } from "@/components/dashboard/grid/widget-card";
import { DrillDownModal, useDrillStack } from "./drill-down-modal";
import { formatINR, cn } from "@/lib/utils";
import type { AnomalyAlert, DashboardAggregate, InvoiceRecord } from "@/lib/dashboard/types";

interface WidgetProps {
  data: DashboardAggregate;
  editing?: boolean;
  onRemove?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Top Customers
// ─────────────────────────────────────────────────────────────────────────────
export function TopCustomersWidget({ data, editing, onRemove }: WidgetProps) {
  const drill = useDrillStack({ title: "Top Customers", content: null });
  const customers = data.customers.topByRevenue;
  const max = Math.max(...customers.map((c) => c.totalRevenue), 1);

  return (
    <>
      <WidgetCard
        title="Top Customers"
        subtitle="By revenue"
        icon={<Users className="h-3.5 w-3.5" />}
        editing={editing}
        onRemove={onRemove}
        clickable
        onClick={() =>
          drill.openAt({
            title: "Top customers",
            eyebrow: "Customers",
            subtitle: `${data.customers.all.length} customers · ${formatINR(data.revenue.ytd)} YTD`,
            content: <AllCustomersDrill data={data} />,
          })
        }
      >
        <div className="space-y-2">
          {customers.map((c) => (
            <div key={c.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-fg truncate">{c.name}</span>
                <span className="font-mono text-[12px] text-fg tabular-nums shrink-0">
                  {formatINR(c.totalRevenue, { compact: true })}
                </span>
              </div>
              <div className="h-1 rounded-full bg-bg-subtle overflow-hidden">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${(c.totalRevenue / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </WidgetCard>
      <DrillDownModal open={drill.open} onOpenChange={drill.setOpen} levels={drill.levels} onPop={drill.pop} />
    </>
  );
}

function AllCustomersDrill({ data }: { data: DashboardAggregate }) {
  const customers = data.customers.all;
  return (
    <div className="rounded-md border border-border bg-bg-elevated overflow-hidden">
      <div className="grid grid-cols-[1fr_100px_100px_120px_100px] gap-3 px-3.5 py-2 text-[10px] font-mono uppercase tracking-wider text-fg-subtle border-b border-border/60">
        <span>Customer</span>
        <span>State</span>
        <span className="text-right">Invoices</span>
        <span className="text-right">Revenue</span>
        <span className="text-right">Outstanding</span>
      </div>
      {customers.map((c) => (
        <div
          key={c.id}
          className="grid grid-cols-[1fr_100px_100px_120px_100px] gap-3 px-3.5 py-2.5 text-[12px] border-b border-border/30 last:border-0"
        >
          <span className="text-fg truncate">{c.name}</span>
          <span className="text-fg-muted truncate">{c.state}</span>
          <span className="font-mono text-fg-muted text-right">{c.invoiceCount}</span>
          <span className="font-mono text-fg text-right tabular-nums">{formatINR(c.totalRevenue)}</span>
          <span
            className={cn(
              "font-mono text-right tabular-nums",
              c.outstanding > 0 ? "text-warning" : "text-fg-muted",
            )}
          >
            {c.outstanding > 0 ? formatINR(c.outstanding) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top Vendors
// ─────────────────────────────────────────────────────────────────────────────
export function TopVendorsWidget({ data, editing, onRemove }: WidgetProps) {
  const drill = useDrillStack({ title: "Top Vendors", content: null });
  const vendors = data.expensesData.topVendors.slice(0, 5);
  const max = Math.max(...vendors.map((v) => v.totalSpend), 1);

  return (
    <>
      <WidgetCard
        title="Top Vendors"
        subtitle="By spend"
        icon={<Receipt className="h-3.5 w-3.5" />}
        editing={editing}
        onRemove={onRemove}
        clickable
        onClick={() =>
          drill.openAt({
            title: "All vendors",
            eyebrow: "Vendors",
            subtitle: `${data.expensesData.topVendors.length} vendors this month`,
            content: <AllVendorsDrill data={data} />,
          })
        }
      >
        <div className="space-y-2">
          {vendors.map((v) => (
            <div key={v.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  <span className="text-[12px] text-fg truncate">{v.name}</span>
                  <span className="text-[10px] font-mono text-fg-subtle">· {v.expenseCount}</span>
                </div>
                <span className="font-mono text-[12px] text-fg tabular-nums shrink-0">
                  {formatINR(v.totalSpend, { compact: true })}
                </span>
              </div>
              <div className="h-1 rounded-full bg-bg-subtle overflow-hidden">
                <div
                  className="h-full bg-fg-muted"
                  style={{ width: `${(v.totalSpend / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </WidgetCard>
      <DrillDownModal open={drill.open} onOpenChange={drill.setOpen} levels={drill.levels} onPop={drill.pop} />
    </>
  );
}

function AllVendorsDrill({ data }: { data: DashboardAggregate }) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated overflow-hidden">
      <div className="grid grid-cols-[1fr_180px_100px_120px] gap-3 px-3.5 py-2 text-[10px] font-mono uppercase tracking-wider text-fg-subtle border-b border-border/60">
        <span>Vendor</span>
        <span>Category</span>
        <span className="text-right">Transactions</span>
        <span className="text-right">Total Spend</span>
      </div>
      {data.expensesData.topVendors.map((v) => (
        <div
          key={v.id}
          className="grid grid-cols-[1fr_180px_100px_120px] gap-3 px-3.5 py-2.5 text-[12px] border-b border-border/30 last:border-0"
        >
          <span className="text-fg truncate">{v.name}</span>
          <span className="text-fg-muted truncate">{v.category}</span>
          <span className="font-mono text-fg-muted text-right">{v.expenseCount}</span>
          <span className="font-mono text-fg text-right tabular-nums">{formatINR(v.totalSpend)}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent Invoices
// ─────────────────────────────────────────────────────────────────────────────
export function RecentInvoicesWidget({ data, editing, onRemove }: WidgetProps) {
  const drill = useDrillStack({ title: "Recent Invoices", content: null });
  return (
    <>
      <WidgetCard
        title="Recent Invoices"
        icon={<FileText className="h-3.5 w-3.5" />}
        editing={editing}
        onRemove={onRemove}
        clickable
        onClick={() =>
          drill.openAt({
            title: "All invoices",
            eyebrow: "Invoices",
            subtitle: `${data.invoices.all.length} invoices · ${formatINR(data.invoices.averageValue)} avg value`,
            content: <AllInvoicesDrill data={data} />,
          })
        }
      >
        <div className="divide-y divide-border/40">
          {data.invoices.recent.slice(0, 6).map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-fg truncate">{inv.customerName}</p>
                <p className="text-[10px] font-mono text-fg-muted">{inv.number}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-[13px] tabular-nums text-fg">
                  {formatINR(inv.total, { compact: true })}
                </p>
                <p className={cn("text-[10px] font-mono uppercase tracking-wider", invStatusClass(inv.status))}>
                  {inv.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </WidgetCard>
      <DrillDownModal open={drill.open} onOpenChange={drill.setOpen} levels={drill.levels} onPop={drill.pop} />
    </>
  );
}

function AllInvoicesDrill({ data }: { data: DashboardAggregate }) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated overflow-hidden">
      <div className="grid grid-cols-[100px_1fr_120px_80px_100px_100px] gap-3 px-3.5 py-2 text-[10px] font-mono uppercase tracking-wider text-fg-subtle border-b border-border/60">
        <span>Number</span>
        <span>Customer</span>
        <span>Issue Date</span>
        <span>Status</span>
        <span className="text-right">Total</span>
        <span className="text-right">Due</span>
      </div>
      {data.invoices.all.slice(0, 50).map((inv) => (
        <div
          key={inv.id}
          className="grid grid-cols-[100px_1fr_120px_80px_100px_100px] gap-3 px-3.5 py-2 text-[12px] border-b border-border/30 last:border-0"
        >
          <span className="font-mono text-fg-muted">{inv.number}</span>
          <span className="text-fg truncate">{inv.customerName}</span>
          <span className="font-mono text-fg-muted">{format(new Date(inv.issueDate), "dd MMM yyyy")}</span>
          <span className={cn("text-[10px] font-mono uppercase tracking-wider", invStatusClass(inv.status))}>
            {inv.status}
          </span>
          <span className="font-mono text-fg text-right tabular-nums">{formatINR(inv.total)}</span>
          <span
            className={cn(
              "font-mono text-right tabular-nums",
              inv.amountDue > 0 ? "text-warning" : "text-fg-muted",
            )}
          >
            {inv.amountDue > 0 ? formatINR(inv.amountDue) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent Expenses
// ─────────────────────────────────────────────────────────────────────────────
export function RecentExpensesWidget({ data, editing, onRemove }: WidgetProps) {
  const drill = useDrillStack({ title: "Recent Expenses", content: null });
  return (
    <>
      <WidgetCard
        title="Recent Expenses"
        icon={<CreditCard className="h-3.5 w-3.5" />}
        editing={editing}
        onRemove={onRemove}
        clickable
        onClick={() =>
          drill.openAt({
            title: "All expenses",
            eyebrow: "Expenses",
            subtitle: `${data.expensesData.all.length} entries`,
            content: <AllExpensesDrill data={data} />,
          })
        }
      >
        <div className="divide-y divide-border/40">
          {data.expensesData.recent.slice(0, 6).map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-fg truncate">{e.vendorName}</p>
                <p className="text-[10px] font-mono text-fg-muted">
                  {format(new Date(e.date), "dd MMM")} · {e.source.replace("_", " ")}
                </p>
              </div>
              <p className="font-mono text-[13px] tabular-nums text-negative shrink-0">
                -{formatINR(e.totalAmount, { compact: true })}
              </p>
            </div>
          ))}
        </div>
      </WidgetCard>
      <DrillDownModal open={drill.open} onOpenChange={drill.setOpen} levels={drill.levels} onPop={drill.pop} />
    </>
  );
}

function AllExpensesDrill({ data }: { data: DashboardAggregate }) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated overflow-hidden">
      <div className="grid grid-cols-[100px_1fr_180px_120px_100px] gap-3 px-3.5 py-2 text-[10px] font-mono uppercase tracking-wider text-fg-subtle border-b border-border/60">
        <span>Date</span>
        <span>Vendor</span>
        <span>Category</span>
        <span>Source</span>
        <span className="text-right">Amount</span>
      </div>
      {data.expensesData.all.slice(0, 80).map((e) => (
        <div
          key={e.id}
          className="grid grid-cols-[100px_1fr_180px_120px_100px] gap-3 px-3.5 py-2 text-[12px] border-b border-border/30 last:border-0"
        >
          <span className="font-mono text-fg-muted">{format(new Date(e.date), "dd MMM yyyy")}</span>
          <span className="text-fg truncate">{e.vendorName}</span>
          <span className="text-fg-muted truncate">{e.category}</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle">
            {e.source.replace("_", " ")}
          </span>
          <span className="font-mono text-fg text-right tabular-nums">{formatINR(e.totalAmount)}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Activity
// ─────────────────────────────────────────────────────────────────────────────
export function AIActivityWidget({ data, editing, onRemove }: WidgetProps) {
  return (
    <WidgetCard
      title="AI Activity"
      subtitle="Recent agent actions"
      icon={<Sparkles className="h-3.5 w-3.5" />}
      editing={editing}
      onRemove={onRemove}
    >
      <div className="space-y-2.5">
        {data.aiActivity.map((a) => (
          <div key={a.id} className="flex items-start gap-2.5 text-[12px]">
            <div
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded mt-0.5",
                a.status === "success"
                  ? "bg-positive/10 text-positive"
                  : a.status === "pending"
                    ? "bg-warning/10 text-warning"
                    : "bg-fg-muted/10 text-fg-muted",
              )}
            >
              {a.status === "success" ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : a.status === "pending" ? (
                <Clock className="h-3 w-3" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-fg leading-snug">
                <span className="font-medium">{a.action}</span>{" "}
                <span className="text-fg-muted">— {a.description}</span>
              </p>
              <p className="text-[10px] font-mono text-fg-subtle mt-0.5">
                {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })} · {a.source}
              </p>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Anomaly Alerts
// ─────────────────────────────────────────────────────────────────────────────
export function AnomalyAlertsWidget({ data, editing, onRemove }: WidgetProps) {
  return (
    <WidgetCard
      title="Alerts"
      subtitle={`${data.alerts.length} need attention`}
      icon={<AlertTriangle className="h-3.5 w-3.5" />}
      editing={editing}
      onRemove={onRemove}
    >
      <div className="space-y-2">
        {data.alerts.map((a) => (
          <AlertRow key={a.id} alert={a} />
        ))}
      </div>
    </WidgetCard>
  );
}

function AlertRow({ alert }: { alert: AnomalyAlert }) {
  const colors =
    alert.level === "critical"
      ? "border-negative/30 bg-negative/5"
      : alert.level === "warning"
        ? "border-warning/30 bg-warning/5"
        : "border-border bg-bg-subtle";
  const dotColor =
    alert.level === "critical"
      ? "bg-negative"
      : alert.level === "warning"
        ? "bg-warning"
        : "bg-accent";

  return (
    <div className={cn("rounded-md border p-2.5 flex gap-2.5", colors)}>
      <span className={cn("h-1.5 w-1.5 rounded-full mt-2 shrink-0", dotColor)} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-fg leading-snug">{alert.title}</p>
        <p className="text-[11px] text-fg-muted leading-snug mt-0.5">{alert.description}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GST Summary
// ─────────────────────────────────────────────────────────────────────────────
export function GstSummaryWidget({ data, editing, onRemove }: WidgetProps) {
  const drill = useDrillStack({ title: "GST Summary", content: null });
  const g = data.gst;

  return (
    <>
      <WidgetCard
        title="GST Summary"
        subtitle="Current period"
        icon={<Wallet className="h-3.5 w-3.5" />}
        editing={editing}
        onRemove={onRemove}
        clickable
        onClick={() =>
          drill.openAt({
            title: "GST overview",
            eyebrow: "Tax",
            subtitle: `Net payable: ${formatINR(g.netPayable)}`,
            content: <GstDrill data={data} />,
          })
        }
      >
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded border border-border bg-bg-subtle px-2.5 py-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle">Liability</p>
            <p className="font-mono text-[14px] font-semibold text-fg tabular-nums mt-0.5">
              {formatINR(g.totalLiability, { compact: true })}
            </p>
          </div>
          <div className="rounded border border-border bg-bg-subtle px-2.5 py-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle">ITC</p>
            <p className="font-mono text-[14px] font-semibold text-positive tabular-nums mt-0.5">
              {formatINR(g.inputTaxCredit, { compact: true })}
            </p>
          </div>
          <div className="col-span-2 rounded border border-border bg-bg-subtle px-2.5 py-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle">Net Payable</p>
            <p className="font-mono text-[16px] font-semibold text-warning tabular-nums mt-0.5">
              {formatINR(g.netPayable)}
            </p>
          </div>
        </div>
      </WidgetCard>
      <DrillDownModal open={drill.open} onOpenChange={drill.setOpen} levels={drill.levels} onPop={drill.pop} />
    </>
  );
}

function GstDrill({ data }: { data: DashboardAggregate }) {
  const g = data.gst;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-border bg-bg-elevated p-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">CGST</p>
          <p className="font-mono text-xl font-semibold text-fg tabular-nums mt-1">{formatINR(g.cgstCollected)}</p>
        </div>
        <div className="rounded-md border border-border bg-bg-elevated p-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">SGST</p>
          <p className="font-mono text-xl font-semibold text-fg tabular-nums mt-1">{formatINR(g.sgstCollected)}</p>
        </div>
        <div className="rounded-md border border-border bg-bg-elevated p-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">IGST</p>
          <p className="font-mono text-xl font-semibold text-fg tabular-nums mt-1">{formatINR(g.igstCollected)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border bg-bg-elevated p-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">Total Liability</p>
          <p className="font-mono text-xl font-semibold text-fg tabular-nums mt-1">{formatINR(g.totalLiability)}</p>
        </div>
        <div className="rounded-md border border-border bg-bg-elevated p-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">Input Tax Credit</p>
          <p className="font-mono text-xl font-semibold text-positive tabular-nums mt-1">{formatINR(g.inputTaxCredit)}</p>
        </div>
      </div>
      <div className="rounded-md border border-warning/30 bg-warning/5 p-3.5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-warning">Net Payable</p>
        <p className="font-mono text-2xl font-semibold text-warning tabular-nums mt-1">{formatINR(g.netPayable)}</p>
      </div>
      <div>
        <h4 className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle mb-2">
          Place of supply breakdown
        </h4>
        <div className="rounded-md border border-border bg-bg-elevated divide-y divide-border/40">
          {g.placeOfSupplyBreakdown.map((p) => (
            <div key={p.state} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="text-fg">{p.state}</span>
                <span
                  className={cn(
                    "text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded",
                    p.type === "intra" ? "bg-accent/10 text-accent" : "bg-info/10 text-info",
                  )}
                >
                  {p.type}-state
                </span>
              </div>
              <span className="font-mono text-fg tabular-nums">{formatINR(p.revenue)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function invStatusClass(status: InvoiceRecord["status"]) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Morning Briefing
// ─────────────────────────────────────────────────────────────────────────────
export function MorningBriefingWidget({ editing, onRemove }: { editing?: boolean; onRemove?: () => void }) {
  const { data: briefing, isLoading } = trpc.briefings.latest.useQuery();
  const content = briefing?.content as BriefingContent | undefined;

  return (
    <WidgetCard
      title="Morning Briefing"
      subtitle={briefing ? new Date(briefing.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "No briefing yet"}
      icon={<Sun className="h-3.5 w-3.5" />}
      editing={editing}
      onRemove={onRemove}
    >
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-bg-subtle rounded animate-pulse" />
          ))}
        </div>
      ) : !content ? (
        <div className="flex flex-col items-center justify-center py-6 text-fg-muted">
          <Sun className="h-6 w-6 opacity-30 mb-1.5" />
          <p className="text-[12px]">No briefing yet</p>
          <p className="text-[11px] opacity-60 mt-0.5">Generated daily at 9 AM</p>
        </div>
      ) : (
        <div className="space-y-3">
          {content.greeting && (
            <p className="text-[12px] text-fg-muted italic">{content.greeting}</p>
          )}
          {content.headline && (
            <p className="text-[13px] font-semibold text-fg">{content.headline}</p>
          )}
          {content.topConcerns?.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle mb-1">Concerns</p>
              <ul className="space-y-1">
                {content.topConcerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[12px] text-fg-muted">
                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {content.suggestedActions?.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle mb-1">Actions</p>
              <ul className="space-y-1">
                {content.suggestedActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[12px] text-fg">
                    <ArrowRight className="h-3 w-3 text-accent shrink-0 mt-0.5" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {content.cashPosition && (
            <p className="text-[11px] text-fg-muted border-t border-border pt-2">{content.cashPosition}</p>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
