import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankAccounts, expenses } from "@/lib/db/schema";
import { getOutstandingReceivables } from "./outstanding";

/**
 * Forward cash-flow forecast. Projects the connected bank balance over the next
 * `days`, adding receivables as they come due and subtracting the recent daily
 * burn, to find the lowest point — and whether the business runs short.
 *
 * Deliberately conservative: money that is already OVERDUE is not counted as a
 * reliable inflow (that's exactly why cash gets tight), so the forecast answers
 * "what if the late payers stay late?". Needs a connected bank (see
 * BankProvider); without one it reports `connected: false`.
 */

export interface CashForecast {
  connected: boolean;
  horizonDays: number;
  displayName?: string;
  startBalance?: number;
  dailyBurn?: number;
  expectedInflow?: number; // reliable (not-yet-overdue) receivables arriving in the window
  lowBalance?: number;
  lowDaysOut?: number;
  lowDateLabel?: string;
  willGoNegative?: boolean;
  shortfall?: number; // how far below zero at the low point (positive number)
  shortDaysOut?: number; // first day the balance goes negative
  shortDateLabel?: string;
}

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function daysUntil(target: Date, now: Date) {
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export async function forecastCash(orgId: string, days = 30, now: Date = new Date()): Promise<CashForecast> {
  const [acct] = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.connected, true)))
    .limit(1);

  if (!acct) return { connected: false, horizonDays: days };

  const startBalance = parseFloat(acct.balance);

  // Daily burn from the last 60 days of expenses.
  const since = new Date(now.getTime() - 60 * 86400000);
  const [burnRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${expenses.totalAmount}::numeric), 0)` })
    .from(expenses)
    .where(and(eq(expenses.orgId, orgId), gte(expenses.date, since)));
  const dailyBurn = round2(parseFloat(burnRow?.total ?? "0") / 60);

  // Reliable inflows: receivables due within the window that are NOT already overdue.
  const recv = await getOutstandingReceivables(orgId);
  const inflowByDay = new Array(days + 1).fill(0);
  let expectedInflow = 0;
  for (const inv of recv.items) {
    if (inv.daysOverdue > 0 || !inv.dueDate) continue;
    const d = daysUntil(new Date(inv.dueDate), now);
    if (d >= 1 && d <= days) {
      inflowByDay[d] += inv.amountDue;
      expectedInflow += inv.amountDue;
    }
  }

  // Walk the horizon.
  let bal = startBalance;
  let lowBalance = startBalance;
  let lowDay = 0;
  let firstNegDay = 0;
  for (let day = 1; day <= days; day++) {
    bal = bal - dailyBurn + inflowByDay[day];
    if (bal < lowBalance) {
      lowBalance = bal;
      lowDay = day;
    }
    if (firstNegDay === 0 && bal < 0) firstNegDay = day;
  }
  lowBalance = round2(lowBalance);

  const label = (d: number) =>
    new Date(now.getTime() + d * 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return {
    connected: true,
    horizonDays: days,
    displayName: acct.displayName,
    startBalance: round2(startBalance),
    dailyBurn,
    expectedInflow: round2(expectedInflow),
    lowBalance,
    lowDaysOut: lowDay,
    lowDateLabel: label(lowDay),
    willGoNegative: lowBalance < 0,
    shortfall: lowBalance < 0 ? round2(-lowBalance) : 0,
    shortDaysOut: firstNegDay || undefined,
    shortDateLabel: firstNegDay ? label(firstNegDay) : undefined,
  };
}
