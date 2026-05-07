/**
 * Zoho aggregator — fetches everything the FinAI dashboard needs in one
 * sweep, computes the DashboardAggregate shape, caches it.
 *
 * Same shape as src/lib/mock/zoho-aggregate.ts so widgets don't change.
 *
 * Designed to run from a Vercel Cron every 5 min, but also callable inline
 * (cold-start / on-demand refresh). Total Zoho API calls per run: ~6-10
 * depending on data volume, well under the 100/min cap.
 */

import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { zohoFetch, zohoFetchAll } from "./client";
import type {
  ZohoBankAccount,
  ZohoBill,
  ZohoChartOfAccount,
  ZohoCustomerPayment,
  ZohoExpense,
  ZohoInvoice,
  ZohoOrgInfo,
} from "./types";
import type {
  AnomalyAlert,
  AIActivityItem,
  BankAccount,
  CategorySpend,
  CustomerSummary,
  DailyCashFlow,
  DashboardAggregate,
  ExpenseRecord,
  InvoiceRecord,
  MonthlyPnL,
  PaymentRecord,
  VendorSummary,
} from "@/lib/dashboard/types";

const CACHE_KEY = "zoho:aggregate";
const CACHE_TTL_SEC = 5 * 60;

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}
function fiscalYearStart(d: Date) {
  // India FY: April 1.
  const year = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
  return new Date(year, 3, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Status mapping
// ─────────────────────────────────────────────────────────────────────────────
function mapInvStatus(s: string): InvoiceRecord["status"] {
  const norm = s.toLowerCase();
  if (norm === "paid") return "paid";
  if (norm === "overdue") return "overdue";
  if (norm === "partially_paid" || norm === "partial") return "partial";
  if (norm === "draft") return "draft";
  return "sent";
}

// ─────────────────────────────────────────────────────────────────────────────
// Transformers
// ─────────────────────────────────────────────────────────────────────────────
function toInvoiceRecord(z: ZohoInvoice): InvoiceRecord {
  const total = Number(z.total ?? 0);
  const paid = Number(z.payment_made ?? z.paid_amount ?? Math.max(0, total - Number(z.balance ?? 0)));
  const due = Number(z.balance ?? Math.max(0, total - paid));
  const dueDate = new Date(z.due_date);
  const today = new Date();
  const daysOverdue = due > 0 && dueDate < today
    ? Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000)
    : 0;

  const cgst = Number(z.cgst_total ?? 0);
  const sgst = Number(z.sgst_total ?? 0);
  const igst = Number(z.igst_total ?? 0);

  return {
    id: z.invoice_id,
    number: z.invoice_number,
    customerId: z.customer_id,
    customerName: z.customer_name,
    issueDate: z.date,
    dueDate: z.due_date,
    status: mapInvStatus(z.status),
    total,
    amountPaid: paid,
    amountDue: due,
    daysOverdue,
    gstTreatment: igst > 0 ? "inter" : "intra",
    cgst,
    sgst,
    igst,
    lines: [], // line items only loaded on drill — keep aggregator light
  };
}

function toExpenseRecord(z: ZohoExpense, accountCodeMap: Map<string, string>): ExpenseRecord {
  const amount = Number(z.amount ?? 0);
  const taxAmount = Number(z.tax_amount ?? 0);
  const total = Number(z.total ?? amount + taxAmount);
  return {
    id: z.expense_id,
    date: z.date,
    vendorName: z.vendor_name ?? z.description ?? "—",
    vendorId: z.vendor_id ?? `unknown-${z.expense_id}`,
    category: z.account_name ?? "Uncategorized",
    categoryCode: accountCodeMap.get(z.account_id) ?? "",
    amount,
    taxAmount,
    totalAmount: total,
    hasReceipt: Boolean(z.has_attachment),
    source: z.reference_number?.includes("BANK") ? "bank_feed" : "manual",
    notes: z.description,
  };
}

function toPaymentRecord(z: ZohoCustomerPayment): PaymentRecord {
  const inv = z.invoices?.[0];
  return {
    id: z.payment_id,
    date: z.date,
    customerId: z.customer_id,
    customerName: z.customer_name,
    amount: Number(z.amount ?? 0),
    method: mapPaymentMethod(z.payment_mode),
    appliedToInvoiceId: inv?.invoice_id ?? "",
    appliedToInvoiceNumber: inv?.invoice_number ?? z.invoice_numbers ?? "",
  };
}

function mapPaymentMethod(m: string): PaymentRecord["method"] {
  const norm = (m || "").toLowerCase();
  if (norm.includes("upi")) return "upi";
  if (norm.includes("cash")) return "cash";
  if (norm.includes("cheque") || norm.includes("check")) return "cheque";
  return "bank_transfer";
}

function toBankAccount(z: ZohoBankAccount): BankAccount {
  const masked = z.account_number
    ? `••••${z.account_number.slice(-4)}`
    : `••••${z.account_id.slice(-4)}`;
  return {
    id: z.account_id,
    name: z.account_name,
    bank: z.bank_name ?? "—",
    accountNumberMasked: masked,
    balance: Number(z.balance ?? 0),
    currency: "INR",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregations
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryBreakdown(expenses: ExpenseRecord[], now: Date): CategorySpend[] {
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const thisMonth = expenses.filter((e) => new Date(e.date) >= monthStart);
  const lastMonth = expenses.filter((e) => {
    const d = new Date(e.date);
    return d >= lastMonthStart && d <= lastMonthEnd;
  });
  const total = thisMonth.reduce((s, e) => s + e.totalAmount, 0);

  const groups = new Map<
    string,
    { code: string; name: string; amount: number; count: number; lastMonthAmount: number }
  >();
  for (const e of thisMonth) {
    const key = e.categoryCode || e.category;
    const g = groups.get(key) ?? {
      code: e.categoryCode,
      name: e.category,
      amount: 0,
      count: 0,
      lastMonthAmount: 0,
    };
    g.amount += e.totalAmount;
    g.count += 1;
    groups.set(key, g);
  }
  for (const e of lastMonth) {
    const key = e.categoryCode || e.category;
    const g = groups.get(key);
    if (g) g.lastMonthAmount += e.totalAmount;
  }

  return Array.from(groups.values())
    .map((g) => ({
      code: g.code,
      name: g.name,
      amount: g.amount,
      count: g.count,
      pctOfTotal: total > 0 ? (g.amount / total) * 100 : 0,
      vsLastMonthChangePct:
        g.lastMonthAmount > 0 ? ((g.amount - g.lastMonthAmount) / g.lastMonthAmount) * 100 : null,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function buildTopVendors(expenses: ExpenseRecord[], now: Date): VendorSummary[] {
  const monthStart = startOfMonth(now);
  const recent = expenses.filter((e) => new Date(e.date) >= monthStart);
  const vmap = new Map<string, VendorSummary>();
  for (const e of recent) {
    const v = vmap.get(e.vendorId) ?? {
      id: e.vendorId,
      name: e.vendorName,
      totalSpend: 0,
      expenseCount: 0,
      category: e.category,
    };
    v.totalSpend += e.totalAmount;
    v.expenseCount += 1;
    vmap.set(e.vendorId, v);
  }
  return Array.from(vmap.values()).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10);
}

function buildCustomerSummaries(invoices: InvoiceRecord[]): CustomerSummary[] {
  const cmap = new Map<string, CustomerSummary>();
  for (const inv of invoices) {
    const c = cmap.get(inv.customerId) ?? {
      id: inv.customerId,
      name: inv.customerName,
      totalRevenue: 0,
      outstanding: 0,
      invoiceCount: 0,
      averagePaymentDays: 0,
      state: "",
      gstin: undefined,
    };
    c.totalRevenue += inv.amountPaid;
    c.outstanding += inv.amountDue;
    c.invoiceCount += 1;
    cmap.set(inv.customerId, c);
  }
  // Average payment days isn't directly computable without per-invoice payment
  // dates — leave at 0 for now and refine when we wire payment join.
  return Array.from(cmap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function buildMonthlyTrend(invoices: InvoiceRecord[], expenses: ExpenseRecord[], now: Date): MonthlyPnL[] {
  const out: MonthlyPnL[] = [];
  for (let monthBack = 5; monthBack >= 0; monthBack--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - monthBack + 1, 0);
    const monthInvs = invoices.filter((i) => {
      const d = new Date(i.issueDate);
      return d >= monthDate && d <= monthEnd;
    });
    const monthExps = expenses.filter((e) => {
      const d = new Date(e.date);
      return d >= monthDate && d <= monthEnd;
    });
    const revenue = monthInvs.reduce((s, i) => s + i.amountPaid, 0);
    const expensesTotal = monthExps.reduce((s, e) => s + e.totalAmount, 0);
    out.push({
      monthLabel: monthDate.toLocaleString("en-US", { month: "short" }),
      monthIso: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      revenue,
      expenses: expensesTotal,
      netProfit: revenue - expensesTotal,
    });
  }
  return out;
}

function buildDailyCashFlow(payments: PaymentRecord[], expenses: ExpenseRecord[], now: Date): DailyCashFlow[] {
  const out: DailyCashFlow[] = [];
  const monthStart = startOfMonth(now);
  for (const d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
    const date = fmt(d);
    const inflow = payments.filter((p) => p.date === date).reduce((s, p) => s + p.amount, 0);
    const outflow = expenses.filter((e) => e.date === date).reduce((s, e) => s + e.totalAmount, 0);
    out.push({ date, inflow, outflow, net: inflow - outflow });
  }
  return out;
}

function buildAlerts(expenses: ExpenseRecord[], invoices: InvoiceRecord[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  // Travel-style spike check (top category vs trailing avg)
  const cats = buildCategoryBreakdown(expenses, new Date());
  const big = cats.find((c) => c.vsLastMonthChangePct !== null && c.vsLastMonthChangePct > 50);
  if (big) {
    alerts.push({
      id: `alert-spike-${big.code}`,
      level: big.vsLastMonthChangePct! > 100 ? "critical" : "warning",
      title: `${big.name} spend up ${Math.round(big.vsLastMonthChangePct ?? 0)}%`,
      description: `${big.name} is ₹${Math.round(big.amount).toLocaleString("en-IN")} this month vs trailing average.`,
      triggeredAt: new Date().toISOString(),
      category: big.name,
      amount: big.amount,
    });
  }

  // Most-overdue invoice
  const overdues = invoices
    .filter((i) => i.daysOverdue > 0 && i.amountDue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
  const worst = overdues[0];
  if (worst) {
    alerts.push({
      id: `alert-overdue-${worst.id}`,
      level: worst.daysOverdue > 30 ? "critical" : "warning",
      title: `${worst.customerName}: ${worst.daysOverdue} days overdue`,
      description: `${worst.number} (₹${Math.round(worst.amountDue).toLocaleString("en-IN")}) is past due.`,
      triggeredAt: new Date().toISOString(),
      amount: worst.amountDue,
    });
  }

  return alerts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main aggregator
// ─────────────────────────────────────────────────────────────────────────────
export async function buildZohoAggregate(): Promise<DashboardAggregate> {
  const now = new Date();
  const fyStart = fiscalYearStart(now);
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  // ── Parallel fetches ─────────────────────────────────────────────────────
  const [orgInfo, allInvoices, allExpenses, openBills, banks, payments, accounts] = await Promise.all([
    fetchOrg(),
    zohoFetchAll<ZohoInvoice>("/invoices", "invoices", { query: { date_start: fmt(fyStart) } }, 10, 200),
    zohoFetchAll<ZohoExpense>("/expenses", "expenses", { query: { date_start: fmt(fyStart) } }, 10, 200),
    zohoFetchAll<ZohoBill>("/bills", "bills", { query: { status: "open" } }, 5, 200),
    zohoFetchAll<ZohoBankAccount>("/bankaccounts", "bankaccounts", {}, 2, 200),
    zohoFetchAll<ZohoCustomerPayment>(
      "/customerpayments",
      "customerpayments",
      { query: { date_start: fmt(lastMonthStart) } },
      5,
      200,
    ),
    zohoFetchAll<ZohoChartOfAccount>("/chartofaccounts", "chartofaccounts", {}, 5, 200),
  ]);

  // ── Build lookups ────────────────────────────────────────────────────────
  const accountCodeMap = new Map<string, string>();
  for (const a of accounts) {
    if (a.account_id && a.account_code) accountCodeMap.set(a.account_id, a.account_code);
  }

  // ── Transform ────────────────────────────────────────────────────────────
  const invoices: InvoiceRecord[] = allInvoices.map(toInvoiceRecord);
  const expenses: ExpenseRecord[] = allExpenses.map((e) => toExpenseRecord(e, accountCodeMap));
  const banksOut: BankAccount[] = banks.map(toBankAccount);
  const paymentsOut: PaymentRecord[] = payments.map(toPaymentRecord);
  const customers = buildCustomerSummaries(invoices);

  // ── Compute period sums ──────────────────────────────────────────────────
  const sumPaidIn = (from: Date, to?: Date) =>
    invoices
      .filter((i) => {
        const d = new Date(i.issueDate);
        if (to) return d >= from && d <= to;
        return d >= from;
      })
      .reduce((s, i) => s + i.amountPaid, 0);
  const sumExpIn = (from: Date, to?: Date) =>
    expenses
      .filter((e) => {
        const d = new Date(e.date);
        if (to) return d >= from && d <= to;
        return d >= from;
      })
      .reduce((s, e) => s + e.totalAmount, 0);

  const revMtd = sumPaidIn(monthStart);
  const revLastMtd = sumPaidIn(lastMonthStart, lastMonthEnd);
  const expMtd = sumExpIn(monthStart);
  const expLastMtd = sumExpIn(lastMonthStart, lastMonthEnd);
  const revYtd = sumPaidIn(fyStart);
  const expYtd = sumExpIn(fyStart);

  // ── Outstanding ──────────────────────────────────────────────────────────
  const outstandingInvs = invoices.filter((i) => i.amountDue > 0);
  const overdueInvs = outstandingInvs.filter((i) => i.daysOverdue > 0);
  const totalOutstanding = outstandingInvs.reduce((s, i) => s + i.amountDue, 0);
  const totalOverdue = overdueInvs.reduce((s, i) => s + i.amountDue, 0);

  // ── GST aggregations ─────────────────────────────────────────────────────
  const cgst = invoices.reduce((s, i) => s + i.cgst, 0);
  const sgst = invoices.reduce((s, i) => s + i.sgst, 0);
  const igst = invoices.reduce((s, i) => s + i.igst, 0);
  const itc = expenses.reduce((s, e) => s + e.taxAmount, 0);

  const today = fmt(now);
  const recentInvoices = [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate)).slice(0, 8);
  const recentExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const recentPayments = [...paymentsOut].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  // ── Compose ──────────────────────────────────────────────────────────────
  const aggregate: DashboardAggregate = {
    generatedAt: now.toISOString(),
    org: {
      id: orgInfo?.organization_id ?? process.env.ZOHO_ORG_ID ?? "",
      name: orgInfo?.name ?? "AdvertOut",
      gstin: orgInfo?.gstin ?? "",
      stateCode: orgInfo?.state_code ?? "",
      fiscalYearStart: "04-01",
    },
    revenue: { mtd: revMtd, qtd: revMtd, ytd: revYtd, lastMonthMtd: revLastMtd },
    expenses: { mtd: expMtd, qtd: expMtd, ytd: expYtd, lastMonthMtd: expLastMtd },
    profitability: {
      netProfitMtd: revMtd - expMtd,
      netProfitYtd: revYtd - expYtd,
      grossMarginPct: revMtd > 0 ? ((revMtd - expMtd) / revMtd) * 100 : 0,
      expenseRatioPct: revMtd > 0 ? (expMtd / revMtd) * 100 : 0,
    },
    cash: {
      accounts: banksOut,
      totalBalance: banksOut.reduce((s, b) => s + b.balance, 0),
      inflowsMtd: paymentsOut
        .filter((p) => new Date(p.date) >= monthStart)
        .reduce((s, p) => s + p.amount, 0),
      outflowsMtd: expMtd,
      netCashFlowMtd: 0,
      dailyFlow: buildDailyCashFlow(paymentsOut, expenses, now),
    },
    receivables: {
      totalOutstanding,
      overdueAmount: totalOverdue,
      overdueCount: overdueInvs.length,
      averageDaysToPay: 0,
      statusBreakdown: ["draft", "sent", "paid", "overdue", "partial"].map((status) => ({
        status,
        count: invoices.filter((i) => i.status === status).length,
        total: invoices.filter((i) => i.status === status).reduce((s, i) => s + i.total, 0),
      })),
      topOverdue: overdueInvs.sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 5),
      customerOutstanding: customers
        .filter((c) => c.outstanding > 0)
        .map((c) => ({ customerId: c.id, name: c.name, amount: c.outstanding }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8),
    },
    payables: {
      totalOpenBills: openBills.reduce((s, b) => s + Number(b.balance ?? 0), 0),
      openBillsCount: openBills.length,
    },
    invoices: {
      all: invoices,
      recent: recentInvoices,
      createdMtd: invoices.filter((i) => new Date(i.issueDate) >= monthStart).length,
      averageValue: invoices.length > 0 ? invoices.reduce((s, i) => s + i.total, 0) / invoices.length : 0,
    },
    expensesData: {
      all: expenses,
      recent: recentExpenses,
      byCategory: buildCategoryBreakdown(expenses, now),
      topVendors: buildTopVendors(expenses, now),
      uncategorizedCount: expenses.filter((e) => !e.categoryCode).length,
    },
    customers: {
      all: customers,
      topByRevenue: customers.slice(0, 5),
    },
    payments: {
      all: paymentsOut,
      recent: recentPayments,
      receivedMtd: paymentsOut
        .filter((p) => new Date(p.date) >= monthStart)
        .reduce((s, p) => s + p.amount, 0),
    },
    gst: {
      cgstCollected: cgst,
      sgstCollected: sgst,
      igstCollected: igst,
      totalLiability: cgst + sgst + igst,
      inputTaxCredit: itc,
      netPayable: cgst + sgst + igst - itc,
      placeOfSupplyBreakdown: [],
    },
    ops: {
      invoicesCreatedToday: invoices.filter((i) => i.issueDate === today).length,
      paymentsReceivedToday: paymentsOut.filter((p) => p.date === today).length,
      averageInvoiceValue:
        invoices.length > 0 ? invoices.reduce((s, i) => s + i.total, 0) / invoices.length : 0,
    },
    trend: { monthly: buildMonthlyTrend(invoices, expenses, now) },
    alerts: buildAlerts(expenses, invoices),
    aiActivity: [], // populated by AI agent activity log later
  };
  aggregate.cash.netCashFlowMtd = aggregate.cash.inflowsMtd - aggregate.cash.outflowsMtd;
  return aggregate;
}

async function fetchOrg(): Promise<ZohoOrgInfo | null> {
  try {
    const data = await zohoFetch<{ organizations: ZohoOrgInfo[] }>("/organizations", { skipOrgId: true });
    return data.organizations?.[0] ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cached entry-points
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read the cached aggregate. Returns null on a cache miss — callers can choose
 * to trigger a rebuild inline or fall back to the mock.
 */
export async function getCachedAggregate(): Promise<DashboardAggregate | null> {
  return cacheGet<DashboardAggregate>(CACHE_KEY);
}

/**
 * Build + cache the aggregate. Called by the cron route every 5 min.
 */
export async function refreshAggregate(): Promise<DashboardAggregate> {
  const data = await buildZohoAggregate();
  await cacheSet(CACHE_KEY, data, CACHE_TTL_SEC);
  return data;
}

/**
 * Read-or-build: returns cache if present, otherwise builds inline (slower
 * first call until cron warms the cache).
 */
export async function getOrBuildAggregate(): Promise<DashboardAggregate> {
  const cached = await getCachedAggregate();
  if (cached) return cached;
  return refreshAggregate();
}
