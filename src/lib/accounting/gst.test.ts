import { describe, expect, it } from "vitest";
import {
  calculateGST,
  calculateLineGST,
  getStateCodeFromGstin,
  isInterstateSale,
  normalizeExpenseGst,
  summariseInvoiceTax,
} from "./gst";

describe("getStateCodeFromGstin", () => {
  it("returns the first two digits", () => {
    expect(getStateCodeFromGstin("29AABCR1234A1Z5")).toBe("29");
    expect(getStateCodeFromGstin("07AAAAA0000A1Z5")).toBe("07");
  });
  it("returns null for missing/too-short input", () => {
    expect(getStateCodeFromGstin(null)).toBeNull();
    expect(getStateCodeFromGstin(undefined)).toBeNull();
    expect(getStateCodeFromGstin("2")).toBeNull();
  });
});

describe("isInterstateSale", () => {
  it("is intrastate when both GSTINs share a state code", () => {
    expect(isInterstateSale("29AABCR1234A1Z5", "29XYZAB5678C1Z2")).toBe(false);
  });
  it("is interstate when state codes differ", () => {
    expect(isInterstateSale("29AABCR1234A1Z5", "27XYZAB5678C1Z2")).toBe(true);
  });
  it("defaults to intrastate (conservative) when either GSTIN is missing", () => {
    expect(isInterstateSale("29AABCR1234A1Z5", null)).toBe(false);
    expect(isInterstateSale(null, "27XYZAB5678C1Z2")).toBe(false);
    expect(isInterstateSale(null, null)).toBe(false);
  });
});

describe("calculateGST", () => {
  it("splits intrastate tax into equal CGST + SGST", () => {
    const g = calculateGST(1000, 18, false);
    expect(g.cgst).toBe(90);
    expect(g.sgst).toBe(90);
    expect(g.igst).toBe(0);
    expect(g.totalTax).toBe(180);
    expect(g.total).toBe(1180);
  });

  it("puts the whole tax in IGST for interstate", () => {
    const g = calculateGST(1000, 18, true);
    expect(g.cgst).toBe(0);
    expect(g.sgst).toBe(0);
    expect(g.igst).toBe(180);
    expect(g.total).toBe(1180);
  });

  it("CGST + SGST always sum exactly to the total tax, even with odd rounding", () => {
    for (const [amount, rate] of [
      [1, 5],
      [101, 5],
      [333.33, 12],
      [9999.99, 18],
      [12345.67, 28],
    ] as const) {
      const g = calculateGST(amount, rate, false);
      expect(g.cgst + g.sgst).toBeCloseTo(g.totalTax, 2);
    }
  });

  it("handles the 0% slab", () => {
    const g = calculateGST(1000, 0, false);
    expect(g.totalTax).toBe(0);
    expect(g.cgst).toBe(0);
    expect(g.sgst).toBe(0);
  });
});

describe("calculateLineGST", () => {
  it("computes an intrastate line", () => {
    const l = calculateLineGST(2, 500, 18, false);
    expect(l.cgstRate).toBe(9);
    expect(l.sgstRate).toBe(9);
    expect(l.igstRate).toBe(0);
    expect(l.cgstAmount).toBe(90);
    expect(l.sgstAmount).toBe(90);
    expect(l.taxAmount).toBe(180);
    expect(l.lineTotal).toBe(1180);
  });
  it("computes an interstate line", () => {
    const l = calculateLineGST(2, 500, 18, true);
    expect(l.igstRate).toBe(18);
    expect(l.igstAmount).toBe(180);
    expect(l.cgstAmount).toBe(0);
  });
});

describe("summariseInvoiceTax", () => {
  it("sums tax across lines (intrastate)", () => {
    const s = summariseInvoiceTax(
      [
        { quantity: 1, rate: 1000, gstRate: 18 },
        { quantity: 2, rate: 500, gstRate: 12 },
      ],
      false,
    );
    expect(s.subtotal).toBe(2000);
    expect(s.cgst).toBe(150); // 90 + 60
    expect(s.sgst).toBe(150);
    expect(s.igst).toBe(0);
    expect(s.totalTax).toBe(300);
    expect(s.total).toBe(2300);
  });
});

describe("normalizeExpenseGst (AI proposes, code recomputes)", () => {
  it("accepts a valid intrastate split and recomputes it", () => {
    const r = normalizeExpenseGst({ amount: 1000, cgst: 90, sgst: 90, igst: 0 });
    expect(r.isInterstate).toBe(false);
    expect(r.gstRate).toBe(18);
    expect(r.cgst).toBe(90);
    expect(r.sgst).toBe(90);
    expect(r.igst).toBe(0);
    expect(r.taxAmount).toBe(180);
  });

  it("accepts a valid interstate split", () => {
    const r = normalizeExpenseGst({ amount: 1000, cgst: 0, sgst: 0, igst: 180 });
    expect(r.isInterstate).toBe(true);
    expect(r.gstRate).toBe(18);
    expect(r.igst).toBe(180);
  });

  it("snaps a slightly-off proposal to the nearest slab", () => {
    // ₹179 tax on ₹1000 (17.9%) is within tolerance of the 18% slab
    const r = normalizeExpenseGst({ amount: 1000, cgst: 89.5, sgst: 89.5, igst: 0 });
    expect(r.gstRate).toBe(18);
    expect(r.taxAmount).toBe(180);
  });

  it("recognises the 0% slab", () => {
    const r = normalizeExpenseGst({ amount: 1000, cgst: 0, sgst: 0, igst: 0 });
    expect(r.gstRate).toBe(0);
    expect(r.taxAmount).toBe(0);
    expect(r.isInterstate).toBe(false);
  });

  it("rejects a mix of CGST/SGST and IGST (ambiguous)", () => {
    expect(() => normalizeExpenseGst({ amount: 1000, cgst: 90, sgst: 90, igst: 180 })).toThrow();
  });

  it("rejects unequal CGST and SGST", () => {
    expect(() => normalizeExpenseGst({ amount: 1000, cgst: 90, sgst: 50, igst: 0 })).toThrow();
  });

  it("rejects a non-standard implied rate", () => {
    // ₹100 on ₹1000 = 10%, not a GST slab
    expect(() => normalizeExpenseGst({ amount: 1000, cgst: 50, sgst: 50, igst: 0 })).toThrow();
  });

  it("rejects a non-positive base amount", () => {
    expect(() => normalizeExpenseGst({ amount: 0, cgst: 0, sgst: 0, igst: 0 })).toThrow();
  });
});
