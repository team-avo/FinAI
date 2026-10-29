/**
 * Seed the full demo dataset so the flagship screens are rich out of the box:
 *   - GST Credit / Supplier Trust — purchases + GSTR-2B with ₹14,400 ITC at risk
 *   - Supplier Trust network effect — a 2nd business (Nimbus Media) observing
 *     the same suppliers
 *   - Money Check — overdue receivables (₹1,52,500) + a sandbox bank so the
 *     cash forecast runs
 *
 * Evergreen (dates are relative to "now"), idempotent (clears its own
 * demo-marked rows first), and scoped to the demo org ("advertout") plus the
 * data-only "org_nimbus". Real user orgs are never touched.
 *
 * Run locally with `pnpm db:seed:demo`. In a deploy it runs from post-build
 * only when SEED_DEMO_DATA=1. Non-fatal — never blocks a deploy.
 */
import { and, eq, gte, like } from "drizzle-orm";
import { getAccountByCode, postExpense, postInvoice } from "@/lib/accounting/journal";
import { db } from "@/lib/db/client";
import {
  bankAccounts,
  expenses,
  gstr2bEntries,
  invoices,
  journalEntries,
  organizations,
} from "@/lib/db/schema";

const ORG = "advertout";
const NIMBUS = "org_nimbus";

