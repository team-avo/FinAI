import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Calendar,
  CreditCard,
  FileText,
  Landmark,
  PieChart,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { WidgetCategory, WidgetSize } from "./types";

export type WidgetId =
  | "revenue-mtd"
  | "expenses-mtd"
  | "net-profit-mtd"
  | "outstanding-receivables"
  | "bank-balance"
  | "expenses-by-category"
  | "revenue-vs-expenses"
  | "top-customers"
  | "top-vendors"
  | "recent-invoices"
  | "recent-expenses"
  | "ai-activity"
  | "anomaly-alerts"
  | "gst-summary";

export interface WidgetDef {
  id: WidgetId;
  category: WidgetCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
}

export const WIDGET_REGISTRY: Record<WidgetId, WidgetDef> = {
  "revenue-mtd": {
    id: "revenue-mtd",
    category: "revenue",
    label: "Revenue (MTD)",
    description: "Month-to-date revenue with vs-last-month delta",
    icon: TrendingUp,
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
  },
  "expenses-mtd": {
    id: "expenses-mtd",
    category: "expenses",
    label: "Expenses (MTD)",
    description: "Month-to-date spend with category breakdown drill-down",
    icon: TrendingDown,
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
  },
  "net-profit-mtd": {
    id: "net-profit-mtd",
    category: "profitability",
    label: "Net Profit (MTD)",
    description: "Revenue minus expenses, with margin %",
    icon: BarChart3,
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
  },
  "outstanding-receivables": {
    id: "outstanding-receivables",
    category: "revenue",
    label: "Outstanding",
    description: "Total unpaid + overdue count",
    icon: ArrowUpRight,
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
  },
  "bank-balance": {
    id: "bank-balance",
    category: "cash",
    label: "Bank Balance",
    description: "Total balance across all linked accounts",
    icon: Landmark,
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
  },
  "expenses-by-category": {
    id: "expenses-by-category",
    category: "expenses",
    label: "Expenses by Category",
    description: "Donut breakdown of spend across categories",
    icon: PieChart,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  "revenue-vs-expenses": {
    id: "revenue-vs-expenses",
    category: "profitability",
    label: "Revenue vs Expenses",
    description: "6-month trend of revenue, expenses, and profit",
    icon: BarChart3,
    defaultSize: { w: 8, h: 4 },
    minSize: { w: 5, h: 3 },
  },
  "top-customers": {
    id: "top-customers",
    category: "revenue",
    label: "Top Customers",
    description: "Highest revenue contributors",
    icon: Users,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  "top-vendors": {
    id: "top-vendors",
    category: "expenses",
    label: "Top Vendors",
    description: "Where your money goes — vendor breakdown",
    icon: Receipt,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  "recent-invoices": {
    id: "recent-invoices",
    category: "ops",
    label: "Recent Invoices",
    description: "Latest invoices with status",
    icon: FileText,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
  },
  "recent-expenses": {
    id: "recent-expenses",
    category: "ops",
    label: "Recent Expenses",
    description: "Latest expenses from bank, photos, manual",
    icon: CreditCard,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
  },
  "ai-activity": {
    id: "ai-activity",
    category: "ops",
    label: "AI Activity",
    description: "Recent actions taken by your AI agent",
    icon: Sparkles,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
  },
  "anomaly-alerts": {
    id: "anomaly-alerts",
    category: "alerts",
    label: "Alerts",
    description: "Anomalies, overdue, and things needing attention",
    icon: AlertTriangle,
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
  },
  "gst-summary": {
    id: "gst-summary",
    category: "gst",
    label: "GST Summary",
    description: "Liability, ITC, net payable for current period",
    icon: Wallet,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
  },
};

export const ALL_WIDGET_IDS = Object.keys(WIDGET_REGISTRY) as WidgetId[];

// Smart defaults — what shows up if a user clicks "Use smart defaults" in onboarding
export const DEFAULT_WIDGET_IDS: WidgetId[] = [
  "revenue-mtd",
  "expenses-mtd",
  "net-profit-mtd",
  "outstanding-receivables",
  "revenue-vs-expenses",
  "expenses-by-category",
  "top-customers",
  "anomaly-alerts",
  "ai-activity",
];

// Sensible default layout for the smart defaults set, on a 12-col grid
export function buildDefaultLayout(widgetIds: WidgetId[] = DEFAULT_WIDGET_IDS): {
  gridConfig: { i: string; x: number; y: number; w: number; h: number }[];
  widgets: Record<string, { type: WidgetId }>;
} {
  const gridConfig: { i: string; x: number; y: number; w: number; h: number }[] = [];
  const widgets: Record<string, { type: WidgetId }> = {};

  // Row 1: 4 KPI tiles (3w each = 12)
  const kpis = widgetIds.filter((id) =>
    ["revenue-mtd", "expenses-mtd", "net-profit-mtd", "outstanding-receivables", "bank-balance"].includes(
      id,
    ),
  );
  let x = 0;
  let y = 0;
  for (const id of kpis.slice(0, 4)) {
    const def = WIDGET_REGISTRY[id];
    const inst = `${id}-${Math.random().toString(36).slice(2, 8)}`;
    gridConfig.push({ i: inst, x, y, w: def.defaultSize.w, h: def.defaultSize.h });
    widgets[inst] = { type: id };
    x += def.defaultSize.w;
    if (x >= 12) {
      x = 0;
      y += def.defaultSize.h;
    }
  }
  if (x > 0) {
    x = 0;
    y += 2;
  }

  // Row 2: revenue-vs-expenses (8w) + expenses-by-category (4w)
  if (widgetIds.includes("revenue-vs-expenses")) {
    const inst = `revenue-vs-expenses-${Math.random().toString(36).slice(2, 8)}`;
    gridConfig.push({ i: inst, x: 0, y, w: 8, h: 4 });
    widgets[inst] = { type: "revenue-vs-expenses" };
  }
  if (widgetIds.includes("expenses-by-category")) {
    const inst = `expenses-by-category-${Math.random().toString(36).slice(2, 8)}`;
    gridConfig.push({ i: inst, x: 8, y, w: 4, h: 4 });
    widgets[inst] = { type: "expenses-by-category" };
  }
  y += 4;

  // Row 3: top-customers (4) + top-vendors (4) + bank-balance (4)
  let rowX = 0;
  if (widgetIds.includes("top-customers")) {
    const inst = `top-customers-${Math.random().toString(36).slice(2, 8)}`;
    gridConfig.push({ i: inst, x: rowX, y, w: 4, h: 4 });
    widgets[inst] = { type: "top-customers" };
    rowX += 4;
  }
  if (widgetIds.includes("top-vendors")) {
    const inst = `top-vendors-${Math.random().toString(36).slice(2, 8)}`;
    gridConfig.push({ i: inst, x: rowX, y, w: 4, h: 4 });
    widgets[inst] = { type: "top-vendors" };
    rowX += 4;
  }
  if (widgetIds.includes("anomaly-alerts")) {
    const inst = `anomaly-alerts-${Math.random().toString(36).slice(2, 8)}`;
    gridConfig.push({ i: inst, x: rowX, y, w: 12 - rowX, h: 4 });
    widgets[inst] = { type: "anomaly-alerts" };
  }
  y += 4;

  // Row 4: recent-invoices (6) + recent-expenses (6)
  rowX = 0;
  for (const id of ["recent-invoices", "recent-expenses", "ai-activity"] as const) {
    if (widgetIds.includes(id)) {
      const inst = `${id}-${Math.random().toString(36).slice(2, 8)}`;
      gridConfig.push({ i: inst, x: rowX, y, w: 6, h: 4 });
      widgets[inst] = { type: id };
      rowX += 6;
      if (rowX >= 12) {
        rowX = 0;
        y += 4;
      }
    }
  }

  // Row 5: GST + anything left
  rowX = 0;
  if (widgetIds.includes("gst-summary")) {
    const inst = `gst-summary-${Math.random().toString(36).slice(2, 8)}`;
    gridConfig.push({ i: inst, x: 0, y: y + 4, w: 4, h: 3 });
    widgets[inst] = { type: "gst-summary" };
  }

  return { gridConfig, widgets };
}
