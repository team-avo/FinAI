import { execSync } from "node:child_process";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { computeMoneyCheck } from "@/lib/ai/money-check";
import { db } from "@/lib/db/client";
import { expenses, trustGraphMeta } from "@/lib/db/schema";
import { forecastCash } from "./cash-forecast";
import { reconcileItc } from "./itc-recon";
import {
  computeSupplierTrust,
  getSupplierNetworkStats,
  rebuildSupplierNetworkStats,
  rebuildSupplierNetworkStatsIncremental,
} from "./supplier-trust";

/**
 * Integration tests over the committed demo seed. They exercise the real
 * reconciliation / Trust Graph / forecast / money-check logic against Postgres,
 * so they only run when a database is configured (locally). In CI without
 * DATABASE_URL the whole suite is skipped.
 */
const ORG = "advertout";
const now = new Date();
const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const PERIOD = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, "0")}`;

describe.skipIf(!process.env.DATABASE_URL)("demo data integration", () => {
  beforeAll(async () => {
    // Reproduce the exact demo state, then materialise the Trust Graph.
    execSync("pnpm db:seed:demo", { stdio: "ignore" });
    await rebuildSupplierNetworkStats();
  }, 60_000);

  it("reconciliation finds ₹14,400 of ITC at risk", async () => {
    const r = await reconcileItc(ORG, PERIOD);
    expect(r.hasData).toBe(true);
    const totalAtRisk = r.itc.atRisk + r.itc.mismatch + r.itc.needsDetail;
    expect(totalAtRisk).toBeCloseTo(14400, 2);
    expect(r.counts.inBooksNot2b).toBe(3); // Metro, Stationery, Courier
    expect(r.counts.matched).toBe(2); // Reliance, Chai
    expect(r.counts.mismatch).toBe(1); // CloudHost
  });

  it("supplier trust ranks risky suppliers and totals the ITC at risk", async () => {
    const t = await computeSupplierTrust(ORG);
    expect(t.totals.suppliers).toBe(6);
    expect(t.totals.risky).toBe(3);
    expect(t.totals.itcAtRisk).toBeCloseTo(14400, 2);

    const metro = t.suppliers.find((s) => s.gstin === "29AABCM3456D1Z1");
    expect(metro?.rating).toBe("risky");

    const reliance = t.suppliers.find((s) => s.gstin === "29AABCR1234A1Z5");
    expect(reliance?.rating).toBe("reliable");
  });

  it("the cross-business network signal is present for ≥2-business suppliers", async () => {
    const t = await computeSupplierTrust(ORG);
    expect(t.totals.networkVerified).toBe(3);

    const metro = t.suppliers.find((s) => s.gstin === "29AABCM3456D1Z1");
    expect(metro?.network).toMatchObject({ orgs: 2, score: 0 });

    const reliance = t.suppliers.find((s) => s.gstin === "29AABCR1234A1Z5");
    expect(reliance?.network).toMatchObject({ orgs: 2, score: 100 });

    // A supplier only this org has seen must NOT carry a network signal.
    const courier = t.suppliers.find((s) => s.gstin === "29AAFCC8899F1Z3");
    expect(courier?.network).toBeUndefined();
  });

  it("the cash forecast runs short (sandbox bank + overdue receivables)", async () => {
    const f = await forecastCash(ORG);
    expect(f.connected).toBe(true);
    expect(f.willGoNegative).toBe(true);
    expect(f.startBalance).toBeCloseTo(92000, 2);
  });

  it("the money check surfaces the receivables, ITC and forecast items", async () => {
    const m = await computeMoneyCheck(ORG, now);
    const kinds = m.items.filter((i) => i.live).map((i) => i.kind);
    expect(kinds).toContain("receivables");
    expect(kinds).toContain("itc");
    expect(kinds).toContain("forecast");

    const itc = m.items.find((i) => i.kind === "itc");
    expect(itc?.title).toContain("14,400");
  });

  it("incremental rebuild is a no-op when nothing changed and preserves the table", async () => {
    // beforeAll ran a FULL rebuild, which sets the watermark to after the seed.
    const before = await getSupplierNetworkStats();

    const recomputed = await rebuildSupplierNetworkStatsIncremental();
    // 0 (not -1) confirms the watermark was written by the full rebuild, and
    // that nothing in the seed is newer than it.
    expect(recomputed).toBe(0);

    const after = await getSupplierNetworkStats();
    expect(after.size).toBe(before.size);
    for (const [gstin, s] of before) {
      expect(after.get(gstin)).toMatchObject({
        orgs: s.orgs,
        score: s.score,
        invoices: s.invoices,
        filed: s.filed,
      });
    }
  });

  it("falls back to a full rebuild when there is no watermark", async () => {
    const full = await getSupplierNetworkStats();

    // Clear the watermark to simulate a never-built graph, then run incremental:
    // it must fall back to a full rebuild (-1) and reproduce the same table.
    await db.delete(trustGraphMeta);
    const result = await rebuildSupplierNetworkStatsIncremental();
    expect(result).toBe(-1);

    const rebuilt = await getSupplierNetworkStats();
    expect(rebuilt.size).toBe(full.size);
    for (const [gstin, s] of full) {
      expect(rebuilt.get(gstin)).toMatchObject({ orgs: s.orgs, score: s.score });
    }
  });

  it("incrementally recomputes only the GSTIN a new invoice touches", async () => {
    const METRO = "29AABCM3456D1Z1"; // a ≥2-business supplier in the seed
    const before = await getSupplierNetworkStats();
    const metroBefore = before.get(METRO);
    expect(metroBefore).toBeDefined();

    // Book one more Metro invoice for `advertout`, dated in an evaluable period
    // (the last complete month, which has an uploaded 2B in the seed).
    const invDate = new Date(lm.getFullYear(), lm.getMonth(), 15);
    const [inserted] = await db
      .insert(expenses)
      .values({
        orgId: ORG,
        date: invDate,
        vendorName: "Metro Cash & Carry",
        vendorGstin: METRO,
        vendorInvoiceNumber: "TEST-INCR-0001",
        invoiceDate: invDate,
        amount: "1000",
        taxAmount: "180",
        totalAmount: "1180",
        cgst: "90",
        sgst: "90",
        igst: "0",
        itcEligible: true,
      })
      .returning({ id: expenses.id });

    try {
      const touched = await rebuildSupplierNetworkStatsIncremental();
      expect(touched).toBeGreaterThanOrEqual(1); // recomputed, not a full rescan

      const after = await getSupplierNetworkStats();
      // Metro gained exactly the one new invoice; still seen by 2 businesses.
      expect(after.get(METRO)?.invoices).toBe((metroBefore?.invoices ?? 0) + 1);
      expect(after.get(METRO)?.orgs).toBe(metroBefore?.orgs);
      // Every other supplier's row is untouched.
      for (const [gstin, s] of before) {
        if (gstin === METRO) continue;
        expect(after.get(gstin)).toMatchObject({
          orgs: s.orgs,
          invoices: s.invoices,
          score: s.score,
        });
      }
    } finally {
      // Restore the seed baseline so re-runs stay deterministic.
      await db.delete(expenses).where(eq(expenses.id, inserted.id));
      await rebuildSupplierNetworkStats();
    }
  });
});
