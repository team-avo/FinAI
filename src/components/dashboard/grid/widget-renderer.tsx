"use client";

import {
  RevenueMtdWidget,
  ExpensesMtdWidget,
  NetProfitMtdWidget,
  OutstandingReceivablesWidget,
  BankBalanceWidget,
} from "@/components/dashboard/widgets/kpi-widgets";
import {
  RevenueVsExpensesWidget,
  ExpensesByCategoryWidget,
} from "@/components/dashboard/widgets/chart-widgets";
import {
  TopCustomersWidget,
  TopVendorsWidget,
  RecentInvoicesWidget,
  RecentExpensesWidget,
  AIActivityWidget,
  AnomalyAlertsWidget,
  GstSummaryWidget,
} from "@/components/dashboard/widgets/list-widgets";
import type { WidgetId } from "@/lib/dashboard/widgets-registry";
import type { DashboardAggregate } from "@/lib/dashboard/types";

interface WidgetRendererProps {
  type: WidgetId;
  data: DashboardAggregate;
  editing?: boolean;
  onRemove?: () => void;
}

export function WidgetRenderer({ type, data, editing, onRemove }: WidgetRendererProps) {
  switch (type) {
    case "revenue-mtd":
      return <RevenueMtdWidget data={data} editing={editing} onRemove={onRemove} />;
    case "expenses-mtd":
      return <ExpensesMtdWidget data={data} editing={editing} onRemove={onRemove} />;
    case "net-profit-mtd":
      return <NetProfitMtdWidget data={data} editing={editing} onRemove={onRemove} />;
    case "outstanding-receivables":
      return <OutstandingReceivablesWidget data={data} editing={editing} onRemove={onRemove} />;
    case "bank-balance":
      return <BankBalanceWidget data={data} editing={editing} onRemove={onRemove} />;
    case "revenue-vs-expenses":
      return <RevenueVsExpensesWidget data={data} editing={editing} onRemove={onRemove} />;
    case "expenses-by-category":
      return <ExpensesByCategoryWidget data={data} editing={editing} onRemove={onRemove} />;
    case "top-customers":
      return <TopCustomersWidget data={data} editing={editing} onRemove={onRemove} />;
    case "top-vendors":
      return <TopVendorsWidget data={data} editing={editing} onRemove={onRemove} />;
    case "recent-invoices":
      return <RecentInvoicesWidget data={data} editing={editing} onRemove={onRemove} />;
    case "recent-expenses":
      return <RecentExpensesWidget data={data} editing={editing} onRemove={onRemove} />;
    case "ai-activity":
      return <AIActivityWidget data={data} editing={editing} onRemove={onRemove} />;
    case "anomaly-alerts":
      return <AnomalyAlertsWidget data={data} editing={editing} onRemove={onRemove} />;
    case "gst-summary":
      return <GstSummaryWidget data={data} editing={editing} onRemove={onRemove} />;
    default:
      return null;
  }
}
