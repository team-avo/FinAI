import { and, eq, gte, like } from "drizzle-orm";
import { getAccountByCode, postExpense, postInvoice } from "@/lib/accounting/journal";
import { db } from "@/lib/db/client";
import { expenses, invoices, journalEntries } from "@/lib/db/schema";

/**
 * Seeds (and re-seeds) a demo org's CURRENT-MONTH ledger so the Dashboard P&L
 * (which is month-to-date) always shows live numbers.
 *
 * This is deliberately split out from the one-shot demo seed because the P&L is
 * the one piece of demo data that goes stale with the calendar: the seed posts
 * it for the month it runs in, so once the month rolls over, MTD empties out.
 * A daily cron calls this to re-anchor the ledger to the current month, which
 * keeps the demo "evergreen" regardless of deploy cadence.
 *
 * Idempotent: clears this month's demo-marked rows (and all of the org's
 * current-month journal entries — demo-only under the SEED_DEMO_DATA flag) before
 * re-posting, so it's safe to run every day. Returns a short summary.
 */
export async function seedCurrentMonthLedger(
  orgId: string,
  now: Date = new Date(),
): Promise<{ expenses: number; invoices: number; posted: boolean }> {
  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Clear this month's demo ledger wholesale (cascades journal lines), then the
  // demo expense/invoice rows. Robustly idempotent, no orphaned entries.
  await db
    .delete(journalEntries)
    .where(and(eq(journalEntries.orgId, orgId), gte(journalEntries.date, curMonthStart)));
  await db
    .delete(expenses)
    .where(and(eq(expenses.orgId, orgId), like(expenses.reference, "CUR-DEMO%")));
  await db
    .delete(invoices)
    .where(and(eq(invoices.orgId, orgId), like(invoices.number, "DEMO-REV-%")));

  const bankId = await getAccountByCode(orgId, "1120");
  const incomeId = await getAccountByCode(orgId, "4100");
  const curDay = (day: number) => new Date(now.getFullYear(), now.getMonth(), Math.min(day, 28));
  const r2 = (v: number) => Math.round(v * 100) / 100;
  let posted = false;

  // Expenses this month (posted → Dr expense / Cr bank).
  const curExp = async (vendor: string, code: string, taxable: number, day: number) => {
    const half = r2(taxable * 0.09);
    const total = taxable + half * 2;
    const acctId = await getAccountByCode(orgId, code);
    const [row] = await db
      .insert(expenses)
      .values({
        orgId,
        date: curDay(day),
        vendorName: vendor,
        accountId: acctId,
        amount: String(taxable),
        taxAmount: String(half * 2),
        totalAmount: String(total),
        currency: "INR",
        cgst: String(half),
        sgst: String(half),
        igst: "0",
        itcEligible: true,
        reference: "CUR-DEMO",
        aiCategorized: true,
      })
      .returning();
    if (acctId && bankId) {
      const jeId = await postExpense({
        orgId,
        expenseId: row.id,
        date: row.date,
        amount: taxable,
        cgst: half,
        sgst: half,
        igst: 0,
        total,
        expenseAccountId: acctId,
        description: vendor,
        bankAccountId: bankId,
      });
      await db.update(expenses).set({ journalEntryId: jeId }).where(eq(expenses.id, row.id));
      posted = true;
    }
  };
  await curExp("AWS India", "6310", 45000, 3);
  await curExp("Google Ads", "6410", 60000, 6);
  await curExp("Office Rent", "6210", 35000, 1);
  await curExp("Zoom + Figma", "6320", 8000, 9);

  // Revenue invoices this month, marked paid (posted → Dr A/R, Cr Revenue) so
  // they show as revenue without inflating outstanding receivables.
  const curInv = async (num: string, name: string, subtotal: number, day: number) => {
    const half = r2(subtotal * 0.09);
    const total = subtotal + half * 2;
    const [row] = await db
      .insert(invoices)
      .values({
        orgId,
        number: num,
        contactName: name,
        issueDate: curDay(day),
        status: "paid",
        subtotal: String(subtotal),
        cgstAmount: String(half),
        sgstAmount: String(half),
        totalTax: String(half * 2),
        total: String(total),
        amountPaid: String(total),
        amountDue: "0",
        currency: "INR",
      })
      .returning();
    if (incomeId) {
      const jeId = await postInvoice({
        orgId,
        invoiceId: row.id,
        date: row.issueDate,
        subtotal,
        cgst: half,
        sgst: half,
        igst: 0,
        total,
        contactName: name,
        incomeAccountId: incomeId,
      });
      await db.update(invoices).set({ journalEntryId: jeId }).where(eq(invoices.id, row.id));
      posted = true;
    }
  };
  await curInv("DEMO-REV-0101", "Acme Corp", 180000, 4);
  await curInv("DEMO-REV-0102", "Globex Media", 120000, 8);

  return { expenses: 4, invoices: 2, posted };
}
