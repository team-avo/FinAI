import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expenses, gstr2bEntries } from "@/lib/db/schema";

/**
 * Supplier Trust Graph (v1).
 *
 * The by-product of GST-2B reconciliation: for every supplier we buy from, how
 * reliably do they actually file their GST? A supplier whose invoices keep
 * showing up in our books but NOT in the government's GSTR-2B is silently
 * putting our input tax credit (ITC) at risk — so we score them.
 *
 * v1 is scored from THIS org's own reconciliation history. The same shape
 * aggregates across orgs later (the real network effect) — the computation is
 * deliberately keyed on GSTIN, not on who observed it.
 *
 * We only judge a supplier on periods where a GSTR-2B was actually uploaded —
 * otherwise "not in 2B" would just mean "you haven't imported that month yet".
 */

export type SupplierRating = "reliable" | "watch" | "risky";

export interface SupplierTrust {
  gstin: string;
  name: string | null;
  invoices: number; // invoices we booked from them in evaluable periods
  filed: number; // of those, how many appeared in the 2B (they filed)
  notFiled: number; // in our books, missing from 2B → ITC at risk
  mismatched: number; // same invoice, different tax
  score: number; // 0–100 = filed / invoices
  rating: SupplierRating;
  itcAtRisk: number; // ₹ of our ITC this supplier has put at risk
  lastSeen: string | null; // most recent period we have an invoice from them (YYYY-MM)
}

export interface SupplierTrustReport {
  suppliers: SupplierTrust[];
  evaluatedPeriods: string[];
  totals: { suppliers: number; risky: number; itcAtRisk: number };
}

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function num(v: string | null | undefined) {
  return v ? parseFloat(v) : 0;
}
function key(gstin: string, invno: string) {
  return `${gstin.toUpperCase().trim()}|${invno.toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** Tolerance for "same tax" — 1% of value, min ₹1 (mirrors itc-recon). */
function tol(value: number) {
  return Math.max(1, round2(value * 0.01));
}
function rate(score: number, notFiled: number, mismatched: number): SupplierRating {
  if (score >= 90 && notFiled === 0 && mismatched === 0) return "reliable";
  if (score >= 60) return "watch";
  return "risky";
}

interface Acc {
  gstin: string;
  name: string | null;
  invoices: number;
  filed: number;
  notFiled: number;
  mismatched: number;
  itcAtRisk: number;
  lastSeen: string | null;
}

export async function computeSupplierTrust(orgId: string): Promise<SupplierTrustReport> {
  const [twoB, allExpenses] = await Promise.all([
    db.select().from(gstr2bEntries).where(eq(gstr2bEntries.orgId, orgId)),
    db.select().from(expenses).where(eq(expenses.orgId, orgId)),
  ]);

  // Only periods with an uploaded 2B are judgeable.
  const evaluable = new Set<string>(twoB.map((b) => b.period));

  // Index the government's 2B by period → invoice key, and remember each
  // GSTIN's officially-registered name.
  const twoBByPeriod = new Map<string, Map<string, (typeof twoB)[number]>>();
  const officialName = new Map<string, string>();
  for (const b of twoB) {
    let m = twoBByPeriod.get(b.period);
    if (!m) {
      m = new Map();
      twoBByPeriod.set(b.period, m);
    }
    m.set(key(b.supplierGstin, b.invoiceNumber), b);
    if (b.supplierName) officialName.set(b.supplierGstin.toUpperCase().trim(), b.supplierName);
  }

  const bySupplier = new Map<string, Acc>();

  for (const e of allExpenses) {
    if (!e.vendorGstin || !e.vendorInvoiceNumber) continue;
    const when = e.invoiceDate ?? e.date;
    if (!when) continue;
    const period = monthKey(new Date(when));
    if (!evaluable.has(period)) continue; // can't judge a month with no 2B

    const g = e.vendorGstin.toUpperCase().trim();
    let acc = bySupplier.get(g);
    if (!acc) {
      acc = { gstin: e.vendorGstin, name: null, invoices: 0, filed: 0, notFiled: 0, mismatched: 0, itcAtRisk: 0, lastSeen: null };
      bySupplier.set(g, acc);
    }
    if (!acc.name) acc.name = officialName.get(g) ?? e.vendorName ?? null;
    acc.invoices++;
    if (!acc.lastSeen || period > acc.lastSeen) acc.lastSeen = period;

    const booksTax = round2(num(e.cgst) + num(e.sgst) + num(e.igst));
    const match = twoBByPeriod.get(period)?.get(key(e.vendorGstin, e.vendorInvoiceNumber));

    if (!match) {
      acc.notFiled++;
      if (e.itcEligible) acc.itcAtRisk = round2(acc.itcAtRisk + booksTax);
      continue;
    }
    acc.filed++;
    const twoBTax = round2(num(match.cgst) + num(match.sgst) + num(match.igst));
    const taxOk = Math.abs(booksTax - twoBTax) <= tol(twoBTax);
    const taxableOk = Math.abs(num(e.amount) - num(match.taxableValue)) <= tol(num(match.taxableValue));
    if (!taxOk || !taxableOk) {
      acc.mismatched++;
      const shortfall = e.itcEligible ? Math.max(0, round2(booksTax - twoBTax)) : 0;
      acc.itcAtRisk = round2(acc.itcAtRisk + shortfall);
    }
  }

  const suppliers: SupplierTrust[] = [...bySupplier.values()].map((a) => {
    const score = a.invoices > 0 ? Math.round((a.filed / a.invoices) * 100) : 100;
    return {
      gstin: a.gstin,
      name: a.name,
      invoices: a.invoices,
      filed: a.filed,
      notFiled: a.notFiled,
      mismatched: a.mismatched,
      score,
      rating: rate(score, a.notFiled, a.mismatched),
      itcAtRisk: a.itcAtRisk,
      lastSeen: a.lastSeen,
    };
  });

  // Most dangerous first: risky, then by ITC at risk, then lowest score.
  const order: Record<SupplierRating, number> = { risky: 0, watch: 1, reliable: 2 };
  suppliers.sort(
    (x, y) => order[x.rating] - order[y.rating] || y.itcAtRisk - x.itcAtRisk || x.score - y.score,
  );

  return {
    suppliers,
    evaluatedPeriods: [...evaluable].sort(),
    totals: {
      suppliers: suppliers.length,
      risky: suppliers.filter((s) => s.rating === "risky").length,
      itcAtRisk: round2(suppliers.reduce((t, s) => t + s.itcAtRisk, 0)),
    },
  };
}
