import { db } from "@/lib/db/client";
import { chartOfAccounts, journalEntries, journalLines } from "@/lib/db/schema";
import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";

export interface PnLAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: "income" | "expense";
  amount: number;
}

export interface PnLReport {
  from: Date;
  to: Date;
  revenue: PnLAccount[];
  expenses: PnLAccount[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

export async function getPnLReport(orgId: string, from: Date, to: Date): Promise<PnLReport> {
  const rows = await db
    .select({
      accountId: journalLines.accountId,
      accountCode: chartOfAccounts.code,
      accountName: chartOfAccounts.name,
      accountType: chartOfAccounts.type,
      debitTotal: sql<string>`COALESCE(SUM(${journalLines.debit}::numeric), 0)`,
      creditTotal: sql<string>`COALESCE(SUM(${journalLines.credit}::numeric), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(chartOfAccounts, eq(journalLines.accountId, chartOfAccounts.id))
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        gte(journalEntries.date, from),
        lte(journalEntries.date, to),
        inArray(chartOfAccounts.type, ["income", "expense"]),
      ),
    )
    .groupBy(
      journalLines.accountId,
      chartOfAccounts.code,
      chartOfAccounts.name,
      chartOfAccounts.type,
    )
    .orderBy(chartOfAccounts.code);

  const revenue: PnLAccount[] = [];
  const expenses: PnLAccount[] = [];

  for (const row of rows) {
    const debit = parseFloat(row.debitTotal);
    const credit = parseFloat(row.creditTotal);

    if (row.accountType === "income") {
      const amount = round2(credit - debit);
      if (amount !== 0) {
        revenue.push({
          accountId: row.accountId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          accountType: "income",
          amount,
        });
      }
    } else if (row.accountType === "expense") {
      const amount = round2(debit - credit);
      if (amount !== 0) {
        expenses.push({
          accountId: row.accountId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          accountType: "expense",
          amount,
        });
      }
    }
  }

  const totalRevenue = round2(revenue.reduce((s, a) => s + a.amount, 0));
  const totalExpenses = round2(expenses.reduce((s, a) => s + a.amount, 0));

  return {
    from,
    to,
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netProfit: round2(totalRevenue - totalExpenses),
  };
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
}

export async function getMonthlyPnL(orgId: string, months = 6): Promise<MonthlyRevenue[]> {
  const rows = await db
    .select({
      month: sql<string>`TO_CHAR(${journalEntries.date}, 'YYYY-MM')`,
      accountType: chartOfAccounts.type,
      debitTotal: sql<string>`COALESCE(SUM(${journalLines.debit}::numeric), 0)`,
      creditTotal: sql<string>`COALESCE(SUM(${journalLines.credit}::numeric), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(chartOfAccounts, eq(journalLines.accountId, chartOfAccounts.id))
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        inArray(chartOfAccounts.type, ["income", "expense"]),
        gte(
          journalEntries.date,
          sql`NOW() - INTERVAL '${sql.raw(String(months))} months'`,
        ),
      ),
    )
    .groupBy(
      sql`TO_CHAR(${journalEntries.date}, 'YYYY-MM')`,
      chartOfAccounts.type,
    )
    .orderBy(sql`TO_CHAR(${journalEntries.date}, 'YYYY-MM')`);

  const monthMap = new Map<string, MonthlyRevenue>();

  for (const row of rows) {
    const existing = monthMap.get(row.month) ?? {
      month: row.month,
      revenue: 0,
      expenses: 0,
      netProfit: 0,
    };

    const debit = parseFloat(row.debitTotal);
    const credit = parseFloat(row.creditTotal);

    if (row.accountType === "income") {
      existing.revenue = round2(credit - debit);
    } else if (row.accountType === "expense") {
      existing.expenses = round2(debit - credit);
    }

    existing.netProfit = round2(existing.revenue - existing.expenses);
    monthMap.set(row.month, existing);
  }

  return Array.from(monthMap.values());
}

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
