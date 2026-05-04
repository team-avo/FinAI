/**
 * Double-entry accounting journal engine.
 *
 * Every rupee entering or leaving the system creates a balanced journal entry
 * where sum(debit) === sum(credit). This invariant is also enforced at the DB
 * level via a check constraint.
 *
 * System account codes (must exist in the org's CoA):
 *   1200 — Accounts Receivable
 *   2100 — Accounts Payable
 *   2210 — CGST Payable
 *   2220 — SGST Payable
 *   2230 — IGST Payable
 *   1510 — CGST Input Credit
 *   1520 — SGST Input Credit
 *   1530 — IGST Input Credit
 *   1120 — Bank Account
 *   4100 — Service Revenue (default; caller should pass actual income account)
 */

import { db } from "@/lib/db/client";
import { chartOfAccounts, journalEntries, journalLines } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@/lib/db/utils";

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  narration?: string;
}

export interface CreateJournalEntryInput {
  orgId: string;
  date: Date;
  sourceType: "invoice" | "payment" | "expense" | "bill" | "manual" | "opening_balance";
  sourceId?: string;
  narration: string;
  lines: JournalLineInput[];
}

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function assertBalanced(lines: JournalLineInput[]) {
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(
      `Journal entry is unbalanced: debit ${totalDebit} ≠ credit ${totalCredit}`,
    );
  }
}

export async function createJournalEntry(input: CreateJournalEntryInput): Promise<string> {
  assertBalanced(input.lines);

  const entryId = createId();

  await db.insert(journalEntries).values({
    id: entryId,
    orgId: input.orgId,
    date: input.date,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    narration: input.narration,
  });

  await db.insert(journalLines).values(
    input.lines.map((line) => ({
      id: createId(),
      entryId,
      accountId: line.accountId,
      debit: String(round2(line.debit)),
      credit: String(round2(line.credit)),
      narration: line.narration,
    })),
  );

  return entryId;
}

/** Lookup a system account by its code in a given org. */
export async function getAccountByCode(orgId: string, code: string): Promise<string | null> {
  const rows = await db
    .select({ id: chartOfAccounts.id })
    .from(chartOfAccounts)
    .where(and(eq(chartOfAccounts.orgId, orgId), eq(chartOfAccounts.code, code)))
    .limit(1);
  return rows[0]?.id ?? null;
}

// ── Convenience entry-point helpers ────────────────────────────────────────

export interface InvoicePostingInput {
  orgId: string;
  invoiceId: string;
  date: Date;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  contactName: string;
  incomeAccountId: string;
}

/** Post an invoice: Dr Accounts Receivable, Cr Revenue + Tax Liabilities */
export async function postInvoice(input: InvoicePostingInput): Promise<string> {
  const [arId, cgstId, sgstId, igstId] = await Promise.all([
    getAccountByCode(input.orgId, "1200"),
    getAccountByCode(input.orgId, "2210"),
    getAccountByCode(input.orgId, "2220"),
    getAccountByCode(input.orgId, "2230"),
  ]);

  if (!arId) throw new Error("Accounts Receivable (1200) not found in CoA");

  const lines: JournalLineInput[] = [
    { accountId: arId, debit: input.total, credit: 0, narration: `AR — ${input.contactName}` },
    {
      accountId: input.incomeAccountId,
      debit: 0,
      credit: input.subtotal,
      narration: "Revenue",
    },
  ];

  if (input.cgst > 0 && cgstId) {
    lines.push({ accountId: cgstId, debit: 0, credit: input.cgst, narration: "CGST Payable" });
  }
  if (input.sgst > 0 && sgstId) {
    lines.push({ accountId: sgstId, debit: 0, credit: input.sgst, narration: "SGST Payable" });
  }
  if (input.igst > 0 && igstId) {
    lines.push({ accountId: igstId, debit: 0, credit: input.igst, narration: "IGST Payable" });
  }

  return createJournalEntry({
    orgId: input.orgId,
    date: input.date,
    sourceType: "invoice",
    sourceId: input.invoiceId,
    narration: `Invoice to ${input.contactName}`,
    lines,
  });
}

export interface PaymentPostingInput {
  orgId: string;
  paymentId: string;
  date: Date;
  amount: number;
  contactName: string;
  bankAccountId?: string;
}

/** Post a customer payment receipt: Dr Bank, Cr Accounts Receivable */
export async function postPaymentReceipt(input: PaymentPostingInput): Promise<string> {
  const [bankId, arId] = await Promise.all([
    input.bankAccountId ?? getAccountByCode(input.orgId, "1120"),
    getAccountByCode(input.orgId, "1200"),
  ]);

  if (!bankId) throw new Error("Bank Account (1120) not found in CoA");
  if (!arId) throw new Error("Accounts Receivable (1200) not found in CoA");

  return createJournalEntry({
    orgId: input.orgId,
    date: input.date,
    sourceType: "payment",
    sourceId: input.paymentId,
    narration: `Payment received from ${input.contactName}`,
    lines: [
      { accountId: bankId, debit: input.amount, credit: 0 },
      { accountId: arId, debit: 0, credit: input.amount },
    ],
  });
}

export interface ExpensePostingInput {
  orgId: string;
  expenseId: string;
  date: Date;
  amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  expenseAccountId: string;
  description: string;
  bankAccountId?: string;
}

/** Post an expense: Dr Expense + Input Tax Credits, Cr Bank (or AP) */
export async function postExpense(input: ExpensePostingInput): Promise<string> {
  const [bankId, cgstInId, sgstInId, igstInId] = await Promise.all([
    input.bankAccountId ?? getAccountByCode(input.orgId, "1120"),
    getAccountByCode(input.orgId, "1510"),
    getAccountByCode(input.orgId, "1520"),
    getAccountByCode(input.orgId, "1530"),
  ]);

  if (!bankId) throw new Error("Bank Account (1120) not found in CoA");

  const lines: JournalLineInput[] = [
    {
      accountId: input.expenseAccountId,
      debit: input.amount,
      credit: 0,
      narration: input.description,
    },
  ];

  if (input.cgst > 0 && cgstInId) {
    lines.push({ accountId: cgstInId, debit: input.cgst, credit: 0, narration: "CGST ITC" });
  }
  if (input.sgst > 0 && sgstInId) {
    lines.push({ accountId: sgstInId, debit: input.sgst, credit: 0, narration: "SGST ITC" });
  }
  if (input.igst > 0 && igstInId) {
    lines.push({ accountId: igstInId, debit: input.igst, credit: 0, narration: "IGST ITC" });
  }

  lines.push({ accountId: bankId, debit: 0, credit: input.total, narration: "Bank" });

  return createJournalEntry({
    orgId: input.orgId,
    date: input.date,
    sourceType: "expense",
    sourceId: input.expenseId,
    narration: input.description,
    lines,
  });
}
