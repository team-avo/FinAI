import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { computeMoneyCheck } from "@/lib/ai/money-check";
import { forecastCash } from "./cash-forecast";
import { reconcileItc } from "./itc-recon";
import { computeSupplierTrust, rebuildSupplierNetworkStats } from "./supplier-trust";

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
});
