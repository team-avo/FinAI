import { describe, expect, it } from "vitest";
import { formatINR } from "./utils";

describe("formatINR", () => {
  it("uses the Indian grouping system (lakh/crore)", () => {
    expect(formatINR(152500)).toContain("1,52,500");
    expect(formatINR(10000000)).toContain("1,00,00,000"); // one crore
  });
  it("prefixes the rupee symbol", () => {
    expect(formatINR(100).startsWith("₹")).toBe(true);
  });
  it("handles zero", () => {
    expect(formatINR(0)).toBe("₹0.00");
  });
});
