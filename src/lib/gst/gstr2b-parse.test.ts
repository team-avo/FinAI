import { describe, expect, it } from "vitest";
import { parse2b, parse2bDate } from "./gstr2b-parse";

describe("parse2b — flat array", () => {
  it("normalizes loose records and tolerates field-name variants", () => {
    const out = parse2b([
      {
        ctin: "29AABCR1234A1Z5",
        inum: "INV-1",
        txval: 1000,
        camt: 90,
        samt: 90,
        iamt: 0,
        trdnm: "Acme",
        dt: "05-09-2026",
      },
      {
        supplierGstin: "27XYZAB5678C1Z2",
        invoice_number: "INV-2",
        taxable: 500,
        cgst: 0,
        sgst: 0,
        igst: 90,
      },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      supplierGstin: "29AABCR1234A1Z5",
      invoiceNumber: "INV-1",
      taxableValue: 1000,
      cgst: 90,
      sgst: 90,
      supplierName: "Acme",
    });
    expect(out[1]).toMatchObject({
      supplierGstin: "27XYZAB5678C1Z2",
      invoiceNumber: "INV-2",
      igst: 90,
    });
  });

  it("drops records missing a GSTIN or invoice number", () => {
    const out = parse2b([
      { ctin: "29AABCR1234A1Z5", txval: 1000 }, // no invoice number
      { inum: "INV-3", txval: 1000 }, // no gstin
      { ctin: "29AABCR1234A1Z5", inum: "INV-4", txval: 1000 },
    ]);
    expect(out.map((e) => e.invoiceNumber)).toEqual(["INV-4"]);
  });
});

describe("parse2b — GSTN b2b JSON", () => {
  it("sums item-level tax per invoice", () => {
    const raw = {
      data: {
        docdata: {
          b2b: [
            {
              ctin: "29AABCR1234A1Z5",
              trdnm: "Reliance Digital",
              inv: [
                {
                  inum: "INV-9001",
                  dt: "04-09-2026",
                  itms: [
                    { itm_det: { txval: 30000, camt: 2700, samt: 2700, iamt: 0 } },
                    { itm_det: { txval: 20000, camt: 1800, samt: 1800, iamt: 0 } },
                  ],
                },
              ],
            },
          ],
        },
      },
    };
    const out = parse2b(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      supplierGstin: "29AABCR1234A1Z5",
      supplierName: "Reliance Digital",
      invoiceNumber: "INV-9001",
      taxableValue: 50000,
      cgst: 4500,
      sgst: 4500,
      igst: 0,
    });
  });

  it("falls back to invoice-level tax when there are no items", () => {
    const raw = {
      b2b: [
        { ctin: "29AABCR1234A1Z5", inv: [{ inum: "INV-5", txval: 10000, camt: 900, samt: 900 }] },
      ],
    };
    const out = parse2b(raw);
    expect(out[0]).toMatchObject({
      invoiceNumber: "INV-5",
      taxableValue: 10000,
      cgst: 900,
      sgst: 900,
    });
  });

  it("returns [] for junk input", () => {
    expect(parse2b(null)).toEqual([]);
    expect(parse2b({})).toEqual([]);
    expect(parse2b("not json")).toEqual([]);
  });
});

describe("parse2bDate", () => {
  it("parses dd-mm-yyyy (GSTN) and dd/mm/yyyy", () => {
    const a = parse2bDate("05-09-2026")!;
    expect([a.getFullYear(), a.getMonth(), a.getDate()]).toEqual([2026, 8, 5]);
    const b = parse2bDate("05/09/2026")!;
    expect([b.getFullYear(), b.getMonth(), b.getDate()]).toEqual([2026, 8, 5]);
  });
  it("parses ISO dates", () => {
    expect(parse2bDate("2026-09-05")?.getFullYear()).toBe(2026);
  });
  it("returns null for empty or invalid input", () => {
    expect(parse2bDate(null)).toBeNull();
    expect(parse2bDate(undefined)).toBeNull();
    expect(parse2bDate("")).toBeNull();
    expect(parse2bDate("garbage")).toBeNull();
  });
});
