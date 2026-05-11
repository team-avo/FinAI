/**
 * Quick smoke test for the Zoho client. Runs the aggregator end-to-end
 * against the FIRST `zoho_connections` row in the DB and prints the resulting
 * top-level numbers.
 *
 * Usage: DATABASE_URL=... ZOHO_CLIENT_ID=... ZOHO_CLIENT_SECRET=... \
 *        pnpm tsx scripts/smoke-zoho.ts
 *
 * (After v2 the script needs an actual connected user, since refresh tokens
 *  live in the DB, not env vars. Run the OAuth flow at least once first.)
 */

import { db } from "../src/lib/db/client";
import { zohoConnections } from "../src/lib/db/schema";
import { buildZohoAggregate } from "../src/lib/zoho/aggregator";

async function main() {
  const required = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "DATABASE_URL"];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`✗ Missing ${key}`);
      process.exit(1);
    }
  }

  const [conn] = await db.select().from(zohoConnections).limit(1);
  if (!conn) {
    console.error("✗ No Zoho connections in DB. Run the OAuth flow at /api/zoho/connect first.");
    process.exit(1);
  }

  console.log(`▶ Using connection for zoho_org=${conn.zohoOrgId} (${conn.zohoOrgName ?? "—"})\n`);
  const t0 = Date.now();
  const data = await buildZohoAggregate(conn);
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
}

main().catch((err) => {
  console.error("✗ Smoke test failed:");
  console.error(err);
  process.exit(1);
});
