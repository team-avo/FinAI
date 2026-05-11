import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { contacts, invoices, expenses, invoiceLines, organizations, vendorCategories } from "@/lib/db/schema";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import { getPnLReport } from "@/lib/accounting/reports/pnl";
import { getOutstandingReceivables, getExpenseBreakdown } from "@/lib/accounting/reports/outstanding";
import { postInvoice, postExpense, getAccountByCode } from "@/lib/accounting/journal";
import { summariseInvoiceTax, isInterstateSale, calculateLineGST } from "@/lib/accounting/gst";
import { createId } from "@/lib/db/utils";
import { formatINR } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";
import { logActivity } from "@/lib/trpc/routers/activity";

const ORG_ID = "advertout";

const getPnLParams = z.object({
  from: z.string().describe("Start date in YYYY-MM-DD format"),
  to: z.string().describe("End date in YYYY-MM-DD format"),
});

const getExpenseBreakdownParams = z.object({
  from: z.string().optional().describe("Start date YYYY-MM-DD, defaults to start of month"),
  to: z.string().optional().describe("End date YYYY-MM-DD, defaults to today"),
});

const findContactParams = z.object({
  query: z.string().describe("Name or email to search"),
});

const createInvoiceParams = z.object({
  contactName: z.string().describe("Customer name"),
  contactGstin: z.string().optional(),
  issueDate: z.string().describe("Issue date in YYYY-MM-DD format, defaults to today"),
  dueDate: z.string().optional().describe("Due date in YYYY-MM-DD format"),
  lines: z.array(z.object({
    description: z.string(),
    quantity: z.string().describe("Quantity (default 1)"),
    rate: z.string().describe("Rate in INR"),
    taxRate: z.string().describe("GST rate percentage (default 18)"),
  })).min(1),
});

const recordExpenseParams = z.object({
  date: z.string().describe("Date in YYYY-MM-DD format, defaults to today"),
  vendorName: z.string().optional().describe("Vendor or merchant name"),
  categoryDescription: z.string().describe("Description of the expense category (e.g. 'food', 'travel', 'software subscription')"),
  amount: z.number().positive().describe("Base amount before tax in INR"),
  cgst: z.number().min(0).describe("CGST amount"),
  sgst: z.number().min(0).describe("SGST amount"),
  igst: z.number().min(0).describe("IGST amount"),
  notes: z.string().optional(),
});

const getRecentInvoicesParams = z.object({
  limit: z.number().describe("Number of invoices to return"),
  status: z.string().optional(),
});

