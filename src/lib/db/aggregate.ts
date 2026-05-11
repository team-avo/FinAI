/**
 * Build a DashboardAggregate from the local Drizzle/Postgres tables.
 *
 * This is the fallback when no Zoho connection exists for the org. It produces
 * the exact same shape as `src/lib/zoho/aggregator.ts` so dashboard widgets
 * stay agnostic — they only care about the DashboardAggregate contract.
 *
 * Data sources:
 *   - `invoices` / `invoice_lines` for AR
 *   - `expenses` (+ joined chart_of_accounts) for AP
 *   - `journal_entries` / `journal_lines` for P&L (via getPnLReport)
 *
 * Bank balances and payments are not yet modelled in the local schema, so we
 * leave them empty rather than fabricating numbers. Widgets that key off those
 * will render a "no data" state — which is honest.
 */

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  chartOfAccounts,
  expenses as expensesTable,
  invoices as invoicesTable,
} from "@/lib/db/schema";
import { getPnLReport, getMonthlyPnL } from "@/lib/accounting/reports/pnl";
import { getOutstandingReceivables, getExpenseBreakdown } from "@/lib/accounting/reports/outstanding";
import type {
  AnomalyAlert,
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

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}
function fiscalYearStart(d: Date) {
  const year = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
  return new Date(year, 3, 1);
}
function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mapInvStatus(s: string): InvoiceRecord["status"] {
  if (s === "paid" || s === "overdue" || s === "partial" || s === "draft" || s === "sent") return s;
  return "sent";
}

