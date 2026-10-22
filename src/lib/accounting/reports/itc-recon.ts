import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expenses, gstr2bEntries } from "@/lib/db/schema";

/**
 * GSTR-2B ↔ purchase-register reconciliation (the P2 ITC-recovery core).
 *
 * For a period, match the business's recorded purchases against the invoices
 * the government shows in GSTR-2B. Classify each and surface the money:
 *  - matched            — safe to claim
 *  - mismatch           — same invoice, different values → fix with the supplier
 *  - in_books_not_2b    — recorded, but the supplier hasn't filed → ITC AT RISK
 *  - in_2b_not_books    — in 2B but not recorded → a purchase to add
 * "needsDetail" = recorded purchases carrying GST but missing GSTIN/invoice,
 * so their credit can't be proven against 2B.
 */

export type ReconStatus = "matched" | "mismatch" | "in_books_not_2b" | "in_2b_not_books";

export interface ReconLine {
  bookExpenseId?: string;
  gstin: string;
  invoiceNumber: string;
  vendorName?: string | null;
  booksTaxable?: number;
  twoBTaxable?: number;
  booksTax?: number;
  twoBTax?: number;
  status: ReconStatus;
  itcAtRisk: number;
}

export interface ItcReconReport {
  period: string;
  hasData: boolean;
  counts: { matched: number; mismatch: number; inBooksNot2b: number; in2bNotBooks: number; needsDetail: number };
  itc: { claimable: number; atRisk: number; mismatch: number; needsDetail: number };
  atRiskLines: ReconLine[];
  mismatchLines: ReconLine[];
  missingInBooks: ReconLine[];
}

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function n(v: string | null | undefined) {
  return v ? parseFloat(v) : 0;
}
function key(gstin: string, invno: string) {
  return `${gstin.toUpperCase().trim()}|${invno.toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function tol(value: number) {
  return Math.max(1, round2(value * 0.01));
}

export async function reconcileItc(orgId: string, period: string): Promise<ItcReconReport> {
  const [twoB, allExpenses] = await Promise.all([
    db.select().from(gstr2bEntries).where(and(eq(gstr2bEntries.orgId, orgId), eq(gstr2bEntries.period, period))),
    db.select().from(expenses).where(eq(expenses.orgId, orgId)),
  ]);

  // Purchases that fall in this period (by invoice date, else booking date).
  const periodExpenses = allExpenses.filter((e) => {
    const d = e.invoiceDate ?? e.date;
    return d ? monthKey(new Date(d)) === period : false;
  });

  const counts = { matched: 0, mismatch: 0, inBooksNot2b: 0, in2bNotBooks: 0, needsDetail: 0 };
  const itc = { claimable: 0, atRisk: 0, mismatch: 0, needsDetail: 0 };
  const atRiskLines: ReconLine[] = [];
  const mismatchLines: ReconLine[] = [];

  // Index 2B by key; mark consumed as we match.
  const twoBByKey = new Map<string, (typeof twoB)[number]>();
  for (const b of twoB) twoBByKey.set(key(b.supplierGstin, b.invoiceNumber), b);
  const consumed = new Set<string>();

  for (const e of periodExpenses) {
    const booksTax = round2(n(e.cgst) + n(e.sgst) + n(e.igst));
    // Can we even reconcile this one?
    if (!e.vendorGstin || !e.vendorInvoiceNumber) {
      if (booksTax > 0 && e.itcEligible) {
        counts.needsDetail++;
        itc.needsDetail = round2(itc.needsDetail + booksTax);
      }
      continue;
    }

    const k = key(e.vendorGstin, e.vendorInvoiceNumber);
    const match = twoBByKey.get(k);
    const booksTaxable = n(e.amount);

    if (!match) {
      counts.inBooksNot2b++;
      const risk = e.itcEligible ? booksTax : 0;
      itc.atRisk = round2(itc.atRisk + risk);
      atRiskLines.push({
        bookExpenseId: e.id,
        gstin: e.vendorGstin,
        invoiceNumber: e.vendorInvoiceNumber,
        vendorName: e.vendorName,
        booksTaxable,
        booksTax,
        status: "in_books_not_2b",
        itcAtRisk: round2(risk),
      });
      continue;
    }

    consumed.add(k);
    const twoBTax = round2(n(match.cgst) + n(match.sgst) + n(match.igst));
    const twoBTaxable = n(match.taxableValue);
    const taxableOk = Math.abs(booksTaxable - twoBTaxable) <= tol(twoBTaxable);
    const taxOk = Math.abs(booksTax - twoBTax) <= tol(twoBTax);

    if (taxableOk && taxOk) {
      counts.matched++;
      if (e.itcEligible) itc.claimable = round2(itc.claimable + Math.min(booksTax, twoBTax));
    } else {
      counts.mismatch++;
      // If 2B shows less tax than booked, the shortfall is at risk.
      const shortfall = e.itcEligible ? Math.max(0, round2(booksTax - twoBTax)) : 0;
      itc.mismatch = round2(itc.mismatch + shortfall);
      if (e.itcEligible) itc.claimable = round2(itc.claimable + Math.min(booksTax, twoBTax));
      mismatchLines.push({
        bookExpenseId: e.id,
        gstin: e.vendorGstin,
        invoiceNumber: e.vendorInvoiceNumber,
        vendorName: e.vendorName,
        booksTaxable,
        twoBTaxable,
        booksTax,
        twoBTax,
        status: "mismatch",
        itcAtRisk: round2(shortfall),
      });
    }
  }

  // 2B invoices never matched → purchases missing from the books.
  const missingInBooks: ReconLine[] = [];
  for (const b of twoB) {
    const k = key(b.supplierGstin, b.invoiceNumber);
    if (consumed.has(k)) continue;
    counts.in2bNotBooks++;
    missingInBooks.push({
      gstin: b.supplierGstin,
      invoiceNumber: b.invoiceNumber,
      vendorName: b.supplierName,
      twoBTaxable: n(b.taxableValue),
      twoBTax: round2(n(b.cgst) + n(b.sgst) + n(b.igst)),
      status: "in_2b_not_books",
      itcAtRisk: 0,
    });
  }

  return {
    period,
    hasData: twoB.length > 0,
    counts,
    itc,
    atRiskLines: atRiskLines.sort((a, b) => b.itcAtRisk - a.itcAtRisk),
    mismatchLines,
    missingInBooks,
  };
}

/** Total ITC at risk for a period (at-risk + mismatch shortfall + unverifiable). */
export async function itcAtRisk(orgId: string, period: string): Promise<number> {
  const r = await reconcileItc(orgId, period);
  return round2(r.itc.atRisk + r.itc.mismatch + r.itc.needsDetail);
}
