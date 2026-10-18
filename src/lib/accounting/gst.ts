/**
 * India GST calculator.
 *
 * Rules:
 * - Intrastate sale (seller and buyer in same state): CGST + SGST, each = rate / 2
 * - Interstate sale (different states) or export: IGST = full rate
 * - State code is the first 2 digits of a GSTIN (e.g. "29" for Karnataka)
 */

export interface GSTBreakdown {
  taxableAmount: number;
  gstRate: number;
  isInterstate: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  total: number;
}

export interface LineGSTBreakdown {
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export function getStateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  return gstin.substring(0, 2);
}

export function isInterstateSale(
  sellerGstin: string | null | undefined,
  buyerGstin: string | null | undefined,
): boolean {
  const sellerState = getStateCodeFromGstin(sellerGstin);
  const buyerState = getStateCodeFromGstin(buyerGstin);
  // If either GSTIN is missing, default to intrastate (conservative — apply CGST+SGST)
  if (!sellerState || !buyerState) return false;
  return sellerState !== buyerState;
}

export function calculateGST(
  taxableAmount: number,
  gstRate: number,
  interstate: boolean,
): GSTBreakdown {
  const totalTax = round2(taxableAmount * (gstRate / 100));

  if (interstate) {
    return {
      taxableAmount,
      gstRate,
      isInterstate: true,
      cgst: 0,
      sgst: 0,
      igst: totalTax,
      totalTax,
      total: taxableAmount + totalTax,
    };
  }

  const halfTax = round2(totalTax / 2);
  // CGST + SGST must sum exactly to totalTax; handle rounding by giving remainder to SGST
  const cgst = halfTax;
  const sgst = round2(totalTax - cgst);

  return {
    taxableAmount,
    gstRate,
    isInterstate: false,
    cgst,
    sgst,
    igst: 0,
    totalTax,
    total: taxableAmount + totalTax,
  };
}

export function calculateLineGST(
  quantity: number,
  rate: number,
  gstRate: number,
  interstate: boolean,
): LineGSTBreakdown {
  const lineBase = round2(quantity * rate);
  const gst = calculateGST(lineBase, gstRate, interstate);
  const halfRate = round2(gstRate / 2);

  return {
    cgstRate: interstate ? 0 : halfRate,
    sgstRate: interstate ? 0 : round2(gstRate - halfRate),
    igstRate: interstate ? gstRate : 0,
    cgstAmount: gst.cgst,
    sgstAmount: gst.sgst,
    igstAmount: gst.igst,
    taxAmount: gst.totalTax,
    lineTotal: gst.total,
  };
}

export function summariseInvoiceTax(
  lines: Array<{
    quantity: number;
    rate: number;
    gstRate: number;
  }>,
  interstate: boolean,
): {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  total: number;
} {
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  for (const line of lines) {
    const { taxableAmount, cgst: c, sgst: s, igst: i } = calculateGST(
      round2(line.quantity * line.rate),
      line.gstRate,
      interstate,
    );
    subtotal += taxableAmount;
    cgst += c;
    sgst += s;
    igst += i;
  }

  return {
    subtotal: round2(subtotal),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    totalTax: round2(cgst + sgst + igst),
    total: round2(subtotal + cgst + sgst + igst),
  };
}

/** Standard GST slabs (%) recognised when validating a proposed tax amount. */
export const GST_SLABS = [0, 5, 12, 18, 28] as const;

export interface ExpenseGstProposal {
  amount: number; // taxable base, before tax
  cgst: number;
  sgst: number;
  igst: number;
}

export interface NormalizedExpenseGst {
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  gstRate: number;
  isInterstate: boolean;
}

/**
 * Deterministically validate and recompute an expense's GST split.
 *
 * The LLM/OCR proposes absolute CGST/SGST/IGST amounts; we never post those
 * directly. We infer the tax type from which buckets are non-zero, snap the
 * implied rate to a standard GST slab, and recompute the split in code so the
 * posted figures are correct by construction. Throws when the proposal cannot
 * be reconciled to a valid slab/structure — the caller surfaces that for the
 * user / a reviewer instead of writing wrong numbers to the ledger.
 */
export function normalizeExpenseGst(p: ExpenseGstProposal): NormalizedExpenseGst {
  const amount = round2(p.amount);
  const cgst = round2(Math.max(0, p.cgst));
  const sgst = round2(Math.max(0, p.sgst));
  const igst = round2(Math.max(0, p.igst));
  const taxProposed = round2(cgst + sgst + igst);

  if (!(amount > 0)) {
    throw new Error("Expense base amount must be greater than zero.");
  }

  const hasIntra = cgst > 0 || sgst > 0;
  const hasInter = igst > 0;
  if (hasIntra && hasInter) {
    throw new Error(
      "GST is ambiguous: an expense can't carry both CGST/SGST and IGST. Confirm whether this was an in-state or inter-state purchase.",
    );
  }
  if (hasIntra && Math.abs(cgst - sgst) > taxTolerance(amount)) {
    throw new Error(
      `CGST (₹${cgst}) and SGST (₹${sgst}) must be equal for an in-state purchase. Please recheck the tax on the bill.`,
    );
  }

  const isInterstate = hasInter;
  const slab = matchSlab(amount, taxProposed);
  if (slab === null) {
    const impliedRate = taxProposed === 0 ? 0 : round2((taxProposed / amount) * 100);
    throw new Error(
      `Tax of ₹${taxProposed} on ₹${amount} implies a ${impliedRate}% rate, which isn't a standard GST slab (0/5/12/18/28%). Please confirm the amount and tax.`,
    );
  }

  const g = calculateGST(amount, slab, isInterstate);
  return {
    cgst: g.cgst,
    sgst: g.sgst,
    igst: g.igst,
    taxAmount: g.totalTax,
    gstRate: slab,
    isInterstate,
  };
}

/** Rounding slack allowed when matching a proposed tax to a slab: ₹1 or 0.5%. */
function taxTolerance(amount: number): number {
  return Math.max(1, round2(amount * 0.005));
}

/** Pick the slab whose computed tax is closest to the proposal, within slack. */
function matchSlab(amount: number, taxProposed: number): number | null {
  let best: number | null = null;
  let bestDiff = Infinity;
  for (const s of GST_SLABS) {
    const diff = Math.abs(round2(amount * (s / 100)) - taxProposed);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best !== null && bestDiff <= taxTolerance(amount) ? best : null;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** Human-readable GST label for display */
export function gstLabel(rate: number, interstate: boolean): string {
  if (rate === 0) return "GST 0%";
  if (interstate) return `IGST ${rate}%`;
  const half = rate / 2;
  return `CGST ${half}% + SGST ${half}%`;
}

/** India state codes */
export const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};
