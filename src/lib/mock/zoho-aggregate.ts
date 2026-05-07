// Mock data generator for the dashboard.
// Shapes match the future Zoho aggregator output exactly so swap-in is one-file.
// Deterministic — same seed → same data.

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

// Tiny seedable RNG so data is stable across reloads.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);
const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)]!;
const randBetween = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const randMoney = (min: number, max: number) => Math.round((rng() * (max - min) + min) / 100) * 100;

const CUSTOMERS: { id: string; name: string; state: string; gstin: string }[] = [
  { id: "c-001", name: "Bluestone Tech Pvt Ltd", state: "Karnataka", gstin: "29AABCB1234C1Z5" },
  { id: "c-002", name: "Redline Media", state: "Maharashtra", gstin: "27AABCR5678D1Z2" },
  { id: "c-003", name: "Nimbus Cloud Solutions", state: "Tamil Nadu", gstin: "33AABCN9012E1Z8" },
  { id: "c-004", name: "Vega Analytics", state: "Karnataka", gstin: "29AABCV3456F1Z1" },
  { id: "c-005", name: "Apex Logistics", state: "Delhi", gstin: "07AABCA7890G1Z4" },
  { id: "c-006", name: "Coral Retail Group", state: "Gujarat", gstin: "24AABCC2345H1Z7" },
  { id: "c-007", name: "Ironhide Manufacturing", state: "Maharashtra", gstin: "27AABCI6789I1Z3" },
  { id: "c-008", name: "Quartz Studios", state: "Karnataka", gstin: "29AABCQ4567J1Z9" },
];

const VENDORS = [
  { name: "AWS", category: "Cloud Infrastructure", code: "6310" },
  { name: "Notion Labs", category: "SaaS Subscriptions", code: "6320" },
  { name: "GitHub", category: "SaaS Subscriptions", code: "6320" },
  { name: "Figma", category: "SaaS Subscriptions", code: "6320" },
  { name: "Swiggy", category: "Meals & Food", code: "6540" },
  { name: "Zomato", category: "Meals & Food", code: "6540" },
  { name: "Uber", category: "Local Travel", code: "6520" },
  { name: "Ola", category: "Local Travel", code: "6520" },
  { name: "MakeMyTrip", category: "Travel & Lodging", code: "6510" },
  { name: "Airtel", category: "Internet & Telecom", code: "6340" },
  { name: "Jio Fiber", category: "Internet & Telecom", code: "6340" },
  { name: "WeWork", category: "Office Rent", code: "6210" },
  { name: "Razorpay", category: "Payment Gateway", code: "6420" },
  { name: "LinkedIn Ads", category: "Marketing", code: "6410" },
  { name: "Google Ads", category: "Marketing", code: "6410" },
  { name: "Salary - Engineering", category: "Salaries", code: "6110" },
  { name: "Salary - Operations", category: "Salaries", code: "6110" },
  { name: "Salary - Founders", category: "Salaries", code: "6110" },
  { name: "Stripe", category: "Payment Gateway", code: "6420" },
  { name: "Slack", category: "SaaS Subscriptions", code: "6320" },
];

const SERVICES = [
  "Digital marketing campaign",
  "Social media management",
  "SEO consulting",
  "Performance marketing audit",
  "Content strategy",
  "Brand identity design",
  "Marketing automation setup",
  "Analytics dashboard build",
  "PPC campaign management",
  "Influencer marketing",
];

const ORG_STATE = "Karnataka";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildInvoices(now: Date): InvoiceRecord[] {
  const invoices: InvoiceRecord[] = [];
  let n = 1001;
  // 3 months of invoices
  for (let monthBack = 2; monthBack >= 0; monthBack--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);
    const count = monthBack === 0 ? randBetween(8, 12) : randBetween(10, 15);
    for (let i = 0; i < count; i++) {
      const customer = pick(CUSTOMERS);
      const issueDate = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        randBetween(1, 27),
      );
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 30);
      const numLines = randBetween(1, 3);
      const lines = Array.from({ length: numLines }, () => {
        const qty = randBetween(1, 2);
        const rate = randMoney(15000, 100000);
        return {
          description: pick(SERVICES),
          quantity: qty,
          rate,
          amount: qty * rate,
        };
      });
      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const isInter = customer.state !== ORG_STATE;
      const gstAmount = subtotal * 0.18;
      const cgst = isInter ? 0 : gstAmount / 2;
      const sgst = isInter ? 0 : gstAmount / 2;
      const igst = isInter ? gstAmount : 0;
      const total = Math.round(subtotal + gstAmount);

      // Status logic — older invoices more likely paid
      let status: InvoiceRecord["status"];
      const r = rng();
      if (monthBack >= 1) {
        status = r < 0.85 ? "paid" : r < 0.95 ? "partial" : "overdue";
      } else {
        // current month — mix of statuses
        if (r < 0.35) status = "paid";
        else if (r < 0.55) status = "sent";
        else if (r < 0.7) status = "partial";
        else if (r < 0.9) status = "overdue";
        else status = "draft";
      }

      const amountPaid =
        status === "paid"
          ? total
          : status === "partial"
            ? Math.round(total * (0.3 + rng() * 0.4))
            : 0;
      const amountDue = total - amountPaid;
      const daysOverdue =
        status === "overdue" || (status === "partial" && dueDate < now)
          ? Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)
          : 0;

      invoices.push({
        id: `inv-${n}`,
        number: `INV-${String(n).padStart(4, "0")}`,
        customerId: customer.id,
        customerName: customer.name,
        issueDate: fmt(issueDate),
        dueDate: fmt(dueDate),
        status,
        total,
        amountPaid,
        amountDue,
        daysOverdue,
        gstTreatment: isInter ? "inter" : "intra",
        cgst,
        sgst,
        igst,
        lines,
      });
      n++;
    }
  }
  return invoices.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
}