export const agentTools = {
  getPnL: tool({
    description: "Get the Profit & Loss report for a date range",
    inputSchema: getPnLParams,
    execute: async (input: z.infer<typeof getPnLParams>) => {
      const report = await getPnLReport(ORG_ID, new Date(input.from), new Date(input.to));
      return {
        totalRevenue: formatINR(report.totalRevenue),
        totalExpenses: formatINR(report.totalExpenses),
        netProfit: formatINR(report.netProfit),
        revenueBreakdown: report.revenue.map((r) => ({ account: r.accountName, amount: formatINR(r.amount) })),
        expenseBreakdown: report.expenses.map((e) => ({ account: e.accountName, amount: formatINR(e.amount) })),
      };
    },
  }),

  getThisMonthPnL: tool({
    description: "Get P&L for the current month",
    inputSchema: z.preprocess((v) => v ?? {}, z.object({})),
    execute: async () => {
      const now = new Date();
      const report = await getPnLReport(ORG_ID, startOfMonth(now), endOfMonth(now));
      return {
        period: `${startOfMonth(now).toLocaleDateString("en-IN")} — ${endOfMonth(now).toLocaleDateString("en-IN")}`,
        revenue: formatINR(report.totalRevenue),
        expenses: formatINR(report.totalExpenses),
        netProfit: formatINR(report.netProfit),
      };
    },
  }),

  getOutstandingInvoices: tool({
    description: "Get all unpaid/outstanding invoices",
    inputSchema: z.preprocess((v) => v ?? {}, z.object({})),
    execute: async () => {
      const summary = await getOutstandingReceivables(ORG_ID);
      return {
        totalOutstanding: formatINR(summary.totalOutstanding),
        overdueCount: summary.overdueCount,
        totalOverdue: formatINR(summary.totalOverdue),
        invoices: summary.items.slice(0, 10).map((inv) => ({
          number: inv.number,
          customer: inv.contactName,
          amountDue: formatINR(inv.amountDue),
          daysOverdue: inv.daysOverdue > 0 ? `${inv.daysOverdue} days overdue` : "Not overdue",
        })),
      };
    },
  }),

  getExpenseBreakdown: tool({
    description: "Get expense breakdown by category for a period",
    inputSchema: getExpenseBreakdownParams,
    execute: async (input: z.infer<typeof getExpenseBreakdownParams>) => {
      const now = new Date();
      const breakdown = await getExpenseBreakdown(
        ORG_ID,
        input.from ? new Date(input.from) : startOfMonth(now),
        input.to ? new Date(input.to) : now,
      );
      return breakdown.slice(0, 10).map((b) => ({
        category: b.accountName ?? "Uncategorized",
        total: formatINR(b.total),
        count: b.count,
      }));
    },
  }),

  findContact: tool({
    description: "Find a contact by name or email",
    inputSchema: findContactParams,
    execute: async (input: z.infer<typeof findContactParams>) => {
      const term = `%${input.query}%`;
      const results = await db
        .select({ id: contacts.id, name: contacts.name, email: contacts.email, gstin: contacts.gstin, type: contacts.type })
        .from(contacts)
        .where(
          and(
            eq(contacts.orgId, ORG_ID),
            or(ilike(contacts.name, term), ilike(contacts.email, term)),
          ),
        )
        .limit(5);

      return results.length > 0
        ? results
        : "No contacts found matching that query.";
    },
  }),

  createInvoice: tool({
    description: "Create an invoice for a customer",
    inputSchema: createInvoiceParams,
    execute: async (input: z.infer<typeof createInvoiceParams>) => {
      const [org] = await db.select({ gstin: organizations.gstin }).from(organizations).where(eq(organizations.id, ORG_ID)).limit(1);
      const interstate = isInterstateSale(org?.gstin, input.contactGstin);

      const taxLines = input.lines.map((l) => ({
        quantity: parseFloat(l.quantity),
        rate: parseFloat(l.rate),
        gstRate: parseFloat(l.taxRate),
      }));

      const summary = summariseInvoiceTax(taxLines, interstate);

      const [{ count }] = await db.select({ count: db.$count(invoices, eq(invoices.orgId, ORG_ID)) }).from(invoices);
      const nextNum = Number(count) + 1;
      const invoiceNumber = `INV-${String(nextNum).padStart(4, "0")}`;

      const issueDate = input.issueDate ? new Date(input.issueDate) : new Date();

      const [invoice] = await db
        .insert(invoices)
        .values({
          orgId: ORG_ID,
          number: invoiceNumber,
          contactName: input.contactName,
          contactGstin: input.contactGstin,
          issueDate,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          status: "draft",
          subtotal: String(summary.subtotal),
          cgstAmount: String(summary.cgst),
          sgstAmount: String(summary.sgst),
          igstAmount: String(summary.igst),
          totalTax: String(summary.totalTax),
          total: String(summary.total),
          amountPaid: "0",
          amountDue: String(summary.total),
          isInterstate: interstate ? 1 : 0,
        })
        .returning();

      const lineInserts = input.lines.map((line, i: number) => {
        const gst = calculateLineGST(
          parseFloat(line.quantity),
          parseFloat(line.rate),
          parseFloat(line.taxRate),
          interstate,
        );
        return {
          id: createId(),
          invoiceId: invoice.id,
          description: line.description,
          quantity: line.quantity,
          rate: line.rate,
          taxRate: line.taxRate,
          cgstRate: String(gst.cgstRate),
          sgstRate: String(gst.sgstRate),
          igstRate: String(gst.igstRate),
          taxAmount: String(gst.taxAmount),
          amount: String(gst.lineTotal),
          sortOrder: i,
        };
      });

      await db.insert(invoiceLines).values(lineInserts);

      const incomeAccountId = await getAccountByCode(ORG_ID, "4100");
      if (incomeAccountId) {
        await postInvoice({
          orgId: ORG_ID,
          invoiceId: invoice.id,
          date: issueDate,
          subtotal: summary.subtotal,
          cgst: summary.cgst,
          sgst: summary.sgst,
          igst: summary.igst,
          total: summary.total,
          contactName: input.contactName,
          incomeAccountId,
        });
      }

      const result = {
        invoiceId: invoice.id,
        invoiceNumber,
        total: formatINR(summary.total),
        status: "draft",
        message: `Invoice ${invoiceNumber} created for ${input.contactName} — ${formatINR(summary.total)}`,
      };

      logActivity({
        orgId: ORG_ID,
        actor: "ai_web",
        action: "tool:createInvoice",
        entityType: "invoice",
        entityRef: invoiceNumber,
        input: { contactName: input.contactName, lineCount: input.lines.length },
        output: { invoiceId: invoice.id, total: summary.total },
      }).catch(() => {});

      return result;
    },
  }),

  recordExpense: tool({
    description: "Record a business expense",
    inputSchema: recordExpenseParams,
    execute: async (input: z.infer<typeof recordExpenseParams>) => {
      const accountId = await resolveExpenseAccount(input.categoryDescription);
      if (!accountId) {
        return "Could not determine expense category. Please create the expense manually.";
      }

      const taxAmount = input.cgst + input.sgst + input.igst;
      const totalAmount = input.amount + taxAmount;

      const [expense] = await db
        .insert(expenses)
        .values({
          orgId: ORG_ID,
          date: input.date ? new Date(input.date) : new Date(),
          vendorName: input.vendorName,
          accountId,
          amount: String(input.amount),
          taxAmount: String(taxAmount),
          totalAmount: String(totalAmount),
          notes: input.notes,
          source: "whatsapp",
          aiCategorized: true,
        })
        .returning();

      const bankId = await getAccountByCode(ORG_ID, "1120");
      if (bankId) {
        await postExpense({
          orgId: ORG_ID,
          expenseId: expense.id,
          date: expense.date,
          amount: input.amount,
          cgst: input.cgst,
          sgst: input.sgst,
          igst: input.igst,
          total: totalAmount,
          expenseAccountId: accountId,
          description: input.vendorName ?? input.notes ?? "Expense",
          bankAccountId: bankId,
        });
      }

      const result = {
        expenseId: expense.id,
        vendorName: input.vendorName,
        amount: formatINR(totalAmount),
        message: `Expense of ${formatINR(totalAmount)} recorded${input.vendorName ? ` for ${input.vendorName}` : ""}`,
      };

      logActivity({
        orgId: ORG_ID,
        actor: "ai_web",
        action: "tool:recordExpense",
        entityType: "expense",
        entityRef: expense.id,
        input: { vendorName: input.vendorName, amount: input.amount, category: input.categoryDescription },
        output: { expenseId: expense.id, total: totalAmount },
      }).catch(() => {});

      return result;
    },
  }),

  learnVendorCategory: tool({
    description: "Save a vendor→category mapping so future expenses from this vendor are auto-categorized. Use this when the user corrects a category or explicitly tells you what a vendor should map to.",
    inputSchema: z.object({
      vendorPattern: z.string().describe("Vendor name or pattern, e.g. 'Swiggy', 'AWS'"),
      accountCode: z.string().describe("Chart of accounts code, e.g. '6540' for Meals & Food"),
    }),
    execute: async (input) => {
      const accountId = await getAccountByCode(ORG_ID, input.accountCode);
      if (!accountId) return `Account code ${input.accountCode} not found`;

      await db
        .insert(vendorCategories)
        .values({ orgId: ORG_ID, vendorPattern: input.vendorPattern, accountId })
        .onConflictDoNothing();

      logActivity({
        orgId: ORG_ID,
        actor: "ai_web",
        action: "tool:learnVendorCategory",
        entityType: "vendor_category",
        entityRef: input.vendorPattern,
        input: { vendorPattern: input.vendorPattern, accountCode: input.accountCode },
        output: { accountId },
      }).catch(() => {});

      return `Learned: ${input.vendorPattern} → account ${input.accountCode}`;
    },
  }),

  getRecentInvoices: tool({
    description: "Get list of recent invoices",
    inputSchema: getRecentInvoicesParams,
    execute: async (input: z.infer<typeof getRecentInvoicesParams>) => {
      const conditions = [eq(invoices.orgId, ORG_ID)];
      const results = await db
        .select({
          number: invoices.number,
          contactName: invoices.contactName,
          status: invoices.status,
          total: invoices.total,
          amountDue: invoices.amountDue,
          issueDate: invoices.issueDate,
        })
        .from(invoices)
        .where(and(...conditions))
        .orderBy(desc(invoices.issueDate))
        .limit(input.limit);

      return results.map((inv) => ({
        number: inv.number,
        customer: inv.contactName,
        status: inv.status,
        total: formatINR(parseFloat(inv.total)),
        due: parseFloat(inv.amountDue) > 0 ? formatINR(parseFloat(inv.amountDue)) : "Paid",
        date: inv.issueDate.toLocaleDateString("en-IN"),
      }));
    },
  }),
};

