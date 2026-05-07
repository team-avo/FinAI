/**
 * Quick smoke test for the Zoho client. Runs the aggregator end-to-end
 * against live Zoho and prints the resulting top-level numbers.
 *
 * Usage: ZOHO_*=... pnpm tsx scripts/smoke-zoho.ts
 */

import { buildZohoAggregate } from "../src/lib/zoho/aggregator";

async function main() {
  const required = ["ZOHO_REFRESH_TOKEN", "ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_ORG_ID"];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`✗ Missing ${key}`);
      process.exit(1);
    }
  }

  console.log("▶ Fetching aggregate from live Zoho...\n");
  const t0 = Date.now();
  const data = await buildZohoAggregate();
  const ms = Date.now() - t0;

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  console.log(`✅ Built in ${ms}ms\n`);
  console.log(`Org: ${data.org.name} (${data.org.id})`);
  console.log(`GSTIN: ${data.org.gstin || "—"}`);
  console.log("");
  console.log("─── KPIs ─────────────────────────────────────");
  console.log(`Revenue MTD     ${fmt(data.revenue.mtd).padStart(15)}   (last month: ${fmt(data.revenue.lastMonthMtd)})`);
  console.log(`Expenses MTD    ${fmt(data.expenses.mtd).padStart(15)}   (last month: ${fmt(data.expenses.lastMonthMtd)})`);
  console.log(`Net Profit MTD  ${fmt(data.profitability.netProfitMtd).padStart(15)}   (margin ${data.profitability.grossMarginPct.toFixed(1)}%)`);
  console.log(`Outstanding     ${fmt(data.receivables.totalOutstanding).padStart(15)}   (${data.receivables.overdueCount} overdue)`);
  console.log(`Bank balance    ${fmt(data.cash.totalBalance).padStart(15)}   (${data.cash.accounts.length} accounts)`);
  console.log("");
  console.log("─── Counts ───────────────────────────────────");
  console.log(`Invoices: ${data.invoices.all.length}  (${data.invoices.createdMtd} this month)`);
  console.log(`Expenses: ${data.expensesData.all.length}`);
  console.log(`Customers: ${data.customers.all.length}`);
  console.log(`Top categories: ${data.expensesData.byCategory.length}`);
  console.log(`Top vendors: ${data.expensesData.topVendors.length}`);
  console.log(`Alerts: ${data.alerts.length}`);
  console.log("");
  console.log("─── Top Customers ────────────────────────────");
  for (const c of data.customers.topByRevenue.slice(0, 5)) {
    console.log(`  ${c.name.padEnd(32)} ${fmt(c.totalRevenue).padStart(15)}   ${c.outstanding > 0 ? "due " + fmt(c.outstanding) : ""}`);
  }
  console.log("");
  console.log("─── Top Categories ───────────────────────────");
  for (const c of data.expensesData.byCategory.slice(0, 5)) {
    console.log(`  ${c.name.padEnd(32)} ${fmt(c.amount).padStart(15)}   ${c.pctOfTotal.toFixed(1)}%`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("✗ Smoke test failed:");
  console.error(err);
  process.exit(1);
});
