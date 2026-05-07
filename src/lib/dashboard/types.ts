// Shared types for the customizable dashboard.
// Designed so the same shapes flow from either the mock generator or
// the future Zoho aggregator output — widgets read this contract.

export type WidgetCategory =
  | "revenue"
  | "expenses"
  | "profitability"
  | "cash"
  | "gst"
  | "ops"
  | "alerts";

export type WidgetSize = { w: number; h: number };

export interface InvoiceRecord {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "overdue" | "partial";
  total: number;
  amountPaid: number;
  amountDue: number;
  daysOverdue: number;
  gstTreatment: "intra" | "inter";
  cgst: number;
  sgst: number;
  igst: number;
  lines: InvoiceLine[];
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  vendorName: string;
  vendorId: string;
  category: string;
  categoryCode: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  hasReceipt: boolean;
  source: "bank_feed" | "whatsapp" | "manual";
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  date: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: "bank_transfer" | "upi" | "cheque" | "cash";
  appliedToInvoiceId: string;
  appliedToInvoiceNumber: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bank: string;
  accountNumberMasked: string;
  balance: number;
  currency: "INR";
}

export interface CustomerSummary {
  id: string;
  name: string;
  totalRevenue: number;
  outstanding: number;
  invoiceCount: number;
  averagePaymentDays: number;
  state: string;
  gstin?: string;
}

export interface VendorSummary {
  id: string;
  name: string;
  totalSpend: number;
  expenseCount: number;
  category: string;
}

export interface CategorySpend {
  code: string;
  name: string;
  amount: number;
  count: number;
  pctOfTotal: number;
  vsLastMonthChangePct: number | null;
}

export interface MonthlyPnL {
  monthLabel: string; // "Apr"
  monthIso: string; // "2026-04"
  revenue: number;
  expenses: number;
  netProfit: number;
}

export interface DailyCashFlow {
  date: string; // YYYY-MM-DD
  inflow: number;
  outflow: number;
  net: number;
}

export interface AnomalyAlert {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  description: string;
  triggeredAt: string;
  category?: string;
  amount?: number;
}

export interface AIActivityItem {
  id: string;
  timestamp: string;
  action: string;
  description: string;
  status: "success" | "pending" | "reverted";
  source: "whatsapp" | "chat" | "auto";
}

// The fat aggregate blob — Redis cache target in production, mock in dev.
export interface DashboardAggregate {
  generatedAt: string;
  org: {
    id: string;
    name: string;
    gstin: string;
    stateCode: string;
    fiscalYearStart: string;
  };

  revenue: {
    mtd: number;
    qtd: number;
    ytd: number;
    lastMonthMtd: number;
  };
  expenses: {
    mtd: number;
    qtd: number;
    ytd: number;
    lastMonthMtd: number;
  };
  profitability: {
    netProfitMtd: number;
    netProfitYtd: number;
    grossMarginPct: number;
    expenseRatioPct: number;
  };
  cash: {
    accounts: BankAccount[];
    totalBalance: number;
    inflowsMtd: number;
    outflowsMtd: number;
    netCashFlowMtd: number;
    dailyFlow: DailyCashFlow[];
  };
  receivables: {
    totalOutstanding: number;
    overdueAmount: number;
    overdueCount: number;
    averageDaysToPay: number;
    statusBreakdown: { status: string; count: number; total: number }[];
    topOverdue: InvoiceRecord[];
    customerOutstanding: { customerId: string; name: string; amount: number }[];
  };
  payables: {
    totalOpenBills: number;
    openBillsCount: number;
  };
  invoices: {
    all: InvoiceRecord[];
    recent: InvoiceRecord[];
    createdMtd: number;
    averageValue: number;
  };
  expensesData: {
    all: ExpenseRecord[];
    recent: ExpenseRecord[];
    byCategory: CategorySpend[];
    topVendors: VendorSummary[];
    uncategorizedCount: number;
  };
  customers: {
    all: CustomerSummary[];
    topByRevenue: CustomerSummary[];
  };
  payments: {
    all: PaymentRecord[];
    recent: PaymentRecord[];
    receivedMtd: number;
  };
  gst: {
    cgstCollected: number;
    sgstCollected: number;
    igstCollected: number;
    totalLiability: number;
    inputTaxCredit: number;
    netPayable: number;
    placeOfSupplyBreakdown: { state: string; revenue: number; type: "intra" | "inter" }[];
  };
  ops: {
    invoicesCreatedToday: number;
    paymentsReceivedToday: number;
    averageInvoiceValue: number;
  };
  trend: {
    monthly: MonthlyPnL[];
  };
  alerts: AnomalyAlert[];
  aiActivity: AIActivityItem[];
}
