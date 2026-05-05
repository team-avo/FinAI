import { db } from "@/lib/db/client";
import { invoices, expenses, chartOfAccounts } from "@/lib/db/schema";
import { and, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";

export interface OutstandingInvoice {
  id: string;
  number: string;
  contactId: string | null;
  contactName: string;
  issueDate: Date;
  dueDate: Date | null;
  status: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  daysOverdue: number;
}

export interface OutstandingSummary {
  items: OutstandingInvoice[];
  totalOutstanding: number;
  overdueCount: number;
  totalOverdue: number;
}

export async function getOutstandingReceivables(orgId: string): Promise<OutstandingSummary> {
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      contactId: invoices.contactId,
      contactName: invoices.contactName,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      status: invoices.status,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      amountDue: invoices.amountDue,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.orgId, orgId),
        inArray(invoices.status, ["sent", "overdue", "partial"]),
        gt(invoices.amountDue, "0"),
      ),
    )
    .orderBy(invoices.dueDate);

  const now = new Date();
  const items: OutstandingInvoice[] = rows.map((row) => {
    const dueDate = row.dueDate ?? null;
    const daysOverdue =
      dueDate && dueDate < now
        ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return {
      id: row.id,
      number: row.number,
      contactId: row.contactId,
      contactName: row.contactName,
      issueDate: row.issueDate,
      dueDate,
      status: row.status,
      total: parseFloat(row.total),
      amountPaid: parseFloat(row.amountPaid),
      amountDue: parseFloat(row.amountDue),
      daysOverdue,
    };
  });

  const totalOutstanding = items.reduce((s, i) => s + i.amountDue, 0);
  const overdueItems = items.filter((i) => i.daysOverdue > 0);

  return {
    items,
    totalOutstanding,
    overdueCount: overdueItems.length,
    totalOverdue: overdueItems.reduce((s, i) => s + i.amountDue, 0),
  };
}

export interface ExpenseBreakdownItem {
  accountId: string | null;
  accountName: string | null;
  total: number;
  count: number;
}

export async function getExpenseBreakdown(
  orgId: string,
  from: Date,
  to: Date,
): Promise<ExpenseBreakdownItem[]> {
  const rows = await db
    .select({
      accountId: expenses.accountId,
      accountName: chartOfAccounts.name,
      total: sql<string>`COALESCE(SUM(${expenses.totalAmount}::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(expenses)
    .leftJoin(chartOfAccounts, eq(expenses.accountId, chartOfAccounts.id))
    .where(
      and(
        eq(expenses.orgId, orgId),
        gte(expenses.date, from),
        lte(expenses.date, to),
      ),
    )
    .groupBy(expenses.accountId, chartOfAccounts.name)
    .orderBy(sql`COALESCE(SUM(${expenses.totalAmount}::numeric), 0) DESC`);

  return rows.map((row) => ({
    accountId: row.accountId,
    accountName: row.accountName,
    total: parseFloat(row.total),
    count: row.count,
  }));
}
