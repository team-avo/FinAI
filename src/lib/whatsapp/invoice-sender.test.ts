import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isInvoiceSender, normalizePhone, parseDecisionText } from "./invoice-sender";

describe("normalizePhone", () => {
  it("strips spaces, plus signs and punctuation", () => {
    expect(normalizePhone("+91 98123-45678")).toBe("919812345678");
    expect(normalizePhone("919812345678")).toBe("919812345678");
  });
});

describe("isInvoiceSender (the billing gate)", () => {
  const original = process.env.WHATSAPP_INVOICE_SENDERS;
  beforeEach(() => {
    process.env.WHATSAPP_INVOICE_SENDERS = "+91 98123 45678, 919900011122";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.WHATSAPP_INVOICE_SENDERS;
    else process.env.WHATSAPP_INVOICE_SENDERS = original;
  });

  it("allows a listed number regardless of formatting", () => {
    expect(isInvoiceSender("919812345678")).toBe(true); // webhook format (no +)
    expect(isInvoiceSender("+91-98123-45678")).toBe(true); // punctuated
    expect(isInvoiceSender("919900011122")).toBe(true); // second entry
  });

  it("rejects a number that is not on the list", () => {
    expect(isInvoiceSender("919999999999")).toBe(false);
  });

  it("denies everyone when the env var is empty or unset (safe default)", () => {
    process.env.WHATSAPP_INVOICE_SENDERS = "";
    expect(isInvoiceSender("919812345678")).toBe(false);
    delete process.env.WHATSAPP_INVOICE_SENDERS;
    expect(isInvoiceSender("919812345678")).toBe(false);
  });

  it("never treats an empty sender as allowed", () => {
    expect(isInvoiceSender("")).toBe(false);
  });
});

describe("parseDecisionText", () => {
  it("reads common approvals", () => {
    for (const t of ["yes", "YES", " Approve ", "ok", "send", "confirm"]) {
      expect(parseDecisionText(t)).toBe("approve");
    }
  });
  it("reads common rejections", () => {
    for (const t of ["no", "N", "reject", "cancel", "decline"]) {
      expect(parseDecisionText(t)).toBe("reject");
    }
  });
  it("returns null for anything else (falls through to the agent)", () => {
    for (const t of ["create an invoice for Acme", "maybe", "yeah sure later", ""]) {
      expect(parseDecisionText(t)).toBeNull();
    }
  });
});
