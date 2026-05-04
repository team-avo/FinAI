import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expenses, invoices } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";
import { getMonthlyPnL } from "@/lib/accounting/reports/pnl";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export const dashboardRouter = router({
  kpis: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const [revenueRow] = await db
      .select({
        current: sql<string>`COALESCE(SUM(CASE WHEN issue_date >= ${monthStart} AND issue_date <= ${monthEnd} AND status = 'paid' THEN total::numeric ELSE 0 END), 0)`,
        previous: sql<string>`COALESCE(SUM(CASE WHEN issue_date >= ${lastMonthStart} AND issue_date <= ${lastMonthEnd} AND status = 'paid' THEN total::numeric ELSE 0 END), 0)`,
        outstanding: sql<string>`COALESCE(SUM(CASE WHEN status IN ('sent','overdue','partial') THEN amount_due::numeric ELSE 0 END), 0)`,
        overdueCount: sql<number>`COUNT(CASE WHEN status = 'overdue' THEN 1 END)::int`,
      })
      .from(invoices)
      .where(eq(invoices.orgId, ctx.orgId));

    const [expenseRow] = await db
      .select({
        current: sql<string>`COALESCE(SUM(CASE WHEN date >= ${monthStart} AND date <= ${monthEnd} THEN total_amount::numeric ELSE 0 END), 0)`,
        previous: sql<string>`COALESCE(SUM(CASE WHEN date >= ${lastMonthStart} AND date <= ${lastMonthEnd} THEN total_amount::numeric ELSE 0 END), 0)`,
      })
      .from(expenses)
      .where(eq(expenses.orgId, ctx.orgId));

    const rev = parseFloat(revenueRow?.current ?? "0");
    const revPrev = parseFloat(revenueRow?.previous ?? "0");
    const exp = parseFloat(expenseRow?.current ?? "0");
    const expPrev = parseFloat(expenseRow?.previous ?? "0");

    return {
      revenue: {
        current: rev,
        previous: revPrev,
        change: revPrev > 0 ? ((rev - revPrev) / revPrev) * 100 : null,
      },
      expenses: {
        current: exp,
        previous: expPrev,
        change: expPrev > 0 ? ((exp - expPrev) / expPrev) * 100 : null,
      },
      netProfit: {
        current: rev - exp,
        previous: revPrev - expPrev,
      },
      outstanding: parseFloat(revenueRow?.outstanding ?? "0"),
      overdueCount: revenueRow?.overdueCount ?? 0,
    };
  }),

  revenueChart: protectedProcedure.query(async ({ ctx }) => {
    return getMonthlyPnL(ctx.orgId, 6);
  }),

  recentInvoices: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: invoices.id,
        number: invoices.number,
        contactName: invoices.contactName,
        total: invoices.total,
        amountDue: invoices.amountDue,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .where(eq(invoices.orgId, ctx.orgId))
      .orderBy(desc(invoices.createdAt))
      .limit(5);
  }),

  recentExpenses: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: expenses.id,
        date: expenses.date,
        vendorName: expenses.vendorName,
        totalAmount: expenses.totalAmount,
        notes: expenses.notes,
        source: expenses.source,
      })
      .from(expenses)
      .where(eq(expenses.orgId, ctx.orgId))
      .orderBy(desc(expenses.date))
      .limit(5);
  }),
});