async function resolveExpenseAccount(categoryDescription: string): Promise<string | null> {
  const lower = categoryDescription.toLowerCase();

  // 1. Check DB vendor→category rules first (user-taught mappings take priority)
  const dbRules = await db
    .select({ accountId: vendorCategories.accountId })
    .from(vendorCategories)
    .where(and(eq(vendorCategories.orgId, ORG_ID), ilike(vendorCategories.vendorPattern, `%${lower}%`)))
    .limit(1);

  if (dbRules[0]?.accountId) return dbRules[0].accountId;

  // 2. Fall back to hardcoded keyword matching
  const keywords = [
    { pattern: ["food", "meal", "swiggy", "zomato", "lunch", "dinner", "breakfast"], code: "6540" },
    { pattern: ["cab", "uber", "ola", "taxi", "transport", "rapido", "auto"], code: "6520" },
    { pattern: ["flight", "train", "travel", "hotel", "accommodation", "oyo", "airbnb"], code: "6510" },
    { pattern: ["aws", "cloud", "hosting", "server", "gcp", "azure"], code: "6310" },
    { pattern: ["saas", "software", "subscription", "notion", "slack", "figma", "github", "zoom"], code: "6320" },
    { pattern: ["internet", "airtel", "jio", "broadband", "telecom", "mobile"], code: "6340" },
    { pattern: ["salary", "payroll", "wage"], code: "6110" },
    { pattern: ["rent", "office"], code: "6210" },
    { pattern: ["marketing", "advertising", "ads"], code: "6410" },
    { pattern: ["legal", "compliance", "ca", "accountant", "lawyer"], code: "6620" },
    { pattern: ["miscellaneous", "other", "misc"], code: "6920" },
  ];

  for (const { pattern, code } of keywords) {
    if (pattern.some((p) => lower.includes(p))) {
      return getAccountByCode(ORG_ID, code);
    }
  }

  return getAccountByCode(ORG_ID, "6920");
}