function ym(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  const now = new Date();
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); // last complete month
  const PERIOD = ym(lm);
  const dIn = (day: number) => new Date(lm.getFullYear(), lm.getMonth(), day);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

  // intrastate 18% expense (purchase register)
  const exp = (
    orgId: string,
    vendorName: string,
    gstin: string,
    invno: string,
    taxable: number,
    day: number,
    ref: string,
  ) => {
    const half = Math.round(taxable * 0.09 * 100) / 100;
    return {
      orgId,
      date: dIn(day),
      vendorName,
      amount: String(taxable),
      taxAmount: String(half * 2),
      totalAmount: String(taxable + half * 2),
      currency: "INR",
      vendorGstin: gstin,
      vendorInvoiceNumber: invno,
      invoiceDate: dIn(day),
      cgst: String(half),
      sgst: String(half),
      igst: "0",
      itcEligible: true,
      reference: ref,
      aiCategorized: true,
    };
  };
  // a GSTR-2B line (what the supplier filed)
  const twob = (
    orgId: string,
    supplierName: string,
    gstin: string,
    invno: string,
    taxable: number,
    day: number,
  ) => {
    const half = Math.round(taxable * 0.09 * 100) / 100;
    return {
      orgId,
      period: PERIOD,
      supplierGstin: gstin,
      supplierName,
      invoiceNumber: invno,
      invoiceDate: dIn(day),
      taxableValue: String(taxable),
      cgst: String(half),
      sgst: String(half),
      igst: "0",
    };
  };

  // ---- idempotent cleanup (demo-marked rows only) ----
  await db
    .delete(gstr2bEntries)
    .where(and(eq(gstr2bEntries.orgId, ORG), eq(gstr2bEntries.period, PERIOD)));
  await db
    .delete(expenses)
    .where(and(eq(expenses.orgId, ORG), like(expenses.reference, "RECON-DEMO%")));
  await db.delete(invoices).where(and(eq(invoices.orgId, ORG), like(invoices.number, "DEMO-%")));
  await db.delete(bankAccounts).where(eq(bankAccounts.orgId, ORG));
  await db
    .delete(gstr2bEntries)
    .where(and(eq(gstr2bEntries.orgId, NIMBUS), eq(gstr2bEntries.period, PERIOD)));
  await db
    .delete(expenses)
    .where(and(eq(expenses.orgId, NIMBUS), like(expenses.reference, "NET-DEMO%")));

  // ---- AdvertOut: purchase register (6) → ₹14,400 ITC at risk ----
  await db.insert(expenses).values([
    exp(ORG, "Reliance Digital", "29AABCR1234A1Z5", "INV-9001", 50000, 4, "RECON-DEMO"), // matched
    exp(ORG, "Chai Point Pvt Ltd", "29AADCC5678B1Z2", "CP-220", 10000, 7, "RECON-DEMO"), // matched
    exp(ORG, "CloudHost India", "29AAECC9012C1Z8", "CH-5521", 80000, 9, "RECON-DEMO"), // mismatch (2B lower)
    exp(ORG, "Metro Cash & Carry", "29AABCM3456D1Z1", "MCC-7781", 40000, 12, "RECON-DEMO"), // at risk
    exp(ORG, "Stationery World", "29AAQFS2233E1Z9", "SW-0145", 12000, 15, "RECON-DEMO"), // at risk
    exp(ORG, "Courier Express", "29AAFCC8899F1Z3", "CE-3310", 8000, 18, "RECON-DEMO"), // at risk
  ]);
  await db.insert(gstr2bEntries).values([
    twob(ORG, "Reliance Digital", "29AABCR1234A1Z5", "INV-9001", 50000, 4),
    twob(ORG, "Chai Point Pvt Ltd", "29AADCC5678B1Z2", "CP-220", 10000, 7),
    twob(ORG, "CloudHost India", "29AAECC9012C1Z8", "CH-5521", 60000, 9), // less than booked
    twob(ORG, "AWS India", "29AAACA1111G1Z7", "AWS-IN-88211", 25000, 11), // in 2B, not in books
  ]);

  // ---- AdvertOut: overdue receivables (₹1,52,500) ----
  const inv = (
    num: string,
    name: string,
    total: number,
    dueDaysAgo: number,
    issuedDaysAgo: number,
  ) => ({
    orgId: ORG,
    number: num,
    contactName: name,
    issueDate: daysAgo(issuedDaysAgo),
    dueDate: daysAgo(dueDaysAgo),
    status: "overdue" as const,
    subtotal: String(Math.round(total / 1.18)),
    total: String(total),
    amountPaid: "0",
    amountDue: String(total),
    currency: "INR",
  });
  await db
    .insert(invoices)
    .values([
      inv("DEMO-INV-0042", "Zomato Media", 88500, 17, 47),
      inv("DEMO-INV-0043", "Blinkit Brand Ads", 42000, 9, 39),
      inv("DEMO-INV-0044", "Swiggy Ads", 22000, 3, 33),
    ]);

  // ---- AdvertOut: sandbox bank (powers the cash forecast) ----
  await db.insert(bankAccounts).values({
    orgId: ORG,
    provider: "sandbox",
    displayName: "HDFC Current ••4821 (sandbox)",
    balance: "92000",
    connected: true,
  });

  // ---- Nimbus Media: a 2nd business observing the same suppliers (network effect) ----
  await db.insert(organizations).values({ id: NIMBUS, name: "Nimbus Media" }).onConflictDoNothing();
  await db.insert(expenses).values([
    exp(NIMBUS, "Metro Cash & Carry", "29AABCM3456D1Z1", "NB-MCC-11", 30000, 5, "NET-DEMO"), // not filed
    exp(NIMBUS, "Reliance Digital", "29AABCR1234A1Z5", "NB-REL-22", 25000, 8, "NET-DEMO"), // filed
    exp(NIMBUS, "Stationery World", "29AAQFS2233E1Z9", "NB-SW-33", 9000, 12, "NET-DEMO"), // not filed
    exp(NIMBUS, "Paper Hub", "29AAHCP7788K1Z4", "NB-PH-44", 15000, 15, "NET-DEMO"), // unique
  ]);
  await db
    .insert(gstr2bEntries)
    .values([
      twob(NIMBUS, "Reliance Digital", "29AABCR1234A1Z5", "NB-REL-22", 25000, 8),
      twob(NIMBUS, "Paper Hub", "29AAHCP7788K1Z4", "NB-PH-44", 15000, 15),
    ]);

  // ---- AdvertOut: current-month ledger so the Dashboard P&L (MTD) shows ----
  // Clear this month's demo ledger wholesale (advertout's current month is
  // demo-only under the SEED_DEMO_DATA flag) — cascades journal lines — then
  // the demo expense/invoice rows. Robustly idempotent, no orphaned entries.
  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  await db
    .delete(journalEntries)
    .where(and(eq(journalEntries.orgId, ORG), gte(journalEntries.date, curMonthStart)));
  await db
    .delete(expenses)
    .where(and(eq(expenses.orgId, ORG), like(expenses.reference, "CUR-DEMO%")));
  await db
    .delete(invoices)
    .where(and(eq(invoices.orgId, ORG), like(invoices.number, "DEMO-REV-%")));

  const bankId = await getAccountByCode(ORG, "1120");
  const incomeId = await getAccountByCode(ORG, "4100");
  const curDay = (day: number) => new Date(now.getFullYear(), now.getMonth(), Math.min(day, 28));
  const r2 = (v: number) => Math.round(v * 100) / 100;

  // Expenses this month (posted → Dr expense / Cr bank).
  const curExp = async (vendor: string, code: string, taxable: number, day: number) => {
    const half = r2(taxable * 0.09);
    const total = taxable + half * 2;
    const acctId = await getAccountByCode(ORG, code);
    const [row] = await db
      .insert(expenses)
      .values({
        orgId: ORG,
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
        orgId: ORG,
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
        orgId: ORG,
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
        orgId: ORG,
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
    }
  };
  await curInv("DEMO-REV-0101", "Acme Corp", 180000, 4);
  await curInv("DEMO-REV-0102", "Globex Media", 120000, 8);

  console.log(`✓ Demo data seeded (AdvertOut + Nimbus Media) for period ${PERIOD}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Demo seed failed (non-fatal):", e);
  process.exit(0);
});
