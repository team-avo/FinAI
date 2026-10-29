/**
 * Populate the materialised Trust Graph aggregate (supplier_network_stats).
 * Run in post-build so a fresh deploy has it, and daily via the nudges cron.
 * Non-fatal: a failure here must never block a deploy.
 */
import { rebuildSupplierNetworkStats } from "@/lib/accounting/reports/supplier-trust";

rebuildSupplierNetworkStats()
  .then((n) => {
    console.log(`✓ Trust Graph: ${n} network-verified supplier(s) materialised`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("Trust Graph rebuild failed (non-fatal):", e);
    process.exit(0);
  });
