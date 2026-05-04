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