function buildExpenses(now: Date): ExpenseRecord[] {
  const expenses: ExpenseRecord[] = [];
  let n = 1;
  for (let monthBack = 2; monthBack >= 0; monthBack--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);
    const count = randBetween(35, 55);
    for (let i = 0; i < count; i++) {
      const v = pick(VENDORS);
      const date = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        randBetween(1, monthBack === 0 ? Math.min(now.getDate(), 28) : 28),
      );
      const isSalary = v.category === "Salaries";
      const isRent = v.category === "Office Rent";
      const baseAmount = isSalary
        ? randMoney(45000, 180000)
        : isRent
          ? randMoney(180000, 220000)
          : v.category === "Cloud Infrastructure"
            ? randMoney(15000, 65000)
            : v.category === "Marketing"
              ? randMoney(20000, 80000)
              : v.category === "Travel & Lodging"
                ? randMoney(8000, 35000)
                : v.category === "Meals & Food"
                  ? randMoney(300, 4500)
                  : v.category === "Local Travel"
                    ? randMoney(150, 2500)
                    : randMoney(500, 12000);
      const taxAmount = isSalary ? 0 : Math.round(baseAmount * 0.18);
      const totalAmount = baseAmount + taxAmount;

      expenses.push({
        id: `exp-${n}`,
        date: fmt(date),
        vendorName: v.name,
        vendorId: `v-${v.name.toLowerCase().replace(/\W+/g, "-")}`,
        category: v.category,
        categoryCode: v.code,
        amount: baseAmount,
        taxAmount,
        totalAmount,
        hasReceipt: rng() < 0.6,
        source: rng() < 0.7 ? "bank_feed" : rng() < 0.5 ? "whatsapp" : "manual",
        notes: undefined,
      });
      n++;
    }
  }
  return expenses.sort((a, b) => b.date.localeCompare(a.date));
}

