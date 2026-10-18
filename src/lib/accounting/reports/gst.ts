import { db } from "@/lib/db/client";
import {
  chartOfAccounts,
  invoiceLines,
  invoices,
  journalEntries,
  journalLines,
} from "@/lib/db/schema";
import { and, eq, gte, inArray, lte, notInArray, sql } from "drizzle-orm";

/**
 * GST return helpers.
 *
 * GSTR-1 (outward supplies) is built from issued invoices + their lines.
 * GSTR-3B (monthly summary) nets the output tax on sales against the Input
 * Tax Credit actually booked to the GST-input accounts (1510/1520/1530).
 *
 * These produce a clean, file-ready summary — not the raw GSTN upload JSON,
 * which has its own section codes and is a later refinement.
 */

// Invoice statuses that represent a real outward supply (exclude drafts/voids).
const ISSUED_STATUSES_EXCLUDED = ["draft", "cancelled"] as const;

// Chart-of-accounts codes for Input Tax Credit, by head.
const ITC_CODES = { cgst: "1510", sgst: "1520", igst: "1530" } as const;

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function num(v: string | null | undefined) {
  return v ? parseFloat(v) : 0;
}

export interface Gstr1Line {
  invoiceNo: string;
  date: string;
  customer: string;
  gstin: string | null;
  placeOfSupply: "intrastate" | "interstate";
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface Gstr1HsnRow {
  hsn: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface Gstr1Report {
  from: Date;
  to: Date;
  b2b: Gstr1Line[];
  b2c: Gstr1Line[];
  hsnSummary: Gstr1HsnRow[];
  totals: {
    invoiceCount: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
}

export async function getGSTR1(orgId: string, from: Date, to: Date): Promise<Gstr1Report> {
  const rows = await db
    .select({
      number: invoices.number,
      issueDate: invoices.issueDate,
      contactName: invoices.contactName,
      contactGstin: invoices.contactGstin,
      isInterstate: invoices.isInterstate,
      subtotal: invoices.subtotal,
      cgstAmount: invoices.cgstAmount,
      sgstAmount: invoices.sgstAmount,
      igstAmount: invoices.igstAmount,
      total: invoices.total,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.orgId, orgId),
        gte(invoices.issueDate, from),
        lte(invoices.issueDate, to),
        notInArray(invoices.status, [...ISSUED_STATUSES_EXCLUDED]),
      ),
    )
    .orderBy(invoices.issueDate);

  const b2b: Gstr1Line[] = [];
  const b2c: Gstr1Line[] = [];
  const totals = { invoiceCount: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };

  for (const r of rows) {
    const gstin = r.contactGstin?.trim() || null;
    const line: Gstr1Line = {
      invoiceNo: r.number,
      date: r.issueDate.toISOString().slice(0, 10),
      customer: r.contactName,
      gstin,
      placeOfSupply: r.isInterstate ? "interstate" : "intrastate",
      taxableValue: num(r.subtotal),
      cgst: num(r.cgstAmount),
      sgst: num(r.sgstAmount),
      igst: num(r.igstAmount),
      total: num(r.total),
    };
    (gstin ? b2b : b2c).push(line);
    totals.invoiceCount += 1;
    totals.taxableValue = round2(totals.taxableValue + line.taxableValue);
    totals.cgst = round2(totals.cgst + line.cgst);
    totals.sgst = round2(totals.sgst + line.sgst);
    totals.igst = round2(totals.igst + line.igst);
    totals.total = round2(totals.total + line.total);
  }

  // HSN summary: per-head tax derived deterministically from each line's rates.
  const lineRows = await db
    .select({
      hsnCode: invoiceLines.hsnCode,
      // `amount` is the tax-inclusive line total, so the taxable base is
      // quantity * rate (matches calculateLineGST's lineBase).
      quantity: invoiceLines.quantity,
      rate: invoiceLines.rate,
      cgstRate: invoiceLines.cgstRate,
      sgstRate: invoiceLines.sgstRate,
      igstRate: invoiceLines.igstRate,
    })
    .from(invoiceLines)
    .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
    .where(
      and(
        eq(invoices.orgId, orgId),
        gte(invoices.issueDate, from),
        lte(invoices.issueDate, to),
        notInArray(invoices.status, [...ISSUED_STATUSES_EXCLUDED]),
      ),
    );

  const hsnMap = new Map<string, Gstr1HsnRow>();
  for (const l of lineRows) {
    const hsn = l.hsnCode?.trim() || "(none)";
    const taxable = round2(num(l.quantity) * num(l.rate));
    const row = hsnMap.get(hsn) ?? { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxableValue = round2(row.taxableValue + taxable);
    row.cgst = round2(row.cgst + taxable * (num(l.cgstRate) / 100));
    row.sgst = round2(row.sgst + taxable * (num(l.sgstRate) / 100));
    row.igst = round2(row.igst + taxable * (num(l.igstRate) / 100));
    hsnMap.set(hsn, row);
  }

  return {
    from,
    to,
    b2b,
    b2c,
    hsnSummary: Array.from(hsnMap.values()).sort((a, b) => a.hsn.localeCompare(b.hsn)),
    totals,
  };
}

export interface Gstr3bReport {
  from: Date;
  to: Date;
  outward: { taxableValue: number; cgst: number; sgst: number; igst: number; totalTax: number };
  itc: { cgst: number; sgst: number; igst: number; total: number };
  netTaxPayable: { cgst: number; sgst: number; igst: number; total: number };
}

export async function getGSTR3B(orgId: string, from: Date, to: Date): Promise<Gstr3bReport> {
  // Outward tax liability — from issued invoices.
  const [out] = await db
    .select({
      taxableValue: sql<string>`COALESCE(SUM(${invoices.subtotal}::numeric), 0)`,
      cgst: sql<string>`COALESCE(SUM(${invoices.cgstAmount}::numeric), 0)`,
      sgst: sql<string>`COALESCE(SUM(${invoices.sgstAmount}::numeric), 0)`,
      igst: sql<string>`COALESCE(SUM(${invoices.igstAmount}::numeric), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.orgId, orgId),
        gte(invoices.issueDate, from),
        lte(invoices.issueDate, to),
        notInArray(invoices.status, [...ISSUED_STATUSES_EXCLUDED]),
      ),
    );

  const outward = {
    taxableValue: round2(num(out?.taxableValue)),
    cgst: round2(num(out?.cgst)),
    sgst: round2(num(out?.sgst)),
    igst: round2(num(out?.igst)),
    totalTax: round2(num(out?.cgst) + num(out?.sgst) + num(out?.igst)),
  };

  // ITC — net debit booked to the GST-input accounts in the period.
  const itcRows = await db
    .select({
      code: chartOfAccounts.code,
      debit: sql<string>`COALESCE(SUM(${journalLines.debit}::numeric), 0)`,
      credit: sql<string>`COALESCE(SUM(${journalLines.credit}::numeric), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(chartOfAccounts, eq(journalLines.accountId, chartOfAccounts.id))
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        gte(journalEntries.date, from),
        lte(journalEntries.date, to),
        inArray(chartOfAccounts.code, [ITC_CODES.cgst, ITC_CODES.sgst, ITC_CODES.igst]),
      ),
    )
    .groupBy(chartOfAccounts.code);

  const itc = { cgst: 0, sgst: 0, igst: 0, total: 0 };
  for (const r of itcRows) {
    const net = round2(num(r.debit) - num(r.credit));
    if (r.code === ITC_CODES.cgst) itc.cgst = net;
    else if (r.code === ITC_CODES.sgst) itc.sgst = net;
    else if (r.code === ITC_CODES.igst) itc.igst = net;
  }
  itc.total = round2(itc.cgst + itc.sgst + itc.igst);

  const payHead = (output: number, credit: number) => round2(Math.max(0, output - credit));
  const netTaxPayable = {
    cgst: payHead(outward.cgst, itc.cgst),
    sgst: payHead(outward.sgst, itc.sgst),
    igst: payHead(outward.igst, itc.igst),
    total: 0,
  };
  netTaxPayable.total = round2(netTaxPayable.cgst + netTaxPayable.sgst + netTaxPayable.igst);

  return { from, to, outward, itc, netTaxPayable };
}