export async function buildDbAggregate(orgId: string, now: Date = new Date()): Promise<DashboardAggregate> {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = startOfMonth(lastMonth);
  const lastMonthEnd = endOfMonth(lastMonth);
  const fyStart = fiscalYearStart(now);

  // ── Parallel fetches ─────────────────────────────────────────────────────
  const [
    invoiceRows,
    expenseRows,
    pnlMtd,
    pnlLastMtd,
    pnlYtd,
    monthlyTrend,
    receivables,
    expenseBreakdown,
  ] = await Promise.all([
    db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.orgId, orgId), gte(invoicesTable.issueDate, fyStart)))
      .orderBy(desc(invoicesTable.issueDate)),
    db
      .select({
        id: expensesTable.id,
        date: expensesTable.date,
        vendorId: expensesTable.vendorId,
        vendorName: expensesTable.vendorName,
        accountId: expensesTable.accountId,
        accountName: chartOfAccounts.name,
        accountCode: chartOfAccounts.code,
        amount: expensesTable.amount,
        taxAmount: expensesTable.taxAmount,
        totalAmount: expensesTable.totalAmount,
        source: expensesTable.source,
        notes: expensesTable.notes,
        attachmentId: expensesTable.attachmentId,
      })
      .from(expensesTable)
      .leftJoin(chartOfAccounts, eq(expensesTable.accountId, chartOfAccounts.id))
      .where(and(eq(expensesTable.orgId, orgId), gte(expensesTable.date, fyStart)))
      .orderBy(desc(expensesTable.date)),
    getPnLReport(orgId, monthStart, monthEnd),
    getPnLReport(orgId, lastMonthStart, lastMonthEnd),
    getPnLReport(orgId, fyStart, monthEnd),
    getMonthlyPnL(orgId, 6),
    getOutstandingReceivables(orgId),
    getExpenseBreakdown(orgId, monthStart, monthEnd),
  ]);

  // ── Transform invoices ───────────────────────────────────────────────────
  const invoices: InvoiceRecord[] = invoiceRows.map((row) => {
    const total = parseFloat(row.total);
    const paid = parseFloat(row.amountPaid);
    const due = parseFloat(row.amountDue);
    const dueDate = row.dueDate ?? row.issueDate;
    const daysOverdue =
      due > 0 && dueDate < now ? Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000) : 0;
    return {
      id: row.id,
      number: row.number,
      customerId: row.contactId ?? `cust-${row.id.slice(-8)}`,
      customerName: row.contactName,
      issueDate: fmt(row.issueDate),
      dueDate: fmt(dueDate),
      status: mapInvStatus(row.status),
      total,
      amountPaid: paid,
      amountDue: due,
      daysOverdue,
      gstTreatment: row.isInterstate ? "inter" : "intra",
      cgst: parseFloat(row.cgstAmount),
      sgst: parseFloat(row.sgstAmount),
      igst: parseFloat(row.igstAmount),
      lines: [],
    };
  });

  // ── Transform expenses ───────────────────────────────────────────────────
  const expenses: ExpenseRecord[] = expenseRows.map((row) => ({
    id: row.id,
    date: fmt(row.date),
    vendorName: row.vendorName ?? row.accountName ?? "—",
    vendorId: row.vendorId ?? `vendor-${row.id.slice(-8)}`,
    category: row.accountName ?? "Uncategorized",
    categoryCode: row.accountCode ?? "",
    amount: parseFloat(row.amount),
    taxAmount: parseFloat(row.taxAmount),
    totalAmount: parseFloat(row.totalAmount),
    hasReceipt: Boolean(row.attachmentId),
    source: row.source === "whatsapp" ? "whatsapp" : row.source === "manual" ? "manual" : "bank_feed",
    notes: row.notes ?? undefined,
  }));

  // ── Customer summaries ───────────────────────────────────────────────────
  const customerMap = new Map<string, CustomerSummary>();
  for (const inv of invoices) {
    const c = customerMap.get(inv.customerId) ?? {
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
    customerMap.set(inv.customerId, c);
  }
  const customers = Array.from(customerMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

  // ── Category breakdown (this vs last month) ──────────────────────────────
  const breakdownByCode = new Map<string, { lastMonth: number }>();
  for (const e of expenses) {
    const d = new Date(e.date);
    if (d >= lastMonthStart && d <= lastMonthEnd) {
      const key = e.categoryCode || e.category;
      const g = breakdownByCode.get(key) ?? { lastMonth: 0 };
      g.lastMonth += e.totalAmount;
      breakdownByCode.set(key, g);
    }
  }
  const totalThisMonth = expenseBreakdown.reduce((s, b) => s + b.total, 0);
  const byCategory: CategorySpend[] = expenseBreakdown.map((b) => {
    const last = breakdownByCode.get(b.accountName ?? "")?.lastMonth ?? 0;
    return {
      code: "",
      name: b.accountName ?? "Uncategorized",
      amount: b.total,
      count: b.count,
      pctOfTotal: totalThisMonth > 0 ? (b.total / totalThisMonth) * 100 : 0,
      vsLastMonthChangePct: last > 0 ? ((b.total - last) / last) * 100 : null,
    };
  });

  // ── Top vendors (this month) ─────────────────────────────────────────────
  const vmap = new Map<string, VendorSummary>();
  for (const e of expenses) {
    const d = new Date(e.date);
    if (d < monthStart) continue;
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
  const topVendors = Array.from(vmap.values()).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10);

  // ── Receivables → top overdue ────────────────────────────────────────────
  const topOverdue: InvoiceRecord[] = receivables.items
    .filter((r) => r.daysOverdue > 0)
    .slice(0, 5)
    .map((r) => {
      const matching = invoices.find((i) => i.id === r.id);
      return (
        matching ?? {
          id: r.id,
          number: r.number,
          customerId: r.contactId ?? r.id,
          customerName: r.contactName,
          issueDate: fmt(r.issueDate),
          dueDate: fmt(r.dueDate ?? r.issueDate),
          status: mapInvStatus(r.status),
          total: r.total,
          amountPaid: r.amountPaid,
          amountDue: r.amountDue,
          daysOverdue: r.daysOverdue,
          gstTreatment: "intra",
          cgst: 0,
          sgst: 0,
          igst: 0,
          lines: [],
        }
      );
    });

  // ── GST aggregations ─────────────────────────────────────────────────────
  const cgst = invoices.reduce((s, i) => s + i.cgst, 0);
  const sgst = invoices.reduce((s, i) => s + i.sgst, 0);
  const igst = invoices.reduce((s, i) => s + i.igst, 0);
  const itc = expenses.reduce((s, e) => s + e.taxAmount, 0);

  // ── Daily cash flow (this month) — based on expenses only since payments
  //    are not modelled separately yet ───────────────────────────────────────
  const dailyFlow: DailyCashFlow[] = [];
  for (const d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
    const date = fmt(d);
    const outflow = expenses
      .filter((e) => e.date === date)
      .reduce((s, e) => s + e.totalAmount, 0);
    dailyFlow.push({ date, inflow: 0, outflow, net: -outflow });
  }

  // ── Monthly trend → MonthlyPnL ───────────────────────────────────────────
  const monthly: MonthlyPnL[] = monthlyTrend.map((m) => {
    const [, mm] = m.month.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return {
      monthLabel: monthNames[parseInt(mm, 10) - 1] ?? m.month,
      monthIso: m.month,
      revenue: m.revenue,
      expenses: m.expenses,
      netProfit: m.netProfit,
    };
  });

  // ── Alerts (lightweight — biggest category jump + worst overdue) ─────────
  const alerts: AnomalyAlert[] = [];
  const big = byCategory.find((c) => c.vsLastMonthChangePct !== null && c.vsLastMonthChangePct > 50);
  if (big) {
    alerts.push({
      id: `alert-spike-${big.name}`,
      level: (big.vsLastMonthChangePct ?? 0) > 100 ? "critical" : "warning",
      title: `${big.name} spend up ${Math.round(big.vsLastMonthChangePct ?? 0)}%`,
      description: `${big.name} is ₹${Math.round(big.amount).toLocaleString("en-IN")} this month.`,
      triggeredAt: now.toISOString(),
      category: big.name,
      amount: big.amount,
    });
  }
  if (topOverdue[0]) {
    const worst = topOverdue[0];
    alerts.push({
      id: `alert-overdue-${worst.id}`,
      level: worst.daysOverdue > 30 ? "critical" : "warning",
      title: `${worst.customerName}: ${worst.daysOverdue} days overdue`,
      description: `${worst.number} (₹${Math.round(worst.amountDue).toLocaleString("en-IN")}) is past due.`,
      triggeredAt: now.toISOString(),
      amount: worst.amountDue,
    });
  }

  // ── Compose final aggregate ──────────────────────────────────────────────
  const revMtd = pnlMtd.totalRevenue;
  const expMtd = pnlMtd.totalExpenses;
  const today = fmt(now);

  const banks: BankAccount[] = []; // not yet modelled locally
  const payments: PaymentRecord[] = []; // not yet modelled locally

  return {
    generatedAt: now.toISOString(),
    org: {
      id: orgId,
      name: orgId === "advertout" ? "AdvertOut" : orgId,
      gstin: "",
      stateCode: "",
      fiscalYearStart: "04-01",
    },
    revenue: {
      mtd: revMtd,
      qtd: revMtd,
      ytd: pnlYtd.totalRevenue,
      lastMonthMtd: pnlLastMtd.totalRevenue,
    },
    expenses: {
      mtd: expMtd,
      qtd: expMtd,
      ytd: pnlYtd.totalExpenses,
      lastMonthMtd: pnlLastMtd.totalExpenses,
    },
    profitability: {
      netProfitMtd: pnlMtd.netProfit,
      netProfitYtd: pnlYtd.netProfit,
      grossMarginPct: revMtd > 0 ? (pnlMtd.netProfit / revMtd) * 100 : 0,
      expenseRatioPct: revMtd > 0 ? (expMtd / revMtd) * 100 : 0,
    },
    cash: {
      accounts: banks,
      totalBalance: 0,
      inflowsMtd: 0,
      outflowsMtd: expMtd,
      netCashFlowMtd: -expMtd,
      dailyFlow,
    },
    receivables: {
      totalOutstanding: receivables.totalOutstanding,
      overdueAmount: receivables.totalOverdue,
      overdueCount: receivables.overdueCount,
      averageDaysToPay: 0,
      statusBreakdown: ["draft", "sent", "paid", "overdue", "partial"].map((status) => ({
        status,
        count: invoices.filter((i) => i.status === status).length,
        total: invoices.filter((i) => i.status === status).reduce((s, i) => s + i.total, 0),
      })),
      topOverdue,
      customerOutstanding: customers
        .filter((c) => c.outstanding > 0)
        .map((c) => ({ customerId: c.id, name: c.name, amount: c.outstanding }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8),
    },
    payables: {
      totalOpenBills: 0,
      openBillsCount: 0,
    },
    invoices: {
      all: invoices,
      recent: invoices.slice(0, 8),
      createdMtd: invoices.filter((i) => new Date(i.issueDate) >= monthStart).length,
      averageValue: invoices.length > 0 ? invoices.reduce((s, i) => s + i.total, 0) / invoices.length : 0,
    },
    expensesData: {
      all: expenses,
      recent: expenses.slice(0, 8),
      byCategory,
      topVendors,
      uncategorizedCount: expenses.filter((e) => !e.categoryCode).length,
    },
    customers: {
      all: customers,
      topByRevenue: customers.slice(0, 5),
    },
    payments: {
      all: payments,
      recent: payments,
      receivedMtd: 0,
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
      paymentsReceivedToday: 0,
      averageInvoiceValue:
        invoices.length > 0 ? invoices.reduce((s, i) => s + i.total, 0) / invoices.length : 0,
    },
    trend: { monthly },
    alerts,
    aiActivity: [], // populated by the aggregate router from aiActivityLog
  };
}