function buildPayments(invoices: InvoiceRecord[]): PaymentRecord[] {
  const out: PaymentRecord[] = [];
  let n = 1;
  for (const inv of invoices) {
    if (inv.status === "paid" || inv.status === "partial") {
      const date = new Date(inv.issueDate);
      date.setDate(date.getDate() + randBetween(2, 28));
      out.push({
        id: `pay-${n}`,
        date: fmt(date),
        customerId: inv.customerId,
        customerName: inv.customerName,
        amount: inv.amountPaid,
        method: pick(["bank_transfer", "upi", "cheque", "bank_transfer"]) as PaymentRecord["method"],
        appliedToInvoiceId: inv.id,
        appliedToInvoiceNumber: inv.number,
      });
      n++;
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function buildBankAccounts(): BankAccount[] {
  return [
    {
      id: "ba-1",
      name: "Operating Account",
      bank: "HDFC Bank",
      accountNumberMasked: "••••4521",
      balance: 4_872_300,
      currency: "INR",
    },
    {
      id: "ba-2",
      name: "Reserve Account",
      bank: "ICICI Bank",
      accountNumberMasked: "••••9876",
      balance: 12_450_000,
      currency: "INR",
    },
    {
      id: "ba-3",
      name: "GST Holding",
      bank: "Axis Bank",
      accountNumberMasked: "••••3344",
      balance: 894_500,
      currency: "INR",
    },
  ];
}

function buildCategoryBreakdown(expenses: ExpenseRecord[], now: Date): CategorySpend[] {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

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
    const g = groups.get(e.categoryCode) ?? {
      code: e.categoryCode,
      name: e.category,
      amount: 0,
      count: 0,
      lastMonthAmount: 0,
    };
    g.amount += e.totalAmount;
    g.count += 1;
    groups.set(e.categoryCode, g);
  }
  for (const e of lastMonth) {
    const g = groups.get(e.categoryCode);
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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
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
  return Array.from(vmap.values())
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 10);
}

function buildCustomerSummaries(invoices: InvoiceRecord[]): CustomerSummary[] {
  const cmap = new Map<string, CustomerSummary>();
  for (const inv of invoices) {
    const cust = CUSTOMERS.find((c) => c.id === inv.customerId)!;
    const c = cmap.get(inv.customerId) ?? {
      id: inv.customerId,
      name: inv.customerName,
      totalRevenue: 0,
      outstanding: 0,
      invoiceCount: 0,
      averagePaymentDays: 0,
      state: cust.state,
      gstin: cust.gstin,
    };
    c.totalRevenue += inv.total;
    c.outstanding += inv.amountDue;
    c.invoiceCount += 1;
    cmap.set(inv.customerId, c);
  }
  for (const c of cmap.values()) {
    c.averagePaymentDays = randBetween(8, 35);
  }
  return Array.from(cmap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function buildMonthlyTrend(invoices: InvoiceRecord[], expenses: ExpenseRecord[], now: Date): MonthlyPnL[] {
  const out: MonthlyPnL[] = [];
  for (let monthBack = 5; monthBack >= 0; monthBack--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - monthBack + 1, 0);
    const monthInvs = invoices.filter((i) => {
      const d = new Date(i.issueDate);
      return d >= monthDate && d <= monthEnd && (i.status === "paid" || i.status === "partial");
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
      revenue: monthBack > 2 ? randMoney(700_000, 1_400_000) : revenue, // synthesize historical
      expenses: monthBack > 2 ? randMoney(380_000, 720_000) : expensesTotal,
      netProfit: 0,
    });
  }
  for (const r of out) r.netProfit = r.revenue - r.expenses;
  return out;
}

function buildDailyCashFlow(payments: PaymentRecord[], expenses: ExpenseRecord[], now: Date): DailyCashFlow[] {
  const out: DailyCashFlow[] = [];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
    const date = fmt(d);
    const inflow = payments.filter((p) => p.date === date).reduce((s, p) => s + p.amount, 0);
    const outflow = expenses.filter((e) => e.date === date).reduce((s, e) => s + e.totalAmount, 0);
    out.push({ date, inflow, outflow, net: inflow - outflow });
  }
  return out;
}

function buildAlerts(): AnomalyAlert[] {
  return [
    {
      id: "alert-1",
      level: "warning",
      title: "Travel spend up 142%",
      description: "Travel & Lodging is ₹1.2L this month vs ₹49K average. Mostly Mumbai trip (₹85K).",
      triggeredAt: new Date().toISOString(),
      category: "Travel & Lodging",
      amount: 120_000,
    },
    {
      id: "alert-2",
      level: "critical",
      title: "Redline Media: 18 days overdue",
      description: "INV-1014 (₹1,18,000) is 18 days past due. No payment received.",
      triggeredAt: new Date(Date.now() - 86_400_000).toISOString(),
      amount: 118_000,
    },
    {
      id: "alert-3",
      level: "info",
      title: "Q1 close approaching",
      description: "Fiscal Q1 ends in 9 days. 3 unbilled engagements pending.",
      triggeredAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
  ];
}

function buildAIActivity(): AIActivityItem[] {
  return [
    {
      id: "ai-1",
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      action: "Invoice created",
      description: "Created INV-1042 for Bluestone Tech (₹85,000) via WhatsApp",
      status: "success",
      source: "whatsapp",
    },
    {
      id: "ai-2",
      timestamp: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
      action: "Expense categorized",
      description: "Tagged ₹2,400 from Swiggy as Meals & Food",
      status: "success",
      source: "auto",
    },
    {
      id: "ai-3",
      timestamp: new Date(Date.now() - 1000 * 60 * 91).toISOString(),
      action: "Receipt attached",
      description: "Photo matched to bank-fed expense ₹1,180 (Barbeque Nation)",
      status: "success",
      source: "whatsapp",
    },
    {
      id: "ai-4",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      action: "Reminder sent",
      description: "Sent payment reminder to Redline Media for INV-1014",
      status: "success",
      source: "auto",
    },
    {
      id: "ai-5",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      action: "P&L generated",
      description: "Calculated April P&L: ₹8.4L revenue, ₹3.2L expenses",
      status: "success",
      source: "chat",
    },
  ];
}

export function buildMockAggregate(now: Date = new Date()): DashboardAggregate {
  const invoices = buildInvoices(now);
  const expenses = buildExpenses(now);
  const payments = buildPayments(invoices);
  const banks = buildBankAccounts();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const fyStart = new Date(now.getFullYear(), 3, 1); // April

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

  const outstandingInvs = invoices.filter((i) => i.amountDue > 0);
  const overdueInvs = outstandingInvs.filter((i) => i.daysOverdue > 0);
  const totalOutstanding = outstandingInvs.reduce((s, i) => s + i.amountDue, 0);
  const totalOverdue = overdueInvs.reduce((s, i) => s + i.amountDue, 0);

  const customers = buildCustomerSummaries(invoices);

  const cgst = invoices.reduce((s, i) => s + i.cgst, 0);
  const sgst = invoices.reduce((s, i) => s + i.sgst, 0);
  const igst = invoices.reduce((s, i) => s + i.igst, 0);
  const itc = expenses.reduce((s, e) => s + e.taxAmount, 0);

  const placeOfSupply = customers.reduce(
    (acc, c) => {
      const existing = acc.find((x) => x.state === c.state);
      const type: "intra" | "inter" = c.state === ORG_STATE ? "intra" : "inter";
      if (existing) existing.revenue += c.totalRevenue;
      else acc.push({ state: c.state, revenue: c.totalRevenue, type });
      return acc;
    },
    [] as { state: string; revenue: number; type: "intra" | "inter" }[],
  );

  const today = fmt(now);
  const recentInvoices = invoices.slice(0, 8);
  const recentExpenses = expenses.slice(0, 8);
  const recentPayments = payments.slice(0, 8);

  return {
    generatedAt: now.toISOString(),
    org: {
      id: "advertout",
      name: "AdvertOut",
      gstin: "29AABCA1234R1Z5",
      stateCode: "29",
      fiscalYearStart: "04-01",
    },
    revenue: {
      mtd: revMtd,
      qtd: revMtd, // simplified
      ytd: revYtd,
      lastMonthMtd: revLastMtd,
    },
    expenses: {
      mtd: expMtd,
      qtd: expMtd,
      ytd: expYtd,
      lastMonthMtd: expLastMtd,
    },
    profitability: {
      netProfitMtd: revMtd - expMtd,
      netProfitYtd: revYtd - expYtd,
      grossMarginPct: revMtd > 0 ? ((revMtd - expMtd) / revMtd) * 100 : 0,
      expenseRatioPct: revMtd > 0 ? (expMtd / revMtd) * 100 : 0,
    },
    cash: {
      accounts: banks,
      totalBalance: banks.reduce((s, b) => s + b.balance, 0),
      inflowsMtd: payments.filter((p) => new Date(p.date) >= monthStart).reduce((s, p) => s + p.amount, 0),
      outflowsMtd: expMtd,
      netCashFlowMtd: 0,
      dailyFlow: buildDailyCashFlow(payments, expenses, now),
    },
    receivables: {
      totalOutstanding,
      overdueAmount: totalOverdue,
      overdueCount: overdueInvs.length,
      averageDaysToPay: 19,
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
      totalOpenBills: 245_000,
      openBillsCount: 4,
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
      uncategorizedCount: 7,
    },
    customers: {
      all: customers,
      topByRevenue: customers.slice(0, 5),
    },
    payments: {
      all: payments,
      recent: recentPayments,
      receivedMtd: payments.filter((p) => new Date(p.date) >= monthStart).reduce((s, p) => s + p.amount, 0),
    },
    gst: {
      cgstCollected: cgst,
      sgstCollected: sgst,
      igstCollected: igst,
      totalLiability: cgst + sgst + igst,
      inputTaxCredit: itc,
      netPayable: cgst + sgst + igst - itc,
      placeOfSupplyBreakdown: placeOfSupply,
    },
    ops: {
      invoicesCreatedToday: invoices.filter((i) => i.issueDate === today).length,
      paymentsReceivedToday: payments.filter((p) => p.date === today).length,
      averageInvoiceValue:
        invoices.length > 0 ? invoices.reduce((s, i) => s + i.total, 0) / invoices.length : 0,
    },
    trend: {
      monthly: buildMonthlyTrend(invoices, expenses, now),
    },
    alerts: buildAlerts(),
    aiActivity: buildAIActivity(),
  };
}

// Cached singleton — same data across requests in dev.
let cached: DashboardAggregate | null = null;
export function getMockAggregate(): DashboardAggregate {
  if (!cached) {
    cached = buildMockAggregate();
    // Recompute net cash flow after build
    cached.cash.netCashFlowMtd = cached.cash.inflowsMtd - cached.cash.outflowsMtd;
  }
  return cached;
}
